/**
 * Drawing Tools Panel - React Component
 *
 * User interface for drawing tools and symbol library
 * Provides:
 * - Drawing tool selection
 * - Symbol library browsing
 * - Symbol search
 * - Tool options (colors, line width, etc.)
 */

import React, { useState } from 'react';
import type { Symbol, SymbolCategory } from './types';
import { SymbolCategory } from './types';
import { getAllTools } from './tools';
import { symbolLibrary, getSymbolByCategory, searchSymbols } from './symbolLibrary';
import styles from './DrawingToolsPanel.module.css';

export interface DrawingToolsPanelProps {
  activeTool?: string | null;
  onToolSelect?: (toolName: string) => void;
  onSymbolSelect?: (symbol: Symbol) => void;
  lineWidth?: number;
  onLineWidthChange?: (width: number) => void;
  color?: string;
  onColorChange?: (color: string) => void;
}

export const DrawingToolsPanel: React.FC<DrawingToolsPanelProps> = ({
  activeTool,
  onToolSelect,
  onSymbolSelect,
  lineWidth = 1,
  onLineWidthChange,
  color = '#000000',
  onColorChange,
}) => {
  const [activeTab, setActiveTab] = useState<'tools' | 'symbols'>('tools');
  const [selectedCategory, setSelectedCategory] = useState<SymbolCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTools, setExpandedTools] = useState<string | null>(null);

  const tools = getAllTools();
  const displayedSymbols = searchQuery
    ? searchSymbols(searchQuery)
    : selectedCategory
      ? getSymbolByCategory(selectedCategory)
      : symbolLibrary;

  const categories = [
    SymbolCategory.Resistor,
    SymbolCategory.Capacitor,
    SymbolCategory.Inductor,
    SymbolCategory.Diode,
    SymbolCategory.Led,
    SymbolCategory.Transistor,
    SymbolCategory.OpAmp,
    SymbolCategory.VoltageSource,
    SymbolCategory.CurrentSource,
    SymbolCategory.Switch,
    SymbolCategory.Ground,
    SymbolCategory.Junction,
  ];

  return (
    <div className={styles.panel}>
      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'tools' ? styles.active : ''}`}
          onClick={() => setActiveTab('tools')}
        >
          🖌 Tools
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'symbols' ? styles.active : ''}`}
          onClick={() => setActiveTab('symbols')}
        >
          📦 Symbols
        </button>
      </div>

      {/* Tools Tab */}
      {activeTab === 'tools' && (
        <div className={styles.content}>
          <h3>Drawing Tools</h3>

          <div className={styles.toolGrid}>
            {tools.map(([toolId, tool]) => (
              <button
                key={toolId}
                className={`${styles.toolButton} ${activeTool === toolId ? styles.active : ''}`}
                onClick={() => {
                  onToolSelect?.(toolId);
                  setExpandedTools(expandedTools === toolId ? null : toolId);
                }}
                title={tool.name}
              >
                <span className={styles.toolIcon}>{tool.icon}</span>
                <span className={styles.toolName}>{tool.name}</span>
              </button>
            ))}
          </div>

          {/* Tool Options */}
          <div className={styles.section}>
            <h4>Options</h4>

            {/* Color Picker */}
            <div className={styles.option}>
              <label htmlFor="color-picker">Color:</label>
              <input
                id="color-picker"
                type="color"
                value={color}
                onChange={(e) => onColorChange?.(e.target.value)}
                className={styles.colorPicker}
              />
              <span className={styles.colorValue}>{color}</span>
            </div>

            {/* Line Width */}
            <div className={styles.option}>
              <label htmlFor="line-width">Line Width:</label>
              <input
                id="line-width"
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={lineWidth}
                onChange={(e) => onLineWidthChange?.(parseFloat(e.target.value))}
                className={styles.slider}
              />
              <span className={styles.value}>{lineWidth}px</span>
            </div>
          </div>

          {/* Tips */}
          <div className={styles.tips}>
            <h4>Tips</h4>
            <ul>
              <li>
                <strong>Line:</strong> Click start and end points
              </li>
              <li>
                <strong>Circle:</strong> Click center, drag to set radius
              </li>
              <li>
                <strong>Polygon:</strong> Click to add points, close by clicking near start
              </li>
              <li>
                <strong>Text:</strong> Click to place text (edit in dialog)
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Symbols Tab */}
      {activeTab === 'symbols' && (
        <div className={styles.content}>
          <h3>Symbol Library</h3>

          {/* Search */}
          <div className={styles.search}>
            <input
              type="text"
              placeholder="Search symbols..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={styles.clearButton}
              >
                ✕
              </button>
            )}
          </div>

          {/* Categories */}
          <div className={styles.categories}>
            <button
              className={`${styles.categoryButton} ${selectedCategory === null && !searchQuery ? styles.active : ''}`}
              onClick={() => {
                setSelectedCategory(null);
                setSearchQuery('');
              }}
            >
              All ({symbolLibrary.length})
            </button>

            {categories.map((cat) => (
              <button
                key={cat}
                className={`${styles.categoryButton} ${selectedCategory === cat && !searchQuery ? styles.active : ''}`}
                onClick={() => {
                  setSelectedCategory(cat);
                  setSearchQuery('');
                }}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')} (
                {getSymbolByCategory(cat).length})
              </button>
            ))}
          </div>

          {/* Symbol Grid */}
          <div className={styles.symbolGrid}>
            {displayedSymbols.map((symbol) => (
              <button
                key={symbol.id}
                className={styles.symbolCard}
                onClick={() => onSymbolSelect?.(symbol)}
                title={symbol.description}
              >
                <div className={styles.symbolPreview}>
                  <svg
                    width="60"
                    height="60"
                    viewBox={`${symbol.bounds.minX} ${symbol.bounds.minY} ${symbol.bounds.maxX - symbol.bounds.minX} ${symbol.bounds.maxY - symbol.bounds.minY}`}
                  >
                    {symbol.entities.map((entity, idx) => renderEntitySVG(entity, idx))}
                  </svg>
                </div>
                <div className={styles.symbolName}>{symbol.name}</div>
              </button>
            ))}
          </div>

          {displayedSymbols.length === 0 && (
            <div className={styles.noResults}>
              <p>No symbols found for "{searchQuery}"</p>
            </div>
          )}

          {/* Symbol Count */}
          <div className={styles.footer}>
            Showing {displayedSymbols.length} of {symbolLibrary.length} symbols
          </div>
        </div>
      )}
    </div>
  );
};

// ============ SVG RENDERING HELPER ============

function renderEntitySVG(entity: any, key: number): JSX.Element | null {
  switch (entity.type) {
    case 'line':
      return (
        <line
          key={key}
          x1={entity.start.x}
          y1={entity.start.y}
          x2={entity.end.x}
          y2={entity.end.y}
          stroke="#000"
          strokeWidth="0.5"
        />
      );
    case 'circle':
      return (
        <circle
          key={key}
          cx={entity.center.x}
          cy={entity.center.y}
          r={entity.radius}
          fill="none"
          stroke="#000"
          strokeWidth="0.5"
        />
      );
    case 'polygon':
      const points = entity.points.map((p: any) => `${p.x},${p.y}`).join(' ');
      return (
        <polyline
          key={key}
          points={points}
          fill="none"
          stroke="#000"
          strokeWidth="0.5"
        />
      );
    case 'arc':
      return (
        <path
          key={key}
          d={`M ${entity.center.x + entity.radius * Math.cos(entity.startAngle)} ${entity.center.y + entity.radius * Math.sin(entity.startAngle)} A ${entity.radius} ${entity.radius} 0 0 1 ${entity.center.x + entity.radius * Math.cos(entity.endAngle)} ${entity.center.y + entity.radius * Math.sin(entity.endAngle)}`}
          fill="none"
          stroke="#000"
          strokeWidth="0.5"
        />
      );
    case 'text':
      return (
        <text
          key={key}
          x={entity.position.x}
          y={entity.position.y}
          fontSize={entity.height * 0.5}
          fill="#000"
        >
          {entity.content}
        </text>
      );
    default:
      return null;
  }
}

export default DrawingToolsPanel;
