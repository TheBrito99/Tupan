/**
 * CAM Editor - Main Component
 * Task 8: Integrated multi-axis CAM interface
 */

import React, { useState, useCallback } from 'react';
import MultiAxisPanel, { MultiAxisConfig } from './MultiAxisPanel';
import ToolLibraryPanel, { ToolSearchResult } from './ToolLibraryPanel';
import FeatureRecognitionPanel, { GeneratedOperation } from './FeatureRecognitionPanel';
import CollisionVisualizationPanel from './CollisionVisualizationPanel';
import './CAMEditor.module.css';

export interface CAMEditorProps {
  cadModel?: any;
  onExportGCode?: (gcode: string) => void;
  onUpdateOperations?: (operations: GeneratedOperation[]) => void;
}

export const CAMEditor: React.FC<CAMEditorProps> = ({
  cadModel,
  onExportGCode,
  onUpdateOperations,
}) => {
  const [activeTab, setActiveTab] = useState<
    'machine' | 'tools' | 'features' | 'collision'
  >('machine');
  const [machineConfig, setMachineConfig] = useState<MultiAxisConfig | null>(
    null
  );
  const [selectedTool, setSelectedTool] = useState<ToolSearchResult | null>(
    null
  );
  const [operations, setOperations] = useState<GeneratedOperation[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [gcodePreview, setGcodePreview] = useState<string>('');

  // Handle machine configuration changes
  const handleMachineConfigChange = useCallback((config: MultiAxisConfig) => {
    setMachineConfig(config);
  }, []);

  // Handle tool selection
  const handleToolSelected = useCallback((tool: ToolSearchResult) => {
    setSelectedTool(tool);
  }, []);

  // Handle operations generated from features
  const handleOperationsGenerated = useCallback(
    (newOperations: GeneratedOperation[]) => {
      setOperations(newOperations);
      onUpdateOperations?.(newOperations);
    },
    [onUpdateOperations]
  );

  // Generate G-code preview
  const handleGenerateGCode = () => {
    if (!machineConfig || !selectedTool || operations.length === 0) {
      alert('Please configure machine, select tool, and generate operations');
      return;
    }

    // Simulate G-code generation
    const preview = `; Generated G-Code Preview
; Machine: ${machineConfig.machineType}
; Strategy: ${machineConfig.strategy}
; Tool: ${selectedTool.sku} (${selectedTool.description})
; Operations: ${operations.length}
;
G90 G54
G0 Z10
${operations
  .map(
    (op, idx) => `
; Operation ${idx + 1}: ${op.type}
; Feature: ${op.feature_id}
; Tool diameter: ${op.tool_diameter}mm
G0 X10 Y10 Z5
G1 Z-${op.feature_id.charCodeAt(1) % 10} F1000
G0 Z10
`
  )
  .join('')}
G0 Z50
M30
%`;

    setGcodePreview(preview);
    onExportGCode?.(preview);
  };

  return (
    <div className="cam-editor">
      <div className="editor-header">
        <h1>Multi-Axis CAM Editor</h1>
        <div className="header-status">
          {machineConfig && (
            <>
              <span className="badge machine">
                {machineConfig.machineType}
              </span>
              {selectedTool && (
                <span className="badge tool">{selectedTool.sku}</span>
              )}
              {operations.length > 0 && (
                <span className="badge operations">
                  {operations.length} ops
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="editor-layout">
        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === 'machine' ? 'active' : ''}`}
            onClick={() => setActiveTab('machine')}
          >
            ⚙ Machine
          </button>
          <button
            className={`tab-button ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            🔧 Tools
          </button>
          <button
            className={`tab-button ${
              activeTab === 'features' ? 'active' : ''
            }`}
            onClick={() => setActiveTab('features')}
          >
            🎯 Features
          </button>
          <button
            className={`tab-button ${
              activeTab === 'collision' ? 'active' : ''
            }`}
            onClick={() => setActiveTab('collision')}
          >
            ⚠ Collision
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'machine' && (
            <MultiAxisPanel
              onConfigChange={handleMachineConfigChange}
              onToolpathGenerated={(result) => {
                console.log('Toolpath generated:', result);
              }}
            />
          )}

          {activeTab === 'tools' && (
            <ToolLibraryPanel
              selectedTool={selectedTool}
              onToolSelected={handleToolSelected}
            />
          )}

          {activeTab === 'features' && (
            <FeatureRecognitionPanel
              cadModel={cadModel}
              onOperationsGenerated={handleOperationsGenerated}
            />
          )}

          {activeTab === 'collision' && (
            <CollisionVisualizationPanel
              isSimulating={isSimulating}
              onCollisionDetected={(collision) => {
                console.log('Collision detected:', collision);
              }}
            />
          )}
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="control-bar">
        <div className="left-controls">
          <button
            className={`btn-simulate ${isSimulating ? 'active' : ''}`}
            onClick={() => setIsSimulating(!isSimulating)}
          >
            {isSimulating ? '⏸ Stop Simulation' : '▶ Start Simulation'}
          </button>
        </div>

        <div className="center-info">
          {machineConfig && operations.length > 0 && (
            <div className="info-text">
              {machineConfig.machineType} | {operations.length} operations |
              {selectedTool && ` Tool: ${selectedTool.sku}`}
            </div>
          )}
        </div>

        <div className="right-controls">
          <button
            className="btn-secondary"
            onClick={() => {
              // Clear all settings
              setMachineConfig(null);
              setSelectedTool(null);
              setOperations([]);
              setGcodePreview('');
            }}
          >
            Reset
          </button>
          <button
            className="btn-success"
            onClick={handleGenerateGCode}
            disabled={!machineConfig || !selectedTool || operations.length === 0}
          >
            Generate G-Code
          </button>
        </div>
      </div>

      {/* G-Code Preview Modal */}
      {gcodePreview && (
        <div className="gcode-preview-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>G-Code Preview</h3>
              <button
                className="close-button"
                onClick={() => setGcodePreview('')}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <pre className="gcode-text">{gcodePreview}</pre>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setGcodePreview('')}
              >
                Close
              </button>
              <button
                className="btn-success"
                onClick={() => {
                  // Copy to clipboard
                  navigator.clipboard.writeText(gcodePreview);
                  alert('G-Code copied to clipboard');
                }}
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CAMEditor;
