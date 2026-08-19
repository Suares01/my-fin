use rusqlite::Connection;

use super::protocol::{database_error, DatabaseError, DATABASE_NOT_OPEN};
use super::transaction::ActiveTransaction;

pub fn health(connection: Option<&Connection>) -> Result<(), DatabaseError> {
    let connection =
        connection.ok_or_else(|| DatabaseError::new(DATABASE_NOT_OPEN, "Database is not open"))?;
    connection
        .query_row("SELECT 1", [], |_row| Ok(()))
        .map_err(|error| database_error("Database health check failed", error))
}

pub fn rollback_active(connection: Option<&Connection>, active: &Option<ActiveTransaction>) {
    if active.is_some() {
        if let Some(connection) = connection {
            let _ = connection.execute_batch("ROLLBACK");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn health_requires_an_open_connection() {
        assert_eq!(health(None).unwrap_err().code(), DATABASE_NOT_OPEN);
    }

    #[test]
    fn health_executes_select_one() {
        let connection = Connection::open_in_memory().unwrap();
        assert!(health(Some(&connection)).is_ok());
    }
}
