use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Condvar, Mutex};
use std::thread::{self, JoinHandle};

use rusqlite::Connection;

use super::protocol::{
    database_error, decode_row, DatabaseError, IpcExecutionResult, IpcParameters, IpcRow,
    DATABASE_ALREADY_OPEN, DATABASE_CLOSED, DATABASE_NOT_OPEN, VAULT_PATH_REJECTED,
};
use super::transaction::{self, ActiveTransaction, TransactionIdGenerator};
use super::{lifecycle, transaction::TransactionMode};

pub const APPROVED_VAULT_NAME: &str = "my-fin.sqlite";

enum DatabaseMessage {
    Open {
        app_data_dir: PathBuf,
        reply: Sender<Result<PathBuf, DatabaseError>>,
    },
    Execute {
        sql: String,
        parameters: IpcParameters,
        transaction_id: Option<String>,
        reply: Sender<Result<IpcExecutionResult, DatabaseError>>,
    },
    Query {
        sql: String,
        parameters: IpcParameters,
        transaction_id: Option<String>,
        reply: Sender<Result<Vec<IpcRow>, DatabaseError>>,
    },
    ExecuteBatch {
        sql: String,
        transaction_id: Option<String>,
        reply: Sender<Result<(), DatabaseError>>,
    },
    BeginWrite {
        reply: Sender<Result<String, DatabaseError>>,
    },
    BeginRead {
        reply: Sender<Result<String, DatabaseError>>,
    },
    Commit {
        transaction_id: String,
        reply: Sender<Result<(), DatabaseError>>,
    },
    Rollback {
        transaction_id: String,
        reply: Sender<Result<(), DatabaseError>>,
    },
    Health {
        reply: Sender<Result<(), DatabaseError>>,
    },
    Close {
        reply: Sender<Result<(), DatabaseError>>,
    },
}

pub struct DatabaseHandle {
    sender: Sender<DatabaseMessage>,
    worker: Arc<Mutex<Option<JoinHandle<()>>>>,
    lifecycle: Arc<(Mutex<HandleState>, Condvar)>,
    accepting: Arc<AtomicBool>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum HandleState {
    Open,
    Closing,
    Closed,
}

impl Clone for DatabaseHandle {
    fn clone(&self) -> Self {
        Self {
            sender: self.sender.clone(),
            worker: self.worker.clone(),
            lifecycle: self.lifecycle.clone(),
            accepting: self.accepting.clone(),
        }
    }
}

impl DatabaseHandle {
    pub fn new() -> Self {
        let (sender, receiver) = mpsc::channel();
        let worker = thread::Builder::new()
            .name("my-fin-sqlite".to_owned())
            .spawn(move || run_actor(receiver))
            .expect("SQLite actor thread must start");
        Self {
            sender,
            worker: Arc::new(Mutex::new(Some(worker))),
            lifecycle: Arc::new((Mutex::new(HandleState::Open), Condvar::new())),
            accepting: Arc::new(AtomicBool::new(true)),
        }
    }

    pub fn open(&self, app_data_dir: impl Into<PathBuf>) -> Result<PathBuf, DatabaseError> {
        self.request(|reply| DatabaseMessage::Open {
            app_data_dir: app_data_dir.into(),
            reply,
        })
    }

    pub fn execute(
        &self,
        sql: impl Into<String>,
        parameters: IpcParameters,
    ) -> Result<IpcExecutionResult, DatabaseError> {
        self.request(|reply| DatabaseMessage::Execute {
            sql: sql.into(),
            parameters,
            transaction_id: None,
            reply,
        })
    }

    pub fn execute_in_transaction(
        &self,
        sql: impl Into<String>,
        parameters: IpcParameters,
        transaction_id: impl Into<String>,
    ) -> Result<IpcExecutionResult, DatabaseError> {
        self.request(|reply| DatabaseMessage::Execute {
            sql: sql.into(),
            parameters,
            transaction_id: Some(transaction_id.into()),
            reply,
        })
    }

    pub fn query(
        &self,
        sql: impl Into<String>,
        parameters: IpcParameters,
    ) -> Result<Vec<IpcRow>, DatabaseError> {
        self.request(|reply| DatabaseMessage::Query {
            sql: sql.into(),
            parameters,
            transaction_id: None,
            reply,
        })
    }

    pub fn query_in_transaction(
        &self,
        sql: impl Into<String>,
        parameters: IpcParameters,
        transaction_id: impl Into<String>,
    ) -> Result<Vec<IpcRow>, DatabaseError> {
        self.request(|reply| DatabaseMessage::Query {
            sql: sql.into(),
            parameters,
            transaction_id: Some(transaction_id.into()),
            reply,
        })
    }

    pub fn execute_batch(&self, sql: impl Into<String>) -> Result<(), DatabaseError> {
        self.request(|reply| DatabaseMessage::ExecuteBatch {
            sql: sql.into(),
            transaction_id: None,
            reply,
        })
    }

    pub fn execute_batch_in_transaction(
        &self,
        sql: impl Into<String>,
        transaction_id: impl Into<String>,
    ) -> Result<(), DatabaseError> {
        self.request(|reply| DatabaseMessage::ExecuteBatch {
            sql: sql.into(),
            transaction_id: Some(transaction_id.into()),
            reply,
        })
    }

    pub fn begin_write(&self) -> Result<String, DatabaseError> {
        self.request(|reply| DatabaseMessage::BeginWrite { reply })
    }

    pub fn begin_read(&self) -> Result<String, DatabaseError> {
        self.request(|reply| DatabaseMessage::BeginRead { reply })
    }

    pub fn commit(&self, transaction_id: impl Into<String>) -> Result<(), DatabaseError> {
        self.request(|reply| DatabaseMessage::Commit {
            transaction_id: transaction_id.into(),
            reply,
        })
    }

    pub fn rollback(&self, transaction_id: impl Into<String>) -> Result<(), DatabaseError> {
        self.request(|reply| DatabaseMessage::Rollback {
            transaction_id: transaction_id.into(),
            reply,
        })
    }

    pub fn health(&self) -> Result<(), DatabaseError> {
        self.request(|reply| DatabaseMessage::Health { reply })
    }

    pub fn close(&self) -> Result<(), DatabaseError> {
        let (state_lock, state_changed) = &*self.lifecycle;
        let mut state = state_lock.lock().expect("database lifecycle lock");
        loop {
            match *state {
                HandleState::Closed => return Ok(()),
                HandleState::Closing => {
                    state = state_changed
                        .wait(state)
                        .expect("database lifecycle condition");
                }
                HandleState::Open => {
                    *state = HandleState::Closing;
                    self.accepting.store(false, Ordering::Release);
                    break;
                }
            }
        }
        drop(state);
        let (reply, result) = mpsc::channel();
        let send_result = self.sender.send(DatabaseMessage::Close { reply });
        let result = if send_result.is_err() {
            Ok(())
        } else {
            result.recv().unwrap_or(Ok(()))
        };
        if let Ok(mut worker) = self.worker.lock() {
            if let Some(worker) = worker.take() {
                let _ = worker.join();
            }
        }
        let (state_lock, state_changed) = &*self.lifecycle;
        *state_lock.lock().expect("database lifecycle lock") = HandleState::Closed;
        state_changed.notify_all();
        result
    }

    fn request<T>(
        &self,
        build: impl FnOnce(Sender<Result<T, DatabaseError>>) -> DatabaseMessage,
    ) -> Result<T, DatabaseError> {
        if !self.accepting.load(Ordering::Acquire) {
            return Err(DatabaseError::new(
                DATABASE_CLOSED,
                "Database actor is closed",
            ));
        }
        let (reply, result) = mpsc::channel();
        self.sender
            .send(build(reply))
            .map_err(|_| DatabaseError::new(DATABASE_CLOSED, "Database actor is closed"))?;
        result
            .recv()
            .map_err(|_| DatabaseError::new(DATABASE_CLOSED, "Database actor is closed"))?
    }
}

impl Default for DatabaseHandle {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for DatabaseHandle {
    fn drop(&mut self) {
        if std::sync::Arc::strong_count(&self.worker) == 1 {
            let _ = self.close();
        }
    }
}

fn run_actor(receiver: Receiver<DatabaseMessage>) {
    let mut connection = None;
    let mut active_transaction: Option<ActiveTransaction> = None;
    let transaction_ids = TransactionIdGenerator::new();
    while let Ok(message) = receiver.recv() {
        match message {
            DatabaseMessage::Open {
                app_data_dir,
                reply,
            } => {
                let result = open_connection(&mut connection, &app_data_dir);
                let _ = reply.send(result);
            }
            DatabaseMessage::Execute {
                sql,
                parameters,
                transaction_id,
                reply,
            } => {
                let result = execute(
                    &connection,
                    &active_transaction,
                    &sql,
                    parameters,
                    transaction_id.as_deref(),
                );
                let _ = reply.send(result);
            }
            DatabaseMessage::Query {
                sql,
                parameters,
                transaction_id,
                reply,
            } => {
                let result = query(
                    &connection,
                    &active_transaction,
                    &sql,
                    parameters,
                    transaction_id.as_deref(),
                );
                let _ = reply.send(result);
            }
            DatabaseMessage::ExecuteBatch {
                sql,
                transaction_id,
                reply,
            } => {
                let result = execute_batch(
                    &connection,
                    &active_transaction,
                    &sql,
                    transaction_id.as_deref(),
                );
                let _ = reply.send(result);
            }
            DatabaseMessage::BeginWrite { reply } => {
                let result = connection
                    .as_ref()
                    .ok_or_else(|| DatabaseError::new(DATABASE_NOT_OPEN, "Database is not open"))
                    .and_then(|connection| {
                        transaction::begin_write(
                            connection,
                            &mut active_transaction,
                            &transaction_ids,
                        )
                    });
                let _ = reply.send(result);
            }
            DatabaseMessage::BeginRead { reply } => {
                let result = connection
                    .as_ref()
                    .ok_or_else(|| DatabaseError::new(DATABASE_NOT_OPEN, "Database is not open"))
                    .and_then(|connection| {
                        transaction::begin_read(
                            connection,
                            &mut active_transaction,
                            &transaction_ids,
                        )
                    });
                let _ = reply.send(result);
            }
            DatabaseMessage::Commit {
                transaction_id,
                reply,
            } => {
                let result = connection
                    .as_ref()
                    .ok_or_else(|| DatabaseError::new(DATABASE_NOT_OPEN, "Database is not open"))
                    .and_then(|connection| {
                        transaction::finish(
                            connection,
                            &mut active_transaction,
                            &transaction_id,
                            true,
                        )
                    });
                let _ = reply.send(result);
            }
            DatabaseMessage::Rollback {
                transaction_id,
                reply,
            } => {
                let result = connection
                    .as_ref()
                    .ok_or_else(|| DatabaseError::new(DATABASE_NOT_OPEN, "Database is not open"))
                    .and_then(|connection| {
                        transaction::finish(
                            connection,
                            &mut active_transaction,
                            &transaction_id,
                            false,
                        )
                    });
                let _ = reply.send(result);
            }
            DatabaseMessage::Health { reply } => {
                let _ = reply.send(lifecycle::health(connection.as_ref()));
            }
            DatabaseMessage::Close { reply } => {
                lifecycle::rollback_active(connection.as_ref(), &active_transaction);
                drop(active_transaction);
                drop(connection);
                let _ = reply.send(Ok(()));
                break;
            }
        }
    }
}

fn open_connection(
    connection: &mut Option<Connection>,
    app_data_dir: &Path,
) -> Result<PathBuf, DatabaseError> {
    if connection.is_some() {
        return Err(DatabaseError::new(
            DATABASE_ALREADY_OPEN,
            "Database is already open",
        ));
    }
    if !app_data_dir.is_absolute() || app_data_dir.as_os_str().is_empty() {
        return Err(DatabaseError::new(
            VAULT_PATH_REJECTED,
            "Database app-data directory is not approved",
        ));
    }
    std::fs::create_dir_all(app_data_dir).map_err(|error| {
        DatabaseError::with_source(
            VAULT_PATH_REJECTED,
            "Database app-data directory is not approved",
            Some(error.to_string()),
        )
    })?;
    let path = app_data_dir.join(APPROVED_VAULT_NAME);
    let opened = Connection::open(&path)
        .map_err(|error| database_error("Database could not be opened", error))?;
    opened
        .execute_batch("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;")
        .map_err(|error| database_error("Database setup failed", error))?;
    *connection = Some(opened);
    Ok(path)
}

fn open_connection_ref(connection: &Option<Connection>) -> Result<&Connection, DatabaseError> {
    connection
        .as_ref()
        .ok_or_else(|| DatabaseError::new(DATABASE_NOT_OPEN, "Database is not open"))
}

fn execute(
    connection: &Option<Connection>,
    active_transaction: &Option<ActiveTransaction>,
    sql: &str,
    parameters: IpcParameters,
    transaction_id: Option<&str>,
) -> Result<IpcExecutionResult, DatabaseError> {
    transaction::verify_active(active_transaction.as_ref(), transaction_id)?;
    if active_transaction
        .as_ref()
        .is_some_and(|transaction| transaction.mode == TransactionMode::ReadDeferred)
    {
        return Err(DatabaseError::new(
            super::protocol::READ_ONLY_TRANSACTION,
            "Read transaction does not allow writes",
        ));
    }
    let connection = open_connection_ref(connection)?;
    let mut statement = connection
        .prepare(sql)
        .map_err(|error| database_error("Database statement failed", error))?;
    parameters.bind(&mut statement)?;
    let rows_affected = statement
        .raw_execute()
        .map_err(|error| database_error("Database execution failed", error))?;
    Ok(super::protocol::execution_result(
        rows_affected,
        connection.last_insert_rowid(),
    ))
}

fn query(
    connection: &Option<Connection>,
    active_transaction: &Option<ActiveTransaction>,
    sql: &str,
    parameters: IpcParameters,
    transaction_id: Option<&str>,
) -> Result<Vec<IpcRow>, DatabaseError> {
    transaction::verify_active(active_transaction.as_ref(), transaction_id)?;
    let connection = open_connection_ref(connection)?;
    let mut statement = connection
        .prepare(sql)
        .map_err(|error| database_error("Database statement failed", error))?;
    parameters.bind(&mut statement)?;
    let mut rows = statement.raw_query();
    let mut result = Vec::new();
    while let Some(row) = rows
        .next()
        .map_err(|error| database_error("Database query failed", error))?
    {
        result.push(decode_row(row)?);
    }
    Ok(result)
}

fn execute_batch(
    connection: &Option<Connection>,
    active_transaction: &Option<ActiveTransaction>,
    sql: &str,
    transaction_id: Option<&str>,
) -> Result<(), DatabaseError> {
    transaction::verify_active(active_transaction.as_ref(), transaction_id)?;
    if active_transaction
        .as_ref()
        .is_some_and(|transaction| transaction.mode == TransactionMode::ReadDeferred)
    {
        return Err(DatabaseError::new(
            super::protocol::READ_ONLY_TRANSACTION,
            "Read transaction does not allow writes",
        ));
    }
    open_connection_ref(connection)?
        .execute_batch(sql)
        .map_err(|error| database_error("Database batch failed", error))
}

#[cfg(test)]
mod tests {
    use super::super::protocol::{DATABASE_FAILURE, INVALID_PARAMETERS};
    use super::*;
    use std::sync::Arc;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_app_data_dir() -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("my-fin-actor-{suffix}"))
    }

    fn positional(values: Vec<super::super::protocol::IpcSqliteValue>) -> IpcParameters {
        IpcParameters::Positional { values }
    }

    #[test]
    fn actor_starts_closed_and_rejects_work() {
        let handle = DatabaseHandle::new();
        let error = handle.query("SELECT 1", positional(vec![])).unwrap_err();
        assert_eq!(error.code(), DATABASE_NOT_OPEN);
    }

    #[test]
    fn open_creates_only_the_fixed_vault_file() {
        let dir = temp_app_data_dir();
        let handle = DatabaseHandle::new();
        let path = handle.open(&dir).unwrap();
        assert_eq!(path, dir.join(APPROVED_VAULT_NAME));
        assert!(path.is_file());
        assert!(!dir.join("other.sqlite").exists());
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn open_rejects_relative_app_data_path() {
        let handle = DatabaseHandle::new();
        let error = handle.open("relative-app-data").unwrap_err();
        assert_eq!(error.code(), VAULT_PATH_REJECTED);
    }

    #[test]
    fn open_is_rejected_twice() {
        let dir = temp_app_data_dir();
        let handle = DatabaseHandle::new();
        handle.open(&dir).unwrap();
        assert_eq!(handle.open(&dir).unwrap_err().code(), DATABASE_ALREADY_OPEN);
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn execute_and_query_preserve_crud_values() {
        let dir = temp_app_data_dir();
        let handle = DatabaseHandle::new();
        handle.open(&dir).unwrap();
        handle
            .execute(
                "CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
                positional(vec![]),
            )
            .unwrap();
        let result = handle
            .execute(
                "INSERT INTO items (name) VALUES (?1)",
                positional(vec![super::super::protocol::IpcSqliteValue::Text {
                    value: "cash".into(),
                }]),
            )
            .unwrap();
        assert_eq!(result.rows_affected, 1);
        assert_eq!(result.last_insert_row_id.as_deref(), Some("1"));
        let rows = handle
            .query("SELECT id, name FROM items", positional(vec![]))
            .unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(
            rows[0].0["id"],
            super::super::protocol::IpcSqliteValue::Integer { value: "1".into() }
        );
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn named_parameters_are_bound_by_the_actor() {
        let dir = temp_app_data_dir();
        let handle = DatabaseHandle::new();
        handle.open(&dir).unwrap();
        let mut values = std::collections::BTreeMap::new();
        values.insert(
            "name".into(),
            super::super::protocol::IpcSqliteValue::Text {
                value: "book".into(),
            },
        );
        let rows = handle
            .query("SELECT :name AS name", IpcParameters::Named { values })
            .unwrap();
        assert_eq!(
            rows[0].0["name"],
            super::super::protocol::IpcSqliteValue::Text {
                value: "book".into()
            }
        );
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn query_returns_multiple_rows_in_sql_order() {
        let dir = temp_app_data_dir();
        let handle = DatabaseHandle::new();
        handle.open(&dir).unwrap();
        handle.execute_batch("CREATE TABLE numbers (value INTEGER); INSERT INTO numbers VALUES (2); INSERT INTO numbers VALUES (1);").unwrap();
        let rows = handle
            .query(
                "SELECT value FROM numbers ORDER BY rowid",
                positional(vec![]),
            )
            .unwrap();
        assert_eq!(
            rows[0].0["value"],
            super::super::protocol::IpcSqliteValue::Integer { value: "2".into() }
        );
        assert_eq!(
            rows[1].0["value"],
            super::super::protocol::IpcSqliteValue::Integer { value: "1".into() }
        );
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn batch_executes_statements_in_order() {
        let dir = temp_app_data_dir();
        let handle = DatabaseHandle::new();
        handle.open(&dir).unwrap();
        handle.execute_batch("CREATE TABLE events (value TEXT); INSERT INTO events VALUES ('first'); INSERT INTO events VALUES ('second');").unwrap();
        let rows = handle
            .query(
                "SELECT value FROM events ORDER BY rowid",
                positional(vec![]),
            )
            .unwrap();
        assert_eq!(
            rows[0].0["value"],
            super::super::protocol::IpcSqliteValue::Text {
                value: "first".into()
            }
        );
        assert_eq!(
            rows[1].0["value"],
            super::super::protocol::IpcSqliteValue::Text {
                value: "second".into()
            }
        );
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn failed_sql_is_sanitized() {
        let dir = temp_app_data_dir();
        let handle = DatabaseHandle::new();
        handle.open(&dir).unwrap();
        let error = handle
            .query("SELECT * FROM missing_table", positional(vec![]))
            .unwrap_err();
        assert_eq!(error.code(), DATABASE_FAILURE);
        assert!(error.source().is_some());
        assert!(!error.response().message.contains("missing_table"));
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn failed_batch_does_not_run_following_statements() {
        let dir = temp_app_data_dir();
        let handle = DatabaseHandle::new();
        handle.open(&dir).unwrap();
        let error = handle.execute_batch("CREATE TABLE one (value INTEGER); INSERT INTO missing VALUES (1); CREATE TABLE three (value INTEGER);").unwrap_err();
        assert_eq!(error.code(), DATABASE_FAILURE);
        assert!(handle
            .query("SELECT * FROM one", positional(vec![]))
            .is_ok());
        assert_eq!(
            handle
                .query("SELECT * FROM three", positional(vec![]))
                .unwrap_err()
                .code(),
            DATABASE_FAILURE
        );
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn actor_serializes_concurrent_requests() {
        let dir = temp_app_data_dir();
        let handle = DatabaseHandle::new();
        handle.open(&dir).unwrap();
        handle
            .execute_batch("CREATE TABLE values_table (value INTEGER);")
            .unwrap();
        let shared = Arc::new(handle);
        let threads = (0..4)
            .map(|value| {
                let handle = shared.clone();
                std::thread::spawn(move || {
                    handle
                        .execute(
                            "INSERT INTO values_table (value) VALUES (?1)",
                            positional(vec![super::super::protocol::IpcSqliteValue::Integer {
                                value: value.to_string(),
                            }]),
                        )
                        .unwrap();
                })
            })
            .collect::<Vec<_>>();
        for thread in threads {
            thread.join().unwrap();
        }
        let rows = shared
            .query("SELECT value FROM values_table", positional(vec![]))
            .unwrap();
        assert_eq!(rows.len(), 4);
        shared.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn close_rejects_new_work() {
        let dir = temp_app_data_dir();
        let handle = DatabaseHandle::new();
        handle.open(&dir).unwrap();
        handle.close().unwrap();
        assert_eq!(
            handle
                .query("SELECT 1", positional(vec![]))
                .unwrap_err()
                .code(),
            DATABASE_CLOSED
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn parameter_failure_is_reported_before_sql_execution() {
        let dir = temp_app_data_dir();
        let handle = DatabaseHandle::new();
        handle.open(&dir).unwrap();
        let error = handle
            .execute(
                "SELECT :known",
                IpcParameters::Named {
                    values: std::collections::BTreeMap::from([(
                        String::from("unknown"),
                        super::super::protocol::IpcSqliteValue::Null,
                    )]),
                },
            )
            .unwrap_err();
        assert_eq!(error.code(), INVALID_PARAMETERS);
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    fn open_transaction_fixture() -> (DatabaseHandle, PathBuf) {
        let dir = temp_app_data_dir();
        let handle = DatabaseHandle::new();
        handle.open(&dir).unwrap();
        handle
            .execute_batch("CREATE TABLE entries (value TEXT NOT NULL);")
            .unwrap();
        (handle, dir)
    }

    #[test]
    fn begin_write_returns_an_opaque_id() {
        let (handle, dir) = open_transaction_fixture();
        let id = handle.begin_write().unwrap();
        assert!(id.starts_with("tx-"));
        assert!(!id.contains("entries"));
        handle.rollback(&id).unwrap();
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn committed_write_persists_after_reopen() {
        let (handle, dir) = open_transaction_fixture();
        let id = handle.begin_write().unwrap();
        handle
            .execute_in_transaction(
                "INSERT INTO entries (value) VALUES (?1)",
                positional(vec![super::super::protocol::IpcSqliteValue::Text {
                    value: "committed".into(),
                }]),
                &id,
            )
            .unwrap();
        handle.commit(&id).unwrap();
        handle.close().unwrap();
        let reopened = DatabaseHandle::new();
        reopened.open(&dir).unwrap();
        let rows = reopened
            .query("SELECT value FROM entries", positional(vec![]))
            .unwrap();
        assert_eq!(rows.len(), 1);
        reopened.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn rolled_back_write_does_not_persist() {
        let (handle, dir) = open_transaction_fixture();
        let id = handle.begin_write().unwrap();
        handle
            .execute_in_transaction(
                "INSERT INTO entries (value) VALUES ('rolled back')",
                positional(vec![]),
                &id,
            )
            .unwrap();
        handle.rollback(&id).unwrap();
        assert!(handle
            .query("SELECT value FROM entries", positional(vec![]))
            .unwrap()
            .is_empty());
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn begin_write_uses_immediate_locking() {
        let (handle, dir) = open_transaction_fixture();
        let id = handle.begin_write().unwrap();
        let second = rusqlite::Connection::open(dir.join(APPROVED_VAULT_NAME)).unwrap();
        let error = second
            .execute("INSERT INTO entries (value) VALUES ('blocked')", [])
            .unwrap_err();
        assert!(error.to_string().contains("locked"));
        handle.rollback(&id).unwrap();
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn nested_transaction_is_rejected() {
        let (handle, dir) = open_transaction_fixture();
        let id = handle.begin_write().unwrap();
        assert_eq!(
            handle.begin_write().unwrap_err().code(),
            super::super::protocol::TRANSACTION_ACTIVE
        );
        handle.rollback(&id).unwrap();
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn execute_with_wrong_id_is_rejected() {
        let (handle, dir) = open_transaction_fixture();
        let id = handle.begin_write().unwrap();
        assert_eq!(
            handle
                .execute_in_transaction(
                    "INSERT INTO entries VALUES ('x')",
                    positional(vec![]),
                    "tx-wrong"
                )
                .unwrap_err()
                .code(),
            super::super::protocol::TRANSACTION_NOT_FOUND
        );
        handle.rollback(&id).unwrap();
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn unscoped_write_is_rejected_while_transaction_is_active() {
        let (handle, dir) = open_transaction_fixture();
        let id = handle.begin_write().unwrap();
        assert_eq!(
            handle
                .execute("INSERT INTO entries VALUES ('x')", positional(vec![]))
                .unwrap_err()
                .code(),
            super::super::protocol::TRANSACTION_NOT_FOUND
        );
        handle.rollback(&id).unwrap();
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn query_and_batch_require_the_active_id() {
        let (handle, dir) = open_transaction_fixture();
        let id = handle.begin_write().unwrap();
        assert_eq!(
            handle
                .query("SELECT 1", positional(vec![]))
                .unwrap_err()
                .code(),
            super::super::protocol::TRANSACTION_NOT_FOUND
        );
        assert_eq!(
            handle
                .execute_batch("INSERT INTO entries VALUES ('x')")
                .unwrap_err()
                .code(),
            super::super::protocol::TRANSACTION_NOT_FOUND
        );
        assert!(handle
            .query_in_transaction("SELECT 1", positional(vec![]), &id)
            .is_ok());
        handle.rollback(&id).unwrap();
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn wrong_id_cannot_commit_or_rollback() {
        let (handle, dir) = open_transaction_fixture();
        let id = handle.begin_write().unwrap();
        assert_eq!(
            handle.commit("tx-wrong").unwrap_err().code(),
            super::super::protocol::TRANSACTION_NOT_FOUND
        );
        assert_eq!(
            handle.rollback("tx-wrong").unwrap_err().code(),
            super::super::protocol::TRANSACTION_NOT_FOUND
        );
        handle.rollback(&id).unwrap();
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn double_finish_is_rejected() {
        let (handle, dir) = open_transaction_fixture();
        let id = handle.begin_write().unwrap();
        handle.commit(&id).unwrap();
        assert_eq!(
            handle.commit(&id).unwrap_err().code(),
            super::super::protocol::TRANSACTION_NOT_FOUND
        );
        assert_eq!(
            handle.rollback(&id).unwrap_err().code(),
            super::super::protocol::TRANSACTION_NOT_FOUND
        );
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn failed_callback_can_rollback_all_partial_writes() {
        let (handle, dir) = open_transaction_fixture();
        let id = handle.begin_write().unwrap();
        handle
            .execute_in_transaction(
                "INSERT INTO entries VALUES ('first')",
                positional(vec![]),
                &id,
            )
            .unwrap();
        let failure = handle
            .execute_in_transaction(
                "INSERT INTO missing VALUES ('second')",
                positional(vec![]),
                &id,
            )
            .unwrap_err();
        assert_eq!(failure.code(), DATABASE_FAILURE);
        handle.rollback(&id).unwrap();
        assert!(handle
            .query("SELECT * FROM entries", positional(vec![]))
            .unwrap()
            .is_empty());
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn close_rolls_back_an_active_transaction() {
        let (handle, dir) = open_transaction_fixture();
        let id = handle.begin_write().unwrap();
        handle
            .execute_in_transaction(
                "INSERT INTO entries VALUES ('close')",
                positional(vec![]),
                &id,
            )
            .unwrap();
        handle.close().unwrap();
        let reopened = DatabaseHandle::new();
        reopened.open(&dir).unwrap();
        assert!(reopened
            .query("SELECT * FROM entries", positional(vec![]))
            .unwrap()
            .is_empty());
        reopened.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn different_actor_handles_issue_distinct_ids() {
        let (first, first_dir) = open_transaction_fixture();
        let (second, second_dir) = open_transaction_fixture();
        let first_id = first.begin_write().unwrap();
        let second_id = second.begin_write().unwrap();
        assert_ne!(first_id, second_id);
        first.rollback(&first_id).unwrap();
        second.rollback(&second_id).unwrap();
        first.close().unwrap();
        second.close().unwrap();
        let _ = std::fs::remove_dir_all(first_dir);
        let _ = std::fs::remove_dir_all(second_dir);
    }

    fn open_read_fixture() -> (DatabaseHandle, PathBuf) {
        let (handle, dir) = open_transaction_fixture();
        handle
            .execute("INSERT INTO entries VALUES ('before')", positional(vec![]))
            .unwrap();
        (handle, dir)
    }

    #[test]
    fn read_begin_uses_deferred_mode() {
        let (handle, dir) = open_read_fixture();
        let id = handle.begin_read().unwrap();
        assert!(handle
            .query_in_transaction("SELECT value FROM entries", positional(vec![]), &id)
            .is_ok());
        handle.rollback(&id).unwrap();
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn read_transaction_preserves_snapshot_after_external_commit() {
        let (handle, dir) = open_read_fixture();
        handle.execute_batch("PRAGMA journal_mode = WAL;").unwrap();
        let id = handle.begin_read().unwrap();
        let first = handle
            .query_in_transaction("SELECT value FROM entries", positional(vec![]), &id)
            .unwrap();
        assert_eq!(first.len(), 1);
        let external = rusqlite::Connection::open(dir.join(APPROVED_VAULT_NAME)).unwrap();
        external
            .execute("INSERT INTO entries VALUES ('after snapshot')", [])
            .unwrap();
        let snapshot = handle
            .query_in_transaction("SELECT value FROM entries", positional(vec![]), &id)
            .unwrap();
        assert_eq!(snapshot.len(), 1);
        handle.rollback(&id).unwrap();
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn read_transaction_rejects_execute() {
        let (handle, dir) = open_read_fixture();
        let id = handle.begin_read().unwrap();
        assert_eq!(
            handle
                .execute_in_transaction(
                    "INSERT INTO entries VALUES ('blocked')",
                    positional(vec![]),
                    &id
                )
                .unwrap_err()
                .code(),
            super::super::protocol::READ_ONLY_TRANSACTION
        );
        handle.rollback(&id).unwrap();
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn read_transaction_rejects_batch() {
        let (handle, dir) = open_read_fixture();
        let id = handle.begin_read().unwrap();
        assert_eq!(
            handle
                .execute_batch_in_transaction("INSERT INTO entries VALUES ('blocked')", &id)
                .unwrap_err()
                .code(),
            super::super::protocol::READ_ONLY_TRANSACTION
        );
        handle.rollback(&id).unwrap();
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn health_requires_open_database() {
        let handle = DatabaseHandle::new();
        assert_eq!(handle.health().unwrap_err().code(), DATABASE_NOT_OPEN);
    }

    #[test]
    fn health_selects_one_when_open() {
        let (handle, dir) = open_read_fixture();
        assert!(handle.health().is_ok());
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn health_does_not_finish_an_active_transaction() {
        let (handle, dir) = open_read_fixture();
        let id = handle.begin_read().unwrap();
        handle.health().unwrap();
        assert_eq!(
            handle
                .query_in_transaction("SELECT value FROM entries", positional(vec![]), &id)
                .unwrap()
                .len(),
            1
        );
        handle.rollback(&id).unwrap();
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn close_is_idempotent_after_open() {
        let (handle, dir) = open_read_fixture();
        handle.close().unwrap();
        handle.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn close_is_idempotent_before_open() {
        let handle = DatabaseHandle::new();
        handle.close().unwrap();
        handle.close().unwrap();
    }

    #[test]
    fn post_close_work_is_rejected() {
        let (handle, dir) = open_read_fixture();
        handle.close().unwrap();
        assert_eq!(handle.health().unwrap_err().code(), DATABASE_CLOSED);
        assert_eq!(handle.begin_read().unwrap_err().code(), DATABASE_CLOSED);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn concurrent_close_calls_share_one_shutdown() {
        let (handle, dir) = open_read_fixture();
        let first = handle.clone();
        let second = handle.clone();
        let first_thread = std::thread::spawn(move || first.close());
        let second_thread = std::thread::spawn(move || second.close());
        assert!(first_thread.join().unwrap().is_ok());
        assert!(second_thread.join().unwrap().is_ok());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn close_rolls_back_active_read_transaction() {
        let (handle, dir) = open_read_fixture();
        let id = handle.begin_read().unwrap();
        handle
            .query_in_transaction("SELECT value FROM entries", positional(vec![]), &id)
            .unwrap();
        handle.close().unwrap();
        let reopened = DatabaseHandle::new();
        reopened.open(&dir).unwrap();
        assert!(reopened.health().is_ok());
        reopened.close().unwrap();
        let _ = std::fs::remove_dir_all(dir);
    }
}
