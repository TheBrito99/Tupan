/**
 * Manufacturing Module - Exports
 *
 * Phase 14: Manufacturing output generation
 * - Gerber file generation (RS-274X)
 * - Drill file generation (Excellon)
 * - BOM generation and export (CSV/JSON/HTML)
 * - Manufacturing report and DFM checking
 */

export { GerberGenerator } from './GerberGenerator';
export type {
  GerberFile,
  GerberGeneratorOptions,
} from './GerberGenerator';

export { DrillFileGenerator } from './DrillFileGenerator';
export type {
  DrillFile,
  DrillTool,
  DrillFileGeneratorOptions,
} from './DrillFileGenerator';

export { BOMGenerator } from './BOMGenerator';
export type {
  BOMEntry,
  BOMValidation,
  BOMValidationWarning,
  BOMExportFormat,
} from './BOMGenerator';

export { ManufacturingReportGenerator } from './ManufacturingReportGenerator';
export type {
  ManufacturingReport,
  ManufacturingSpecifications,
  DFMIssue,
  DFMIssueSeverity,
} from './ManufacturingReportGenerator';

export { ManufacturingPanel } from './ManufacturingPanel';
export type { ManufacturingPanelProps } from './ManufacturingPanel';
