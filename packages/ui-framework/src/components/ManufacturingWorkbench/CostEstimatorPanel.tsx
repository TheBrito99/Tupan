/**
 * Cost Estimator Panel - Manufacturing Cost Analysis
 * Phase 19 Task 6: CAM UI & Integration
 *
 * Provides cost breakdown and ROI analysis for manufacturing jobs
 */

import React, { useState, useMemo } from 'react';
import styles from './CostEstimatorPanel.module.css';

export interface CostEstimate {
  jobName: string;
  jobType: 'fdm-print' | 'cnc-mill' | 'laser-cut';
  material_cost: number;
  machine_time_cost: number;
  tool_wear_cost: number;
  labor_cost: number;
  overhead_cost: number;
  total_cost: number;
  profit_margin: number;
  selling_price: number;
  payback_units: number;
}

interface Props {
  jobs?: any[];
  onExportEstimate?: (estimate: CostEstimate) => void;
}

// Cost calculation helper
const calculateCost = (job: any): CostEstimate => {
  const jobType = job.type;
  const machineTime = job.estimatedTime || 60;

  let materialCost = 0;
  let machineTimeCost = 0;
  let toolWearCost = 0;
  let laborCost = 0;

  if (jobType === 'fdm-print') {
    // FDM: Material cost + energy
    const filamentWeight = 100 + Math.random() * 100; // grams
    materialCost = filamentWeight * 0.025; // $0.025 per gram
    machineTimeCost = machineTime * 0.5; // $0.50 per machine minute
    toolWearCost = materialCost * 0.05; // 5% of material
    laborCost = machineTime * 0.3; // $0.30 per minute labor (prep, post-processing)
  } else if (jobType === 'cnc-mill') {
    // CNC: Tool wear, machine time, coolant
    const estimatedPartsProduced = 1;
    materialCost = 50 + Math.random() * 150; // Varies wildly by material
    machineTimeCost = machineTime * 1.5; // $1.50 per machine minute
    toolWearCost = machineTime * 0.8; // Tool degradation
    laborCost = machineTime * 0.25; // $0.25 per minute (setup, tool change)
  } else if (jobType === 'laser-cut') {
    // Laser: Material + energy + maintenance
    materialCost = 30 + Math.random() * 100;
    machineTimeCost = machineTime * 0.75; // $0.75 per minute
    toolWearCost = machineTime * 0.1; // Optics maintenance
    laborCost = machineTime * 0.2; // Minimal labor for laser
  }

  const subtotal = materialCost + machineTimeCost + toolWearCost + laborCost;
  const overhead = subtotal * 0.25; // 25% overhead

  const totalCost = subtotal + overhead;
  const profitMargin = totalCost * 0.4; // 40% profit margin
  const sellingPrice = totalCost + profitMargin;
  const paybackUnits = Math.ceil(10000 / sellingPrice); // Assume $10k equipment

  return {
    jobName: job.name || `Job ${job.id}`,
    jobType,
    material_cost: materialCost,
    machine_time_cost: machineTimeCost,
    tool_wear_cost: toolWearCost,
    labor_cost: laborCost,
    overhead_cost: overhead,
    total_cost: totalCost,
    profit_margin: profitMargin,
    selling_price: sellingPrice,
    payback_units: paybackUnits,
  };
};

const CostBreakdownChart: React.FC<{ estimate: CostEstimate }> = ({ estimate }) => {
  const costs = [
    { label: 'Material', value: estimate.material_cost, color: '#42a5f5' },
    { label: 'Machine Time', value: estimate.machine_time_cost, color: '#66bb6a' },
    { label: 'Tool Wear', value: estimate.tool_wear_cost, color: '#ffa726' },
    { label: 'Labor', value: estimate.labor_cost, color: '#ef5350' },
    { label: 'Overhead', value: estimate.overhead_cost, color: '#ab47bc' },
  ];

  const total = estimate.total_cost;
  const maxValue = Math.max(...costs.map((c) => c.value));

  return (
    <div className={styles.chartContainer}>
      {costs.map((cost) => (
        <div key={cost.label} className={styles.chartBar}>
          <div className={styles.barLabel}>{cost.label}</div>
          <div className={styles.barContainer}>
            <div
              className={styles.bar}
              style={{
                width: `${(cost.value / maxValue) * 100}%`,
                backgroundColor: cost.color,
              }}
            />
          </div>
          <div className={styles.barValue}>${cost.value.toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
};

export const CostEstimatorPanel: React.FC<Props> = ({ jobs = [], onExportEstimate }) => {
  const [compareMode, setCompareMode] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());

  const estimates = useMemo(() => {
    return jobs.map((job) => calculateCost(job));
  }, [jobs]);

  const comparingEstimates = useMemo(() => {
    return estimates.filter((_, idx) => selectedJobs.has(jobs[idx].id));
  }, [estimates, jobs, selectedJobs]);

  const totalCompareCost = useMemo(() => {
    return comparingEstimates.reduce((sum, est) => sum + est.total_cost, 0);
  }, [comparingEstimates]);

  const toggleJobSelection = (jobId: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobs(newSelected);
  };

  return (
    <div className={styles.panel}>
      <h2>Cost Estimator & Analysis</h2>

      {jobs.length === 0 && (
        <div className={styles.noJobs}>
          <p>No manufacturing jobs created yet.</p>
          <p>Create jobs in the FDM or CNC tabs to see cost estimates.</p>
        </div>
      )}

      {jobs.length > 0 && (
        <div className={styles.content}>
          {/* Mode Toggle */}
          <div className={styles.controlBar}>
            <button
              className={`${styles.modeBtn} ${!compareMode ? styles.active : ''}`}
              onClick={() => setCompareMode(false)}
            >
              📊 Individual Analysis
            </button>
            <button
              className={`${styles.modeBtn} ${compareMode ? styles.active : ''}`}
              onClick={() => setCompareMode(true)}
            >
              📈 Compare Jobs
            </button>
          </div>

          {!compareMode ? (
            // Individual Cost Analysis
            <div className={styles.individual}>
              {estimates.map((estimate, idx) => (
                <section key={idx} className={styles.jobCard}>
                  <h3>{estimate.jobName}</h3>
                  <span className={styles.jobType}>{estimate.jobType}</span>

                  {/* Cost Breakdown */}
                  <div className={styles.costSection}>
                    <h4>Cost Breakdown</h4>
                    <CostBreakdownChart estimate={estimate} />
                  </div>

                  {/* Cost Summary */}
                  <div className={styles.costSummary}>
                    <div className={styles.costRow}>
                      <span className={styles.label}>Subtotal:</span>
                      <span className={styles.value}>
                        ${(
                          estimate.material_cost +
                          estimate.machine_time_cost +
                          estimate.tool_wear_cost +
                          estimate.labor_cost
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className={styles.costRow}>
                      <span className={styles.label}>Overhead (25%):</span>
                      <span className={styles.value}>${estimate.overhead_cost.toFixed(2)}</span>
                    </div>
                    <div className={styles.costRow + ' ' + styles.highlight}>
                      <span className={styles.label}>Total Cost:</span>
                      <span className={styles.value}>${estimate.total_cost.toFixed(2)}</span>
                    </div>

                    <hr />

                    <div className={styles.costRow}>
                      <span className={styles.label}>Profit Margin (40%):</span>
                      <span className={styles.value} style={{ color: '#66bb6a' }}>
                        +${estimate.profit_margin.toFixed(2)}
                      </span>
                    </div>
                    <div className={styles.costRow + ' ' + styles.highlight}>
                      <span className={styles.label}>Selling Price:</span>
                      <span className={styles.value} style={{ color: '#66bb6a', fontSize: '1.1em' }}>
                        ${estimate.selling_price.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* ROI Analysis */}
                  <div className={styles.roiBox}>
                    <p>
                      <strong>Payback:</strong> {estimate.payback_units} units at ${estimate.selling_price.toFixed(2)}
                      each to recover $10,000 equipment investment
                    </p>
                    <p>
                      <strong>Markup:</strong> {((estimate.profit_margin / estimate.total_cost) * 100).toFixed(0)}% over
                      cost
                    </p>
                  </div>

                  <button
                    className={styles.exportBtn}
                    onClick={() => onExportEstimate?.(estimate)}
                  >
                    📄 Export Estimate
                  </button>
                </section>
              ))}
            </div>
          ) : (
            // Comparison Mode
            <div className={styles.comparison}>
              <h3>Select Jobs to Compare</h3>
              <div className={styles.jobCheckboxes}>
                {jobs.map((job, idx) => (
                  <label key={job.id} className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={selectedJobs.has(job.id)}
                      onChange={() => toggleJobSelection(job.id)}
                    />
                    <span>{job.name || `Job ${idx + 1}`}</span>
                  </label>
                ))}
              </div>

              {comparingEstimates.length > 0 && (
                <div className={styles.comparisonResults}>
                  <h4>Comparison Results</h4>
                  <table className={styles.comparisonTable}>
                    <thead>
                      <tr>
                        <th>Job</th>
                        <th>Type</th>
                        <th>Cost</th>
                        <th>Price</th>
                        <th>Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparingEstimates.map((est, idx) => (
                        <tr key={idx}>
                          <td>{est.jobName}</td>
                          <td>{est.jobType}</td>
                          <td>${est.total_cost.toFixed(2)}</td>
                          <td>${est.selling_price.toFixed(2)}</td>
                          <td>{((est.profit_margin / est.total_cost) * 100).toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className={styles.comparisonSummary}>
                    <div className={styles.summaryRow}>
                      <span className={styles.label}>Total Project Cost:</span>
                      <span className={styles.value}>${totalCompareCost.toFixed(2)}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.label}>Average Cost per Job:</span>
                      <span className={styles.value}>
                        ${(totalCompareCost / comparingEstimates.length).toFixed(2)}
                      </span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.label}>Most Expensive:</span>
                      <span className={styles.value}>
                        ${Math.max(...comparingEstimates.map((e) => e.total_cost)).toFixed(2)}
                      </span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.label}>Most Profitable:</span>
                      <span className={styles.value}>
                        ${Math.max(...comparingEstimates.map((e) => e.profit_margin)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {comparingEstimates.length === 0 && (
                <p className={styles.emptyComparison}>Select at least one job to compare</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CostEstimatorPanel;
