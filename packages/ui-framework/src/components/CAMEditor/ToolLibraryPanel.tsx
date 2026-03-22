/**
 * Tool Library Panel
 * Task 8: React component for vendor tool selection
 */

import React, { useState, useEffect } from 'react';
import { getToolVendors } from '../../manufacturing/multi-axis-bridge';

export interface ToolSearchResult {
  sku: string;
  description: string;
  diameter?: number;
  vendor: string;
  price?: number;
  available?: boolean;
  coating?: string;
}

interface ToolLibraryPanelProps {
  onToolSelected?: (tool: ToolSearchResult) => void;
  selectedTool?: ToolSearchResult | null;
}

export const ToolLibraryPanel: React.FC<ToolLibraryPanelProps> = ({
  onToolSelected,
  selectedTool,
}) => {
  const [vendors, setVendors] = useState<string[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string>('Sandvik');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchType, setSearchType] = useState<'name' | 'sku' | 'diameter'>('name');
  const [tools, setTools] = useState<ToolSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filteredTools, setFilteredTools] = useState<ToolSearchResult[]>([]);

  // Load vendors on mount
  useEffect(() => {
    const loadVendors = async () => {
      try {
        const vendorList = await getToolVendors();
        setVendors(vendorList);
      } catch (err) {
        console.error('Failed to load vendors:', err);
      }
    };
    loadVendors();
  }, []);

  // Load tools for selected vendor
  useEffect(() => {
    const loadTools = async () => {
      setLoading(true);
      try {
        // Simulate tool loading - in real app would call WASM bridge
        const mockTools: ToolSearchResult[] = [
          {
            sku: 'EM-10-S',
            description: '10mm Solid Carbide End Mill',
            diameter: 10,
            vendor: selectedVendor,
            price: 45.99,
            available: true,
            coating: 'TiAlN',
          },
          {
            sku: 'EM-8-S',
            description: '8mm Solid Carbide End Mill',
            diameter: 8,
            vendor: selectedVendor,
            price: 38.50,
            available: true,
            coating: 'Uncoated',
          },
          {
            sku: 'BALL-6-S',
            description: '6mm Ball Nose End Mill',
            diameter: 6,
            vendor: selectedVendor,
            price: 52.00,
            available: false,
            coating: 'TiCN',
          },
          {
            sku: 'DRILL-5-S',
            description: '5mm Twist Drill',
            diameter: 5,
            vendor: selectedVendor,
            price: 12.50,
            available: true,
            coating: 'Uncoated',
          },
          {
            sku: 'THREAD-M6-S',
            description: 'M6 Thread Mill',
            vendor: selectedVendor,
            price: 78.99,
            available: true,
            coating: 'TiAlN',
          },
        ];
        setTools(mockTools);
      } catch (err) {
        console.error('Failed to load tools:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTools();
  }, [selectedVendor]);

  // Filter tools based on search
  useEffect(() => {
    let filtered = tools;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = tools.filter((tool) => {
        switch (searchType) {
          case 'sku':
            return tool.sku.toLowerCase().includes(query);
          case 'diameter':
            return (
              tool.diameter && tool.diameter.toString().includes(query)
            );
          case 'name':
          default:
            return tool.description.toLowerCase().includes(query);
        }
      });
    }

    setFilteredTools(filtered);
  }, [searchQuery, searchType, tools]);

  return (
    <div className="tool-library-panel">
      <h2>Tool Library</h2>

      {/* Vendor Selection */}
      <div className="vendor-section">
        <label>Vendor:</label>
        <select
          value={selectedVendor}
          onChange={(e) => setSelectedVendor(e.target.value)}
        >
          {vendors.map((vendor) => (
            <option key={vendor} value={vendor}>
              {vendor}
            </option>
          ))}
        </select>
      </div>

      {/* Search Bar */}
      <div className="search-section">
        <div className="search-controls">
          <input
            type="text"
            placeholder={`Search by ${searchType}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as any)}
            className="search-type"
          >
            <option value="name">Name</option>
            <option value="sku">SKU</option>
            <option value="diameter">Diameter (mm)</option>
          </select>
        </div>
      </div>

      {/* Tools Table */}
      <div className="tools-table-container">
        {loading ? (
          <div className="loading">Loading tools...</div>
        ) : filteredTools.length === 0 ? (
          <div className="no-results">No tools found</div>
        ) : (
          <table className="tools-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Description</th>
                <th>Diameter (mm)</th>
                <th>Coating</th>
                <th>Price (USD)</th>
                <th>Stock</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTools.map((tool) => (
                <tr
                  key={tool.sku}
                  className={
                    selectedTool?.sku === tool.sku ? 'selected' : ''
                  }
                >
                  <td>{tool.sku}</td>
                  <td>{tool.description}</td>
                  <td>{tool.diameter || '—'}</td>
                  <td>{tool.coating || '—'}</td>
                  <td>${tool.price?.toFixed(2) || '—'}</td>
                  <td>
                    <span
                      className={`stock-badge ${
                        tool.available ? 'in-stock' : 'out-of-stock'
                      }`}
                    >
                      {tool.available ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => onToolSelected?.(tool)}
                      className="btn-select"
                      disabled={!tool.available}
                    >
                      {selectedTool?.sku === tool.sku ? '✓ Selected' : 'Select'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Selected Tool Summary */}
      {selectedTool && (
        <div className="selected-summary">
          <h3>Selected Tool</h3>
          <div className="summary-details">
            <div>
              <strong>SKU:</strong> {selectedTool.sku}
            </div>
            <div>
              <strong>Description:</strong> {selectedTool.description}
            </div>
            {selectedTool.diameter && (
              <div>
                <strong>Diameter:</strong> {selectedTool.diameter} mm
              </div>
            )}
            {selectedTool.price && (
              <div>
                <strong>Price:</strong> ${selectedTool.price.toFixed(2)}
              </div>
            )}
            {selectedTool.coating && (
              <div>
                <strong>Coating:</strong> {selectedTool.coating}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolLibraryPanel;
