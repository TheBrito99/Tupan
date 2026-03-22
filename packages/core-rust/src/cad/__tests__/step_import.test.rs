/**
 * STEP File Import Tests
 * Phase 17.6: Testing
 *
 * Tests for STEP parser and geometry conversion
 */

#[cfg(test)]
mod tests {
    use crate::cad::step_import::{STEPParser, STEPFile, STEPEntity, STEPHeader};

    // =========================================================================
    // HEADER PARSING TESTS
    // =========================================================================

    #[test]
    fn test_parse_valid_step_header() {
        let content = r#"ISO-10303-21;
HEADER;
FILE_NAME('test.stp', 2026-03-19T10:00:00, ('author'), ('org'), '', '');
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
ENDSEC;
END-ISO-10303-21;"#;

        let result = STEPParser::parse(content);
        assert!(result.is_ok());

        let file = result.unwrap();
        assert_eq!(file.header.filename, "test.stp");
        assert_eq!(file.header.author, "author");
        assert_eq!(file.header.organization, "org");
    }

    #[test]
    fn test_parse_invalid_step_format() {
        let content = "INVALID STEP FORMAT";

        let result = STEPParser::parse(content);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_missing_header_section() {
        let content = r#"ISO-10303-21;
DATA;
ENDSEC;
END-ISO-10303-21;"#;

        let result = STEPParser::parse(content);
        // Should handle missing header gracefully
        assert!(result.is_ok());
    }

    // =========================================================================
    // ENTITY PARSING TESTS
    // =========================================================================

    #[test]
    fn test_parse_cartesian_point() {
        let content = r#"ISO-10303-21;
HEADER;
FILE_NAME('test.stp', '', '', '', '', '');
ENDSEC;
DATA;
#1 = CARTESIAN_POINT('', (0.0, 0.0, 0.0));
ENDSEC;
END-ISO-10303-21;"#;

        let result = STEPParser::parse(content);
        assert!(result.is_ok());

        let file = result.unwrap();
        assert_eq!(file.entities.len(), 1);

        if let Some(STEPEntity::Point { coordinates }) = file.entities.get(&1) {
            assert_eq!(coordinates[0], 0.0);
            assert_eq!(coordinates[1], 0.0);
            assert_eq!(coordinates[2], 0.0);
        } else {
            panic!("Expected Point entity");
        }
    }

    #[test]
    fn test_parse_point_with_coordinates() {
        let content = r#"ISO-10303-21;
HEADER;
FILE_NAME('test.stp', '', '', '', '', '');
ENDSEC;
DATA;
#1 = CARTESIAN_POINT('', (10.5, 20.3, 30.7));
ENDSEC;
END-ISO-10303-21;"#;

        let result = STEPParser::parse(content);
        let file = result.unwrap();

        if let Some(STEPEntity::Point { coordinates }) = file.entities.get(&1) {
            assert!((coordinates[0] - 10.5).abs() < 0.01);
            assert!((coordinates[1] - 20.3).abs() < 0.01);
            assert!((coordinates[2] - 30.7).abs() < 0.01);
        }
    }

    #[test]
    fn test_parse_multiple_points() {
        let content = r#"ISO-10303-21;
HEADER;
FILE_NAME('test.stp', '', '', '', '', '');
ENDSEC;
DATA;
#1 = CARTESIAN_POINT('', (0.0, 0.0, 0.0));
#2 = CARTESIAN_POINT('', (1.0, 1.0, 1.0));
#3 = CARTESIAN_POINT('', (2.0, 2.0, 2.0));
ENDSEC;
END-ISO-10303-21;"#;

        let result = STEPParser::parse(content);
        let file = result.unwrap();

        assert_eq!(file.entities.len(), 3);
        assert!(file.entities.contains_key(&1));
        assert!(file.entities.contains_key(&2));
        assert!(file.entities.contains_key(&3));
    }

    // =========================================================================
    // CIRCLE PARSING TESTS
    // =========================================================================

    #[test]
    fn test_parse_circle() {
        let content = r#"ISO-10303-21;
HEADER;
FILE_NAME('test.stp', '', '', '', '', '');
ENDSEC;
DATA;
#1 = CIRCLE('', *, 5.0);
ENDSEC;
END-ISO-10303-21;"#;

        let result = STEPParser::parse(content);
        let file = result.unwrap();

        if let Some(STEPEntity::Circle { radius, .. }) = file.entities.get(&1) {
            assert_eq!(*radius, 5.0);
        } else {
            panic!("Expected Circle entity");
        }
    }

    // =========================================================================
    // PLANE PARSING TESTS
    // =========================================================================

    #[test]
    fn test_parse_plane() {
        let content = r#"ISO-10303-21;
HEADER;
FILE_NAME('test.stp', '', '', '', '', '');
ENDSEC;
DATA;
#1 = PLANE('', *, (0.0, 0.0, 1.0));
ENDSEC;
END-ISO-10303-21;"#;

        let result = STEPParser::parse(content);
        let file = result.unwrap();

        if let Some(STEPEntity::Plane { normal, .. }) = file.entities.get(&1) {
            assert_eq!(normal[2], 1.0);
        } else {
            panic!("Expected Plane entity");
        }
    }

    // =========================================================================
    // SHELL BUILDING TESTS
    // =========================================================================

    #[test]
    fn test_build_shells_from_points() {
        let mut file = STEPFile {
            header: STEPHeader {
                filename: "test.stp".to_string(),
                time_stamp: "2026-03-19".to_string(),
                author: "Test".to_string(),
                organization: "Test Org".to_string(),
                preprocessor: "STEP".to_string(),
                originating_system: "Tupan".to_string(),
            },
            entities: std::collections::HashMap::new(),
            shells: Vec::new(),
        };

        // Add some points
        file.entities.insert(
            1,
            STEPEntity::Point {
                coordinates: [0.0, 0.0, 0.0],
            },
        );
        file.entities.insert(
            2,
            STEPEntity::Point {
                coordinates: [1.0, 0.0, 0.0],
            },
        );

        let result = file.build_shells();
        assert!(result.is_ok());
        assert!(file.shells.len() > 0);
    }

    #[test]
    fn test_export_to_step_format() {
        let file = STEPFile {
            header: STEPHeader {
                filename: "test.stp".to_string(),
                time_stamp: "2026-03-19".to_string(),
                author: "Test".to_string(),
                organization: "Test Org".to_string(),
                preprocessor: "STEP".to_string(),
                originating_system: "Tupan".to_string(),
            },
            entities: std::collections::HashMap::new(),
            shells: Vec::new(),
        };

        let step_content = file.to_step();

        assert!(step_content.contains("ISO-10303-21"));
        assert!(step_content.contains("HEADER"));
        assert!(step_content.contains("DATA"));
        assert!(step_content.contains("ENDSEC"));
        assert!(step_content.contains("END-ISO-10303-21"));
    }

    // =========================================================================
    // NUMBER EXTRACTION TESTS
    // =========================================================================

    #[test]
    fn test_extract_number_from_line() {
        let line = "RADIUS(2.5)";
        let num = STEPParser::extract_number(line, "RADIUS");

        assert!(num.is_some());
        assert_eq!(num.unwrap(), 2.5);
    }

    #[test]
    fn test_extract_negative_number() {
        let line = "VALUE(-10.5)";
        let num = STEPParser::extract_number(line, "VALUE");

        assert!(num.is_some());
        assert_eq!(num.unwrap(), -10.5);
    }

    #[test]
    fn test_extract_number_not_found() {
        let line = "SOME TEXT";
        let num = STEPParser::extract_number(line, "RADIUS");

        assert!(num.is_none());
    }

    #[test]
    fn test_extract_integer_as_number() {
        let line = "COUNT(42)";
        let num = STEPParser::extract_number(line, "COUNT");

        assert!(num.is_some());
        assert_eq!(num.unwrap(), 42.0);
    }

    // =========================================================================
    // ROUNDTRIP TESTS
    // =========================================================================

    #[test]
    fn test_parse_and_export_roundtrip() {
        let original = r#"ISO-10303-21;
HEADER;
FILE_NAME('roundtrip.stp', '', '', '', '', '');
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
#1 = CARTESIAN_POINT('', (0.0, 0.0, 0.0));
ENDSEC;
END-ISO-10303-21;"#;

        let result = STEPParser::parse(original);
        assert!(result.is_ok());

        let file = result.unwrap();
        let exported = file.to_step();

        // Check that exported version contains key elements
        assert!(exported.contains("ISO-10303-21"));
        assert!(exported.contains("FILE_NAME"));
        assert!(exported.contains("ENDSEC"));
    }

    // =========================================================================
    // ERROR HANDLING TESTS
    // =========================================================================

    #[test]
    fn test_handle_empty_file() {
        let content = "";
        let result = STEPParser::parse(content);

        // Should return error for empty file
        assert!(result.is_err());
    }

    #[test]
    fn test_handle_malformed_point() {
        let content = r#"ISO-10303-21;
HEADER;
FILE_NAME('test.stp', '', '', '', '', '');
ENDSEC;
DATA;
#1 = CARTESIAN_POINT('', (invalid, coords));
ENDSEC;
END-ISO-10303-21;"#;

        let result = STEPParser::parse(content);
        // Parser should still complete, but point won't be valid
        assert!(result.is_ok());
    }

    #[test]
    fn test_handle_large_coordinates() {
        let content = r#"ISO-10303-21;
HEADER;
FILE_NAME('test.stp', '', '', '', '', '');
ENDSEC;
DATA;
#1 = CARTESIAN_POINT('', (1000.5, 2000.3, 3000.7));
ENDSEC;
END-ISO-10303-21;"#;

        let result = STEPParser::parse(content);
        let file = result.unwrap();

        if let Some(STEPEntity::Point { coordinates }) = file.entities.get(&1) {
            assert!((coordinates[0] - 1000.5).abs() < 0.01);
            assert!((coordinates[1] - 2000.3).abs() < 0.01);
            assert!((coordinates[2] - 3000.7).abs() < 0.01);
        }
    }

    #[test]
    fn test_handle_negative_coordinates() {
        let content = r#"ISO-10303-21;
HEADER;
FILE_NAME('test.stp', '', '', '', '', '');
ENDSEC;
DATA;
#1 = CARTESIAN_POINT('', (-5.5, -10.3, -15.7));
ENDSEC;
END-ISO-10303-21;"#;

        let result = STEPParser::parse(content);
        let file = result.unwrap();

        if let Some(STEPEntity::Point { coordinates }) = file.entities.get(&1) {
            assert!((coordinates[0] - (-5.5)).abs() < 0.01);
            assert!((coordinates[1] - (-10.3)).abs() < 0.01);
            assert!((coordinates[2] - (-15.7)).abs() < 0.01);
        }
    }
}
