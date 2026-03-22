/**
 * Bill of Materials (BOM) Generator
 *
 * Generates manufacturing documentation showing:
 * - Component list with references
 * - Grouping by value/part number
 * - Quantities and placement
 * - Sourcing information
 */

import { PlacedComponent } from './types';

export interface BOMEntry {
  value: string;
  footprint: string;
  quantity: number;
  references: string[];
  partNumber?: string;
  manufacturer?: string;
  cost?: number;
  supplier?: string;
  notes?: string;
}

export interface BOMFormat {
  format: 'csv' | 'json' | 'xml' | 'html';
  groupBy: 'value' | 'footprint' | 'manufacturer';
  includeCost: boolean;
  includeManufacturer: boolean;
}

export class BOMGenerator {
  /**
   * Generate Bill of Materials from components
   */
  public generateBOM(components: PlacedComponent[]): BOMEntry[] {
    const groups = new Map<string, BOMEntry>();

    // Group components by value
    for (const comp of components) {
      const value = comp.footprint.name;
      const key = `${value}_${comp.footprint.package}`;

      if (groups.has(key)) {
        const entry = groups.get(key)!;
        entry.quantity++;
        entry.references.push(comp.refdes);
      } else {
        groups.set(key, {
          value,
          footprint: comp.footprint.package,
          quantity: 1,
          references: [comp.refdes],
        });
      }
    }

    // Convert to array and sort by reference
    return Array.from(groups.values()).sort((a, b) => {
      // Sort by reference designator prefix, then by number
      const aRef = a.references[0];
      const bRef = b.references[0];
      return aRef.localeCompare(bRef, undefined, { numeric: true });
    });
  }

  /**
   * Export BOM as CSV
   */
  public exportCSV(bom: BOMEntry[]): string {
    const lines: string[] = [];

    // Header
    lines.push('Reference Designator,Value,Footprint,Quantity,Part Number,Manufacturer,Cost,Supplier,Notes');

    // Data rows
    for (const entry of bom) {
      const row = [
        entry.references.join('; '),
        entry.value,
        entry.footprint,
        entry.quantity.toString(),
        entry.partNumber || '',
        entry.manufacturer || '',
        entry.cost ? entry.cost.toFixed(2) : '',
        entry.supplier || '',
        entry.notes || '',
      ];

      lines.push(row.map(cell => this.escapeCSV(cell)).join(','));
    }

    return lines.join('\n');
  }

  /**
   * Export BOM as JSON
   */
  public exportJSON(bom: BOMEntry[]): string {
    return JSON.stringify(
      {
        generated: new Date().toISOString(),
        totalItems: bom.length,
        totalQuantity: bom.reduce((sum, entry) => sum + entry.quantity, 0),
        components: bom,
      },
      null,
      2
    );
  }

  /**
   * Export BOM as HTML table
   */
  public exportHTML(bom: BOMEntry[]): string {
    const lines: string[] = [
      '<!DOCTYPE html>',
      '<html>',
      '<head>',
      '<meta charset="UTF-8">',
      '<style>',
      'body { font-family: Arial, sans-serif; margin: 20px; }',
      'table { border-collapse: collapse; width: 100%; }',
      'th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }',
      'th { background-color: #2196f3; color: white; }',
      'tr:nth-child(even) { background-color: #f5f5f5; }',
      '</style>',
      '</head>',
      '<body>',
      '<h1>Bill of Materials</h1>',
      `<p>Generated: ${new Date().toLocaleString()}</p>`,
      '<table>',
      '<thead>',
      '<tr>',
      '<th>Reference Designator</th>',
      '<th>Value</th>',
      '<th>Footprint</th>',
      '<th>Qty</th>',
      '<th>Part Number</th>',
      '<th>Manufacturer</th>',
      '</tr>',
      '</thead>',
      '<tbody>',
    ];

    for (const entry of bom) {
      lines.push('<tr>');
      lines.push(`<td>${entry.references.join(', ')}</td>`);
      lines.push(`<td>${entry.value}</td>`);
      lines.push(`<td>${entry.footprint}</td>`);
      lines.push(`<td style="text-align: center;">${entry.quantity}</td>`);
      lines.push(`<td>${entry.partNumber || ''}</td>`);
      lines.push(`<td>${entry.manufacturer || ''}</td>`);
      lines.push('</tr>');
    }

    lines.push('</tbody>', '</table>', '</body>', '</html>');

    return lines.join('\n');
  }

  /**
   * Generate sourcing summary
   */
  public generateSourcingSummary(bom: BOMEntry[]): string {
    const lines = [
      'SOURCING SUMMARY',
      '═══════════════════════════════════════',
      '',
      'COMPONENT COUNT:',
      `  Unique Values: ${bom.length}`,
      `  Total Quantity: ${bom.reduce((sum, e) => sum + e.quantity, 0)}`,
      '',
      'COST ANALYSIS:',
    ];

    let totalCost = 0;
    let costedItems = 0;

    for (const entry of bom) {
      if (entry.cost) {
        const lineCost = entry.cost * entry.quantity;
        totalCost += lineCost;
        costedItems++;
      }
    }

    if (costedItems > 0) {
      lines.push(`  Parts with Cost Data: ${costedItems}`);
      lines.push(`  Total BOM Cost: $${totalCost.toFixed(2)}`);
      lines.push(`  Average Cost per Unit: $${(totalCost / (bom.reduce((sum, e) => sum + e.quantity, 0))).toFixed(2)}`);
    } else {
      lines.push('  No cost data available');
    }

    // Supplier analysis
    const suppliers = new Set<string>();
    for (const entry of bom) {
      if (entry.supplier) {
        suppliers.add(entry.supplier);
      }
    }

    lines.push('', 'SUPPLIERS:');
    for (const supplier of Array.from(suppliers).sort()) {
      const suppliedCount = bom.filter(e => e.supplier === supplier).length;
      lines.push(`  ${supplier}: ${suppliedCount} components`);
    }

    return lines.join('\n');
  }

  /**
   * Validate BOM for common issues
   */
  public validateBOM(bom: BOMEntry[], strict: boolean = false): {
    valid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const entry of bom) {
      // Check for missing part numbers
      if (!entry.partNumber && strict) {
        warnings.push(`${entry.value}: Missing part number`);
      }

      // Check for missing manufacturer
      if (!entry.manufacturer && strict) {
        warnings.push(`${entry.value}: Missing manufacturer`);
      }

      // Check for duplicate references
      const refSet = new Set(entry.references);
      if (refSet.size !== entry.references.length) {
        errors.push(`${entry.value}: Duplicate references detected`);
      }
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Escape CSV special characters
   */
  private escapeCSV(value: string): string {
    if (!value) return '""';

    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  }

  /**
   * Generate BOM report
   */
  public generateBOMReport(bom: BOMEntry[]): string {
    const lines = [
      'BILL OF MATERIALS (BOM)',
      '═══════════════════════════════════════',
      `Generated: ${new Date().toLocaleString()}`,
      '',
    ];

    // Summary
    const totalQuantity = bom.reduce((sum, e) => sum + e.quantity, 0);
    lines.push('SUMMARY:');
    lines.push(`  Total Component Types: ${bom.length}`);
    lines.push(`  Total Components: ${totalQuantity}`);
    lines.push('', 'DETAILED LIST:');
    lines.push('');

    // Detailed list
    for (const entry of bom) {
      lines.push(`${entry.references.join(', ')}`);
      lines.push(`  Value: ${entry.value}`);
      lines.push(`  Footprint: ${entry.footprint}`);
      lines.push(`  Quantity: ${entry.quantity}`);

      if (entry.partNumber) {
        lines.push(`  Part Number: ${entry.partNumber}`);
      }
      if (entry.manufacturer) {
        lines.push(`  Manufacturer: ${entry.manufacturer}`);
      }
      if (entry.cost) {
        lines.push(`  Unit Cost: $${entry.cost.toFixed(2)}`);
        lines.push(`  Line Cost: $${(entry.cost * entry.quantity).toFixed(2)}`);
      }

      lines.push('');
    }

    // Footer
    const totalCost = bom.reduce((sum, e) => sum + (e.cost ? e.cost * e.quantity : 0), 0);
    if (totalCost > 0) {
      lines.push('COST SUMMARY:');
      lines.push(`  Total BOM Cost: $${totalCost.toFixed(2)}`);
      lines.push(`  Cost per Unit: $${(totalCost / totalQuantity).toFixed(2)}`);
    }

    return lines.join('\n');
  }
}
