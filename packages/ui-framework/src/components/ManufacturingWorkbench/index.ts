/**
 * Manufacturing Workbench - Export Index
 * Phase 19 Task 6: CAM UI & Integration
 */

// Main workbench component
export { CAMWorkbench, type CAMWorkbenchState, type ManufacturingJob } from './CAMWorkbench';

// Panel components
export { FDMSlicerPanel, type FDMSettings, type FDMJob } from './FDMSlicerPanel';
export { CNCWorkbenchPanel, type CNCSettings, type CNCJob } from './CNCWorkbenchPanel';
export { ManufacturingSimulationPanel, type SimulationResult } from './ManufacturingSimulationPanel';
export { CostEstimatorPanel, type CostEstimate } from './CostEstimatorPanel';

// Tab components
export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';

// Export default
export default CAMWorkbench;
