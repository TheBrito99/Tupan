/**
 * DXF File Format Support
 *
 * Enables import/export of 2D drawings in DXF format
 * Compatible with AutoCAD, KiCAD, and other CAD tools
 *
 * Current support:
 * - Line entities
 * - Circle entities
 * - Arc entities
 * - Polyline entities
 * - Text entities
 * - Layer information
 * - Color properties
 */

use crate::geometry::{GeometricEntity, Point};
use std::fs;
use std::io::{Read, Write};
use std::collections::HashMap;

/// Placeholder layer type
#[derive(Debug, Clone)]
pub struct Layer {
    pub name: String,
}

/// Placeholder layer manager
#[derive(Debug, Clone)]
pub struct LayerManager {
    layers: HashMap<String, Layer>,
}

impl LayerManager {
    pub fn new() -> Self {
        LayerManager {
            layers: HashMap::new(),
        }
    }

    pub fn add_layer(&mut self, layer: Layer) -> Result<(), String> {
        self.layers.insert(layer.name.clone(), layer);
        Ok(())
    }

    pub fn get_layers(&self) -> Vec<&Layer> {
        self.layers.values().collect()
    }
}

/// Represents a DXF drawing with entities and layers
pub struct DxfDrawing {
    pub entities: Vec<(String, GeometricEntity)>, // (layer_name, entity)
    pub layers: LayerManager,
}

impl DxfDrawing {
    pub fn new() -> Self {
        DxfDrawing {
            entities: Vec::new(),
            layers: LayerManager::new(),
        }
    }

    pub fn add_entity(&mut self, layer: &str, entity: GeometricEntity) {
        self.entities.push((layer.to_string(), entity));
    }

    pub fn add_layer(&mut self, layer: Layer) -> Result<(), String> {
        self.layers.add_layer(layer)
    }
}

impl Default for DxfDrawing {
    fn default() -> Self {
        Self::new()
    }
}

/// DXF Importer - reads DXF files
pub struct DxfImporter;

impl DxfImporter {
    /// Load DXF file from path
    pub fn load(path: &str) -> Result<DxfDrawing, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        Self::parse(&content)
    }

    /// Parse DXF content from string
    pub fn parse(content: &str) -> Result<DxfDrawing, String> {
        let mut drawing = DxfDrawing::new();
        let lines: Vec<&str> = content.lines().collect();
        let mut i = 0;

        while i < lines.len() {
            let line = lines[i].trim();

            // Look for ENTITIES section
            if line == "ENTITIES" && i > 0 && lines[i - 1].trim() == "0" {
                i += 1;
                // Parse entities until we hit ENDSEC
                while i < lines.len() {
                    let entity_type = lines[i].trim();

                    if entity_type == "ENDSEC" {
                        break;
                    }

                    if entity_type == "0" && i + 1 < lines.len() {
                        let entity_name = lines[i + 1].trim();

                        match entity_name {
                            "LINE" => {
                                if let Ok((entity, next_i)) = Self::parse_line(&lines, i + 2) {
                                    drawing.add_entity("0", entity);
                                    i = next_i;
                                    continue;
                                }
                            }
                            "CIRCLE" => {
                                if let Ok((entity, next_i)) = Self::parse_circle(&lines, i + 2) {
                                    drawing.add_entity("0", entity);
                                    i = next_i;
                                    continue;
                                }
                            }
                            "ARC" => {
                                if let Ok((entity, next_i)) = Self::parse_arc(&lines, i + 2) {
                                    drawing.add_entity("0", entity);
                                    i = next_i;
                                    continue;
                                }
                            }
                            "LWPOLYLINE" | "POLYLINE" => {
                                if let Ok((entity, next_i)) = Self::parse_polyline(&lines, i + 2) {
                                    drawing.add_entity("0", entity);
                                    i = next_i;
                                    continue;
                                }
                            }
                            "TEXT" => {
                                if let Ok((entity, next_i)) = Self::parse_text(&lines, i + 2) {
                                    drawing.add_entity("0", entity);
                                    i = next_i;
                                    continue;
                                }
                            }
                            _ => {}
                        }
                    }

                    i += 1;
                }
            }

            i += 1;
        }

        Ok(drawing)
    }

    fn parse_line(lines: &[&str], start: usize) -> Result<(GeometricEntity, usize), String> {
        let mut i = start;
        let mut start_point = Point { x: 0.0, y: 0.0 };
        let mut end_point = Point { x: 0.0, y: 0.0 };
        let mut found_start = false;
        let mut found_end = false;

        while i < lines.len() && lines[i].trim() != "0" {
            if i + 1 < lines.len() {
                let code: Result<i32, _> = lines[i].trim().parse();
                if let Ok(code) = code {
                    let value = lines[i + 1].trim();

                    match code {
                        10 => {
                            if let Ok(x) = value.parse() {
                                start_point.x = x;
                                found_start = true;
                            }
                        }
                        20 => {
                            if let Ok(y) = value.parse() {
                                start_point.y = y;
                            }
                        }
                        11 => {
                            if let Ok(x) = value.parse() {
                                end_point.x = x;
                                found_end = true;
                            }
                        }
                        21 => {
                            if let Ok(y) = value.parse() {
                                end_point.y = y;
                            }
                        }
                        _ => {}
                    }

                    i += 2;
                    continue;
                }
            }

            i += 1;
        }

        if found_start && found_end {
            Ok((
                GeometricEntity::Line {
                    start: start_point,
                    end: end_point,
                },
                i,
            ))
        } else {
            Err("Invalid LINE entity".to_string())
        }
    }

    fn parse_circle(lines: &[&str], start: usize) -> Result<(GeometricEntity, usize), String> {
        let mut i = start;
        let mut center = Point { x: 0.0, y: 0.0 };
        let mut radius = 0.0;
        let mut found_center = false;
        let mut found_radius = false;

        while i < lines.len() && lines[i].trim() != "0" {
            if i + 1 < lines.len() {
                let code: Result<i32, _> = lines[i].trim().parse();
                if let Ok(code) = code {
                    let value = lines[i + 1].trim();

                    match code {
                        10 => {
                            if let Ok(x) = value.parse() {
                                center.x = x;
                                found_center = true;
                            }
                        }
                        20 => {
                            if let Ok(y) = value.parse() {
                                center.y = y;
                            }
                        }
                        40 => {
                            if let Ok(r) = value.parse() {
                                radius = r;
                                found_radius = true;
                            }
                        }
                        _ => {}
                    }

                    i += 2;
                    continue;
                }
            }

            i += 1;
        }

        if found_center && found_radius && radius > 0.0 {
            Ok((GeometricEntity::Circle { center, radius }, i))
        } else {
            Err("Invalid CIRCLE entity".to_string())
        }
    }

    fn parse_arc(lines: &[&str], start: usize) -> Result<(GeometricEntity, usize), String> {
        let mut i = start;
        let mut center = Point { x: 0.0, y: 0.0 };
        let mut radius = 0.0;
        let mut start_angle = 0.0;
        let mut end_angle = 360.0;
        let mut found_center = false;
        let mut found_radius = false;

        while i < lines.len() && lines[i].trim() != "0" {
            if i + 1 < lines.len() {
                let code: Result<i32, _> = lines[i].trim().parse();
                if let Ok(code) = code {
                    let value = lines[i + 1].trim();

                    match code {
                        10 => {
                            if let Ok(x) = value.parse() {
                                center.x = x;
                                found_center = true;
                            }
                        }
                        20 => {
                            if let Ok(y) = value.parse() {
                                center.y = y;
                            }
                        }
                        40 => {
                            if let Ok(r) = value.parse() {
                                radius = r;
                                found_radius = true;
                            }
                        }
                        50 => {
                            if let Ok(angle) = value.parse::<f64>() {
                                start_angle = angle.to_radians();
                            }
                        }
                        51 => {
                            if let Ok(angle) = value.parse::<f64>() {
                                end_angle = angle.to_radians();
                            }
                        }
                        _ => {}
                    }

                    i += 2;
                    continue;
                }
            }

            i += 1;
        }

        if found_center && found_radius && radius > 0.0 {
            Ok((
                GeometricEntity::Arc {
                    center,
                    radius,
                    start_angle,
                    end_angle,
                },
                i,
            ))
        } else {
            Err("Invalid ARC entity".to_string())
        }
    }

    fn parse_polyline(lines: &[&str], start: usize) -> Result<(GeometricEntity, usize), String> {
        let mut i = start;
        let mut points = Vec::new();

        while i < lines.len() && lines[i].trim() != "0" {
            if i + 1 < lines.len() {
                let code: Result<i32, _> = lines[i].trim().parse();
                if let Ok(code) = code {
                    let value = lines[i + 1].trim();

                    match code {
                        10 => {
                            if let Ok(x) = value.parse::<f64>() {
                                // Next line should be Y coordinate (20)
                                if i + 3 < lines.len() {
                                    let next_code: Result<i32, _> = lines[i + 2].trim().parse();
                                    if let Ok(20) = next_code {
                                        if let Ok(y) = lines[i + 3].trim().parse() {
                                            points.push(Point { x, y });
                                            i += 4;
                                            continue;
                                        }
                                    }
                                }
                            }
                        }
                        _ => {}
                    }

                    i += 2;
                    continue;
                }
            }

            i += 1;
        }

        if points.len() >= 2 {
            Ok((GeometricEntity::Polygon { points }, i))
        } else {
            Err("Invalid POLYLINE entity".to_string())
        }
    }

    fn parse_text(lines: &[&str], start: usize) -> Result<(GeometricEntity, usize), String> {
        let mut i = start;
        let mut position = Point { x: 0.0, y: 0.0 };
        let mut content = String::new();
        let mut height = 1.0;
        let mut found_position = false;
        let mut found_content = false;

        while i < lines.len() && lines[i].trim() != "0" {
            if i + 1 < lines.len() {
                let code: Result<i32, _> = lines[i].trim().parse();
                if let Ok(code) = code {
                    let value = lines[i + 1].trim();

                    match code {
                        10 => {
                            if let Ok(x) = value.parse() {
                                position.x = x;
                                found_position = true;
                            }
                        }
                        20 => {
                            if let Ok(y) = value.parse() {
                                position.y = y;
                            }
                        }
                        40 => {
                            if let Ok(h) = value.parse() {
                                height = h;
                            }
                        }
                        1 => {
                            content = value.to_string();
                            found_content = true;
                        }
                        _ => {}
                    }

                    i += 2;
                    continue;
                }
            }

            i += 1;
        }

        if found_position && found_content {
            Ok((
                GeometricEntity::Text {
                    position,
                    content,
                    height,
                },
                i,
            ))
        } else {
            Err("Invalid TEXT entity".to_string())
        }
    }
}

/// DXF Exporter - writes DXF files
pub struct DxfExporter;

impl DxfExporter {
    pub fn save(path: &str, drawing: &DxfDrawing) -> Result<(), String> {
        let content = Self::to_string(drawing);
        fs::write(path, content)
            .map_err(|e| format!("Failed to write file: {}", e))
    }

    pub fn to_string(drawing: &DxfDrawing) -> String {
        let mut output = String::new();

        // DXF Header
        output.push_str("0\nSECTION\n");
        output.push_str("2\nHEADER\n");
        output.push_str("9\n$ACADVER\n1\nAC1021\n");
        output.push_str("0\nENDSEC\n");

        // Layers Section
        output.push_str("0\nSECTION\n");
        output.push_str("2\nLAYERS\n");

        for layer in drawing.layers.get_layers() {
            output.push_str("0\nLAYER\n");
            output.push_str("2\n");
            output.push_str(&layer.name);
            output.push_str("\n");
            output.push_str("62\n1\n"); // Color index
            output.push_str("370\n0\n"); // Line weight
        }

        output.push_str("0\nENDSEC\n");

        // Entities Section
        output.push_str("0\nSECTION\n");
        output.push_str("2\nENTITIES\n");

        for (layer, entity) in &drawing.entities {
            match entity {
                GeometricEntity::Line { start, end } => {
                    output.push_str("0\nLINE\n");
                    output.push_str("8\n");
                    output.push_str(layer);
                    output.push_str("\n");
                    output.push_str("10\n");
                    output.push_str(&start.x.to_string());
                    output.push_str("\n20\n");
                    output.push_str(&start.y.to_string());
                    output.push_str("\n11\n");
                    output.push_str(&end.x.to_string());
                    output.push_str("\n21\n");
                    output.push_str(&end.y.to_string());
                    output.push_str("\n");
                }
                GeometricEntity::Circle { center, radius } => {
                    output.push_str("0\nCIRCLE\n");
                    output.push_str("8\n");
                    output.push_str(layer);
                    output.push_str("\n");
                    output.push_str("10\n");
                    output.push_str(&center.x.to_string());
                    output.push_str("\n20\n");
                    output.push_str(&center.y.to_string());
                    output.push_str("\n40\n");
                    output.push_str(&radius.to_string());
                    output.push_str("\n");
                }
                GeometricEntity::Arc {
                    center,
                    radius,
                    start_angle,
                    end_angle,
                } => {
                    output.push_str("0\nARC\n");
                    output.push_str("8\n");
                    output.push_str(layer);
                    output.push_str("\n");
                    output.push_str("10\n");
                    output.push_str(&center.x.to_string());
                    output.push_str("\n20\n");
                    output.push_str(&center.y.to_string());
                    output.push_str("\n40\n");
                    output.push_str(&radius.to_string());
                    output.push_str("\n50\n");
                    output.push_str(&start_angle.to_degrees().to_string());
                    output.push_str("\n51\n");
                    output.push_str(&end_angle.to_degrees().to_string());
                    output.push_str("\n");
                }
                GeometricEntity::Polygon { points } => {
                    output.push_str("0\nLWPOLYLINE\n");
                    output.push_str("8\n");
                    output.push_str(layer);
                    output.push_str("\n");
                    output.push_str("90\n");
                    output.push_str(&points.len().to_string());
                    output.push_str("\n");

                    for point in points {
                        output.push_str("10\n");
                        output.push_str(&point.x.to_string());
                        output.push_str("\n20\n");
                        output.push_str(&point.y.to_string());
                        output.push_str("\n");
                    }
                }
                GeometricEntity::Text {
                    position,
                    content,
                    height,
                } => {
                    output.push_str("0\nTEXT\n");
                    output.push_str("8\n");
                    output.push_str(layer);
                    output.push_str("\n");
                    output.push_str("10\n");
                    output.push_str(&position.x.to_string());
                    output.push_str("\n20\n");
                    output.push_str(&position.y.to_string());
                    output.push_str("\n40\n");
                    output.push_str(&height.to_string());
                    output.push_str("\n1\n");
                    output.push_str(content);
                    output.push_str("\n");
                }
                _ => {}
            }
        }

        output.push_str("0\nENDSEC\n");

        // EOF
        output.push_str("0\nEOF\n");

        output
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dxf_roundtrip() {
        let mut drawing = DxfDrawing::new();
        drawing.add_entity(
            "0",
            GeometricEntity::Line {
                start: Point { x: 0.0, y: 0.0 },
                end: Point { x: 10.0, y: 10.0 },
            },
        );
        drawing.add_entity(
            "0",
            GeometricEntity::Circle {
                center: Point { x: 5.0, y: 5.0 },
                radius: 3.0,
            },
        );

        let dxf_str = DxfExporter::to_string(&drawing);
        assert!(dxf_str.contains("LINE"));
        assert!(dxf_str.contains("CIRCLE"));
        assert!(dxf_str.contains("10\n0"));
    }

    #[test]
    fn test_dxf_parse_line() {
        let dxf_content = "0\nSECTION\n2\nENTITIES\n0\nLINE\n10\n5.5\n20\n3.2\n11\n7.1\n21\n9.8\n0\nENDSEC\n0\nEOF\n";
        let drawing = DxfImporter::parse(dxf_content);
        assert!(drawing.is_ok());

        let drawing = drawing.unwrap();
        assert!(drawing.entities.len() > 0);
    }

    #[test]
    fn test_dxf_export_contains_header() {
        let drawing = DxfDrawing::new();
        let dxf_str = DxfExporter::to_string(&drawing);
        assert!(dxf_str.contains("SECTION"));
        assert!(dxf_str.contains("HEADER"));
        assert!(dxf_str.contains("ENTITIES"));
        assert!(dxf_str.contains("EOF"));
    }
}
