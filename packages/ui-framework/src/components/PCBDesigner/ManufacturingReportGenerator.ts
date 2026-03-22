/**
 * Manufacturing Report Generator
 *
 * Generates comprehensive manufacturing documentation package including:
 * - PCB specifications (layer stack, dimensions)
 * - DFM (Design for Manufacturability) report
 * - Assembly notes
 * - Quality standards and requirements
 * - Procurement information
 */

import { PCBBoard } from './types';
import { BOMEntry } from './BOMGenerator';

export interface ManufacturingSpec {
  boardWidth: number;
  boardHeight: number;
  boardThickness: number;
  layers: number;
  copperWeight: string;           // 0.5oz, 1oz, 2oz per side
  surfaceFinish: 'HASL' | 'ENIG' | 'OSP' | 'Immersion_Ag' | 'Immersion_Sn';
  soldermaskColor: 'Green' | 'Red' | 'Blue' | 'Yellow' | 'Black' | 'White';
  silkscreenColor: 'White' | 'Yellow' | 'Black';
  minTraceWidth: number;          // mm
  minTraceSpacing: number;        // mm
  minViaSize: number;             // mm
  minHoleSize: number;            // mm
  qualityStandard: 'IPC-A-600A' | 'IPC-A-600B' | 'IPC-A-600D';
}

export interface ManufacturingReport {
  title: string;
  boardName: string;
  revision: string;
  generatedDate: string;
  specifications: ManufacturingSpec;
  dfmIssues: Array<{
    severity: 'error' | 'warning' | 'info';
    issue: string;
    recommendation: string;
  }>;
  notes: string;
}

export class ManufacturingReportGenerator {
  /**
   * Generate complete manufacturing report
   */
  public generateReport(
    board: PCBBoard,
    bom: BOMEntry[],
    specs: Partial<ManufacturingSpec> = {}
  ): ManufacturingReport {
    const defaultSpec: ManufacturingSpec = {
      boardWidth: board.width,
      boardHeight: board.height,
      boardThickness: board.thickness,
      layers: board.layers.length,
      copperWeight: '1oz',
      surfaceFinish: 'HASL',
      soldermaskColor: 'Green',
      silkscreenColor: 'White',
      minTraceWidth: 0.254,         // 10mil
      minTraceSpacing: 0.254,       // 10mil
      minViaSize: 0.3,              // 30mil
      minHoleSize: 0.3,             // 30mil
      qualityStandard: 'IPC-A-600B',
      ...specs,
    };

    // Check DFM issues
    const dfmIssues = this.checkDFM(board, defaultSpec);

    return {
      title: 'Manufacturing Report',
      boardName: board.title,
      revision: '1.0',
      generatedDate: new Date().toLocaleString(),
      specifications: defaultSpec,
      dfmIssues,
      notes: this.generateNotes(board, defaultSpec),
    };
  }

  /**
   * Check Design for Manufacturability (DFM)
   */
  private checkDFM(
    board: PCBBoard,
    spec: ManufacturingSpec
  ): Array<{ severity: 'error' | 'warning' | 'info'; issue: string; recommendation: string }> {
    const issues: Array<{
      severity: 'error' | 'warning' | 'info';
      issue: string;
      recommendation: string;
    }> = [];

    // Check trace widths
    for (const trace of board.traces) {
      if (trace.width < spec.minTraceWidth) {
        issues.push({
          severity: 'error',
          issue: `Trace width ${trace.width.toFixed(3)}mm is below minimum ${spec.minTraceWidth.toFixed(3)}mm`,
          recommendation: `Increase trace width to minimum ${spec.minTraceWidth.toFixed(3)}mm or request tighter manufacturing tolerance`,
        });
      }
    }

    // Check via sizes
    for (const via of board.vias) {
      if (via.diameter < spec.minViaSize) {
        issues.push({
          severity: 'error',
          issue: `Via diameter ${via.diameter.toFixed(3)}mm is below minimum ${spec.minViaSize.toFixed(3)}mm`,
          recommendation: `Increase via diameter or contact fabricator for micro-via capability`,
        });
      }
    }

    // Check board dimensions for panel
    const area = board.width * board.height;
    if (area < 10) {
      issues.push({
        severity: 'warning',
        issue: `Board area ${area.toFixed(1)}mm² is very small (typical panel: 100-500mm²)`,
        recommendation: `Consider panelization or thicker board support for handling`,
      });
    }

    if (area > 1000) {
      issues.push({
        severity: 'warning',
        issue: `Board area ${area.toFixed(1)}mm² is large (may exceed standard panel size)`,
        recommendation: `Verify with fabricator for capability or plan for multiple panels`,
      });
    }

    // Check copper pour density
    const pourArea = board.zones.reduce((sum, zone) => sum + zone.bounds.width * zone.bounds.height, 0);
    const totalArea = board.width * board.height;
    const pourDensity = (pourArea / totalArea) * 100;

    if (pourDensity > 80) {
      issues.push({
        severity: 'warning',
        issue: `Copper pour density ${pourDensity.toFixed(1)}% is very high`,
        recommendation: `Ensure proper copper balancing to avoid warping. Consider grid or crosshatch pattern`,
      });
    }

    if (pourDensity < 20 && board.zones.length > 0) {
      issues.push({
        severity: 'info',
        issue: `Copper pour density ${pourDensity.toFixed(1)}% is low with pour zones defined`,
        recommendation: `Verify copper distribution is intentional`,
      });
    }

    return issues;
  }

  /**
   * Generate manufacturing notes
   */
  private generateNotes(board: PCBBoard, spec: ManufacturingSpec): string {
    const notes = [
      'MANUFACTURING NOTES',
      '═══════════════════════════════════════',
      '',
      'PCB SPECIFICATIONS:',
      `  • Dimensions: ${spec.boardWidth.toFixed(1)} × ${spec.boardHeight.toFixed(1)} × ${spec.boardThickness.toFixed(2)} mm`,
      `  • Layers: ${spec.layers}`,
      `  • Copper Weight: ${spec.copperWeight}`,
      `  • Surface Finish: ${spec.surfaceFinish}`,
      `  • Solder Mask: ${spec.soldermaskColor}`,
      `  • Silkscreen: ${spec.silkscreenColor}`,
      '',
      'DESIGN RULES:',
      `  • Minimum Trace Width: ${spec.minTraceWidth.toFixed(3)} mm`,
      `  • Minimum Trace Spacing: ${spec.minTraceSpacing.toFixed(3)} mm`,
      `  • Minimum Via Size: ${spec.minViaSize.toFixed(3)} mm`,
      `  • Minimum Hole Size: ${spec.minHoleSize.toFixed(3)} mm`,
      '',
      'QUALITY STANDARD:',
      `  • IPC Standard: ${spec.qualityStandard}`,
      '',
      'ASSEMBLY REQUIREMENTS:',
      '  • All polarized components must be clearly marked',
      '  • Test points should be labeled on silkscreen',
      '  • Keep trace/pad sizes above IPC minimums for reliability',
      '',
      'HANDLING & STORAGE:',
      '  • Store in dry environment (< 60% humidity)',
      '  • Protect from static discharge',
      '  • Keep sealed until assembly readiness',
      '',
    ];

    return notes.join('\n');
  }

  /**
   * Generate manufacturing report as text
   */
  public exportAsText(report: ManufacturingReport): string {
    const lines = [
      report.title.toUpperCase(),
      '═'.repeat(50),
      `Board: ${report.boardName}`,
      `Revision: ${report.revision}`,
      `Generated: ${report.generatedDate}`,
      '',
      'SPECIFICATIONS:',
      `  Size: ${report.specifications.boardWidth.toFixed(1)} × ${report.specifications.boardHeight.toFixed(1)} mm`,
      `  Thickness: ${report.specifications.boardThickness.toFixed(2)} mm`,
      `  Layers: ${report.specifications.layers}`,
      `  Copper Weight: ${report.specifications.copperWeight}`,
      `  Surface Finish: ${report.specifications.surfaceFinish}`,
      `  Solder Mask: ${report.specifications.soldermaskColor}`,
      `  Silkscreen: ${report.specifications.silkscreenColor}`,
      '',
    ];

    if (report.dfmIssues.length > 0) {
      lines.push('MANUFACTURING ISSUES:');

      const errors = report.dfmIssues.filter(i => i.severity === 'error');
      const warnings = report.dfmIssues.filter(i => i.severity === 'warning');
      const infos = report.dfmIssues.filter(i => i.severity === 'info');

      if (errors.length > 0) {
        lines.push('  ERRORS (must fix):');
        for (const issue of errors) {
          lines.push(`    ✗ ${issue.issue}`);
          lines.push(`      → ${issue.recommendation}`);
        }
        lines.push('');
      }

      if (warnings.length > 0) {
        lines.push('  WARNINGS (review):');
        for (const issue of warnings) {
          lines.push(`    ⚠ ${issue.issue}`);
          lines.push(`      → ${issue.recommendation}`);
        }
        lines.push('');
      }

      if (infos.length > 0) {
        lines.push('  INFORMATION:');
        for (const issue of infos) {
          lines.push(`    ℹ ${issue.issue}`);
          lines.push(`      → ${issue.recommendation}`);
        }
      }

      lines.push('');
    }

    lines.push(report.notes);

    return lines.join('\n');
  }

  /**
   * Generate procurement checklist
   */
  public generateProcurementChecklist(board: PCBBoard, bom: BOMEntry[]): string {
    const lines = [
      'PROCUREMENT CHECKLIST',
      '═══════════════════════════════════════',
      '',
      'PCB FABRICATION:',
      '  [ ] Request quote for PCB manufacturing',
      '  [ ] Verify layer stackup and material (FR-4)',
      '  [ ] Confirm copper weight and surface finish',
      '  [ ] Check trace width/spacing design rules',
      '  [ ] Verify DFM report (no critical issues)',
      '  [ ] Order test coupons (if available)',
      '',
      'COMPONENT PROCUREMENT:',
      `  [ ] Verify BOM with ${bom.length} component types`,
      `  [ ] Order components (total qty: ${bom.reduce((sum, e) => sum + e.quantity, 0)})`,
      '  [ ] Check RoHS compliance (if required)',
      '  [ ] Verify part numbers and datasheets',
      '  [ ] Confirm availability and lead times',
      '  [ ] Arrange warehousing/logistics',
      '',
      'ASSEMBLY PREPARATION:',
      '  [ ] Prepare assembly drawing (from PCB design)',
      '  [ ] Generate pick-and-place file (X-Y coordinates)',
      '  [ ] Create solder paste stencil (if required)',
      '  [ ] Prepare test fixture requirements',
      '  [ ] Define reflow profile (for thermal simulation)',
      '',
      'QUALITY ASSURANCE:',
      '  [ ] Define acceptance criteria (IPC-A-600)',
      '  [ ] Plan in-circuit test (ICT) points',
      '  [ ] Schedule functional test',
      '  [ ] Arrange visual inspection',
      '',
      'DOCUMENTATION:',
      '  [ ] Collect component datasheets',
      '  [ ] Prepare schematic (PDF)',
      '  [ ] Prepare assembly drawings (PDF)',
      '  [ ] Create BOM (CSV/Excel)',
      '  [ ] Document all modifications/ECOs',
      '',
    ];

    return lines.join('\n');
  }
}
