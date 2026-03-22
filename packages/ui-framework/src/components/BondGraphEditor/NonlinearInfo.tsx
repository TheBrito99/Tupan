/**
 * Nonlinear Element Configuration Component
 *
 * Allows users to add and configure nonlinear behaviors for bond graph elements
 */

import React, { useState } from 'react';
import type { EditorElement } from './types';
import {
  NONLINEAR_LIBRARY,
  type NonlinearBehavior,
  type NonlinearParams,
  type NonlinearElement,
  describeNonlinearBehavior,
  validateNonlinearParams,
  computeNonlinearResponse,
} from './nonlinearElements';
import styles from './BondGraphEditor.module.css';

interface NonlinearInfoProps {
  element: EditorElement;
  onAddNonlinearity?: (nonlinear: NonlinearElement) => void;
  onRemoveNonlinearity?: (behaviorType: NonlinearBehavior) => void;
  currentNonlinearity?: NonlinearElement;
}

export const NonlinearInfo: React.FC<NonlinearInfoProps> = ({
  element,
  onAddNonlinearity,
  onRemoveNonlinearity,
  currentNonlinearity,
}) => {
  const [selectedBehavior, setSelectedBehavior] = useState<NonlinearBehavior>('saturation');
  const [showLibrary, setShowLibrary] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [previewInput, setPreviewInput] = useState(1.0);

  // Filter library for compatible element types
  const compatibleExamples = Object.values(NONLINEAR_LIBRARY).filter(
    (example) => example.base_element_type === element.type
  );

  const selectedExample = compatibleExamples.find((e) => e.behavior === selectedBehavior);

  const handleApplyExample = (example: NonlinearElement) => {
    if (onAddNonlinearity) {
      onAddNonlinearity({
        ...example,
        id: `${example.id}_${element.id}`,
      });
    }
  };

  const handleRemove = () => {
    if (onRemoveNonlinearity && currentNonlinearity) {
      onRemoveNonlinearity(currentNonlinearity.behavior);
    }
  };

  const previewOutput = selectedExample ? computeNonlinearResponse(previewInput, selectedExample.parameters) : 0;

  return (
    <div className={styles.nonlinearInfo} style={{ marginTop: '16px', padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, color: '#333' }}>⚙️ Nonlinear Behavior</h4>
        {currentNonlinearity && (
          <button
            onClick={handleRemove}
            style={{
              padding: '4px 8px',
              backgroundColor: '#ffebee',
              color: '#c62828',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
            }}
          >
            Remove
          </button>
        )}
      </div>

      {/* Current nonlinearity status */}
      {currentNonlinearity && (
        <div
          style={{
            padding: '8px',
            marginBottom: '12px',
            borderRadius: '4px',
            backgroundColor: '#e8f5e9',
            borderLeft: `4px solid #2e7d32`,
          }}
        >
          <strong style={{ color: '#2e7d32' }}>✓ Active Nonlinearity</strong>
          <br />
          <span style={{ fontSize: '12px', color: '#1b5e20' }}>
            {currentNonlinearity.description}
          </span>
          <div style={{ fontSize: '11px', color: '#558b2f', marginTop: '4px', fontStyle: 'italic' }}>
            {currentNonlinearity.physical_interpretation}
          </div>
        </div>
      )}

      {/* Behavior selection */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#555' }}>
          Nonlinear Behavior Type
        </label>
        <select
          value={selectedBehavior}
          onChange={(e) => setSelectedBehavior(e.target.value as NonlinearBehavior)}
          style={{
            width: '100%',
            padding: '6px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
          }}
        >
          <optgroup label="Resistive Nonlinearities">
            <option value="saturation">Saturation</option>
            <option value="power_law">Power Law (Air drag, turbulence)</option>
            <option value="coulomb_friction">Coulomb Friction (Dry friction)</option>
            <option value="relay">Relay/Hysteresis Switching</option>
            <option value="deadband">Deadband (Insensitive zone)</option>
          </optgroup>
          <optgroup label="Other Nonlinearities">
            <option value="diode">Diode (One-way conduction)</option>
            <option value="backlash">Backlash (Mechanical play)</option>
            <option value="hysteresis">Hysteresis (Path-dependent)</option>
            <option value="polynomial">Polynomial (Custom)</option>
            <option value="custom_lookup">Lookup Table (Real data)</option>
          </optgroup>
        </select>
        <p style={{ fontSize: '11px', color: '#666', margin: '4px 0 0 0' }}>
          {describeNonlinearBehavior(selectedBehavior)}
        </p>
      </div>

      {/* Behavior-specific parameters */}
      {selectedExample && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#f9f9f9',
            borderRadius: '4px',
            marginBottom: '12px',
          }}
        >
          <strong style={{ display: 'block', fontSize: '12px', marginBottom: '8px', color: '#333' }}>
            Parameters
          </strong>

          {/* Render based on behavior type */}
          {selectedExample.behavior === 'saturation' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
              <div>
                <label style={{ display: 'block', color: '#666', marginBottom: '2px' }}>Max Positive</label>
                <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '11px' }}>
                  {(selectedExample.parameters as any).max_positive}
                </code>
              </div>
              <div>
                <label style={{ display: 'block', color: '#666', marginBottom: '2px' }}>Max Negative</label>
                <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '11px' }}>
                  {(selectedExample.parameters as any).max_negative}
                </code>
              </div>
            </div>
          )}

          {selectedExample.behavior === 'power_law' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
              <div>
                <label style={{ display: 'block', color: '#666', marginBottom: '2px' }}>Coefficient (c)</label>
                <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '11px' }}>
                  {(selectedExample.parameters as any).coefficient}
                </code>
              </div>
              <div>
                <label style={{ display: 'block', color: '#666', marginBottom: '2px' }}>Exponent (n)</label>
                <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '11px' }}>
                  {(selectedExample.parameters as any).exponent}
                </code>
              </div>
            </div>
          )}

          {selectedExample.behavior === 'coulomb_friction' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
              <div>
                <label style={{ display: 'block', color: '#666', marginBottom: '2px' }}>Static μ</label>
                <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '11px' }}>
                  {(selectedExample.parameters as any).static_coefficient}
                </code>
              </div>
              <div>
                <label style={{ display: 'block', color: '#666', marginBottom: '2px' }}>Kinetic μ</label>
                <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '11px' }}>
                  {(selectedExample.parameters as any).kinetic_coefficient}
                </code>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', color: '#666', marginBottom: '2px' }}>Normal Force (N)</label>
                <code style={{ backgroundColor: '#fff', padding: '2px 4px', borderRadius: '2px', fontSize: '11px' }}>
                  {(selectedExample.parameters as any).normal_force}
                </code>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview section */}
      {selectedExample && (
        <div style={{ marginBottom: '12px' }}>
          <button
            onClick={() => setShowPreview(!showPreview)}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '8px',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              color: '#333',
            }}
          >
            {showPreview ? '▼' : '▶'} Input/Output Preview
          </button>

          {showPreview && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#f0f8ff',
                borderRadius: '4px',
                fontSize: '12px',
              }}
            >
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', color: '#333', marginBottom: '4px', fontWeight: '600' }}>
                  Test Input Value
                </label>
                <input
                  type="number"
                  value={previewInput}
                  onChange={(e) => setPreviewInput(parseFloat(e.target.value))}
                  min="-10"
                  max="10"
                  step="0.1"
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                />
              </div>

              <div style={{ padding: '8px', backgroundColor: '#fff', borderRadius: '4px', fontFamily: 'monospace' }}>
                <div style={{ color: '#666', marginBottom: '4px' }}>
                  Input: <span style={{ color: '#1565c0', fontWeight: '600' }}>{previewInput.toFixed(3)}</span>
                </div>
                <div style={{ color: '#2e7d32' }}>
                  Output: <span style={{ color: '#2e7d32', fontWeight: '600' }}>{previewOutput.toFixed(3)}</span>
                </div>
              </div>

              {/* Characteristic visualization */}
              <div style={{ marginTop: '8px' }}>
                <canvas
                  width={280}
                  height={100}
                  style={{
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    backgroundColor: '#fff',
                    display: 'block',
                    marginTop: '4px',
                  }}
                  ref={(canvas) => {
                    if (canvas && selectedExample) {
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        // Clear
                        ctx.fillStyle = '#fff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        // Draw axes
                        ctx.strokeStyle = '#ccc';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(20, 50);
                        ctx.lineTo(280, 50);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(140, 10);
                        ctx.lineTo(140, 90);
                        ctx.stroke();

                        // Draw characteristic curve
                        ctx.strokeStyle = '#1565c0';
                        ctx.lineWidth = 2;
                        ctx.beginPath();

                        for (let x = -10; x <= 10; x += 0.2) {
                          const outputVal = computeNonlinearResponse(x, selectedExample.parameters);
                          const screenX = 140 + (x / 10) * 120;
                          const screenY = 50 - (outputVal / 10) * 40;

                          if (x === -10) {
                            ctx.moveTo(screenX, screenY);
                          } else {
                            ctx.lineTo(screenX, screenY);
                          }
                        }
                        ctx.stroke();

                        // Draw current point
                        const currScreenX = 140 + (previewInput / 10) * 120;
                        const currScreenY = 50 - (previewOutput / 10) * 40;
                        ctx.fillStyle = '#d32f2f';
                        ctx.beginPath();
                        ctx.arc(currScreenX, currScreenY, 4, 0, Math.PI * 2);
                        ctx.fill();
                      }
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Library of predefined nonlinearities */}
      <button
        onClick={() => setShowLibrary(!showLibrary)}
        style={{
          width: '100%',
          padding: '8px',
          marginBottom: '12px',
          backgroundColor: '#f5f5f5',
          border: '1px solid #ddd',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '600',
          color: '#333',
        }}
      >
        {showLibrary ? '▼' : '▶'} Library Examples ({compatibleExamples.length} available for {element.type})
      </button>

      {showLibrary && (
        <div style={{ display: 'grid', gap: '8px' }}>
          {compatibleExamples.length === 0 ? (
            <p style={{ color: '#999', fontSize: '12px', margin: 0 }}>
              No predefined examples for {element.type} element
            </p>
          ) : (
            compatibleExamples.map((example) => (
              <div
                key={example.id}
                style={{
                  padding: '8px',
                  backgroundColor: '#f9f9f9',
                  border: `1px solid ${example.id === currentNonlinearity?.id ? '#2e7d32' : '#ddd'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f0f0';
                  e.currentTarget.style.borderColor = '#999';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9f9f9';
                  e.currentTarget.style.borderColor = example.id === currentNonlinearity?.id ? '#2e7d32' : '#ddd';
                }}
                onClick={() => handleApplyExample(example)}
              >
                <strong style={{ fontSize: '12px', color: '#333', display: 'block' }}>
                  {example.description}
                </strong>
                <span style={{ fontSize: '11px', color: '#666', display: 'block', marginTop: '2px' }}>
                  {example.physical_interpretation}
                </span>
                <code style={{ fontSize: '10px', color: '#999', display: 'block', marginTop: '2px' }}>
                  {example.behavior}
                </code>
              </div>
            ))
          )}
        </div>
      )}

      {/* Physics explanation */}
      <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#faf3e0', borderRadius: '4px', fontSize: '12px', lineHeight: '1.6' }}>
        <strong style={{ color: '#e65100' }}>📊 Why Nonlinearities Matter:</strong>
        <ul style={{ margin: '6px 0 0 16px', color: '#333', paddingLeft: 0 }}>
          <li>Saturation limits energy: Motors have max torque, springs have breakage point</li>
          <li>Power law drag: Air resistance increases with speed (v² in turbulent flow)</li>
          <li>Friction changes behavior: Static friction ≠ kinetic friction</li>
          <li>Switches enable control: Relays, solenoids, and check valves are discrete devices</li>
          <li>Real systems are nonlinear: Lookup tables capture actual measured data</li>
        </ul>
      </div>
    </div>
  );
};

export default NonlinearInfo;
