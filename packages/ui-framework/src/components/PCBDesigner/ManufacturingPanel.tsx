/**
 * Manufacturing Panel - UI for Phase 14 manufacturing output
 *
 * Provides:
 * - Gerber file generation
 * - Drill file generation
 * - BOM generation and export
 * - Manufacturing documentation
 * - DFM reports
 */

import React, { useState, useCallback } from 'react';
import { PCBBoard } from './types';
import { GerberGenerator } from './GerberGenerator';
import { DrillFileGenerator } from './DrillFileGenerator';
import { BOMGenerator } from './BOMGenerator';
import { ManufacturingReportGenerator } from './ManufacturingReportGenerator';
import styles from './ManufacturingPanel.module.css';

interface ManufacturingPanelProps {
  board: PCBBoard;
  onExport?: (files: { [filename: string]: string }) => void;
}

type ExportTab = 'gerber' | 'drill' | 'bom' | 'report';

export const ManufacturingPanel: React.FC<ManufacturingPanelProps> = ({ board, onExport }) => {
  const [activeTab, setActiveTab] = useState<ExportTab>('gerber');
  const [surfaceFinish, setSurfaceFinish] = useState<'HASL' | 'ENIG' | 'OSP'>('HASL');
  const [soldermaskColor, setSoldermaskColor] = useState<'Green' | 'Red' | 'Blue'>('Green');
  const [exportOutput, setExportOutput] = useState('');
  const [exportedFiles, setExportedFiles] = useState<Set<string>>(new Set());

  /**
   * Generate Gerber files
   */
  const handleGenerateGerber = useCallback(() => {
    const generator = new GerberGenerator({ units: 'mm' });
    const files = generator.generateAllFiles(board);
    const manifest = generator.generateManifest(files);

    const output = ['GERBER FILES GENERATED', '═══════════════════════════════════════', manifest].join(
      '\n'
    );

    setExportOutput(output);
    setExportedFiles(new Set(files.map(f => f.filename)));

    if (onExport) {
      const fileMap: { [key: string]: string } = {};
      files.forEach(f => {
        fileMap[f.filename] = f.content;
      });
      onExport(fileMap);
    }
  }, [board, onExport]);

  /**
   * Generate drill file
   */
  const handleGenerateDrill = useCallback(() => {
    const generator = new DrillFileGenerator({ units: 'mm' });
    const drillFile = generator.generateDrillFile(board);
    const report = generator.generateDrillReport(drillFile);

    const output = [report, '', 'FILE: drill.xln', `Lines: ${drillFile.content.split('\n').length}`].join(
      '\n'
    );

    setExportOutput(output);
    setExportedFiles(new Set(['drill.xln']));

    if (onExport) {
      onExport({ 'drill.xln': drillFile.content });
    }
  }, [board, onExport]);

  /**
   * Generate BOM
   */
  const handleGenerateBOM = useCallback(() => {
    const bomGen = new BOMGenerator();
    const bom = bomGen.generateBOM(board.components);
    const report = bomGen.generateBOMReport(bom);

    const output = [report, '', 'EXPORT FORMATS:', '  • CSV (spreadsheet)', '  • JSON (structured data)', '  • HTML (viewable)'].join(
      '\n'
    );

    setExportOutput(output);
    setExportedFiles(new Set(['BOM.csv', 'BOM.json', 'BOM.html']));

    if (onExport) {
      onExport({
        'BOM.csv': bomGen.exportCSV(bom),
        'BOM.json': bomGen.exportJSON(bom),
        'BOM.html': bomGen.exportHTML(bom),
      });
    }
  }, [board, onExport]);

  /**
   * Generate manufacturing report
   */
  const handleGenerateReport = useCallback(() => {
    const reportGen = new ManufacturingReportGenerator();
    const bomGen = new BOMGenerator();
    const bom = bomGen.generateBOM(board.components);

    const report = reportGen.generateReport(board, bom, {
      surfaceFinish,
      soldermaskColor: soldermaskColor as any,
    });

    const textReport = reportGen.exportAsText(report);
    const checklist = reportGen.generateProcurementChecklist(board, bom);

    const output = [textReport, '', checklist].join('\n');

    setExportOutput(output);
    setExportedFiles(new Set(['MFG_REPORT.txt', 'PROCUREMENT_CHECKLIST.txt']));

    if (onExport) {
      onExport({
        'MFG_REPORT.txt': textReport,
        'PROCUREMENT_CHECKLIST.txt': checklist,
      });
    }
  }, [board, onExport, surfaceFinish, soldermaskColor]);

  return (
    <div className={styles.container}>
      {/* Tab Navigation */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'gerber' ? styles.active : ''}`}
          onClick={() => setActiveTab('gerber')}
        >
          Gerber
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'drill' ? styles.active : ''}`}
          onClick={() => setActiveTab('drill')}
        >
          Drill
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'bom' ? styles.active : ''}`}
          onClick={() => setActiveTab('bom')}
        >
          BOM
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'report' ? styles.active : ''}`}
          onClick={() => setActiveTab('report')}
        >
          Report
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.content}>
        {/* Gerber Tab */}
        {activeTab === 'gerber' && (
          <div className={styles.tabContent}>
            <h3>Gerber Files (PCB Layers)</h3>
            <p className={styles.description}>
              Gerber RS-274X files for PCB fabrication. Includes all signal, power, and silkscreen layers.
            </p>
            <div className={styles.info}>
              <div className={styles.stat}>
                <span className={styles.label}>Layers:</span>
                <span className={styles.value}>{board.layers.length}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>Traces:</span>
                <span className={styles.value}>{board.traces.length}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>Vias:</span>
                <span className={styles.value}>{board.vias.length}</span>
              </div>
            </div>
            <button onClick={handleGenerateGerber} className={styles.button}>
              Generate Gerber Files
            </button>
          </div>
        )}

        {/* Drill Tab */}
        {activeTab === 'drill' && (
          <div className={styles.tabContent}>
            <h3>Drill Files (Excellon)</h3>
            <p className={styles.description}>
              Excellon format drill files for via and through-hole drilling.
            </p>
            <div className={styles.info}>
              <div className={styles.stat}>
                <span className={styles.label}>Vias:</span>
                <span className={styles.value}>{board.vias.length}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>Through-Holes:</span>
                <span className={styles.value}>
                  {board.components.reduce(
                    (sum, c) => sum + c.footprint.pads.filter(p => p.drill).length,
                    0
                  )}
                </span>
              </div>
            </div>
            <button onClick={handleGenerateDrill} className={styles.button}>
              Generate Drill File
            </button>
          </div>
        )}

        {/* BOM Tab */}
        {activeTab === 'bom' && (
          <div className={styles.tabContent}>
            <h3>Bill of Materials</h3>
            <p className={styles.description}>
              Component list with quantities and placement information.
            </p>
            <div className={styles.info}>
              <div className={styles.stat}>
                <span className={styles.label}>Components:</span>
                <span className={styles.value}>{board.components.length}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>Unique Values:</span>
                <span className={styles.value}>
                  {new Set(board.components.map(c => c.footprint.name)).size}
                </span>
              </div>
            </div>
            <button onClick={handleGenerateBOM} className={styles.button}>
              Generate BOM (CSV/JSON/HTML)
            </button>
          </div>
        )}

        {/* Report Tab */}
        {activeTab === 'report' && (
          <div className={styles.tabContent}>
            <h3>Manufacturing Documentation</h3>
            <p className={styles.description}>
              Complete manufacturing specifications and DFM analysis.
            </p>

            <div className={styles.controls}>
              <label>
                Surface Finish:
                <select value={surfaceFinish} onChange={e => setSurfaceFinish(e.target.value as any)}>
                  <option value="HASL">HASL (Hot Air Solder Leveling)</option>
                  <option value="ENIG">ENIG (Electroless Nickel Gold)</option>
                  <option value="OSP">OSP (Organic Solderability Preservative)</option>
                </select>
              </label>

              <label>
                Solder Mask Color:
                <select value={soldermaskColor} onChange={e => setSoldermaskColor(e.target.value as any)}>
                  <option value="Green">Green</option>
                  <option value="Red">Red</option>
                  <option value="Blue">Blue</option>
                </select>
              </label>
            </div>

            <button onClick={handleGenerateReport} className={styles.button}>
              Generate Manufacturing Report
            </button>
          </div>
        )}
      </div>

      {/* Exported Files List */}
      {exportedFiles.size > 0 && (
        <div className={styles.exportedFiles}>
          <h4>Exported Files ({exportedFiles.size})</h4>
          <ul>
            {Array.from(exportedFiles).map(filename => (
              <li key={filename}>
                <span className={styles.filename}>{filename}</span>
                <span className={styles.badge}>✓ Ready</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Output Display */}
      <div className={styles.output}>
        <pre>{exportOutput}</pre>
      </div>
    </div>
  );
};

export default ManufacturingPanel;
