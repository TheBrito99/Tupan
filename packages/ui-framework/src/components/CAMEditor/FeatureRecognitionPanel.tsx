/**
 * Feature Recognition Panel
 * Task 8: Display recognized CAD features and auto-generate operations
 */

import React, { useState, useEffect } from 'react';
import { MultiAxisBridge, FeatureRecognitionResult, AutoGenerateOperationsResult } from '../../manufacturing/multi-axis-bridge';

export interface RecognizedFeature {
  type: string;
  id: string;
  depth?: number;
  diameter?: number;
  height?: number;
  width?: number;
  length?: number;
}

export interface GeneratedOperation {
  feature_id: string;
  type: string;
  tool_diameter: number;
}

interface FeatureRecognitionPanelProps {
  cadModel?: any;
  onOperationsGenerated?: (operations: GeneratedOperation[]) => void;
}

export const FeatureRecognitionPanel: React.FC<FeatureRecognitionPanelProps> = ({
  cadModel,
  onOperationsGenerated,
}) => {
  const [recognizedFeatures, setRecognizedFeatures] = useState<RecognizedFeature[]>([]);
  const [generatedOperations, setGeneratedOperations] = useState<GeneratedOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalTime, setTotalTime] = useState(0);

  const bridge = MultiAxisBridge.getInstance();

  // Recognize features from CAD model
  useEffect(() => {
    if (cadModel) {
      recognizeFeatures();
    }
  }, [cadModel]);

  const recognizeFeatures = async () => {
    setLoading(true);
    setError(null);
    try {
      await bridge.initialize();

      const cadModelJson = JSON.stringify(cadModel || {});
      const result = await bridge.recognizeFeatures(cadModelJson);

      if (result.success) {
        setRecognizedFeatures(
          result.features_recognized.map((f) => ({
            type: f.type,
            id: f.id,
            depth: f.depth,
            diameter: f.diameter,
            height: f.height,
            width: f.width,
            length: f.length,
          }))
        );
      } else {
        setError('Failed to recognize features');
      }
    } catch (err) {
      setError(`Feature recognition failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const generateOperations = async () => {
    setLoading(true);
    setError(null);
    try {
      await bridge.initialize();

      const featuresJson = JSON.stringify(recognizedFeatures);
      const result = await bridge.autoGenerateOperations(featuresJson);

      if (result.success) {
        setGeneratedOperations(result.operations_generated);
        setTotalTime(result.total_time_minutes);
        onOperationsGenerated?.(result.operations_generated);
      } else {
        setError('Failed to generate operations');
      }
    } catch (err) {
      setError(`Operation generation failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const getFeatureIcon = (featureType: string) => {
    switch (featureType) {
      case 'Pocket':
        return '◼';
      case 'Hole':
        return '●';
      case 'Boss':
        return '▲';
      case 'Slot':
        return '▬';
      case 'Surface':
        return '━';
      case 'Thread':
        return '⦝';
      case 'EdgeModification':
        return '≈';
      default:
        return '○';
    }
  };

  const getOperationColor = (opType: string) => {
    switch (opType) {
      case 'Drilling':
        return '#FF6B6B';
      case 'Milling':
        return '#4ECDC4';
      case 'Tapping':
        return '#45B7D1';
      case 'Profiling':
        return '#96CEB4';
      case 'Roughing':
        return '#FFEAA7';
      case 'Finishing':
        return '#DDA0DD';
      default:
        return '#808080';
    }
  };

  return (
    <div className="feature-recognition-panel">
      <h2>Feature Recognition & CAM Generation</h2>

      {error && <div className="error-message">{error}</div>}

      {/* Recognized Features */}
      <div className="features-section">
        <h3>Recognized Features ({recognizedFeatures.length})</h3>

        {loading && !recognizedFeatures.length ? (
          <div className="loading">Analyzing CAD model...</div>
        ) : recognizedFeatures.length === 0 ? (
          <div className="empty-state">
            <p>No features recognized yet</p>
            <button onClick={recognizeFeatures} className="btn-secondary">
              Re-scan CAD Model
            </button>
          </div>
        ) : (
          <>
            <div className="features-list">
              {recognizedFeatures.map((feature) => (
                <div key={feature.id} className="feature-item">
                  <span className="feature-icon">
                    {getFeatureIcon(feature.type)}
                  </span>
                  <div className="feature-info">
                    <div className="feature-type">{feature.type}</div>
                    <div className="feature-details">
                      {feature.diameter && `Ø${feature.diameter}mm `}
                      {feature.depth && `Depth: ${feature.depth}mm `}
                      {feature.width && `${feature.width}mm × `}
                      {feature.length && `${feature.length}mm `}
                    </div>
                  </div>
                  <div className="feature-id">{feature.id}</div>
                </div>
              ))}
            </div>

            <button
              onClick={recognizeFeatures}
              disabled={loading}
              className="btn-secondary"
            >
              {loading ? 'Re-scanning...' : 'Re-scan CAD'}
            </button>
          </>
        )}
      </div>

      {/* Generated Operations */}
      <div className="operations-section">
        <h3>Generated CAM Operations ({generatedOperations.length})</h3>

        {generatedOperations.length === 0 ? (
          <div className="empty-state">
            <p>No operations generated yet</p>
            <button
              onClick={generateOperations}
              disabled={loading || recognizedFeatures.length === 0}
              className="btn-success"
            >
              {loading ? 'Generating...' : 'Generate Operations'}
            </button>
          </div>
        ) : (
          <>
            <div className="operations-list">
              {generatedOperations.map((op, idx) => (
                <div key={`${op.feature_id}-${idx}`} className="operation-item">
                  <div
                    className="operation-color"
                    style={{ backgroundColor: getOperationColor(op.type) }}
                  />
                  <div className="operation-info">
                    <div className="operation-type">{op.type}</div>
                    <div className="operation-details">
                      Feature: {op.feature_id} | Tool: {op.tool_diameter}mm
                    </div>
                  </div>
                  <div className="operation-index">#{idx + 1}</div>
                </div>
              ))}
            </div>

            <div className="operations-summary">
              <div className="summary-item">
                <strong>Total Operations:</strong> {generatedOperations.length}
              </div>
              <div className="summary-item">
                <strong>Estimated Time:</strong> {totalTime.toFixed(1)} minutes
              </div>
            </div>

            <button
              onClick={generateOperations}
              disabled={loading}
              className="btn-secondary"
            >
              {loading ? 'Regenerating...' : 'Regenerate Operations'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default FeatureRecognitionPanel;
