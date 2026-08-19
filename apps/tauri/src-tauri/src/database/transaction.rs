use std::sync::atomic::{AtomicU64, Ordering};

use rusqlite::Connection;

use super::protocol::{DatabaseError, DATABASE_FAILURE, TRANSACTION_ACTIVE, TRANSACTION_NOT_FOUND};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TransactionMode {
    WriteImmediate,
    ReadDeferred,
}

#[derive(Debug, Eq, PartialEq)]
pub struct ActiveTransaction {
    pub id: String,
    pub mode: TransactionMode,
}

pub struct TransactionIdGenerator {}

static NEXT_TRANSACTION_ID: AtomicU64 = AtomicU64::new(1);

impl TransactionIdGenerator {
    pub fn new() -> Self {
        Self {}
    }

    pub fn next_id(&self) -> String {
        format!(
            "tx-{:016x}",
            NEXT_TRANSACTION_ID.fetch_add(1, Ordering::Relaxed)
        )
    }
}

impl Default for TransactionIdGenerator {
    fn default() -> Self {
        Self::new()
    }
}

pub fn begin_write(
    connection: &Connection,
    active: &mut Option<ActiveTransaction>,
    ids: &TransactionIdGenerator,
) -> Result<String, DatabaseError> {
    begin(connection, active, ids, TransactionMode::WriteImmediate)
}

pub fn begin_read(
    connection: &Connection,
    active: &mut Option<ActiveTransaction>,
    ids: &TransactionIdGenerator,
) -> Result<String, DatabaseError> {
    begin(connection, active, ids, TransactionMode::ReadDeferred)
}

fn begin(
    connection: &Connection,
    active: &mut Option<ActiveTransaction>,
    ids: &TransactionIdGenerator,
    mode: TransactionMode,
) -> Result<String, DatabaseError> {
    if active.is_some() {
        return Err(DatabaseError::new(
            TRANSACTION_ACTIVE,
            "A database transaction is already active",
        ));
    }
    connection
        .execute_batch(match mode {
            TransactionMode::WriteImmediate => "BEGIN IMMEDIATE",
            TransactionMode::ReadDeferred => "BEGIN",
        })
        .map_err(|error| {
            DatabaseError::with_source(
                DATABASE_FAILURE,
                "Transaction begin failed",
                Some(error.to_string()),
            )
        })?;
    let transaction = ActiveTransaction {
        id: ids.next_id(),
        mode,
    };
    let id = transaction.id.clone();
    *active = Some(transaction);
    Ok(id)
}

pub fn verify_active(
    active: Option<&ActiveTransaction>,
    requested_id: Option<&str>,
) -> Result<(), DatabaseError> {
    match (active, requested_id) {
        (None, None) => Ok(()),
        (None, Some(_)) => Err(DatabaseError::new(
            TRANSACTION_NOT_FOUND,
            "Database transaction is not active",
        )),
        (Some(_), None) => Err(DatabaseError::new(
            TRANSACTION_NOT_FOUND,
            "Database transaction id is required",
        )),
        (Some(active), Some(requested)) if active.id == requested => Ok(()),
        (Some(_), Some(_)) => Err(DatabaseError::new(
            TRANSACTION_NOT_FOUND,
            "Database transaction id is not owned by this actor",
        )),
    }
}

pub fn finish(
    connection: &Connection,
    active: &mut Option<ActiveTransaction>,
    requested_id: &str,
    commit: bool,
) -> Result<(), DatabaseError> {
    verify_active(active.as_ref(), Some(requested_id))?;
    let sql = if commit { "COMMIT" } else { "ROLLBACK" };
    connection.execute_batch(sql).map_err(|error| {
        DatabaseError::with_source(
            DATABASE_FAILURE,
            if commit {
                "Transaction commit failed"
            } else {
                "Transaction rollback failed"
            },
            Some(error.to_string()),
        )
    })?;
    *active = None;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn ids_are_opaque_and_unique() {
        let ids = TransactionIdGenerator::new();
        let first = ids.next_id();
        let second = ids.next_id();
        assert_ne!(first, second);
        assert!(first.starts_with("tx-"));
    }

    #[test]
    fn begin_uses_write_immediate_and_records_mode() {
        let connection = Connection::open_in_memory().unwrap();
        let mut active = None;
        let id = begin_write(&connection, &mut active, &TransactionIdGenerator::new()).unwrap();
        assert_eq!(id, active.as_ref().unwrap().id);
        assert_eq!(
            active.as_ref().unwrap().mode,
            TransactionMode::WriteImmediate
        );
        finish(&connection, &mut active, &id, false).unwrap();
    }

    #[test]
    fn nested_begin_is_rejected() {
        let connection = Connection::open_in_memory().unwrap();
        let mut active = None;
        begin_write(&connection, &mut active, &TransactionIdGenerator::new()).unwrap();
        assert_eq!(
            begin_write(&connection, &mut active, &TransactionIdGenerator::new())
                .unwrap_err()
                .code(),
            TRANSACTION_ACTIVE
        );
        let id = active.as_ref().unwrap().id.clone();
        finish(&connection, &mut active, &id, false).unwrap();
    }
}
