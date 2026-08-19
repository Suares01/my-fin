use std::collections::BTreeMap;
use std::fmt::{Display, Formatter};
use std::sync::atomic::{AtomicU64, Ordering};

use rusqlite::types::{ToSqlOutput, Value, ValueRef};
use rusqlite::Statement;
use serde::{Deserialize, Serialize};

const INT64_MIN: i128 = -9_223_372_036_854_775_808;
const INT64_MAX: i128 = 9_223_372_036_854_775_807;
static DIAGNOSTIC_SEQUENCE: AtomicU64 = AtomicU64::new(1);

pub const INVALID_PROTOCOL: &str = "INVALID_PROTOCOL";
pub const INVALID_PARAMETERS: &str = "INVALID_PARAMETERS";
pub const DATABASE_FAILURE: &str = "DATABASE_FAILURE";
pub const DATABASE_NOT_OPEN: &str = "DATABASE_NOT_OPEN";
pub const DATABASE_CLOSED: &str = "DATABASE_CLOSED";
pub const DATABASE_ALREADY_OPEN: &str = "DATABASE_ALREADY_OPEN";
pub const TRANSACTION_ACTIVE: &str = "TRANSACTION_ACTIVE";
pub const TRANSACTION_NOT_FOUND: &str = "TRANSACTION_NOT_FOUND";
pub const READ_ONLY_TRANSACTION: &str = "READ_ONLY_TRANSACTION";
pub const VAULT_PATH_REJECTED: &str = "VAULT_PATH_REJECTED";

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "type")]
pub enum IpcSqliteValue {
    #[serde(rename = "null")]
    Null,
    #[serde(rename = "integer")]
    Integer { value: String },
    #[serde(rename = "real")]
    Real { value: f64 },
    #[serde(rename = "text")]
    Text { value: String },
    #[serde(rename = "blob")]
    Blob { value: Vec<u8> },
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "kind")]
pub enum IpcParameters {
    #[serde(rename = "positional")]
    Positional { values: Vec<IpcSqliteValue> },
    #[serde(rename = "named")]
    Named {
        values: BTreeMap<String, IpcSqliteValue>,
    },
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct IpcRow(pub BTreeMap<String, IpcSqliteValue>);

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcExecutionResult {
    pub rows_affected: u64,
    pub last_insert_row_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseErrorResponse {
    pub code: String,
    pub diagnostic_id: String,
    pub message: String,
}

#[derive(Clone, Debug, PartialEq)]
pub struct DatabaseError {
    code: String,
    diagnostic_id: String,
    message: String,
    source: Option<String>,
}

impl DatabaseError {
    pub fn new(code: &str, message: &str) -> Self {
        Self::with_source(code, message, None)
    }

    pub fn with_source(code: &str, message: &str, source: Option<String>) -> Self {
        let diagnostic_id = format!(
            "diag-{:08}",
            DIAGNOSTIC_SEQUENCE.fetch_add(1, Ordering::Relaxed)
        );
        Self {
            code: code.to_owned(),
            diagnostic_id,
            message: message.to_owned(),
            source,
        }
    }

    pub fn response(&self) -> DatabaseErrorResponse {
        DatabaseErrorResponse {
            code: self.code.clone(),
            diagnostic_id: self.diagnostic_id.clone(),
            message: self.message.clone(),
        }
    }

    pub fn code(&self) -> &str {
        &self.code
    }

    pub fn diagnostic_id(&self) -> &str {
        &self.diagnostic_id
    }

    pub fn source(&self) -> Option<&str> {
        self.source.as_deref()
    }
}

impl Display for DatabaseError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for DatabaseError {}

impl IpcSqliteValue {
    pub fn to_sql_value(&self) -> Result<Value, DatabaseError> {
        match self {
            Self::Null => Ok(Value::Null),
            Self::Integer { value } => parse_int64(value).map(Value::Integer),
            Self::Real { value } if value.is_finite() => Ok(Value::Real(*value)),
            Self::Real { .. } => Err(invalid_value("real")),
            Self::Text { value } => Ok(Value::Text(value.clone())),
            Self::Blob { value } => Ok(Value::Blob(value.clone())),
        }
    }

    pub fn from_value_ref(value: ValueRef<'_>) -> Result<Self, DatabaseError> {
        match value {
            ValueRef::Null => Ok(Self::Null),
            ValueRef::Integer(value) => Ok(Self::Integer {
                value: value.to_string(),
            }),
            ValueRef::Real(value) if value.is_finite() => Ok(Self::Real { value }),
            ValueRef::Real(_) => Err(invalid_value("real")),
            ValueRef::Text(value) => String::from_utf8(value.to_vec())
                .map(|value| Self::Text { value })
                .map_err(|error| {
                    DatabaseError::with_source(
                        INVALID_PROTOCOL,
                        "SQLite text could not be decoded",
                        Some(error.to_string()),
                    )
                }),
            ValueRef::Blob(value) => Ok(Self::Blob {
                value: value.to_vec(),
            }),
        }
    }

    pub fn to_sql_output(&self) -> Result<ToSqlOutput<'static>, DatabaseError> {
        Ok(ToSqlOutput::Owned(self.to_sql_value()?))
    }
}

impl IpcParameters {
    pub fn bind(&self, statement: &mut Statement<'_>) -> Result<(), DatabaseError> {
        match self {
            Self::Positional { values } => {
                for (index, value) in values.iter().enumerate() {
                    statement
                        .raw_bind_parameter(index + 1, &value.to_sql_output()?)
                        .map_err(|error| database_error("SQLite parameter bind failed", error))?;
                }
            }
            Self::Named { values } => {
                for (name, value) in values {
                    let parameter_name = if name.starts_with(':')
                        || name.starts_with('@')
                        || name.starts_with('$')
                    {
                        name.clone()
                    } else {
                        format!(":{name}")
                    };
                    let index = statement
                        .parameter_index(&parameter_name)
                        .map_err(|_| {
                            DatabaseError::new(INVALID_PARAMETERS, "Unknown SQLite parameter")
                        })?
                        .ok_or_else(|| {
                            DatabaseError::new(INVALID_PARAMETERS, "Unknown SQLite parameter")
                        })?;
                    statement
                        .raw_bind_parameter(index, &value.to_sql_output()?)
                        .map_err(|error| database_error("SQLite parameter bind failed", error))?;
                }
            }
        }

        Ok(())
    }
}

pub fn decode_row(row: &rusqlite::Row<'_>) -> Result<IpcRow, DatabaseError> {
    let mut values = BTreeMap::new();
    for index in 0..row.as_ref().column_count() {
        let name = row
            .as_ref()
            .column_name(index)
            .map_err(|error| database_error("SQLite column name could not be read", error))?;
        let value = row
            .get_ref(index)
            .map_err(|error| database_error("SQLite row value could not be read", error))?;
        values.insert(name.to_owned(), IpcSqliteValue::from_value_ref(value)?);
    }

    Ok(IpcRow(values))
}

pub fn execution_result(rows_affected: usize, last_insert_row_id: i64) -> IpcExecutionResult {
    IpcExecutionResult {
        rows_affected: rows_affected as u64,
        last_insert_row_id: Some(last_insert_row_id.to_string()),
    }
}

fn parse_int64(value: &str) -> Result<i64, DatabaseError> {
    let parsed = value.parse::<i128>().map_err(|error| {
        DatabaseError::with_source(
            INVALID_PROTOCOL,
            "SQLite integer must be a signed decimal string",
            Some(error.to_string()),
        )
    })?;
    if !(INT64_MIN..=INT64_MAX).contains(&parsed) {
        return Err(invalid_value("integer"));
    }

    Ok(parsed as i64)
}

fn invalid_value(kind: &str) -> DatabaseError {
    DatabaseError::new(INVALID_PROTOCOL, &format!("Invalid SQLite {kind} value"))
}

pub(crate) fn database_error(message: &str, error: rusqlite::Error) -> DatabaseError {
    DatabaseError::with_source(DATABASE_FAILURE, message, Some(error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use serde_json::json;

    #[test]
    fn serde_round_trips_every_sqlite_value_tag() {
        let values = vec![
            IpcSqliteValue::Null,
            IpcSqliteValue::Integer {
                value: "9223372036854775807".into(),
            },
            IpcSqliteValue::Real { value: 12.5 },
            IpcSqliteValue::Text {
                value: "My Fin".into(),
            },
            IpcSqliteValue::Blob {
                value: vec![0, 127, 255],
            },
        ];

        for value in values {
            let encoded = serde_json::to_value(&value).expect("value serializes");
            let decoded: IpcSqliteValue = serde_json::from_value(encoded).expect("value decodes");
            assert_eq!(decoded, value);
        }
    }

    #[test]
    fn serde_matches_the_tagged_ts_shape() {
        let value = serde_json::to_value(IpcSqliteValue::Integer { value: "7".into() })
            .expect("value serializes");

        assert_eq!(value, json!({ "type": "integer", "value": "7" }));
    }

    #[test]
    fn serde_round_trips_positional_parameters() {
        let parameters = IpcParameters::Positional {
            values: vec![IpcSqliteValue::Integer { value: "7".into() }],
        };

        assert_eq!(
            serde_json::from_value::<IpcParameters>(serde_json::to_value(&parameters).unwrap())
                .unwrap(),
            parameters
        );
    }

    #[test]
    fn serde_round_trips_named_parameters_and_rows() {
        let mut named = BTreeMap::new();
        named.insert(
            "bookId".into(),
            IpcSqliteValue::Text {
                value: "book".into(),
            },
        );
        let parameters = IpcParameters::Named { values: named };
        let mut row = BTreeMap::new();
        row.insert("id".into(), IpcSqliteValue::Integer { value: "1".into() });

        assert_eq!(
            serde_json::from_value::<IpcParameters>(serde_json::to_value(&parameters).unwrap())
                .unwrap(),
            parameters
        );
        assert_eq!(
            serde_json::from_value::<IpcRow>(serde_json::to_value(IpcRow(row.clone())).unwrap())
                .unwrap(),
            IpcRow(row)
        );
    }

    #[test]
    fn integer_binding_preserves_signed_int64() {
        let value = IpcSqliteValue::Integer {
            value: "-9223372036854775808".into(),
        };

        assert_eq!(value.to_sql_value().unwrap(), Value::Integer(i64::MIN));
    }

    #[test]
    fn integer_binding_rejects_out_of_range_values() {
        let error = IpcSqliteValue::Integer {
            value: "9223372036854775808".into(),
        }
        .to_sql_value()
        .unwrap_err();

        assert_eq!(error.code(), INVALID_PROTOCOL);
        assert_eq!(error.response().message, "Invalid SQLite integer value");
    }

    #[test]
    fn real_binding_rejects_non_finite_values() {
        let error = IpcSqliteValue::Real { value: f64::NAN }
            .to_sql_value()
            .unwrap_err();

        assert_eq!(error.code(), INVALID_PROTOCOL);
    }

    #[test]
    fn positional_binding_preserves_null_text_real_and_blob() {
        let connection = Connection::open_in_memory().unwrap();
        let mut statement = connection
            .prepare("SELECT ?1 AS n, ?2 AS t, ?3 AS r, ?4 AS b")
            .unwrap();
        let parameters = IpcParameters::Positional {
            values: vec![
                IpcSqliteValue::Null,
                IpcSqliteValue::Text {
                    value: "text".into(),
                },
                IpcSqliteValue::Real { value: 1.25 },
                IpcSqliteValue::Blob {
                    value: vec![1, 2, 3],
                },
            ],
        };

        parameters.bind(&mut statement).unwrap();
        let mut rows = statement.raw_query();
        let row = decode_row(rows.next().unwrap().unwrap()).unwrap();
        assert_eq!(row.0["n"], IpcSqliteValue::Null);
        assert_eq!(
            row.0["t"],
            IpcSqliteValue::Text {
                value: "text".into()
            }
        );
        assert_eq!(row.0["r"], IpcSqliteValue::Real { value: 1.25 });
        assert_eq!(
            row.0["b"],
            IpcSqliteValue::Blob {
                value: vec![1, 2, 3]
            }
        );
    }

    #[test]
    fn named_binding_preserves_values() {
        let connection = Connection::open_in_memory().unwrap();
        let mut statement = connection
            .prepare("SELECT :name AS name, :amount AS amount")
            .unwrap();
        let mut values = BTreeMap::new();
        values.insert(
            "name".into(),
            IpcSqliteValue::Text {
                value: "book".into(),
            },
        );
        values.insert(
            "amount".into(),
            IpcSqliteValue::Integer {
                value: "100".into(),
            },
        );

        IpcParameters::Named { values }
            .bind(&mut statement)
            .unwrap();
        let mut rows = statement.raw_query();
        let row = decode_row(rows.next().unwrap().unwrap()).unwrap();
        assert_eq!(
            row.0["name"],
            IpcSqliteValue::Text {
                value: "book".into()
            }
        );
        assert_eq!(
            row.0["amount"],
            IpcSqliteValue::Integer {
                value: "100".into()
            }
        );
    }

    #[test]
    fn named_binding_rejects_unknown_parameter() {
        let connection = Connection::open_in_memory().unwrap();
        let mut statement = connection.prepare("SELECT :known").unwrap();
        let mut values = BTreeMap::new();
        values.insert("unknown".into(), IpcSqliteValue::Null);

        let error = IpcParameters::Named { values }
            .bind(&mut statement)
            .unwrap_err();
        assert_eq!(error.code(), INVALID_PARAMETERS);
    }

    #[test]
    fn row_decode_preserves_int64_as_string() {
        let connection = Connection::open_in_memory().unwrap();
        let mut statement = connection
            .prepare("SELECT 9223372036854775807 AS sequence")
            .unwrap();
        let mut rows = statement.query([]).unwrap();
        let row = decode_row(rows.next().unwrap().unwrap()).unwrap();

        assert_eq!(
            row.0["sequence"],
            IpcSqliteValue::Integer {
                value: "9223372036854775807".into()
            }
        );
    }

    #[test]
    fn row_decode_rejects_invalid_utf8_text() {
        let connection = Connection::open_in_memory().unwrap();
        let mut statement = connection
            .prepare("SELECT CAST(X'FF' AS TEXT) AS broken")
            .unwrap();
        let mut rows = statement.query([]).unwrap();
        let error = decode_row(rows.next().unwrap().unwrap()).unwrap_err();

        assert_eq!(error.code(), INVALID_PROTOCOL);
        assert_eq!(error.response().message, "SQLite text could not be decoded");
    }

    #[test]
    fn execution_result_serializes_last_insert_id_as_string() {
        let result = execution_result(1, i64::MAX);
        assert_eq!(result.rows_affected, 1);
        assert_eq!(
            result.last_insert_row_id.as_deref(),
            Some("9223372036854775807")
        );
        assert_eq!(
            serde_json::to_value(result).unwrap()["lastInsertRowId"],
            "9223372036854775807"
        );
    }

    #[test]
    fn safe_error_response_excludes_source_details() {
        let error = DatabaseError::with_source(
            DATABASE_FAILURE,
            "Database operation failed",
            Some("INSERT amount=100 at /absolute/path".into()),
        );
        let response = error.response();
        let encoded = serde_json::to_value(&response).unwrap();

        assert_eq!(response.code, DATABASE_FAILURE);
        assert!(encoded.get("source").is_none());
        assert!(!encoded.to_string().contains("amount=100"));
        assert!(!encoded.to_string().contains("/absolute/path"));
        assert!(error.source().is_some());
    }

    #[test]
    fn error_response_serializes_only_safe_fields() {
        let response = DatabaseError::new(DATABASE_NOT_OPEN, "Database is not open").response();
        let encoded = serde_json::to_value(response).unwrap();

        assert_eq!(encoded.as_object().unwrap().len(), 3);
        assert!(encoded.get("diagnosticId").is_some());
        assert_eq!(encoded["message"], "Database is not open");
    }
}
