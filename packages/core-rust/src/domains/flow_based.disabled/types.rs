//! Flow-based programming type system
//!
//! Defines data types for ports and messages in flow networks.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Node categories for organization and UI purposes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NodeCategory {
    /// Mathematical operations
    Math,
    /// Logical operations
    Logic,
    /// String operations
    String,
    /// Array/list operations
    Array,
    /// Object/key-value operations
    Object,
    /// Type conversion and checking
    Type,
    /// Input/output operations
    IO,
    /// Control flow (if, switch, etc.)
    Control,
    /// User-defined custom nodes
    Custom,
}

impl std::fmt::Display for NodeCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            Self::Math => "Math",
            Self::Logic => "Logic",
            Self::String => "String",
            Self::Array => "Array",
            Self::Object => "Object",
            Self::Type => "Type",
            Self::IO => "I/O",
            Self::Control => "Control",
            Self::Custom => "Custom",
        };
        write!(f, "{}", name)
    }
}

/// Data types for flow ports
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum DataType {
    /// Number type (can hold f64, i32, u32)
    Number,
    /// String type
    String,
    /// Boolean type
    Boolean,
    /// Null/None type
    Null,
    /// Undefined/empty type
    Undefined,
    /// Array of a specific type
    Array(Box<DataType>),
    /// Object with key-value pairs
    Object,
    /// Any type (no constraint)
    Any,
    /// Date/time type
    Date,
    /// Binary data
    Buffer,
}

impl std::fmt::Display for DataType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Number => write!(f, "number"),
            Self::String => write!(f, "string"),
            Self::Boolean => write!(f, "boolean"),
            Self::Null => write!(f, "null"),
            Self::Undefined => write!(f, "undefined"),
            Self::Array(inner) => write!(f, "{}[]", inner),
            Self::Object => write!(f, "object"),
            Self::Any => write!(f, "any"),
            Self::Date => write!(f, "date"),
            Self::Buffer => write!(f, "buffer"),
        }
    }
}

/// Check if two data types are compatible for connection
pub fn types_compatible(source: &DataType, target: &DataType) -> bool {
    // Any type is compatible with everything
    if matches!(source, DataType::Any) || matches!(target, DataType::Any) {
        return true;
    }

    // Exact match
    if source == target {
        return true;
    }

    // Number, String, Boolean are compatible with their type
    match (source, target) {
        (DataType::Number, DataType::Number) => true,
        (DataType::String, DataType::String) => true,
        (DataType::Boolean, DataType::Boolean) => true,
        (DataType::Array(s), DataType::Array(t)) => types_compatible(s, t),
        _ => false,
    }
}

/// Unique identifier for a message
#[derive(Debug, Clone, Copy, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct MessageId(Uuid);

impl MessageId {
    pub fn new() -> Self {
        MessageId(Uuid::new_v4())
    }
}

impl Default for MessageId {
    fn default() -> Self {
        Self::new()
    }
}

/// Data payload for a message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessagePayload {
    Number(f64),
    String(String),
    Boolean(bool),
    Null,
    Array(Vec<MessagePayload>),
    Object(std::collections::HashMap<String, MessagePayload>),
}

impl std::fmt::Display for MessagePayload {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Number(n) => write!(f, "{}", n),
            Self::String(s) => write!(f, "{}", s),
            Self::Boolean(b) => write!(f, "{}", b),
            Self::Null => write!(f, "null"),
            Self::Array(arr) => write!(f, "[...]"),
            Self::Object(_) => write!(f, "{{...}}"),
        }
    }
}

impl MessagePayload {
    /// Get the data type of this payload
    pub fn data_type(&self) -> DataType {
        match self {
            Self::Number(_) => DataType::Number,
            Self::String(_) => DataType::String,
            Self::Boolean(_) => DataType::Boolean,
            Self::Null => DataType::Null,
            Self::Array(items) => {
                if items.is_empty() {
                    DataType::Array(Box::new(DataType::Undefined))
                } else {
                    DataType::Array(Box::new(items[0].data_type()))
                }
            }
            Self::Object(_) => DataType::Object,
        }
    }

    /// Convert to number if possible
    pub fn as_number(&self) -> Option<f64> {
        match self {
            Self::Number(n) => Some(*n),
            Self::Boolean(true) => Some(1.0),
            Self::Boolean(false) => Some(0.0),
            Self::String(s) => s.parse::<f64>().ok(),
            _ => None,
        }
    }

    /// Convert to string
    pub fn as_string(&self) -> String {
        match self {
            Self::String(s) => s.clone(),
            _ => self.to_string(),
        }
    }

    /// Convert to boolean if possible
    pub fn as_boolean(&self) -> Option<bool> {
        match self {
            Self::Boolean(b) => Some(*b),
            Self::Number(n) => Some(*n != 0.0),
            Self::String(s) => match s.to_lowercase().as_str() {
                "true" | "1" | "yes" => Some(true),
                "false" | "0" | "no" => Some(false),
                _ => None,
            },
            Self::Null => Some(false),
            _ => None,
        }
    }
}

/// Message flowing through the network
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    /// Unique message ID
    pub id: MessageId,
    /// Source node (where message came from)
    pub from_node: super::FlowNodeId,
    /// Source port (which output generated this)
    pub from_port: String,
    /// Target node (where message is going)
    pub to_node: super::FlowNodeId,
    /// Target port (which input receives this)
    pub to_port: String,
    /// The actual data
    pub payload: MessagePayload,
    /// When was this message created
    pub timestamp: f64,
    /// Optional context/metadata
    pub context: std::collections::HashMap<String, String>,
}

impl Message {
    /// Create new message
    pub fn new(
        from_node: super::FlowNodeId,
        from_port: &str,
        to_node: super::FlowNodeId,
        to_port: &str,
        payload: MessagePayload,
        timestamp: f64,
    ) -> Self {
        Message {
            id: MessageId::new(),
            from_node,
            from_port: from_port.to_string(),
            to_node,
            to_port: to_port.to_string(),
            payload,
            timestamp,
            context: std::collections::HashMap::new(),
        }
    }

    /// Set context value
    pub fn set_context(mut self, key: &str, value: &str) -> Self {
        self.context.insert(key.to_string(), value.to_string());
        self
    }
}

/// Connection type (for future use with different routing strategies)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConnectionType {
    /// Direct connection
    Direct,
    /// Buffered connection (queues messages)
    Buffered,
    /// Conditional connection (only sends if condition true)
    Conditional,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_data_type_display() {
        assert_eq!(DataType::Number.to_string(), "number");
        assert_eq!(DataType::String.to_string(), "string");
        assert_eq!(DataType::Boolean.to_string(), "boolean");
    }

    #[test]
    fn test_type_compatibility() {
        assert!(types_compatible(&DataType::Number, &DataType::Number));
        assert!(!types_compatible(&DataType::Number, &DataType::String));
        assert!(types_compatible(&DataType::Any, &DataType::Number));
        assert!(types_compatible(&DataType::String, &DataType::Any));
    }

    #[test]
    fn test_message_payload_number() {
        let payload = MessagePayload::Number(42.5);
        assert_eq!(payload.as_number(), Some(42.5));
        assert_eq!(payload.data_type(), DataType::Number);
    }

    #[test]
    fn test_message_payload_string() {
        let payload = MessagePayload::String("hello".to_string());
        assert_eq!(payload.as_string(), "hello");
        assert_eq!(payload.data_type(), DataType::String);
    }

    #[test]
    fn test_message_payload_boolean() {
        let payload = MessagePayload::Boolean(true);
        assert_eq!(payload.as_boolean(), Some(true));
        assert_eq!(payload.data_type(), DataType::Boolean);
    }

    #[test]
    fn test_message_payload_array() {
        let items = vec![
            MessagePayload::Number(1.0),
            MessagePayload::Number(2.0),
            MessagePayload::Number(3.0),
        ];
        let payload = MessagePayload::Array(items);
        assert_eq!(payload.data_type(), DataType::Array(Box::new(DataType::Number)));
    }

    #[test]
    fn test_number_to_boolean() {
        assert_eq!(MessagePayload::Number(1.0).as_boolean(), Some(true));
        assert_eq!(MessagePayload::Number(0.0).as_boolean(), Some(false));
    }

    #[test]
    fn test_string_to_number() {
        assert_eq!(
            MessagePayload::String("123.45".to_string()).as_number(),
            Some(123.45)
        );
        assert_eq!(MessagePayload::String("invalid".to_string()).as_number(), None);
    }

    #[test]
    fn test_message_creation() {
        let payload = MessagePayload::Number(42.0);
        let msg = Message::new(
            super::FlowNodeId::new(),
            "output",
            super::FlowNodeId::new(),
            "input",
            payload,
            0.0,
        );

        assert_eq!(msg.from_port, "output");
        assert_eq!(msg.to_port, "input");
    }

    #[test]
    fn test_node_category_display() {
        assert_eq!(NodeCategory::Math.to_string(), "Math");
        assert_eq!(NodeCategory::Logic.to_string(), "Logic");
        assert_eq!(NodeCategory::String.to_string(), "String");
    }
}
