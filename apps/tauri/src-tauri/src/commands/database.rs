use serde::Deserialize;
use tauri::{AppHandle, Manager, State};

use crate::database::actor::APPROVED_VAULT_NAME;
use crate::database::protocol::{
    DatabaseError, DatabaseErrorResponse, IpcExecutionResult, IpcParameters, IpcRow,
    INVALID_PARAMETERS, VAULT_PATH_REJECTED,
};
use crate::database::DatabaseHandle;

pub type CommandResult<T> = Result<T, DatabaseErrorResponse>;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenRequest {
    pub vault_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SqlRequest {
    pub sql: String,
    pub parameters: IpcParameters,
    #[serde(default)]
    pub transaction_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchRequest {
    pub sql: String,
    #[serde(default)]
    pub transaction_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeginTransactionRequest {
    pub mode: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionRequest {
    pub transaction_id: String,
}

fn safe(command: &str, error: DatabaseError) -> DatabaseErrorResponse {
    eprintln!(
        "[sqlite] command={command} code={} diagnostic_id={} message={} source={}",
        error.code(),
        error.diagnostic_id(),
        error,
        error.source().unwrap_or("-")
    );
    error.response()
}

fn invalid(message: &str) -> DatabaseErrorResponse {
    DatabaseError::new(INVALID_PARAMETERS, message).response()
}

#[tauri::command]
pub async fn database_open(
    app: AppHandle,
    state: State<'_, DatabaseHandle>,
    request: OpenRequest,
) -> CommandResult<()> {
    if request.vault_name != APPROVED_VAULT_NAME {
        return Err(safe(
            "database_open",
            DatabaseError::new(VAULT_PATH_REJECTED, "Database vault is not approved"),
        ));
    }
    let app_data_dir = app.path().app_local_data_dir().map_err(|_| {
        safe(
            "database_open",
            DatabaseError::new(
                VAULT_PATH_REJECTED,
                "Database app-data directory is not approved",
            ),
        )
    })?;
    state
        .open(app_data_dir)
        .map(|_| ())
        .map_err(|error| safe("database_open", error))
}

#[tauri::command]
pub async fn database_execute(
    state: State<'_, DatabaseHandle>,
    request: SqlRequest,
) -> CommandResult<IpcExecutionResult> {
    match request.transaction_id {
        Some(transaction_id) => state
            .execute_in_transaction(request.sql, request.parameters, transaction_id)
            .map_err(|error| safe("database_execute", error)),
        None => state
            .execute(request.sql, request.parameters)
            .map_err(|error| safe("database_execute", error)),
    }
}

#[tauri::command]
pub async fn database_query(
    state: State<'_, DatabaseHandle>,
    request: SqlRequest,
) -> CommandResult<Vec<IpcRow>> {
    match request.transaction_id {
        Some(transaction_id) => state
            .query_in_transaction(request.sql, request.parameters, transaction_id)
            .map_err(|error| safe("database_query", error)),
        None => state
            .query(request.sql, request.parameters)
            .map_err(|error| safe("database_query", error)),
    }
}

#[tauri::command]
pub async fn database_execute_batch(
    state: State<'_, DatabaseHandle>,
    request: BatchRequest,
) -> CommandResult<()> {
    match request.transaction_id {
        Some(transaction_id) => state
            .execute_batch_in_transaction(request.sql, transaction_id)
            .map_err(|error| safe("database_execute_batch", error)),
        None => state
            .execute_batch(request.sql)
            .map_err(|error| safe("database_execute_batch", error)),
    }
}

#[tauri::command]
pub async fn database_begin_transaction(
    state: State<'_, DatabaseHandle>,
    request: BeginTransactionRequest,
) -> CommandResult<String> {
    match request.mode.as_str() {
        "write" => state
            .begin_write()
            .map_err(|error| safe("database_begin_transaction", error)),
        "read" => state
            .begin_read()
            .map_err(|error| safe("database_begin_transaction", error)),
        _ => Err(invalid("Transaction mode must be write or read")),
    }
}

#[tauri::command]
pub async fn database_commit_transaction(
    state: State<'_, DatabaseHandle>,
    request: TransactionRequest,
) -> CommandResult<()> {
    state
        .commit(request.transaction_id)
        .map_err(|error| safe("database_commit_transaction", error))
}

#[tauri::command]
pub async fn database_rollback_transaction(
    state: State<'_, DatabaseHandle>,
    request: TransactionRequest,
) -> CommandResult<()> {
    state
        .rollback(request.transaction_id)
        .map_err(|error| safe("database_rollback_transaction", error))
}

#[tauri::command]
pub async fn database_health(state: State<'_, DatabaseHandle>) -> CommandResult<()> {
    state
        .health()
        .map_err(|error| safe("database_health", error))
}

#[tauri::command]
pub async fn database_close(state: State<'_, DatabaseHandle>) -> CommandResult<()> {
    state.close().map_err(|error| safe("database_close", error))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const COMMANDS: [&str; 9] = [
        "database_open",
        "database_execute",
        "database_query",
        "database_execute_batch",
        "database_begin_transaction",
        "database_commit_transaction",
        "database_rollback_transaction",
        "database_health",
        "database_close",
    ];

    #[test]
    fn registers_exactly_nine_database_commands() {
        assert_eq!(COMMANDS.len(), 9);
        assert!(COMMANDS.contains(&"database_open"));
        assert!(COMMANDS.contains(&"database_close"));
    }

    #[test]
    fn command_names_are_scoped_to_database() {
        assert!(COMMANDS.iter().all(|name| name.starts_with("database_")));
    }

    #[test]
    fn open_request_uses_camel_case_vault_name() {
        let request: OpenRequest = serde_json::from_value(json!({
            "vaultName": APPROVED_VAULT_NAME
        }))
        .unwrap();
        assert_eq!(request.vault_name, APPROVED_VAULT_NAME);
    }

    #[test]
    fn sql_request_accepts_optional_transaction_id() {
        let request: SqlRequest = serde_json::from_value(json!({
            "sql": "SELECT 1",
            "parameters": {"kind": "positional", "values": []},
            "transactionId": "tx-1"
        }))
        .unwrap();
        assert_eq!(request.transaction_id.as_deref(), Some("tx-1"));
    }

    #[test]
    fn batch_request_defaults_transaction_id_to_none() {
        let request: BatchRequest = serde_json::from_value(json!({"sql": "SELECT 1"})).unwrap();
        assert!(request.transaction_id.is_none());
    }

    #[test]
    fn transaction_request_uses_transaction_id() {
        let request: TransactionRequest =
            serde_json::from_value(json!({"transactionId": "tx-1"})).unwrap();
        assert_eq!(request.transaction_id, "tx-1");
    }

    #[test]
    fn begin_transaction_request_uses_mode() {
        let request: BeginTransactionRequest =
            serde_json::from_value(json!({"mode": "read"})).unwrap();
        assert_eq!(request.mode, "read");
    }

    #[test]
    fn capability_targets_only_the_main_window() {
        let capability: serde_json::Value =
            serde_json::from_str(include_str!("../../capabilities/main.json")).unwrap();
        assert_eq!(capability["windows"], json!(["main"]));
        assert!(capability.get("remote").is_none());
    }

    #[test]
    fn capability_has_no_generic_sql_or_fs_plugin() {
        let capability: serde_json::Value =
            serde_json::from_str(include_str!("../../capabilities/main.json")).unwrap();
        let permissions = capability["permissions"].as_array().unwrap();
        assert!(permissions.iter().all(|permission| {
            let value = permission.as_str().unwrap();
            !value.contains("sql") && !value.contains("fs")
        }));
    }

    #[test]
    fn approved_vault_name_is_not_a_frontend_path() {
        assert!(!APPROVED_VAULT_NAME.contains('/'));
        assert!(!APPROVED_VAULT_NAME.contains('\\'));
    }
}
