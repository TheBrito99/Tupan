/**
 * Layer Management System
 *
 * Supports:
 * - Multiple drawing layers with visibility and lock states
 * - Layer properties (color, line width, transparency)
 * - Active layer for operations
 * - Layer ordering and grouping
 *
 * Used by all 2D CAD tools (schematic, PCB, general CAD)
 */

use std::collections::HashMap;

#[derive(Clone, Debug, PartialEq)]
pub struct Layer {
    pub name: String,
    pub visible: bool,
    pub locked: bool,
    pub color: (u8, u8, u8),
    pub line_width: f64,
    pub transparency: f64,  // 0.0 (transparent) to 1.0 (opaque)
    pub order: u32,         // For z-ordering
}

impl Layer {
    pub fn new(name: &str) -> Self {
        Layer {
            name: name.to_string(),
            visible: true,
            locked: false,
            color: (255, 255, 255),
            line_width: 1.0,
            transparency: 1.0,
            order: 0,
        }
    }

    pub fn with_color(mut self, r: u8, g: u8, b: u8) -> Self {
        self.color = (r, g, b);
        self
    }

    pub fn with_line_width(mut self, width: f64) -> Self {
        self.line_width = width;
        self
    }

    pub fn with_transparency(mut self, transparency: f64) -> Self {
        self.transparency = transparency.clamp(0.0, 1.0);
        self
    }
}

pub struct LayerManager {
    layers: HashMap<String, Layer>,
    active_layer: String,
    layer_order: Vec<String>,  // For z-ordering
}

impl LayerManager {
    pub fn new() -> Self {
        let mut layers = HashMap::new();
        let default_layer = Layer::new("0");
        layers.insert("0".to_string(), default_layer);

        LayerManager {
            layers,
            active_layer: "0".to_string(),
            layer_order: vec!["0".to_string()],
        }
    }

    pub fn add_layer(&mut self, layer: Layer) -> Result<(), String> {
        if self.layers.contains_key(&layer.name) {
            return Err(format!("Layer '{}' already exists", layer.name));
        }

        let order = self.layers.len() as u32;
        let mut new_layer = layer;
        new_layer.order = order;

        self.layers.insert(new_layer.name.clone(), new_layer);
        self.layer_order.push(layer.name.clone());

        Ok(())
    }

    pub fn remove_layer(&mut self, name: &str) -> Result<(), String> {
        if name == "0" {
            return Err("Cannot remove default layer '0'".to_string());
        }

        if !self.layers.contains_key(name) {
            return Err(format!("Layer '{}' not found", name));
        }

        self.layers.remove(name);
        self.layer_order.retain(|n| n != name);

        if self.active_layer == name {
            self.active_layer = "0".to_string();
        }

        Ok(())
    }

    pub fn set_active_layer(&mut self, name: &str) -> Result<(), String> {
        if !self.layers.contains_key(name) {
            return Err(format!("Layer '{}' not found", name));
        }

        self.active_layer = name.to_string();
        Ok(())
    }

    pub fn get_active_layer(&self) -> &Layer {
        &self.layers[&self.active_layer]
    }

    pub fn get_active_layer_mut(&mut self) -> &mut Layer {
        let active = self.active_layer.clone();
        &mut self.layers[&active]
    }

    pub fn get_layer(&self, name: &str) -> Option<&Layer> {
        self.layers.get(name)
    }

    pub fn get_layer_mut(&mut self, name: &str) -> Option<&mut Layer> {
        self.layers.get_mut(name)
    }

    pub fn get_active_layer_name(&self) -> &str {
        &self.active_layer
    }

    pub fn get_layers(&self) -> Vec<&Layer> {
        let mut layers: Vec<_> = self.layers.values().collect();
        layers.sort_by_key(|l| l.order);
        layers
    }

    pub fn get_layers_mut(&mut self) -> Vec<&mut Layer> {
        self.layers.values_mut().collect()
    }

    pub fn get_visible_layers(&self) -> Vec<&Layer> {
        let mut layers: Vec<_> = self.layers.values().filter(|l| l.visible).collect();
        layers.sort_by_key(|l| l.order);
        layers
    }

    pub fn set_layer_visibility(&mut self, name: &str, visible: bool) -> Result<(), String> {
        match self.layers.get_mut(name) {
            Some(layer) => {
                layer.visible = visible;
                Ok(())
            }
            None => Err(format!("Layer '{}' not found", name)),
        }
    }

    pub fn set_layer_locked(&mut self, name: &str, locked: bool) -> Result<(), String> {
        match self.layers.get_mut(name) {
            Some(layer) => {
                layer.locked = locked;
                Ok(())
            }
            None => Err(format!("Layer '{}' not found", name)),
        }
    }

    pub fn is_layer_locked(&self, name: &str) -> bool {
        self.layers
            .get(name)
            .map(|l| l.locked)
            .unwrap_or(false)
    }

    pub fn is_layer_visible(&self, name: &str) -> bool {
        self.layers
            .get(name)
            .map(|l| l.visible)
            .unwrap_or(false)
    }

    pub fn move_layer_up(&mut self, name: &str) -> Result<(), String> {
        let idx = self.layer_order.iter().position(|n| n == name)
            .ok_or_else(|| format!("Layer '{}' not found", name))?;

        if idx < self.layer_order.len() - 1 {
            self.layer_order.swap(idx, idx + 1);
            self.update_layer_order();
        }

        Ok(())
    }

    pub fn move_layer_down(&mut self, name: &str) -> Result<(), String> {
        let idx = self.layer_order.iter().position(|n| n == name)
            .ok_or_else(|| format!("Layer '{}' not found", name))?;

        if idx > 0 {
            self.layer_order.swap(idx, idx - 1);
            self.update_layer_order();
        }

        Ok(())
    }

    fn update_layer_order(&mut self) {
        for (i, name) in self.layer_order.iter().enumerate() {
            if let Some(layer) = self.layers.get_mut(name) {
                layer.order = i as u32;
            }
        }
    }

    pub fn get_layer_count(&self) -> usize {
        self.layers.len()
    }
}

impl Default for LayerManager {
    fn default() -> Self {
        LayerManager::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_layer_creation() {
        let manager = LayerManager::new();
        assert_eq!(manager.get_layer_count(), 1);
        assert!(manager.get_layer("0").is_some());
        assert_eq!(manager.get_active_layer_name(), "0");
    }

    #[test]
    fn test_add_layer() {
        let mut manager = LayerManager::new();
        let layer = Layer::new("symbols").with_color(255, 0, 0);
        assert!(manager.add_layer(layer).is_ok());
        assert_eq!(manager.get_layer_count(), 2);
    }

    #[test]
    fn test_duplicate_layer_error() {
        let mut manager = LayerManager::new();
        let layer1 = Layer::new("test");
        let layer2 = Layer::new("test");
        assert!(manager.add_layer(layer1).is_ok());
        assert!(manager.add_layer(layer2).is_err());
    }

    #[test]
    fn test_set_active_layer() {
        let mut manager = LayerManager::new();
        manager.add_layer(Layer::new("test")).unwrap();
        assert!(manager.set_active_layer("test").is_ok());
        assert_eq!(manager.get_active_layer_name(), "test");
    }

    #[test]
    fn test_remove_layer() {
        let mut manager = LayerManager::new();
        manager.add_layer(Layer::new("test")).unwrap();
        assert!(manager.remove_layer("test").is_ok());
        assert_eq!(manager.get_layer_count(), 1);
    }

    #[test]
    fn test_cannot_remove_default_layer() {
        let mut manager = LayerManager::new();
        assert!(manager.remove_layer("0").is_err());
    }

    #[test]
    fn test_layer_visibility() {
        let mut manager = LayerManager::new();
        manager.add_layer(Layer::new("hidden")).unwrap();
        manager.set_layer_visibility("hidden", false).unwrap();
        assert!(!manager.is_layer_visible("hidden"));
        assert_eq!(manager.get_visible_layers().len(), 1); // Only "0"
    }

    #[test]
    fn test_layer_locked() {
        let mut manager = LayerManager::new();
        manager.add_layer(Layer::new("locked")).unwrap();
        manager.set_layer_locked("locked", true).unwrap();
        assert!(manager.is_layer_locked("locked"));
    }

    #[test]
    fn test_layer_ordering() {
        let mut manager = LayerManager::new();
        manager.add_layer(Layer::new("a")).unwrap();
        manager.add_layer(Layer::new("b")).unwrap();
        manager.add_layer(Layer::new("c")).unwrap();

        manager.move_layer_up("a").unwrap();
        let layers = manager.get_layers();
        assert_eq!(layers[layers.len() - 1].name, "a");
    }

    #[test]
    fn test_layer_properties() {
        let layer = Layer::new("test")
            .with_color(100, 150, 200)
            .with_line_width(2.5)
            .with_transparency(0.75);

        assert_eq!(layer.color, (100, 150, 200));
        assert_eq!(layer.line_width, 2.5);
        assert_eq!(layer.transparency, 0.75);
    }
}
