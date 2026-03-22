/**
 * Dashboard Page
 *
 * Welcome page with quick access to all simulators
 */

import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Dashboard.css';

const Dashboard: React.FC = () => {
  const simulators = [
    // Phase 1A: Basic simulators with existing components
    {
      id: 'circuit',
      title: 'Electrical Circuit Simulator',
      description: 'Simulate circuits with resistors, capacitors, inductors, and more',
      icon: 'EE',
      path: '/circuit',
      color: '#F44336',
    },
    {
      id: 'thermal',
      title: 'Thermal Analysis',
      description: 'Model heat transfer with thermal resistances, capacitances, and flows',
      icon: 'TH',
      path: '/thermal',
      color: '#E91E63',
    },
    {
      id: 'mechanical',
      title: 'Mechanical Simulator',
      description: 'Design spring-mass-damper systems and analyze dynamics',
      icon: 'ME',
      path: '/mechanical',
      color: '#9C27B0',
    },
    {
      id: 'hydraulic',
      title: 'Hydraulic Circuits',
      description: 'Simulate fluid power systems with pumps, valves, and cylinders',
      icon: 'HD',
      path: '/hydraulic',
      color: '#00BCD4',
    },
    {
      id: 'pneumatic',
      title: 'Pneumatic Circuits',
      description: 'Design compressed air systems with compressors and actuators',
      icon: 'PN',
      path: '/pneumatic',
      color: '#4FC3F7',
    },
    {
      id: 'block-diagram',
      title: 'Block Diagram Simulator',
      description: 'Create Simulink-like block diagrams with 57+ blocks for control systems',
      icon: 'BD',
      path: '/block-diagram',
      color: '#2196F3',
    },
    {
      id: 'state-machine',
      title: 'State Machine Editor',
      description: 'Design finite state machines with states, transitions, and guards',
      icon: 'SM',
      path: '/state-machine',
      color: '#4CAF50',
    },
    {
      id: 'petri-net',
      title: 'Petri Net Simulator',
      description: 'Model concurrent systems with places, transitions, and token dynamics',
      icon: 'PT',
      path: '/petri-net',
      color: '#FF9800',
    },
    {
      id: 'bond-graph',
      title: 'Bond Graph Editor',
      description: 'Multi-domain energy-based modeling with causality analysis',
      icon: 'BG',
      path: '/bond-graph',
      color: '#FF5722',
    },
    {
      id: 'latex',
      title: 'LaTeX Workspace',
      description: 'Draft engineering reports with a split editor and live preview',
      icon: 'TEX',
      path: '/latex',
      color: '#8E3F2A',
    },
    // Phase 1B: Advanced simulators with complex UIs
    {
      id: 'pcb',
      title: 'PCB Designer',
      description: 'Design PCB layouts with schematic capture and 3D visualization',
      icon: 'PCB',
      path: '/pcb',
      color: '#3F51B5',
    },
    {
      id: 'cad',
      title: '3D CAD Editor',
      description: 'Create parametric 3D models with boolean operations and assemblies',
      icon: 'CAD',
      path: '/cad',
      color: '#673AB7',
    },
    {
      id: 'microcontroller',
      title: 'Microcontroller Simulator',
      description: 'Simulate ARM Cortex-M firmware with block diagram code generation',
      icon: 'MCU',
      path: '/microcontroller',
      color: '#7B1FA2',
    },
    {
      id: 'manufacturing',
      title: 'Manufacturing CAM',
      description: 'Generate G-code for CNC machining, 3D printing, and laser cutting',
      icon: 'CAM',
      path: '/manufacturing',
      color: '#512DA8',
    },
    // Phase 3A: Advanced visualization and ML
    {
      id: 'robotics',
      title: 'Robotics Simulator',
      description: 'Design robot kinematics, swarm coordination, and collaborative tasks',
      icon: 'RBX',
      path: '/robotics',
      color: '#311B92',
    },
    {
      id: 'digital-twin',
      title: 'Digital Twin Dashboard',
      description: 'Real-time prediction and closed-loop validation of swarm behavior',
      icon: 'DT',
      path: '/digital-twin',
      color: '#1A237E',
    },
    {
      id: 'ml-workbench',
      title: 'ML Workbench',
      description: 'Train reinforcement learning agents and optimize swarm behaviors',
      icon: 'ML',
      path: '/ml-workbench',
      color: '#0D47A1',
    },
    // Phase 3B: Flow-based programming
    {
      id: 'fbp',
      title: 'Flow-Based Programming',
      description: 'Design Node-RED style data flows with computer vision capabilities',
      icon: 'FBP',
      path: '/fbp',
      color: '#1565C0',
    },
  ];

  return (
    <div className="dashboard">
      <section className="dashboard-hero">
        <div className="hero-content">
          <h1>Tupan</h1>
          <p className="hero-subtitle">
            Comprehensive Mechatronics Engineering Platform
          </p>
          <p className="hero-description">
            Design, simulate, and analyze complex systems with integrated visual programming
            and physics-based simulation tools.
          </p>
        </div>
      </section>

      <section className="dashboard-simulators">
        <h2>Simulators & Tools</h2>
        <div className="simulators-grid">
          {simulators.map((simulator) => (
            <Link
              key={simulator.id}
              to={simulator.path}
              className="simulator-card"
              style={{ borderTopColor: simulator.color }}
            >
              <div className="card-icon">{simulator.icon}</div>
              <h3>{simulator.title}</h3>
              <p>{simulator.description}</p>
              <div className="card-action">Launch Simulator -&gt;</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="dashboard-features">
        <h2>Key Features</h2>
        <div className="features-grid">
          <div className="feature">
            <div className="feature-icon">UI</div>
            <h4>Visual Design</h4>
            <p>Intuitive canvas-based editors for designing systems visually</p>
          </div>

          <div className="feature">
            <div className="feature-icon">WASM</div>
            <h4>Fast Simulation</h4>
            <p>WASM-accelerated solvers for real-time physics simulation</p>
          </div>

          <div className="feature">
            <div className="feature-icon">AN</div>
            <h4>Analysis</h4>
            <p>Comprehensive analysis tools: boundedness, liveness, stability</p>
          </div>

          <div className="feature">
            <div className="feature-icon">MD</div>
            <h4>Multi-Domain</h4>
            <p>Unified framework for electrical, thermal, mechanical systems</p>
          </div>

          <div className="feature">
            <div className="feature-icon">VX</div>
            <h4>Visualization</h4>
            <p>Real-time plotting and interactive result exploration</p>
          </div>

          <div className="feature">
            <div className="feature-icon">IO</div>
            <h4>Save & Share</h4>
            <p>Export designs and results in multiple formats</p>
          </div>
        </div>
      </section>

      <section className="dashboard-cta">
        <h2>Get Started</h2>
        <p>Choose a simulator above or explore the documentation to learn more</p>
        <div className="cta-buttons">
          <a href="/" className="btn btn-primary">Documentation</a>
          <a href="/" className="btn btn-secondary">Examples</a>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
