//! Petri Net Domain - Place/Transition networks for concurrent systems
//!
//! Petri nets model concurrent, asynchronous systems through:
//! - Places (state elements, contain tokens)
//! - Transitions (events, consume/produce tokens)
//! - Arcs (connections with weights)
//!
//! Features:
//! - Token firing and enabling rules
//! - Markings (state snapshots)
//! - Reachability analysis
//! - Liveness and safety checking
//! - Arc types (normal, inhibitor, read)

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use uuid::Uuid;

pub mod executor;
pub mod analysis;
pub mod domain;

pub use executor::{PetriNetExecutor, Marking, FiringRule};
pub use analysis::{analyze_petri_net, AnalysisResult};
pub use domain::{PetriNetDomain, PetriNetDiagramData, PlaceNode, TransitionNode, ArcEdge, PetriNetStatistics};

/// Unique identifier for a place
#[derive(Debug, Clone, Copy, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct PlaceId(Uuid);

impl PlaceId {
    pub fn new() -> Self {
        PlaceId(Uuid::new_v4())
    }

    pub fn from_string(s: &str) -> Result<Self, uuid::Error> {
        Ok(PlaceId(Uuid::parse_str(s)?))
    }
}

impl Default for PlaceId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for PlaceId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "P{}", self.0.to_string()[..8].to_uppercase())
    }
}

/// Unique identifier for a transition
#[derive(Debug, Clone, Copy, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct TransitionId(Uuid);

impl TransitionId {
    pub fn new() -> Self {
        TransitionId(Uuid::new_v4())
    }

    pub fn from_string(s: &str) -> Result<Self, uuid::Error> {
        Ok(TransitionId(Uuid::parse_str(s)?))
    }
}

impl Default for TransitionId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for TransitionId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "T{}", self.0.to_string()[..8].to_uppercase())
    }
}

/// Unique identifier for an arc
#[derive(Debug, Clone, Copy, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct ArcId(Uuid);

impl ArcId {
    pub fn new() -> Self {
        ArcId(Uuid::new_v4())
    }
}

impl Default for ArcId {
    fn default() -> Self {
        Self::new()
    }
}

/// Type of element (place or transition)
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum Element {
    Place(PlaceId),
    Transition(TransitionId),
}

/// Type of arc connection
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ArcType {
    /// Normal arc: consume/produce tokens
    Normal,
    /// Inhibitor arc: fire only if place has 0 tokens
    Inhibitor,
    /// Read arc: check without consuming
    Read,
}

/// Guard condition for transition firing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Guard {
    /// Boolean expression
    pub condition: String,
    /// Variables for evaluation
    pub context: HashMap<String, f64>,
}

impl Guard {
    pub fn new(condition: &str) -> Self {
        Guard {
            condition: condition.to_string(),
            context: HashMap::new(),
        }
    }

    /// Simple evaluation
    pub fn evaluate(&self) -> bool {
        true  // Placeholder
    }
}

/// Place in a Petri net (state element)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Place {
    /// Unique identifier
    pub id: PlaceId,
    /// Display name
    pub name: String,
    /// Initial number of tokens
    pub initial_tokens: u32,
    /// Maximum capacity (None = unbounded)
    pub capacity: Option<u32>,
}

impl Place {
    pub fn new(id: PlaceId, name: &str, initial_tokens: u32) -> Self {
        Place {
            id,
            name: name.to_string(),
            initial_tokens,
            capacity: None,
        }
    }

    pub fn with_capacity(mut self, capacity: u32) -> Self {
        self.capacity = Some(capacity);
        self
    }

    pub fn unbounded(name: &str) -> Self {
        Place::new(PlaceId::new(), name, 0)
    }

    pub fn source(name: &str) -> Self {
        Place::new(PlaceId::new(), name, 1)
    }

    pub fn sink(name: &str) -> Self {
        Place::new(PlaceId::new(), name, 0)
    }
}

/// Transition in a Petri net (event)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transition {
    /// Unique identifier
    pub id: TransitionId,
    /// Display name
    pub name: String,
    /// Optional guard condition
    pub guard: Option<Guard>,
    /// Priority/weight for non-deterministic choice
    pub weight: f64,
}

impl Transition {
    pub fn new(id: TransitionId, name: &str) -> Self {
        Transition {
            id,
            name: name.to_string(),
            guard: None,
            weight: 1.0,
        }
    }

    pub fn simple(name: &str) -> Self {
        Transition::new(TransitionId::new(), name)
    }

    pub fn with_guard(mut self, guard: Guard) -> Self {
        self.guard = Some(guard);
        self
    }

    pub fn with_weight(mut self, weight: f64) -> Self {
        self.weight = weight;
        self
    }
}

/// Arc connecting place to transition or vice versa
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Arc {
    /// Unique identifier
    pub id: ArcId,
    /// Source element
    pub source: Element,
    /// Target element
    pub target: Element,
    /// Token weight
    pub weight: u32,
    /// Type of arc
    pub arc_type: ArcType,
}

impl Arc {
    pub fn new(source: Element, target: Element, weight: u32) -> Self {
        Arc {
            id: ArcId::new(),
            source,
            target,
            weight,
            arc_type: ArcType::Normal,
        }
    }

    pub fn inhibitor(source: Element, target: Element) -> Self {
        Arc {
            id: ArcId::new(),
            source,
            target,
            weight: 1,
            arc_type: ArcType::Inhibitor,
        }
    }

    pub fn read(source: Element, target: Element, weight: u32) -> Self {
        Arc {
            id: ArcId::new(),
            source,
            target,
            weight,
            arc_type: ArcType::Read,
        }
    }
}

/// Complete Petri net definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PetriNet {
    /// Name of the Petri net
    pub name: String,
    /// All places indexed by ID
    pub places: HashMap<PlaceId, Place>,
    /// All transitions indexed by ID
    pub transitions: HashMap<TransitionId, Transition>,
    /// All arcs indexed by ID
    pub arcs: HashMap<ArcId, Arc>,
}

impl PetriNet {
    /// Create new empty Petri net
    pub fn new(name: &str) -> Self {
        PetriNet {
            name: name.to_string(),
            places: HashMap::new(),
            transitions: HashMap::new(),
            arcs: HashMap::new(),
        }
    }

    /// Add place to net
    pub fn add_place(&mut self, place: Place) -> Result<PlaceId, String> {
        if self.places.contains_key(&place.id) {
            return Err(format!("Place {} already exists", place.id));
        }
        let id = place.id;
        self.places.insert(id, place);
        Ok(id)
    }

    /// Add transition to net
    pub fn add_transition(&mut self, transition: Transition) -> Result<TransitionId, String> {
        if self.transitions.contains_key(&transition.id) {
            return Err(format!("Transition {} already exists", transition.id));
        }
        let id = transition.id;
        self.transitions.insert(id, transition);
        Ok(id)
    }

    /// Add arc to net
    pub fn add_arc(&mut self, arc: Arc) -> Result<ArcId, String> {
        // Validate endpoints exist
        match arc.source {
            Element::Place(id) => {
                if !self.places.contains_key(&id) {
                    return Err(format!("Source place {} not found", id));
                }
            }
            Element::Transition(id) => {
                if !self.transitions.contains_key(&id) {
                    return Err(format!("Source transition {} not found", id));
                }
            }
        }

        match arc.target {
            Element::Place(id) => {
                if !self.places.contains_key(&id) {
                    return Err(format!("Target place {} not found", id));
                }
            }
            Element::Transition(id) => {
                if !self.transitions.contains_key(&id) {
                    return Err(format!("Target transition {} not found", id));
                }
            }
        }

        let id = arc.id;
        self.arcs.insert(id, arc);
        Ok(id)
    }

    /// Get arcs from a place
    pub fn arcs_from_place(&self, place: PlaceId) -> Vec<&Arc> {
        self.arcs
            .values()
            .filter(|a| a.source == Element::Place(place))
            .collect()
    }

    /// Get arcs to a place
    pub fn arcs_to_place(&self, place: PlaceId) -> Vec<&Arc> {
        self.arcs
            .values()
            .filter(|a| a.target == Element::Place(place))
            .collect()
    }

    /// Get arcs from a transition
    pub fn arcs_from_transition(&self, transition: TransitionId) -> Vec<&Arc> {
        self.arcs
            .values()
            .filter(|a| a.source == Element::Transition(transition))
            .collect()
    }

    /// Get arcs to a transition
    pub fn arcs_to_transition(&self, transition: TransitionId) -> Vec<&Arc> {
        self.arcs
            .values()
            .filter(|a| a.target == Element::Transition(transition))
            .collect()
    }

    /// Validate Petri net structure
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        // Check for isolated places and transitions
        for (pid, _) in &self.places {
            let incoming = self.arcs_to_place(*pid);
            let outgoing = self.arcs_from_place(*pid);
            if incoming.is_empty() && outgoing.is_empty() {
                errors.push(format!("Place {} is isolated", pid));
            }
        }

        for (tid, _) in &self.transitions {
            let incoming = self.arcs_to_transition(*tid);
            let outgoing = self.arcs_from_transition(*tid);
            if incoming.is_empty() && outgoing.is_empty() {
                errors.push(format!("Transition {} is isolated", tid));
            }
        }

        // Check at least one source place (tokens initially)
        let source_places = self.places.values().filter(|p| p.initial_tokens > 0).count();
        if source_places == 0 && !self.places.is_empty() {
            errors.push("Petri net has no initial tokens".to_string());
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_place_creation() {
        let p = Place::new(PlaceId::new(), "P1", 0);
        assert_eq!(p.name, "P1");
        assert_eq!(p.initial_tokens, 0);
    }

    #[test]
    fn test_place_with_capacity() {
        let p = Place::new(PlaceId::new(), "P1", 0).with_capacity(5);
        assert_eq!(p.capacity, Some(5));
    }

    #[test]
    fn test_transition_creation() {
        let t = Transition::simple("T1");
        assert_eq!(t.name, "T1");
        assert_eq!(t.weight, 1.0);
    }

    #[test]
    fn test_arc_creation() {
        let p = PlaceId::new();
        let t = TransitionId::new();
        let arc = Arc::new(Element::Place(p), Element::Transition(t), 2);

        assert_eq!(arc.weight, 2);
        assert_eq!(arc.arc_type, ArcType::Normal);
    }

    #[test]
    fn test_arc_types() {
        let p = PlaceId::new();
        let t = TransitionId::new();

        let normal = Arc::new(Element::Place(p), Element::Transition(t), 1);
        assert_eq!(normal.arc_type, ArcType::Normal);

        let inhibitor = Arc::inhibitor(Element::Place(p), Element::Transition(t));
        assert_eq!(inhibitor.arc_type, ArcType::Inhibitor);

        let read = Arc::read(Element::Place(p), Element::Transition(t), 1);
        assert_eq!(read.arc_type, ArcType::Read);
    }

    #[test]
    fn test_petri_net_creation() {
        let net = PetriNet::new("TestNet");
        assert_eq!(net.name, "TestNet");
        assert_eq!(net.places.len(), 0);
    }

    #[test]
    fn test_add_place() {
        let mut net = PetriNet::new("Net");
        let p = Place::unbounded("P1");
        let id = p.id;

        net.add_place(p).expect("Add place");
        assert!(net.places.contains_key(&id));
    }

    #[test]
    fn test_add_transition() {
        let mut net = PetriNet::new("Net");
        let t = Transition::simple("T1");
        let id = t.id;

        net.add_transition(t).expect("Add transition");
        assert!(net.transitions.contains_key(&id));
    }

    #[test]
    fn test_add_arc() {
        let mut net = PetriNet::new("Net");
        let p = Place::unbounded("P1");
        let pid = p.id;
        let t = Transition::simple("T1");
        let tid = t.id;

        net.add_place(p).unwrap();
        net.add_transition(t).unwrap();

        let arc = Arc::new(Element::Place(pid), Element::Transition(tid), 1);
        let arc_id = arc.id;
        net.add_arc(arc).expect("Add arc");

        assert!(net.arcs.contains_key(&arc_id));
    }

    #[test]
    fn test_arc_queries() {
        let mut net = PetriNet::new("Net");
        let p = Place::unbounded("P1");
        let pid = p.id;
        let t = Transition::simple("T1");
        let tid = t.id;

        net.add_place(p).unwrap();
        net.add_transition(t).unwrap();

        net.add_arc(Arc::new(Element::Place(pid), Element::Transition(tid), 1))
            .unwrap();
        net.add_arc(Arc::new(Element::Transition(tid), Element::Place(pid), 1))
            .unwrap();

        assert_eq!(net.arcs_from_place(pid).len(), 1);
        assert_eq!(net.arcs_to_place(pid).len(), 1);
        assert_eq!(net.arcs_from_transition(tid).len(), 1);
        assert_eq!(net.arcs_to_transition(tid).len(), 1);
    }

    #[test]
    fn test_validate_valid_net() {
        let mut net = PetriNet::new("Net");
        let p = Place::unbounded("P1");
        let t = Transition::simple("T1");

        net.add_place(p).unwrap();
        net.add_transition(t).unwrap();
        net.add_arc(Arc::new(
            Element::Place(net.places.keys().next().unwrap().to_owned()),
            Element::Transition(net.transitions.keys().next().unwrap().to_owned()),
            1,
        ))
        .unwrap();

        assert!(net.validate().is_ok());
    }

    #[test]
    fn test_isolated_element_detection() {
        let mut net = PetriNet::new("Net");
        let p = Place::unbounded("P1");
        let _t = Transition::simple("T1");

        net.add_place(p).unwrap();
        net.add_transition(Transition::simple("T1")).unwrap();

        let result = net.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_place_display() {
        let p = PlaceId::new();
        let s = p.to_string();
        assert!(s.starts_with('P'));
    }

    #[test]
    fn test_transition_display() {
        let t = TransitionId::new();
        let s = t.to_string();
        assert!(s.starts_with('T'));
    }
}
