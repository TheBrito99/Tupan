/**
 * CAM Workbench - Main Manufacturing Interface
 * Phase 19 Task 6: CAM UI & Integration
 *
 * Central hub for:
 * - FDM 3D printing slicer
 * - CNC G-code generation
 * - Manufacturing simulation
 * - Cost estimation
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';
import { FDMSlicerPanel } from './FDMSlicerPanel';
import { CNCWorkbenchPanel } from './CNCWorkbenchPanel';
import { ManufacturingSimulationPanel } from './ManufacturingSimulationPanel';
import { CostEstimatorPanel } from './CostEstimatorPanel';
import { initializeManufacturingBridge } from '@tupan/core-ts';
import styles from './CAMWorkbench.module.css';

export interface CAMWorkbenchState {
  selectedTab: 'fdm' | 'cnc' | 'simulation' | 'cost';
  activeJob?: {
    id: string;
    name: string;
    type: 'fdm' | 'cnc';
    createdAt: Date;
  };
}

export interface ManufacturingJob {
  id: string;
  name: string;
  type: 'fdm-print' | 'cnc-mill' | 'laser-cut';
  geometry: any;
  parameters: Record<string, any>;
  estimatedTime: number; // minutes
  estimatedCost: number; // USD
  createdAt: Date;
  modifiedAt: Date;
}

export const CAMWorkbench: React.FC = () => {
  const [state, setState] = useState<CAMWorkbenchState>({
    selectedTab: 'fdm',
  });
  const [jobs, setJobs] = useState<ManufacturingJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<ManufacturingJob | null>(null);

  // Initialize manufacturing bridge on component mount
  useEffect(() => {
    const initBridge = async () => {
      try {
        await initializeManufacturingBridge();
        console.log('✅ Manufacturing bridge initialized successfully');
      } catch (error) {
        console.warn('⚠️ Manufacturing bridge initialization warning (will use mock implementations):', error);
      }
    };

    initBridge();
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    setState((prev) => ({ ...prev, selectedTab: tab as any }));
  }, []);

  const handleCreateJob = useCallback((job: ManufacturingJob) => {
    setJobs((prev) => [...prev, job]);
    setSelectedJob(job);
  }, []);

  const handleDeleteJob = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    if (selectedJob?.id === jobId) {
      setSelectedJob(null);
    }
  }, [selectedJob]);

  const handleUpdateJob = useCallback((jobId: string, updates: Partial<ManufacturingJob>) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, ...updates, modifiedAt: new Date() } : j))
    );
    if (selectedJob?.id === jobId) {
      setSelectedJob((prev) => (prev ? { ...prev, ...updates } : null));
    }
  }, [selectedJob]);

  const totalTime = jobs.reduce((sum, job) => sum + job.estimatedTime, 0);
  const totalCost = jobs.reduce((sum, job) => sum + job.estimatedCost, 0);

  return (
    <div className={styles.workbench}>
      <header className={styles.header}>
        <div className={styles.title}>🏭 Manufacturing Workbench</div>
        <div className={styles.subtitle}>Complete CAM & Simulation System</div>
      </header>

      {/* Sidebar: Job list */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span>Jobs ({jobs.length})</span>
          <button
            className={styles.newJobBtn}
            onClick={() => setState((prev) => ({ ...prev, selectedTab: 'fdm' }))}
          >
            ➕ New
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className={styles.emptyJobs}>
            No manufacturing jobs yet. Create one from FDM or CNC tabs.
          </div>
        ) : (
          <div className={styles.jobsList}>
            {jobs.map((job) => (
              <div
                key={job.id}
                className={`${styles.jobItem} ${selectedJob?.id === job.id ? styles.active : ''}`}
                onClick={() => setSelectedJob(job)}
              >
                <div className={styles.jobItemName}>{job.name}</div>
                <div className={styles.jobItemDetails}>
                  <span className={styles.jobItemTime}>⏱️ {Math.round(job.estimatedTime)}m</span>
                  <span className={styles.jobItemCost}>💵 ${job.estimatedCost.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Main content area */}
      <main className={styles.main}>
        {/* Stats bar */}
        {jobs.length > 0 && (
          <div className={styles.statsBar}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total Jobs</div>
              <div className={styles.statValue}>{jobs.length}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total Time</div>
              <div className={styles.statValue}>
                {Math.round(totalTime)}
                <span className={styles.statUnit}>min</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total Cost</div>
              <div className={styles.statValue}>
                ${totalCost.toFixed(2)}
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Avg Cost/Job</div>
              <div className={styles.statValue}>
                ${(totalCost / jobs.length).toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Tabbed Interface */}
        <Tabs value={state.selectedTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="fdm">🖨️ FDM 3D Printing</TabsTrigger>
            <TabsTrigger value="cnc">⚙️ CNC Machining</TabsTrigger>
            <TabsTrigger value="simulation">🔬 Simulation</TabsTrigger>
            <TabsTrigger value="cost">💰 Cost Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="fdm" className={styles.tabContent}>
            <div className={styles.contentArea}>
              <FDMSlicerPanel
                job={selectedJob}
                onCreateJob={handleCreateJob}
                onUpdateJob={selectedJob ? (updates) => handleUpdateJob(selectedJob.id, updates) : undefined}
              />
            </div>
          </TabsContent>

          <TabsContent value="cnc" className={styles.tabContent}>
            <div className={styles.contentArea}>
              <CNCWorkbenchPanel
                job={selectedJob}
                onCreateJob={handleCreateJob}
                onUpdateJob={selectedJob ? (updates) => handleUpdateJob(selectedJob.id, updates) : undefined}
              />
            </div>
          </TabsContent>

          <TabsContent value="simulation" className={styles.tabContent}>
            <div className={styles.contentArea}>
              <ManufacturingSimulationPanel activeJob={selectedJob} />
            </div>
          </TabsContent>

          <TabsContent value="cost" className={styles.tabContent}>
            <div className={styles.contentArea}>
              <CostEstimatorPanel jobs={jobs} />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CAMWorkbench;
