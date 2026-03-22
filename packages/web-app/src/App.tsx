import { HashRouter, Routes, Route } from 'react-router-dom';
import { WasmProvider } from './contexts/WasmContext';
import Dashboard from './pages/Dashboard';
import CircuitPage from './pages/CircuitPage';
import ThermalPage from './pages/ThermalPage';
import MechanicalPage from './pages/MechanicalPage';
import HydraulicPage from './pages/HydraulicPage';
import PneumaticPage from './pages/PneumaticPage';
import BlockDiagramPage from './pages/BlockDiagramPage';
import StateMachinePage from './pages/StateMachinePage';
import PetriNetPage from './pages/PetriNetPage';
import BondGraphPage from './pages/BondGraphPage';
import LatexPage from './pages/LatexPage';
import PCBPage from './pages/PCBPage';
import CADPage from './pages/CADPage';
import MicrocontrollerPage from './pages/MicrocontrollerPage';
import ManufacturingPage from './pages/ManufacturingPage';
import RoboticsPage from './pages/RoboticsPage';
import FBPPage from './pages/FBPPage';
import DigitalTwinPage from './pages/DigitalTwinPage';
import MLWorkbenchPage from './pages/MLWorkbenchPage';
import './App.css';

function App() {
  return (
    <WasmProvider>
      <HashRouter>
        <Routes>
          {/* Dashboard */}
          <Route path="/" element={<Dashboard />} />

          {/* Phase 1A: Basic simulators with existing components */}
          <Route path="/circuit" element={<CircuitPage />} />
          <Route path="/state-machine" element={<StateMachinePage />} />
          <Route path="/petri-net" element={<PetriNetPage />} />
          <Route path="/latex" element={<LatexPage />} />
          <Route path="/bond-graph" element={<BondGraphPage />} />

          {/* Phase 1B: Advanced simulators with complex UIs */}
          <Route path="/pcb" element={<PCBPage />} />
          <Route path="/cad" element={<CADPage />} />
          <Route path="/microcontroller" element={<MicrocontrollerPage />} />
          <Route path="/manufacturing" element={<ManufacturingPage />} />

          {/* Phase 2A: Physical domain simulators (re-enabled backends) */}
          <Route path="/thermal" element={<ThermalPage />} />
          <Route path="/mechanical" element={<MechanicalPage />} />
          <Route path="/hydraulic" element={<HydraulicPage />} />
          <Route path="/pneumatic" element={<PneumaticPage />} />
          <Route path="/block-diagram" element={<BlockDiagramPage />} />

          {/* Phase 3A: Advanced visualization and ML */}
          <Route path="/robotics" element={<RoboticsPage />} />
          <Route path="/digital-twin" element={<DigitalTwinPage />} />
          <Route path="/ml-workbench" element={<MLWorkbenchPage />} />

          {/* Phase 3B: Flow-based programming */}
          <Route path="/fbp" element={<FBPPage />} />
        </Routes>
      </HashRouter>
    </WasmProvider>
  );
}

export default App;
