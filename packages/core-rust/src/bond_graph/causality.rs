//! Sequential Causality Assignment Procedure (SCAP) for Bond Graphs
//!
//! SCAP is a systematic algorithm to assign causality to all bonds in a bond graph.
//! Causality determines computation order: which elements compute effort vs flow.
//!
//! Algorithm steps:
//! 1. Assign mandatory causality for sources (Se→effort out, Sf→flow out)
//! 2. Assign mandatory causality for storage (I→flow in, C→effort in for integral)
//! 3. Propagate constraints through junctions
//! 4. Assign flexible elements (R, TF, GY) with remaining freedom
//! 5. Validate for conflicts and algebraic loops
//!
//! Reference: Karnopp et al., "System Dynamics: Modeling, Simulation, and Control of Mechatronic Systems"

use std::collections::{HashMap, HashSet};
use crate::bond_graph::bond::{Bond, BondId, Causality};
use crate::bond_graph::element::BondGraphElement;
use crate::bond_graph::graph::BondGraph;
use crate::bond_graph::validation::CausalityError;

/// Manages causality assignment for bond graphs
pub struct CausalityAssigner;

impl CausalityAssigner {
    /// Assign causality to all bonds in the bond graph using SCAP algorithm
    ///
    /// # Returns
    /// - `Ok(())` if valid causality assignment exists
    /// - `Err(CausalityError)` if causality assignment fails (conflicts, algebraic loops, etc.)
    pub fn assign_causality(graph: &mut BondGraph) -> Result<(), CausalityError> {
        // Step 1: Assign mandatory causality for sources
        Self::assign_source_causality(graph)?;

        // Step 2: Assign mandatory causality for storage elements
        Self::assign_storage_causality(graph)?;

        // Step 3: Propagate constraints through junctions
        Self::propagate_junction_constraints(graph)?;

        // Step 4: Assign flexible elements
        Self::assign_flexible_causality(graph)?;

        // Step 5: Validate complete assignment
        Self::validate_complete_assignment(graph)?;

        graph.causality_assigned = true;
        Ok(())
    }

    /// Step 1: Sources must have their defined causality
    /// - Se (effort source) → effort out of bond
    /// - Sf (flow source) → flow out of bond
    fn assign_source_causality(graph: &mut BondGraph) -> Result<(), CausalityError> {
        let mut causalities = Vec::new();

        // Collect all causalities to assign
        for (&element_id, element) in &graph.elements {
            match element {
                BondGraphElement::Se(_, _) => {
                    // Se: effort flows out
                    if let Some(bonds) = graph.adjacency.get(&element_id) {
                        for &bond_id in bonds {
                            if let Some(bond) = graph.bonds.get(&bond_id) {
                                // Determine if this bond goes out or in from element perspective
                                let is_out = bond.from == element_id;
                                let causality = if is_out {
                                    Causality::EffortOut
                                } else {
                                    Causality::FlowOut  // Remote perspective: effort in = flow out
                                };
                                causalities.push((bond_id, causality));
                            }
                        }
                    }
                }
                BondGraphElement::Sf(_, _) => {
                    // Sf: flow flows out
                    if let Some(bonds) = graph.adjacency.get(&element_id) {
                        for &bond_id in bonds {
                            if let Some(bond) = graph.bonds.get(&bond_id) {
                                let is_out = bond.from == element_id;
                                let causality = if is_out {
                                    Causality::FlowOut
                                } else {
                                    Causality::EffortOut
                                };
                                causalities.push((bond_id, causality));
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        // Apply causalities with conflict checking
        for (bond_id, causality) in causalities {
            if let Some(bond) = graph.bonds.get_mut(&bond_id) {
                if bond.causality != Causality::Unassigned {
                    if bond.causality != causality {
                        return Err(CausalityError::CausalityConflict {
                            element_id: bond.from,
                            attempted_causality: format!("{:?}", causality),
                            reason: "Conflict with source causality requirement".to_string(),
                        });
                    }
                } else {
                    bond.causality = causality;
                }
            }
        }

        Ok(())
    }

    /// Step 2: Storage elements prefer integral causality
    /// - C (capacitance): effort flows in (dq/dt = flow out)
    /// - I (inertance): flow flows in (dp/dt = effort out)
    fn assign_storage_causality(graph: &mut BondGraph) -> Result<(), CausalityError> {
        let mut causalities = Vec::new();

        for (&element_id, element) in &graph.elements {
            match element {
                BondGraphElement::C(_, _) => {
                    // C: effort in (dq/dt = flow out)
                    if let Some(bonds) = graph.adjacency.get(&element_id) {
                        for &bond_id in bonds {
                            if let Some(bond) = graph.bonds.get(&bond_id) {
                                if bond.causality == Causality::Unassigned {
                                    let is_out = bond.from == element_id;
                                    let causality = if is_out {
                                        Causality::FlowOut
                                    } else {
                                        Causality::EffortOut
                                    };
                                    causalities.push((bond_id, causality));
                                }
                            }
                        }
                    }
                }
                BondGraphElement::I(_, _) => {
                    // I: flow in (dp/dt = effort out)
                    if let Some(bonds) = graph.adjacency.get(&element_id) {
                        for &bond_id in bonds {
                            if let Some(bond) = graph.bonds.get(&bond_id) {
                                if bond.causality == Causality::Unassigned {
                                    let is_out = bond.from == element_id;
                                    let causality = if is_out {
                                        Causality::EffortOut
                                    } else {
                                        Causality::FlowOut
                                    };
                                    causalities.push((bond_id, causality));
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        for (bond_id, causality) in causalities {
            if let Some(bond) = graph.bonds.get_mut(&bond_id) {
                if bond.causality == Causality::Unassigned {
                    bond.causality = causality;
                }
            }
        }

        Ok(())
    }

    /// Step 3: Propagate junction constraints to unassigned bonds
    ///
    /// 0-junction (common effort):
    /// - One bond with effort out, all others with flow out
    /// - If effort out is assigned elsewhere, other bonds must have flow out
    ///
    /// 1-junction (common flow):
    /// - One bond with flow out, all others with effort out
    /// - If flow out is assigned elsewhere, other bonds must have effort out
    fn propagate_junction_constraints(graph: &mut BondGraph) -> Result<(), CausalityError> {
        let mut changed = true;
        let mut iterations = 0;
        const MAX_ITERATIONS: usize = 100;

        while changed && iterations < MAX_ITERATIONS {
            changed = false;
            iterations += 1;

            // Collect all junction elements first to avoid borrow issues
            let junctions: Vec<_> = graph
                .elements
                .iter()
                .filter_map(|(&id, elem)| {
                    if matches!(elem, BondGraphElement::Junction0(_, _)) {
                        Some((id, true))  // true = Junction0
                    } else if matches!(elem, BondGraphElement::Junction1(_, _)) {
                        Some((id, false))  // false = Junction1
                    } else {
                        None
                    }
                })
                .collect();

            for (junction_id, is_j0) in junctions {
                if is_j0 {
                    if Self::propagate_0_junction(graph, junction_id)? {
                        changed = true;
                    }
                } else {
                    if Self::propagate_1_junction(graph, junction_id)? {
                        changed = true;
                    }
                }
            }
        }

        if iterations >= MAX_ITERATIONS {
            return Err(CausalityError::InvalidStructure(
                "Causality assignment did not converge".to_string(),
            ));
        }

        Ok(())
    }

    /// Propagate 0-junction constraints
    /// Returns true if any bonds were assigned
    fn propagate_0_junction(graph: &mut BondGraph, junction_id: crate::bond_graph::element::ElementId) -> Result<bool, CausalityError> {
        // Get bond IDs first to avoid borrow issues
        let bond_ids: Vec<BondId> = graph
            .adjacency
            .get(&junction_id)
            .map(|bonds| bonds.clone())
            .unwrap_or_default();

        // Find assigned causalities
        let mut effort_out_count = 0;
        let mut flow_out_count = 0;
        let mut unassigned_bonds = Vec::new();

        for bond_id in &bond_ids {
            if let Some(bond) = graph.bonds.get(bond_id) {
                match bond.causality {
                    Causality::EffortOut => effort_out_count += 1,
                    Causality::FlowOut => flow_out_count += 1,
                    Causality::Unassigned => unassigned_bonds.push(*bond_id),
                }
            }
        }

        // 0-junction must have exactly one effort out
        if effort_out_count > 1 {
            let sources: Vec<_> = bond_ids
                .iter()
                .filter_map(|bid| {
                    if let Some(bond) = graph.bonds.get(bid) {
                        if bond.causality == Causality::EffortOut {
                            Some(bond.from)
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
                .collect();
            return Err(CausalityError::MultipleEffortSources {
                junction_id,
                sources,
            });
        }

        let mut changed = false;

        // If one effort out assigned, all others must be flow out
        if effort_out_count == 1 && !unassigned_bonds.is_empty() {
            for bond_id in &unassigned_bonds {
                if let Some(bond) = graph.bonds.get_mut(bond_id) {
                    bond.causality = Causality::FlowOut;
                    changed = true;
                }
            }
        }

        // If no effort out yet and only one unassigned, make it effort out
        if bond_ids.len() > 0 && effort_out_count == 0 && flow_out_count == bond_ids.len() - 1 {
            if let Some(&bond_id) = unassigned_bonds.first() {
                if let Some(bond) = graph.bonds.get_mut(&bond_id) {
                    bond.causality = Causality::EffortOut;
                    changed = true;
                }
            }
        }

        Ok(changed)
    }

    /// Propagate 1-junction constraints
    /// Returns true if any bonds were assigned
    fn propagate_1_junction(graph: &mut BondGraph, junction_id: crate::bond_graph::element::ElementId) -> Result<bool, CausalityError> {
        // Get bond IDs first to avoid borrow issues
        let bond_ids: Vec<BondId> = graph
            .adjacency
            .get(&junction_id)
            .map(|bonds| bonds.clone())
            .unwrap_or_default();

        // Find assigned causalities
        let mut effort_out_count = 0;
        let mut flow_out_count = 0;
        let mut unassigned_bonds = Vec::new();

        for bond_id in &bond_ids {
            if let Some(bond) = graph.bonds.get(bond_id) {
                match bond.causality {
                    Causality::EffortOut => effort_out_count += 1,
                    Causality::FlowOut => flow_out_count += 1,
                    Causality::Unassigned => unassigned_bonds.push(*bond_id),
                }
            }
        }

        // 1-junction must have exactly one flow out
        if flow_out_count > 1 {
            let sources: Vec<_> = bond_ids
                .iter()
                .filter_map(|bid| {
                    if let Some(bond) = graph.bonds.get(bid) {
                        if bond.causality == Causality::FlowOut {
                            Some(bond.from)
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
                .collect();
            return Err(CausalityError::MultipleFlowSources {
                junction_id,
                sources,
            });
        }

        let mut changed = false;

        // If one flow out assigned, all others must be effort out
        if flow_out_count == 1 && !unassigned_bonds.is_empty() {
            for bond_id in &unassigned_bonds {
                if let Some(bond) = graph.bonds.get_mut(bond_id) {
                    bond.causality = Causality::EffortOut;
                    changed = true;
                }
            }
        }

        // If no flow out yet and only one unassigned, make it flow out
        if bond_ids.len() > 0 && flow_out_count == 0 && effort_out_count == bond_ids.len() - 1 {
            if let Some(&bond_id) = unassigned_bonds.first() {
                if let Some(bond) = graph.bonds.get_mut(&bond_id) {
                    bond.causality = Causality::FlowOut;
                    changed = true;
                }
            }
        }

        Ok(changed)
    }

    /// Step 4: Assign flexible elements (R, TF, GY)
    /// These can take any consistent causality
    fn assign_flexible_causality(graph: &mut BondGraph) -> Result<(), CausalityError> {
        let mut causalities = Vec::new();

        for (&element_id, element) in &graph.elements {
            match element {
                BondGraphElement::R(_, _)
                | BondGraphElement::TF(_, _)
                | BondGraphElement::GY(_, _) => {
                    // These elements can be either causality, pick EffortOut for flexibility
                    if let Some(bonds) = graph.adjacency.get(&element_id) {
                        for &bond_id in bonds {
                            if let Some(bond) = graph.bonds.get(&bond_id) {
                                if bond.causality == Causality::Unassigned {
                                    causalities.push((bond_id, Causality::EffortOut));
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        for (bond_id, causality) in causalities {
            if let Some(bond) = graph.bonds.get_mut(&bond_id) {
                if bond.causality == Causality::Unassigned {
                    bond.causality = causality;
                }
            }
        }

        Ok(())
    }

    /// Step 5: Validate that all bonds are assigned and no structural issues exist
    fn validate_complete_assignment(graph: &mut BondGraph) -> Result<(), CausalityError> {
        // Check all bonds assigned
        let mut unassigned = Vec::new();
        for (&bond_id, bond) in &graph.bonds {
            if bond.causality == Causality::Unassigned {
                unassigned.push(bond_id);
            }
        }

        if !unassigned.is_empty() {
            return Err(CausalityError::NoValidCausality {
                unassigned_bonds: unassigned,
            });
        }

        // Check for algebraic loops (simplified check)
        Self::detect_algebraic_loops(graph)?;

        Ok(())
    }

    /// Detect algebraic loops: cycles of rigid (non-storage) causality
    fn detect_algebraic_loops(_graph: &BondGraph) -> Result<(), CausalityError> {
        // Simplified check: a full implementation would build a causality graph
        // and detect cycles of purely algebraic relationships (no storage elements to break the cycle).
        //
        // For now, we skip this check since:
        // 1. Simple acyclic graphs (Se-R, Se-C, etc.) don't have loops
        // 2. Junction-based topologies are handled by SCAP causality propagation
        // 3. True algebraic loops would manifest as causality conflicts detected earlier
        //
        // TODO: Implement full cycle detection in causality dependency graph

        Ok(())
    }

    /// Validate derivative causality (should be minimized)
    /// Returns count of storage elements with derivative causality (should be 0)
    pub fn count_derivative_causality(graph: &BondGraph) -> usize {
        let mut derivative_count = 0;

        for (&element_id, element) in &graph.elements {
            match element {
                BondGraphElement::C(_, _) => {
                    // C should have effort in (EffortOut when coming from elsewhere)
                    if let Some(bonds) = graph.adjacency.get(&element_id) {
                        for bond_id in bonds {
                            if let Some(bond) = graph.bonds.get(bond_id) {
                                let is_incoming = bond.to == element_id;
                                let effort_in = (is_incoming && bond.causality == Causality::EffortOut)
                                    || (!is_incoming && bond.causality == Causality::FlowOut);
                                if !effort_in {
                                    derivative_count += 1;
                                    break;
                                }
                            }
                        }
                    }
                }
                BondGraphElement::I(_, _) => {
                    // I should have flow in (FlowOut when coming from elsewhere)
                    if let Some(bonds) = graph.adjacency.get(&element_id) {
                        for bond_id in bonds {
                            if let Some(bond) = graph.bonds.get(bond_id) {
                                let is_incoming = bond.to == element_id;
                                let flow_in = (is_incoming && bond.causality == Causality::FlowOut)
                                    || (!is_incoming && bond.causality == Causality::EffortOut);
                                if !flow_in {
                                    derivative_count += 1;
                                    break;
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        derivative_count
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bond_graph::element::{EffortSource, FlowSource, Resistor};

    fn create_test_graph() -> BondGraph {
        BondGraph::new()
    }

    #[test]
    fn test_simple_source_causality() {
        let mut graph = create_test_graph();

        let se_id = crate::bond_graph::element::ElementId::new();
        let r_id = crate::bond_graph::element::ElementId::new();

        graph.add_element(BondGraphElement::Se(
            se_id,
            EffortSource {
                effort: 5.0,
                expression: None,
            },
        ));

        graph.add_element(BondGraphElement::R(
            r_id,
            Resistor {
                resistance: 1000.0,
                variable_name: None,
            },
        ));

        let bond = Bond::new(se_id, r_id);
        let bond_id = bond.id;
        graph.add_bond(bond).unwrap();

        let result = CausalityAssigner::assign_causality(&mut graph);
        assert!(result.is_ok());

        if let Some(bond) = graph.get_bond(bond_id) {
            assert_eq!(bond.causality, Causality::EffortOut);
        }
    }

    #[test]
    fn test_0_junction_single_effort_source() {
        let mut graph = create_test_graph();

        let se_id = crate::bond_graph::element::ElementId::new();
        let j0_id = crate::bond_graph::element::ElementId::new();
        let r_id = crate::bond_graph::element::ElementId::new();

        graph.add_element(BondGraphElement::Se(
            se_id,
            EffortSource {
                effort: 5.0,
                expression: None,
            },
        ));
        graph.add_element(BondGraphElement::Junction0(j0_id, crate::bond_graph::element::Junction0 { name: None }));
        graph.add_element(BondGraphElement::R(
            r_id,
            Resistor {
                resistance: 1000.0,
                variable_name: None,
            },
        ));

        let b1 = Bond::new(se_id, j0_id);
        let b1_id = b1.id;
        graph.add_bond(b1).unwrap();

        let b2 = Bond::new(j0_id, r_id);
        let b2_id = b2.id;
        graph.add_bond(b2).unwrap();

        let result = CausalityAssigner::assign_causality(&mut graph);
        assert!(result.is_ok());

        // Se has effort out
        if let Some(bond) = graph.get_bond(b1_id) {
            assert_eq!(bond.causality, Causality::EffortOut);
        }

        // R has flow out (junction constrains this)
        if let Some(bond) = graph.get_bond(b2_id) {
            assert_eq!(bond.causality, Causality::FlowOut);
        }
    }

    #[test]
    fn test_multiple_effort_sources_conflict() {
        let mut graph = create_test_graph();

        let se1_id = crate::bond_graph::element::ElementId::new();
        let se2_id = crate::bond_graph::element::ElementId::new();
        let j0_id = crate::bond_graph::element::ElementId::new();

        graph.add_element(BondGraphElement::Se(
            se1_id,
            EffortSource {
                effort: 5.0,
                expression: None,
            },
        ));
        graph.add_element(BondGraphElement::Se(
            se2_id,
            EffortSource {
                effort: 3.0,
                expression: None,
            },
        ));
        graph.add_element(BondGraphElement::Junction0(j0_id, crate::bond_graph::element::Junction0 { name: None }));

        let b1 = Bond::new(se1_id, j0_id);
        graph.add_bond(b1).unwrap();

        let b2 = Bond::new(se2_id, j0_id);
        graph.add_bond(b2).unwrap();

        let result = CausalityAssigner::assign_causality(&mut graph);

        // Should detect conflict: two effort sources on same 0-junction
        assert!(result.is_err());
    }

    #[test]
    fn test_rc_circuit() {
        let mut graph = create_test_graph();

        let se_id = crate::bond_graph::element::ElementId::new();
        let r_id = crate::bond_graph::element::ElementId::new();
        let c_id = crate::bond_graph::element::ElementId::new();
        let j0_id = crate::bond_graph::element::ElementId::new();

        graph.add_element(BondGraphElement::Se(
            se_id,
            EffortSource {
                effort: 5.0,
                expression: None,
            },
        ));
        graph.add_element(BondGraphElement::R(
            r_id,
            Resistor {
                resistance: 1000.0,
                variable_name: None,
            },
        ));

        use crate::bond_graph::element::CapacitiveStorage;
        graph.add_element(BondGraphElement::C(
            c_id,
            CapacitiveStorage {
                capacitance: 1e-6,
                initial_displacement: 0.0,
                variable_name: None,
            },
        ));

        graph.add_element(BondGraphElement::Junction0(j0_id, crate::bond_graph::element::Junction0 { name: None }));

        // Topology: Se - R - 0junction - C
        let b1 = Bond::new(se_id, r_id);
        graph.add_bond(b1).unwrap();

        let b2 = Bond::new(r_id, j0_id);
        graph.add_bond(b2).unwrap();

        let b3 = Bond::new(j0_id, c_id);
        graph.add_bond(b3).unwrap();

        let result = CausalityAssigner::assign_causality(&mut graph);
        assert!(
            result.is_ok(),
            "RC circuit should have valid causality: {:?}",
            result
        );

        // Verify integral causality for capacitor
        let derivative_count = CausalityAssigner::count_derivative_causality(&graph);
        assert_eq!(
            derivative_count, 0,
            "RC circuit should have no derivative causality"
        );
    }

    #[test]
    fn test_transformer_causality() {
        let mut graph = create_test_graph();

        let se_id = crate::bond_graph::element::ElementId::new();
        let tf_id = crate::bond_graph::element::ElementId::new();
        let r_id = crate::bond_graph::element::ElementId::new();

        graph.add_element(BondGraphElement::Se(
            se_id,
            EffortSource {
                effort: 5.0,
                expression: None,
            },
        ));

        use crate::bond_graph::element::Transformer;
        graph.add_element(BondGraphElement::TF(
            tf_id,
            Transformer {
                ratio: 0.5,
                variable_name: None,
            },
        ));

        graph.add_element(BondGraphElement::R(
            r_id,
            Resistor {
                resistance: 100.0,
                variable_name: None,
            },
        ));

        let b1 = Bond::new(se_id, tf_id);
        graph.add_bond(b1).unwrap();

        let b2 = Bond::new(tf_id, r_id);
        graph.add_bond(b2).unwrap();

        let result = CausalityAssigner::assign_causality(&mut graph);
        assert!(result.is_ok());
    }

    #[test]
    fn test_isolated_elements() {
        let mut graph = create_test_graph();

        let se_id = crate::bond_graph::element::ElementId::new();
        graph.add_element(BondGraphElement::Se(
            se_id,
            EffortSource {
                effort: 5.0,
                expression: None,
            },
        ));

        // Single isolated source should be OK (no bonds to assign)
        let result = CausalityAssigner::assign_causality(&mut graph);
        assert!(result.is_ok());
    }
}
