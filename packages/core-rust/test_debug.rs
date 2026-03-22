use tupan_core::bond_graph::*;
use tupan_core::bond_graph::element::*;

fn main() {
    let mut graph = BondGraph::new();

    let se_id = ElementId::new();
    let r_id = ElementId::new();

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

    println!("Graph: {:?}", graph);
    
    let result = CausalityAssigner::assign_causality(&mut graph);
    match result {
        Ok(_) => println!("Success!"),
        Err(e) => println!("Error: {:?}", e),
    }
}
