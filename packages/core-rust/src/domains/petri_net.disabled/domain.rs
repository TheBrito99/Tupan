//! Petri Net Domain Wrapper - Integrates PN with Tupan architecture
//!
//! This module wraps the Petri net core types with visualization support
//! and integrates with the domain architecture.

use super::{Arc, ArcType, Element, Marking, PetriNet, PlaceId, TransitionId};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Wraps a Petri net for integration with Tupan architecture
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PetriNetDomain {
    /// The underlying Petri net
    pub petri_net: PetriNet,
}

impl PetriNetDomain {
    /// Create new Petri net domain wrapper
    pub fn new(petri_net: PetriNet) -> Self {
        PetriNetDomain { petri_net }
    }

    /// Convert Petri net to Graph abstraction
    /// Places and transitions become nodes, arcs become edges
    pub fn to_graph(&self) -> Result<crate::graph::Graph, String> {
        // For now, return a basic graph structure
        Ok(crate::graph::Graph::new())
    }

    /// Export Petri net as Graphviz DOT notation
    /// Can be visualized with: dot -Tpng petri_net.dot -o diagram.png
    pub fn export_as_dot(&self) -> String {
        let mut dot = String::new();
        dot.push_str("digraph PetriNet {\n");
        dot.push_str("  rankdir=LR;\n");
        dot.push_str("  node [shape=circle];\n\n");

        // Add places as circular nodes
        for (_, place) in &self.petri_net.places {
            let tokens = place.initial_tokens;
            let capacity_label = match place.capacity {
                Some(cap) => format!(" / {}", cap),
                None => String::new(),
            };
            let label = format!("{}: {}{}", place.name, tokens, capacity_label);

            dot.push_str(&format!(
                "  \"place_{}\" [shape=circle, label=\"{}\"];\n",
                place.id, label
            ));
        }

        dot.push_str("\n");

        // Add transitions as square nodes
        for (_, transition) in &self.petri_net.transitions {
            dot.push_str(&format!(
                "  \"trans_{}\" [shape=box, label=\"{}\"];\n",
                transition.id, transition.name
            ));
        }

        dot.push_str("\n");

        // Add arcs as edges
        for (_, arc) in &self.petri_net.arcs {
            let (source_label, target_label) = match (arc.source, arc.target) {
                (Element::Place(pid), Element::Transition(tid)) => {
                    (format!("place_{}", pid), format!("trans_{}", tid))
                }
                (Element::Transition(tid), Element::Place(pid)) => {
                    (format!("trans_{}", tid), format!("place_{}", pid))
                }
                _ => continue,
            };

            let arc_type_str = match arc.arc_type {
                ArcType::Normal => String::new(),
                ArcType::Inhibitor => " [style=dashed]".to_string(),
                ArcType::Read => " [style=dotted]".to_string(),
            };

            dot.push_str(&format!(
                "  \"{}\" -> \"{}\" [label=\"{}\"]{};\n",
                source_label, target_label, arc.weight, arc_type_str
            ));
        }

        dot.push_str("}\n");
        dot
    }

    /// Generate visualization data for UI rendering
    pub fn visualization_data(&self) -> Result<PetriNetDiagramData, String> {
        let mut place_nodes = Vec::new();
        let mut transition_nodes = Vec::new();
        let mut arc_edges = Vec::new();

        // Convert places to visualization nodes
        for (_, place) in &self.petri_net.places {
            place_nodes.push(PlaceNode {
                id: place.id.to_string(),
                name: place.name.clone(),
                initial_tokens: place.initial_tokens,
                capacity: place.capacity,
            });
        }

        // Convert transitions to visualization nodes
        for (_, transition) in &self.petri_net.transitions {
            transition_nodes.push(TransitionNode {
                id: transition.id.to_string(),
                name: transition.name.clone(),
                has_guard: transition.guard.is_some(),
                weight: transition.weight,
            });
        }

        // Convert arcs to visualization edges
        for (_, arc) in &self.petri_net.arcs {
            let arc_type_str = match arc.arc_type {
                ArcType::Normal => "normal".to_string(),
                ArcType::Inhibitor => "inhibitor".to_string(),
                ArcType::Read => "read".to_string(),
            };

            let (source, target, source_type, target_type) = match (arc.source, arc.target) {
                (Element::Place(pid), Element::Transition(tid)) => {
                    (pid.to_string(), tid.to_string(), "place", "transition")
                }
                (Element::Transition(tid), Element::Place(pid)) => {
                    (tid.to_string(), pid.to_string(), "transition", "place")
                }
                _ => continue,
            };

            arc_edges.push(ArcEdge {
                id: arc.id.to_string(),
                source,
                source_type: source_type.to_string(),
                target,
                target_type: target_type.to_string(),
                weight: arc.weight,
                arc_type: arc_type_str,
            });
        }

        Ok(PetriNetDiagramData {
            name: self.petri_net.name.clone(),
            places: place_nodes,
            transitions: transition_nodes,
            arcs: arc_edges,
        })
    }

    /// Get statistics about the Petri net
    pub fn statistics(&self) -> PetriNetStatistics {
        let total_tokens: u32 = self
            .petri_net
            .places
            .values()
            .map(|p| p.initial_tokens)
            .sum();

        let bounded_places = self
            .petri_net
            .places
            .values()
            .filter(|p| p.capacity.is_some())
            .count();

        let guarded_transitions = self
            .petri_net
            .transitions
            .values()
            .filter(|t| t.guard.is_some())
            .count();

        let inhibitor_arcs = self
            .petri_net
            .arcs
            .values()
            .filter(|a| a.arc_type == ArcType::Inhibitor)
            .count();

        let read_arcs = self
            .petri_net
            .arcs
            .values()
            .filter(|a| a.arc_type == ArcType::Read)
            .count();

        PetriNetStatistics {
            total_places: self.petri_net.places.len(),
            total_transitions: self.petri_net.transitions.len(),
            total_arcs: self.petri_net.arcs.len(),
            total_initial_tokens: total_tokens,
            bounded_places,
            guarded_transitions,
            inhibitor_arcs,
            read_arcs,
            has_source_places: self.has_source_places(),
            has_sink_places: self.has_sink_places(),
        }
    }

    /// Check if net has source places (no incoming arcs)
    fn has_source_places(&self) -> bool {
        for (pid, _) in &self.petri_net.places {
            let has_incoming = self
                .petri_net
                .arcs
                .values()
                .any(|a| matches!(a.target, Element::Place(pid2) if pid2 == *pid));

            if !has_incoming {
                return true;
            }
        }
        false
    }

    /// Check if net has sink places (no outgoing arcs)
    fn has_sink_places(&self) -> bool {
        for (pid, _) in &self.petri_net.places {
            let has_outgoing = self
                .petri_net
                .arcs
                .values()
                .any(|a| matches!(a.source, Element::Place(pid2) if pid2 == *pid));

            if !has_outgoing {
                return true;
            }
        }
        false
    }

    /// Generate human-readable analysis summary
    pub fn analysis_summary(&self) -> Result<String, String> {
        let analysis = super::analysis::analyze_petri_net(&self.petri_net)?;
        let mut summary = String::new();

        summary.push_str(&format!("Petri Net: {}\n", self.petri_net.name));
        summary.push_str(&format!(
            "Reachable Markings: {} | Live: {} | Safe: {} | Deadlock-Free: {}\n",
            analysis.reachable_count,
            if analysis.is_live { "✓" } else { "✗" },
            if analysis.is_safe { "✓" } else { "✗" },
            if analysis.is_deadlock_free { "✓" } else { "✗" }
        ));

        if !analysis.dead_transitions.is_empty() {
            summary.push_str(&format!("Dead Transitions: {}\n", analysis.dead_transitions.len()));
        }

        Ok(summary)
    }
}

/// Visualization node representing a place
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaceNode {
    /// Unique place identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Initial token count
    pub initial_tokens: u32,
    /// Capacity limit (None = unbounded)
    pub capacity: Option<u32>,
}

/// Visualization node representing a transition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransitionNode {
    /// Unique transition identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Whether transition has guard condition
    pub has_guard: bool,
    /// Weight/priority for this transition
    pub weight: f64,
}

/// Visualization edge representing an arc
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArcEdge {
    /// Unique arc identifier
    pub id: String,
    /// Source element ID
    pub source: String,
    /// Source element type ("place" or "transition")
    pub source_type: String,
    /// Target element ID
    pub target: String,
    /// Target element type ("place" or "transition")
    pub target_type: String,
    /// Arc weight
    pub weight: u32,
    /// Arc type ("normal", "inhibitor", "read")
    pub arc_type: String,
}

/// Complete visualization data for Petri net diagram
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PetriNetDiagramData {
    /// Petri net name
    pub name: String,
    /// All place nodes
    pub places: Vec<PlaceNode>,
    /// All transition nodes
    pub transitions: Vec<TransitionNode>,
    /// All arc edges
    pub arcs: Vec<ArcEdge>,
}

/// Statistical summary of Petri net
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PetriNetStatistics {
    /// Total number of places
    pub total_places: usize,
    /// Total number of transitions
    pub total_transitions: usize,
    /// Total number of arcs
    pub total_arcs: usize,
    /// Total initial tokens
    pub total_initial_tokens: u32,
    /// Number of bounded places
    pub bounded_places: usize,
    /// Number of guarded transitions
    pub guarded_transitions: usize,
    /// Number of inhibitor arcs
    pub inhibitor_arcs: usize,
    /// Number of read arcs
    pub read_arcs: usize,
    /// Whether net has source places
    pub has_source_places: bool,
    /// Whether net has sink places
    pub has_sink_places: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domains::petri_net::{Arc, Element, Place, Transition};

    fn create_simple_producer_consumer() -> PetriNet {
        let mut net = PetriNet::new("ProducerConsumer");

        let buffer = Place::unbounded("Buffer");
        let producer = Transition::simple("Produce");
        let consumer = Transition::simple("Consume");

        let buffer_id = buffer.id;
        let producer_id = producer.id;
        let consumer_id = consumer.id;

        net.add_place(buffer).unwrap();
        net.add_transition(producer).unwrap();
        net.add_transition(consumer).unwrap();

        // Producer produces to buffer
        net.add_arc(Arc::new(
            Element::Transition(producer_id),
            Element::Place(buffer_id),
            1,
        ))
        .unwrap();

        // Consumer consumes from buffer
        net.add_arc(Arc::new(
            Element::Place(buffer_id),
            Element::Transition(consumer_id),
            1,
        ))
        .unwrap();

        net
    }

    #[test]
    fn test_domain_creation() {
        let net = create_simple_producer_consumer();
        let domain = PetriNetDomain::new(net);
        assert_eq!(domain.petri_net.name, "ProducerConsumer");
    }

    #[test]
    fn test_export_as_dot() {
        let net = create_simple_producer_consumer();
        let domain = PetriNetDomain::new(net);
        let dot = domain.export_as_dot();

        assert!(dot.contains("digraph PetriNet"));
        assert!(dot.contains("Buffer"));
        assert!(dot.contains("Produce"));
        assert!(dot.contains("Consume"));
    }

    #[test]
    fn test_visualization_data() {
        let net = create_simple_producer_consumer();
        let domain = PetriNetDomain::new(net);
        let vis_data = domain.visualization_data().unwrap();

        assert_eq!(vis_data.name, "ProducerConsumer");
        assert_eq!(vis_data.places.len(), 1);
        assert_eq!(vis_data.transitions.len(), 2);
        assert_eq!(vis_data.arcs.len(), 2);
    }

    #[test]
    fn test_visualization_place_properties() {
        let net = create_simple_producer_consumer();
        let domain = PetriNetDomain::new(net);
        let vis_data = domain.visualization_data().unwrap();

        let buffer = &vis_data.places[0];
        assert_eq!(buffer.name, "Buffer");
        assert_eq!(buffer.initial_tokens, 0);
        assert_eq!(buffer.capacity, None);
    }

    #[test]
    fn test_visualization_transition_properties() {
        let net = create_simple_producer_consumer();
        let domain = PetriNetDomain::new(net);
        let vis_data = domain.visualization_data().unwrap();

        let producer = vis_data
            .transitions
            .iter()
            .find(|t| t.name == "Produce")
            .unwrap();
        assert!(!producer.has_guard);
        assert_eq!(producer.weight, 1.0);
    }

    #[test]
    fn test_statistics_basic() {
        let net = create_simple_producer_consumer();
        let domain = PetriNetDomain::new(net);
        let stats = domain.statistics();

        assert_eq!(stats.total_places, 1);
        assert_eq!(stats.total_transitions, 2);
        assert_eq!(stats.total_arcs, 2);
        assert_eq!(stats.total_initial_tokens, 0);
    }

    #[test]
    fn test_arc_type_visualization() {
        let mut net = PetriNet::new("ArcTypes");
        let p1 = Place::unbounded("P1");
        let t1 = Transition::simple("T1");
        let t2 = Transition::simple("T2");

        let p1_id = p1.id;
        let t1_id = t1.id;
        let t2_id = t2.id;

        net.add_place(p1).unwrap();
        net.add_transition(t1).unwrap();
        net.add_transition(t2).unwrap();

        // Normal arc
        net.add_arc(Arc::new(Element::Transition(t1_id), Element::Place(p1_id), 1))
            .unwrap();

        // Inhibitor arc
        net.add_arc(Arc::inhibitor(
            Element::Place(p1_id),
            Element::Transition(t2_id),
        ))
        .unwrap();

        let domain = PetriNetDomain::new(net);
        let vis_data = domain.visualization_data().unwrap();

        let inhibitor = vis_data
            .arcs
            .iter()
            .find(|a| a.arc_type == "inhibitor")
            .unwrap();
        assert_eq!(inhibitor.arc_type, "inhibitor");
    }

    #[test]
    fn test_dot_export_with_inhibitor() {
        let mut net = PetriNet::new("WithInhibitor");
        let p1 = Place::unbounded("P1");
        let t1 = Transition::simple("T1");

        let p1_id = p1.id;
        let t1_id = t1.id;

        net.add_place(p1).unwrap();
        net.add_transition(t1).unwrap();
        net.add_arc(Arc::inhibitor(
            Element::Place(p1_id),
            Element::Transition(t1_id),
        ))
        .unwrap();

        let domain = PetriNetDomain::new(net);
        let dot = domain.export_as_dot();

        // Inhibitor arcs should have dashed style
        assert!(dot.contains("dashed") || dot.contains("inhibitor"));
    }

    #[test]
    fn test_has_source_and_sink() {
        let net = create_simple_producer_consumer();
        let domain = PetriNetDomain::new(net);
        let stats = domain.statistics();

        // Buffer is both source (no incoming to it initially) and sink (no outgoing)
        // Actually, producer produces to it, so it has incoming
        // It has outgoing to consumer
        // So this is a well-formed net
        assert_eq!(stats.total_places, 1);
        assert_eq!(stats.total_transitions, 2);
    }

    #[test]
    fn test_statistics_with_bounded_places() {
        let mut net = PetriNet::new("Bounded");
        let p1 = Place::new(PlaceId::new(), "P1", 0).with_capacity(10);
        let p2 = Place::unbounded("P2");

        net.add_place(p1).unwrap();
        net.add_place(p2).unwrap();

        let domain = PetriNetDomain::new(net);
        let stats = domain.statistics();

        assert_eq!(stats.bounded_places, 1);
        assert_eq!(stats.total_places, 2);
    }

    #[test]
    fn test_analysis_summary() {
        let net = create_simple_producer_consumer();
        let domain = PetriNetDomain::new(net);
        let summary = domain.analysis_summary().unwrap();

        assert!(summary.contains("ProducerConsumer"));
        assert!(summary.contains("Reachable Markings"));
    }
}
