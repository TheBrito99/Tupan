//! Vendor Tool Catalog System
//!
//! Integrates with major tool vendors for catalog data, pricing, and availability.
//! Supports SKU tracking, tool specifications, and cost optimization.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Major cutting tool vendors
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ToolVendor {
    Sandvik,
    Kennametal,
    Seco,
    ISCAR,
    Mitsubishi,
    OSG,
    YG1,
    Harvey,
    Helical,
    Mapal,
    Korloy,
    Taegutec,
    Widia,
}

impl ToolVendor {
    pub fn name(&self) -> &'static str {
        match self {
            Self::Sandvik => "Sandvik Coromant",
            Self::Kennametal => "Kennametal",
            Self::Seco => "Seco",
            Self::ISCAR => "ISCAR",
            Self::Mitsubishi => "Mitsubishi Carbide",
            Self::OSG => "OSG",
            Self::YG1 => "YG1",
            Self::Harvey => "Harvey Tool",
            Self::Helical => "Helical Tools",
            Self::Mapal => "Mapal",
            Self::Korloy => "Korloy",
            Self::Taegutec => "Taegutec",
            Self::Widia => "Widia",
        }
    }

    pub fn country(&self) -> &'static str {
        match self {
            Self::Sandvik => "Sweden",
            Self::Kennametal => "USA",
            Self::Seco => "USA",
            Self::ISCAR => "Israel",
            Self::Mitsubishi => "Japan",
            Self::OSG => "Japan",
            Self::YG1 => "South Korea",
            Self::Harvey => "USA",
            Self::Helical => "USA",
            Self::Mapal => "Germany",
            Self::Korloy => "South Korea",
            Self::Taegutec => "South Korea",
            Self::Widia => "USA",
        }
    }
}

/// Tool coating types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Coating {
    Uncoated,
    TiN,           // Titanium Nitride
    TiCN,          // Titanium Carbonitride
    TiAlN,         // Titanium Aluminum Nitride
    AlTiN,         // Aluminum Titanium Nitride (high-temp variant)
    AlCrN,         // Aluminum Chromium Nitride
    CrN,           // Chromium Nitride
    Diamond,
    DLC,           // Diamond-Like Carbon
    PVD,           // Physical Vapor Deposition (generic)
    CVD,           // Chemical Vapor Deposition (generic)
}

impl Coating {
    pub fn description(&self) -> &'static str {
        match self {
            Self::Uncoated => "Uncoated carbide",
            Self::TiN => "Titanium Nitride - general purpose, good wear resistance",
            Self::TiCN => "Titanium Carbonitride - improved adhesion",
            Self::TiAlN => "Titanium Aluminum Nitride - high speed capability",
            Self::AlTiN => "Aluminum Titanium Nitride - extreme high speed",
            Self::AlCrN => "Aluminum Chromium Nitride - excellent thermal stability",
            Self::CrN => "Chromium Nitride - good toughness",
            Self::Diamond => "PCD (Polycrystalline Diamond) - non-ferrous materials",
            Self::DLC => "Diamond-Like Carbon - low friction, aluminum-friendly",
            Self::PVD => "Physical Vapor Deposition coating",
            Self::CVD => "Chemical Vapor Deposition coating",
        }
    }

    pub fn max_surface_speed(&self) -> f64 {
        match self {
            Self::Uncoated => 100.0,      // m/min
            Self::TiN => 200.0,
            Self::TiCN => 250.0,
            Self::TiAlN => 350.0,
            Self::AlTiN => 500.0,
            Self::AlCrN => 450.0,
            Self::CrN => 220.0,
            Self::Diamond => 1000.0,
            Self::DLC => 280.0,
            Self::PVD => 250.0,
            Self::CVD => 200.0,
        }
    }
}

/// Tool availability status
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Availability {
    pub in_stock: bool,
    pub quantity_available: u32,
    pub lead_time_days: u32,
    pub last_updated: String,
}

impl Default for Availability {
    fn default() -> Self {
        Availability {
            in_stock: false,
            quantity_available: 0,
            lead_time_days: 30,
            last_updated: String::from("2026-03-20"),
        }
    }
}

/// Vendor tool from manufacturer catalog
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VendorTool {
    pub sku: String,                                                   // Manufacturer part number
    pub vendor: ToolVendor,
    pub description: String,
    pub tool_type: String,                                            // "EndMill", "Drill", "ThreadMill", etc.
    pub diameter_mm: f64,
    pub flute_length_mm: f64,
    pub cutting_length_mm: f64,
    pub shank_diameter_mm: f64,
    pub overall_length_mm: f64,
    pub number_of_flutes: u32,
    pub material: String,                                             // "Carbide", "HSS", "Ceramic"
    pub coating: Option<Coating>,
    pub price_usd: f64,
    pub availability: Availability,
    pub specifications: HashMap<String, String>,                       // Custom specs
}

impl VendorTool {
    pub fn new(sku: &str, vendor: ToolVendor, tool_type: &str, diameter_mm: f64) -> Self {
        VendorTool {
            sku: sku.to_string(),
            vendor,
            description: format!("{} - {} {}mm", vendor.name(), tool_type, diameter_mm),
            tool_type: tool_type.to_string(),
            diameter_mm,
            flute_length_mm: 0.0,
            cutting_length_mm: 0.0,
            shank_diameter_mm: 0.0,
            overall_length_mm: 0.0,
            number_of_flutes: 2,
            material: "Carbide".to_string(),
            coating: Some(Coating::TiAlN),
            price_usd: 50.0,
            availability: Availability::default(),
            specifications: HashMap::new(),
        }
    }

    pub fn with_coating(mut self, coating: Coating) -> Self {
        self.coating = Some(coating);
        self
    }

    pub fn with_price(mut self, price: f64) -> Self {
        self.price_usd = price;
        self
    }

    pub fn with_availability(mut self, available: bool, quantity: u32, lead_time: u32) -> Self {
        self.availability.in_stock = available;
        self.availability.quantity_available = quantity;
        self.availability.lead_time_days = lead_time;
        self
    }

    pub fn with_flute_length(mut self, length: f64) -> Self {
        self.flute_length_mm = length;
        self
    }

    pub fn with_flutes(mut self, count: u32) -> Self {
        self.number_of_flutes = count;
        self
    }

    pub fn cost_per_tool(&self) -> f64 {
        self.price_usd
    }

    pub fn cost_per_insert(&self) -> f64 {
        // Some tools use replaceable inserts (cost per edge)
        self.price_usd / (self.number_of_flutes as f64)
    }
}

/// Vendor catalog manager
pub struct VendorCatalog {
    tools: HashMap<String, VendorTool>,  // SKU -> Tool
    vendor_filters: HashMap<ToolVendor, Vec<String>>,  // Vendor -> SKUs
}

impl VendorCatalog {
    pub fn new() -> Self {
        VendorCatalog {
            tools: HashMap::new(),
            vendor_filters: HashMap::new(),
        }
    }

    pub fn add_tool(&mut self, tool: VendorTool) {
        let vendor = tool.vendor;
        let sku = tool.sku.clone();

        self.tools.insert(sku.clone(), tool);

        self.vendor_filters
            .entry(vendor)
            .or_insert_with(Vec::new)
            .push(sku);
    }

    pub fn find_by_sku(&self, sku: &str) -> Option<&VendorTool> {
        self.tools.get(sku)
    }

    pub fn find_by_vendor(&self, vendor: ToolVendor) -> Vec<&VendorTool> {
        self.vendor_filters
            .get(&vendor)
            .map(|skus| {
                skus.iter()
                    .filter_map(|sku| self.tools.get(sku))
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn find_by_diameter(&self, diameter: f64, tolerance: f64) -> Vec<&VendorTool> {
        self.tools
            .values()
            .filter(|tool| (tool.diameter_mm - diameter).abs() <= tolerance)
            .collect()
    }

    pub fn find_by_type(&self, tool_type: &str) -> Vec<&VendorTool> {
        self.tools
            .values()
            .filter(|tool| tool.tool_type == tool_type)
            .collect()
    }

    pub fn find_cheapest(&self, tool_type: &str, diameter: f64) -> Option<&VendorTool> {
        self.find_by_type(tool_type)
            .iter()
            .filter(|tool| (tool.diameter_mm - diameter).abs() < 0.01)
            .min_by(|a, b| a.price_usd.partial_cmp(&b.price_usd).unwrap())
            .copied()
    }

    pub fn find_in_stock(&self, tool_type: &str) -> Vec<&VendorTool> {
        self.find_by_type(tool_type)
            .iter()
            .filter(|tool| tool.availability.in_stock)
            .copied()
            .collect()
    }

    pub fn load_default_catalog() -> Self {
        let mut catalog = VendorCatalog::new();

        // Sandvik Coromant EndMills
        catalog.add_tool(
            VendorTool::new("EM-1.5-S", ToolVendor::Sandvik, "EndMill", 1.5)
                .with_coating(Coating::TiAlN)
                .with_price(45.0)
                .with_availability(true, 25, 2)
                .with_flute_length(5.0),
        );
        catalog.add_tool(
            VendorTool::new("EM-3.0-S", ToolVendor::Sandvik, "EndMill", 3.0)
                .with_coating(Coating::TiAlN)
                .with_price(55.0)
                .with_availability(true, 20, 2)
                .with_flute_length(10.0),
        );
        catalog.add_tool(
            VendorTool::new("EM-6.0-S", ToolVendor::Sandvik, "EndMill", 6.0)
                .with_coating(Coating::TiAlN)
                .with_price(65.0)
                .with_availability(true, 15, 2)
                .with_flute_length(18.0),
        );

        // Kennametal Drills
        catalog.add_tool(
            VendorTool::new("DR-2.0-K", ToolVendor::Kennametal, "Drill", 2.0)
                .with_coating(Coating::TiCN)
                .with_price(25.0)
                .with_availability(true, 30, 1)
                .with_flutes(2),
        );
        catalog.add_tool(
            VendorTool::new("DR-5.0-K", ToolVendor::Kennametal, "Drill", 5.0)
                .with_coating(Coating::TiCN)
                .with_price(35.0)
                .with_availability(true, 25, 1)
                .with_flutes(2),
        );

        // ISCAR Threading Tools
        catalog.add_tool(
            VendorTool::new("THR-M1.5-I", ToolVendor::ISCAR, "ThreadMill", 1.5)
                .with_coating(Coating::TiAlN)
                .with_price(120.0)
                .with_availability(true, 10, 3),
        );

        // YG1 Ball Mills
        catalog.add_tool(
            VendorTool::new("BM-2.0-Y", ToolVendor::YG1, "BallMill", 2.0)
                .with_coating(Coating::AlTiN)
                .with_price(48.0)
                .with_availability(true, 20, 2)
                .with_flute_length(6.0),
        );

        // Harvey Tool Micro EndMills
        catalog.add_tool(
            VendorTool::new("MEM-0.5-H", ToolVendor::Harvey, "MicroEndMill", 0.5)
                .with_coating(Coating::Uncoated)
                .with_price(35.0)
                .with_availability(true, 50, 1)
                .with_flute_length(2.0),
        );

        catalog
    }
}

impl Default for VendorCatalog {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vendor_tool_creation() {
        let tool = VendorTool::new("EM-3.0-S", ToolVendor::Sandvik, "EndMill", 3.0);
        assert_eq!(tool.sku, "EM-3.0-S");
        assert_eq!(tool.diameter_mm, 3.0);
        assert_eq!(tool.vendor, ToolVendor::Sandvik);
    }

    #[test]
    fn test_vendor_tool_builder() {
        let tool = VendorTool::new("EM-3.0-S", ToolVendor::Sandvik, "EndMill", 3.0)
            .with_coating(Coating::TiAlN)
            .with_price(55.0)
            .with_flute_length(10.0)
            .with_flutes(3);

        assert_eq!(tool.coating, Some(Coating::TiAlN));
        assert_eq!(tool.price_usd, 55.0);
        assert_eq!(tool.flute_length_mm, 10.0);
        assert_eq!(tool.number_of_flutes, 3);
    }

    #[test]
    fn test_vendor_catalog_add_and_find() {
        let mut catalog = VendorCatalog::new();
        let tool = VendorTool::new("EM-3.0-S", ToolVendor::Sandvik, "EndMill", 3.0)
            .with_price(55.0);

        catalog.add_tool(tool.clone());

        let found = catalog.find_by_sku("EM-3.0-S");
        assert!(found.is_some());
        assert_eq!(found.unwrap().sku, "EM-3.0-S");
    }

    #[test]
    fn test_find_by_vendor() {
        let mut catalog = VendorCatalog::new();
        catalog.add_tool(VendorTool::new("EM-3.0-S", ToolVendor::Sandvik, "EndMill", 3.0));
        catalog.add_tool(VendorTool::new("EM-4.0-S", ToolVendor::Sandvik, "EndMill", 4.0));
        catalog.add_tool(VendorTool::new("DR-2.0-K", ToolVendor::Kennametal, "Drill", 2.0));

        let sandvik_tools = catalog.find_by_vendor(ToolVendor::Sandvik);
        assert_eq!(sandvik_tools.len(), 2);

        let kennametal_tools = catalog.find_by_vendor(ToolVendor::Kennametal);
        assert_eq!(kennametal_tools.len(), 1);
    }

    #[test]
    fn test_find_by_diameter() {
        let mut catalog = VendorCatalog::new();
        catalog.add_tool(VendorTool::new("EM-3.0-S", ToolVendor::Sandvik, "EndMill", 3.0));
        catalog.add_tool(VendorTool::new("EM-3.1-S", ToolVendor::Sandvik, "EndMill", 3.1));
        catalog.add_tool(VendorTool::new("EM-6.0-S", ToolVendor::Sandvik, "EndMill", 6.0));

        let close_to_3mm = catalog.find_by_diameter(3.0, 0.2);
        assert_eq!(close_to_3mm.len(), 2);
    }

    #[test]
    fn test_find_cheapest() {
        let mut catalog = VendorCatalog::new();
        catalog.add_tool(
            VendorTool::new("EM-3.0-S", ToolVendor::Sandvik, "EndMill", 3.0)
                .with_price(55.0),
        );
        catalog.add_tool(
            VendorTool::new("EM-3.0-K", ToolVendor::Kennametal, "EndMill", 3.0)
                .with_price(45.0),
        );

        let cheapest = catalog.find_cheapest("EndMill", 3.0);
        assert!(cheapest.is_some());
        assert_eq!(cheapest.unwrap().sku, "EM-3.0-K");
    }

    #[test]
    fn test_find_in_stock() {
        let mut catalog = VendorCatalog::new();
        catalog.add_tool(
            VendorTool::new("EM-3.0-S", ToolVendor::Sandvik, "EndMill", 3.0)
                .with_availability(true, 10, 1),
        );
        catalog.add_tool(
            VendorTool::new("EM-4.0-S", ToolVendor::Sandvik, "EndMill", 4.0)
                .with_availability(false, 0, 30),
        );

        let in_stock = catalog.find_in_stock("EndMill");
        assert_eq!(in_stock.len(), 1);
        assert_eq!(in_stock[0].sku, "EM-3.0-S");
    }

    #[test]
    fn test_coating_properties() {
        assert_eq!(Coating::Uncoated.max_surface_speed(), 100.0);
        assert_eq!(Coating::TiAlN.max_surface_speed(), 350.0);
        assert_eq!(Coating::AlTiN.max_surface_speed(), 500.0);
        assert_eq!(Coating::Diamond.max_surface_speed(), 1000.0);
    }

    #[test]
    fn test_default_catalog_loading() {
        let catalog = VendorCatalog::load_default_catalog();
        assert!(!catalog.tools.is_empty());

        // Verify some default tools exist
        assert!(catalog.find_by_sku("EM-1.5-S").is_some());
        assert!(catalog.find_by_sku("DR-2.0-K").is_some());
        assert!(catalog.find_by_sku("THR-M1.5-I").is_some());
    }

    #[test]
    fn test_vendor_tool_costs() {
        let tool = VendorTool::new("EM-3.0-S", ToolVendor::Sandvik, "EndMill", 3.0)
            .with_price(100.0)
            .with_flutes(4);

        assert_eq!(tool.cost_per_tool(), 100.0);
        assert_eq!(tool.cost_per_insert(), 25.0);
    }
}
