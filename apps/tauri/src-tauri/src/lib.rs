pub mod commands;
pub mod database;

#[cfg(test)]
#[path = "lib.test.rs"]
mod lib_test;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(database::DatabaseHandle::new())
        .invoke_handler(tauri::generate_handler![
            commands::database::database_open,
            commands::database::database_execute,
            commands::database::database_query,
            commands::database::database_execute_batch,
            commands::database::database_begin_transaction,
            commands::database::database_commit_transaction,
            commands::database::database_rollback_transaction,
            commands::database::database_health,
            commands::database::database_close,
        ])
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
