/**
 * Manufacturing Tests - Phase 14
 *
 * Tests for:
 * - Gerber file generation
 * - Drill file generation
 * - BOM generation and export
 * - Manufacturing report generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GerberGenerator } from '../GerberGenerator';
import { DrillFileGenerator } from '../DrillFileGenerator';
import { BOMGenerator } from '../BOMGenerator';
import { ManufacturingReportGenerator } from '../ManufacturingReportGenerator';
import { PCBBoard, PCBLayer, Trace, Via } from '../types';
import { FootprintLibrary } from '../FootprintLibrary';

// Test fixtures
const createTestBoard = (): PCBBoard => {
  const library = new FootprintLibrary();
  return {
    id: 'test-board',
    title: 'Test Board',
    width: 100,
    height: 100,
    thickness: 1.6,
    layers: [PCBLayer.SIGNAL_TOP, PCBLayer.SIGNAL_BOTTOM],
    components: [
      {
        id: 'comp1',
        refdes: 'R1',
        footprint: library.getFootprint('R0603')!,
        position: { x: 25, y: 25 },
        rotation: 0,
        side: 'top',
        placed: true,
      },
      {
        id: 'comp2',
        refdes: 'C1',
        footprint: library.getFootprint('C0603')!,
        position: { x: 50, y: 50 },
        rotation: 0,
        side: 'top',
        placed: true,
      },
    ],
    traces: [
      {
        id: 'trace1',
        netName: 'net1',
        layer: PCBLayer.SIGNAL_TOP,
        width: 0.254,
        style: 'manhattan',
        segments: [
          { start: { x: 0, y: 0 }, end: { x: 25, y: 0 } },
          { start: { x: 25, y: 0 }, end: { x: 25, y: 25 } },
        ],
      },
    ],
    vias: [
      {
        id: 'via1',
        position: { x: 50, y: 50 },
        diameter: 0.6,
        fromLayer: PCBLayer.SIGNAL_TOP,
        toLayer: PCBLayer.SIGNAL_BOTTOM,
      },
    ],
    zones: [],
    designRules: [],
  };
};

describe('GerberGenerator', () => {
  let generator: GerberGenerator;
  let board: PCBBoard;

  beforeEach(() => {
    board = createTestBoard();
    generator = new GerberGenerator({ units: 'mm' });
  });

  describe('Gerber File Generation', () => {
    it('should generate Gerber files for all layers', () => {
      const files = generator.generateAllFiles(board);

      expect(files.length).toBeGreaterThan(0);
      expect(files.some(f => f.layer === PCBLayer.SIGNAL_TOP)).toBe(true);
    });

    it('should include Gerber header and footer', () => {
      const files = generator.generateAllFiles(board);
      const file = files[0];

      expect(file.content).toContain('%FSLAX45Y45*%');
      expect(file.content).toContain('M02*');
    });

    it('should generate layer filenames correctly', () => {
      const files = generator.generateAllFiles(board);

      expect(files.some(f => f.filename.includes('F.Cu'))).toBe(true);
      expect(files.some(f => f.filename.includes('B.Cu'))).toBe(true);
    });

    it('should include traces in output', () => {
      const files = generator.generateAllFiles(board);
      const topFile = files.find(f => f.filename.includes('F.Cu'));

      expect(topFile?.content).toContain('D01*'); // Line command
    });

    it('should include pads in output', () => {
      const files = generator.generateAllFiles(board);

      expect(files[0].content).toBeTruthy();
    });
  });

  describe('Gerber Manifest', () => {
    it('should generate file manifest', () => {
      const files = generator.generateAllFiles(board);
      const manifest = generator.generateManifest(files);

      expect(manifest).toContain('GERBER FILES MANIFEST');
      expect(manifest).toContain('F.Cu');
      expect(manifest).toContain('B.Cu');
    });
  });
});

describe('DrillFileGenerator', () => {
  let generator: DrillFileGenerator;
  let board: PCBBoard;

  beforeEach(() => {
    board = createTestBoard();
    generator = new DrillFileGenerator({ units: 'mm' });
  });

  describe('Drill File Generation', () => {
    it('should generate Excellon drill file', () => {
      const file = generator.generateDrillFile(board);

      expect(file.filename).toBe('drill.xln');
      expect(file.holeCount).toBeGreaterThan(0);
    });

    it('should include drill header', () => {
      const file = generator.generateDrillFile(board);

      expect(file.content).toContain('M48');
      expect(file.content).toContain('INCH');
    });

    it('should include tool definitions', () => {
      const file = generator.generateDrillFile(board);

      expect(file.tools.length).toBeGreaterThan(0);
    });

    it('should include drill footer', () => {
      const file = generator.generateDrillFile(board);

      expect(file.content).toContain('M30');
    });

    it('should count holes correctly', () => {
      const file = generator.generateDrillFile(board);

      // Should have at least the vias
      expect(file.holeCount).toBeGreaterThanOrEqual(board.vias.length);
    });
  });

  describe('Drill Report', () => {
    it('should generate drill summary', () => {
      const file = generator.generateDrillFile(board);
      const report = generator.generateDrillReport(file);

      expect(report).toContain('DRILL FILE SUMMARY');
      expect(report).toContain('Total Holes');
    });
  });
});

describe('BOMGenerator', () => {
  let generator: BOMGenerator;
  let board: PCBBoard;

  beforeEach(() => {
    board = createTestBoard();
    generator = new BOMGenerator();
  });

  describe('BOM Generation', () => {
    it('should generate BOM from components', () => {
      const bom = generator.generateBOM(board.components);

      expect(bom.length).toBe(2); // R1 and C1
      expect(bom[0].quantity).toBe(1);
    });

    it('should group components by value', () => {
      // Add duplicate resistor
      board.components.push({
        id: 'comp3',
        refdes: 'R2',
        footprint: board.components[0].footprint,
        position: { x: 75, y: 75 },
        rotation: 0,
        side: 'top',
        placed: true,
      });

      const bom = generator.generateBOM(board.components);

      const resistorEntry = bom.find(e => e.references.includes('R1'));
      expect(resistorEntry?.quantity).toBe(2);
      expect(resistorEntry?.references).toContain('R2');
    });

    it('should sort by reference designator', () => {
      const bom = generator.generateBOM(board.components);

      const firstRef = bom[0].references[0];
      expect(firstRef[0]).toBeLessThanOrEqual(bom[1].references[0][0]);
    });
  });

  describe('BOM Export', () => {
    it('should export as CSV', () => {
      const bom = generator.generateBOM(board.components);
      const csv = generator.exportCSV(bom);

      expect(csv).toContain('Reference Designator');
      expect(csv).toContain('R1');
    });

    it('should export as JSON', () => {
      const bom = generator.generateBOM(board.components);
      const json = generator.exportJSON(bom);

      const parsed = JSON.parse(json);
      expect(parsed.components).toHaveLength(2);
      expect(parsed.totalQuantity).toBe(2);
    });

    it('should export as HTML', () => {
      const bom = generator.generateBOM(board.components);
      const html = generator.exportHTML(bom);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<table>');
      expect(html).toContain('R1');
    });
  });

  describe('BOM Validation', () => {
    it('should validate BOM', () => {
      const bom = generator.generateBOM(board.components);
      const validation = generator.validateBOM(bom);

      expect(validation.valid).toBe(true);
    });

    it('should warn on missing part numbers in strict mode', () => {
      const bom = generator.generateBOM(board.components);
      const validation = generator.validateBOM(bom, true);

      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('BOM Report', () => {
    it('should generate detailed BOM report', () => {
      const bom = generator.generateBOM(board.components);
      const report = generator.generateBOMReport(bom);

      expect(report).toContain('BILL OF MATERIALS');
      expect(report).toContain('R1');
      expect(report).toContain('C1');
    });

    it('should generate sourcing summary', () => {
      const bom = generator.generateBOM(board.components);
      const summary = generator.generateSourcingSummary(bom);

      expect(summary).toContain('SOURCING SUMMARY');
      expect(summary).toContain('Component Count');
    });
  });
});

describe('ManufacturingReportGenerator', () => {
  let generator: ManufacturingReportGenerator;
  let board: PCBBoard;
  let bom: any[];

  beforeEach(() => {
    board = createTestBoard();
    generator = new ManufacturingReportGenerator();
    const bomGen = new BOMGenerator();
    bom = bomGen.generateBOM(board.components);
  });

  describe('Manufacturing Report', () => {
    it('should generate manufacturing report', () => {
      const report = generator.generateReport(board, bom);

      expect(report.title).toBe('Manufacturing Report');
      expect(report.boardName).toBe('Test Board');
      expect(report.specifications).toBeDefined();
    });

    it('should include board specifications', () => {
      const report = generator.generateReport(board, bom);

      expect(report.specifications.boardWidth).toBe(100);
      expect(report.specifications.boardHeight).toBe(100);
      expect(report.specifications.layers).toBe(2);
    });

    it('should check DFM issues', () => {
      const report = generator.generateReport(board, bom);

      expect(Array.isArray(report.dfmIssues)).toBe(true);
    });
  });

  describe('DFM Checking', () => {
    it('should detect trace width violations', () => {
      // Add trace that's too thin
      board.traces.push({
        id: 'trace_thin',
        netName: 'test',
        layer: PCBLayer.SIGNAL_TOP,
        width: 0.05, // 50 microns - way too thin
        style: 'manhattan',
        segments: [{ start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }],
      });

      const report = generator.generateReport(board, bom);

      expect(report.dfmIssues.some(i => i.severity === 'error')).toBe(true);
    });

    it('should detect via size violations', () => {
      // Add via that's too small
      board.vias.push({
        id: 'via_tiny',
        position: { x: 50, y: 50 },
        diameter: 0.1, // 100 microns - too small
        fromLayer: PCBLayer.SIGNAL_TOP,
        toLayer: PCBLayer.SIGNAL_BOTTOM,
      });

      const report = generator.generateReport(board, bom);

      expect(report.dfmIssues.some(i => i.severity === 'error')).toBe(true);
    });

    it('should warn on board size extremes', () => {
      // Very small board
      board.width = 5;
      board.height = 5;

      const report = generator.generateReport(board, bom);

      expect(report.dfmIssues.some(i => i.severity === 'warning')).toBe(true);
    });
  });

  describe('Manufacturing Export', () => {
    it('should export as text', () => {
      const report = generator.generateReport(board, bom);
      const text = generator.exportAsText(report);

      expect(text).toContain('MANUFACTURING REPORT');
      expect(text).toContain('Specifications');
    });

    it('should generate procurement checklist', () => {
      const checklist = generator.generateProcurementChecklist(board, bom);

      expect(checklist).toContain('PROCUREMENT CHECKLIST');
      expect(checklist).toContain('PCB FABRICATION');
      expect(checklist).toContain('COMPONENT PROCUREMENT');
      expect(checklist).toContain('ASSEMBLY PREPARATION');
    });
  });
});
