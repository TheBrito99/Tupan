/**
 * Debugger Panel - Real-time Firmware Debugging Interface
 *
 * Provides interactive debugging capabilities:
 * - Step-by-step execution with instruction tracing
 * - Run/Pause/Reset controls
 * - CPU register inspection (R0-R15, CPSR)
 * - Memory browser with hex dump
 * - Breakpoint management
 * - Execution state visualization
 * - Call stack inspection
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import styles from './DebuggerPanel.module.css';
import { MicrocontrollerBridge } from '../../microcontroller/MicrocontrollerBridge';

// ========== Type Definitions ==========

interface DebuggerState {
  isRunning: boolean;
  isPaused: boolean;
  currentPC: number;
  totalCycles: number;
  executionState: 'Running' | 'Halted' | 'Breakpoint' | 'Fault';
  registers: Record<string, number>;
  breakpoints: Set<number>;
  selectedMemoryAddress: number;
  memoryView: { start: number; data: Uint8Array } | null;
}

interface BreakpointInfo {
  address: number;
  enabled: boolean;
  hitCount: number;
}

// ========== Register View Component ==========

const RegisterView: React.FC<{
  registers: Record<string, number>;
  highlightPC?: boolean;
}> = ({ registers, highlightPC = false }) => {
  const generalRegisters = ['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11', 'r12'];
  const specialRegisters = ['sp', 'lr', 'pc'];

  const formatHex = (value: number): string => {
    return `0x${(value >>> 0).toString(16).padStart(8, '0').toUpperCase()}`;
  };

  const formatBinary = (value: number): string => {
    return (value >>> 0).toString(2).padStart(32, '0');
  };

  return (
    <div className={styles.registerView}>
      <div className={styles.registerGrid}>
        {/* General Purpose Registers */}
        <div className={styles.registerGroup}>
          <h4>General Purpose Registers</h4>
          <div className={styles.registerTable}>
            {generalRegisters.map((regName) => {
              const value = registers[regName] ?? 0;
              const regNameUpper = regName.toUpperCase();
              return (
                <div key={regName} className={styles.registerRow}>
                  <span className={styles.registerName}>{regNameUpper}:</span>
                  <span className={styles.registerValue}>{formatHex(value)}</span>
                  <span className={styles.registerDecimal}>({value})</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Special Registers */}
        <div className={styles.registerGroup}>
          <h4>Special Registers</h4>
          <div className={styles.registerTable}>
            {specialRegisters.map((regName) => {
              const value = registers[regName] ?? 0;
              const regNameUpper = regName.toUpperCase();
              const isPC = regName === 'pc';
              return (
                <div
                  key={regName}
                  className={`${styles.registerRow} ${isPC && highlightPC ? styles.highlightedRegister : ''}`}
                >
                  <span className={styles.registerName}>{regNameUpper}:</span>
                  <span className={styles.registerValue}>{formatHex(value)}</span>
                  <span className={styles.registerDecimal}>({value})</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status Register */}
        <div className={styles.registerGroup}>
          <h4>Status Register (CPSR)</h4>
          <div className={styles.statusRegister}>
            <div className={styles.statusField}>
              <span className={styles.statusLabel}>N (Negative):</span>
              <span className={styles.statusBit}>
                {((registers.cpsr ?? 0) >> 31) & 1}
              </span>
            </div>
            <div className={styles.statusField}>
              <span className={styles.statusLabel}>Z (Zero):</span>
              <span className={styles.statusBit}>
                {((registers.cpsr ?? 0) >> 30) & 1}
              </span>
            </div>
            <div className={styles.statusField}>
              <span className={styles.statusLabel}>C (Carry):</span>
              <span className={styles.statusBit}>
                {((registers.cpsr ?? 0) >> 29) & 1}
              </span>
            </div>
            <div className={styles.statusField}>
              <span className={styles.statusLabel}>V (Overflow):</span>
              <span className={styles.statusBit}>
                {((registers.cpsr ?? 0) >> 28) & 1}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ========== Memory Browser Component ==========

const MemoryBrowser: React.FC<{
  onAddressChange: (address: number) => void;
  memoryView: { start: number; data: Uint8Array } | null;
  selectedAddress: number;
}> = ({ onAddressChange, memoryView, selectedAddress }) => {
  const [addressInput, setAddressInput] = useState('0x00000000');

  const handleAddressSubmit = () => {
    try {
      const addr = parseInt(addressInput, 16);
      if (!isNaN(addr)) {
        onAddressChange(addr);
      }
    } catch (e) {
      // Invalid address
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddressSubmit();
    }
  };

  const formatByte = (byte: number): string => {
    return byte.toString(16).padStart(2, '0').toUpperCase();
  };

  const isASCII = (byte: number): boolean => {
    return byte >= 32 && byte <= 126;
  };

  return (
    <div className={styles.memoryBrowser}>
      <div className={styles.memoryControls}>
        <input
          type="text"
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="0x00000000"
          className={styles.addressInput}
        />
        <button onClick={handleAddressSubmit} className={styles.goButton}>
          Go
        </button>
      </div>

      {memoryView ? (
        <div className={styles.hexDump}>
          <table>
            <thead>
              <tr>
                <th>Address</th>
                <th colSpan={16}>Hex Data</th>
                <th>ASCII</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.ceil(memoryView.data.length / 16) }).map(
                (_, lineIdx) => {
                  const lineStart = memoryView.start + lineIdx * 16;
                  const lineEnd = Math.min(lineStart + 16, memoryView.start + memoryView.data.length);
                  const lineLength = lineEnd - lineStart;

                  return (
                    <tr key={lineIdx}>
                      <td className={styles.addressCell}>
                        {lineStart.toString(16).padStart(8, '0').toUpperCase()}
                      </td>
                      {Array.from({ length: 16 }).map((_, byteIdx) => {
                        const byteAddr = lineStart + byteIdx;
                        const dataIdx = byteAddr - memoryView.start;
                        const byte = dataIdx < memoryView.data.length ? memoryView.data[dataIdx] : 0;
                        const isSelected = byteAddr === selectedAddress;

                        return (
                          <td
                            key={byteIdx}
                            className={`${styles.byteCell} ${isSelected ? styles.selectedByte : ''}`}
                          >
                            {dataIdx < memoryView.data.length ? formatByte(byte) : '--'}
                          </td>
                        );
                      })}
                      <td className={styles.asciiCell}>
                        {Array.from({ length: lineLength })
                          .map((_, idx) => {
                            const byte = memoryView.data[lineIdx * 16 + idx];
                            return isASCII(byte) ? String.fromCharCode(byte) : '.';
                          })
                          .join('')}
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.noMemoryData}>Click "Go" to load memory at the specified address</div>
      )}
    </div>
  );
};

// ========== Breakpoint Manager Component ==========

const BreakpointManager: React.FC<{
  breakpoints: Map<number, BreakpointInfo>;
  onAddBreakpoint: (address: number) => void;
  onRemoveBreakpoint: (address: number) => void;
  onToggleBreakpoint: (address: number) => void;
}> = ({ breakpoints, onAddBreakpoint, onRemoveBreakpoint, onToggleBreakpoint }) => {
  const [addressInput, setAddressInput] = useState('0x00000000');

  const handleAddBreakpoint = () => {
    try {
      const addr = parseInt(addressInput, 16);
      if (!isNaN(addr)) {
        onAddBreakpoint(addr);
        setAddressInput('0x00000000');
      }
    } catch (e) {
      // Invalid address
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddBreakpoint();
    }
  };

  return (
    <div className={styles.breakpointManager}>
      <div className={styles.breakpointControls}>
        <input
          type="text"
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="0x00000000"
          className={styles.addressInput}
        />
        <button onClick={handleAddBreakpoint} className={styles.addButton}>
          + Add
        </button>
      </div>

      {breakpoints.size === 0 ? (
        <div className={styles.noBreakpoints}>No breakpoints set</div>
      ) : (
        <div className={styles.breakpointList}>
          {Array.from(breakpoints.entries()).map(([addr, info]) => (
            <div key={addr} className={styles.breakpointItem}>
              <input
                type="checkbox"
                checked={info.enabled}
                onChange={() => onToggleBreakpoint(addr)}
                className={styles.breakpointToggle}
              />
              <span className={styles.breakpointAddress}>
                {`0x${addr.toString(16).padStart(8, '0').toUpperCase()}`}
              </span>
              <span className={styles.hitCount}>Hits: {info.hitCount}</span>
              <button
                onClick={() => onRemoveBreakpoint(addr)}
                className={styles.removeButton}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ========== Main Debugger Panel Component ==========

export const DebuggerPanel: React.FC<{
  simulator: MicrocontrollerBridge | null;
}> = ({ simulator }) => {
  const [debuggerState, setDebuggerState] = useState<DebuggerState>({
    isRunning: false,
    isPaused: true,
    currentPC: 0,
    totalCycles: 0,
    executionState: 'Halted',
    registers: {},
    breakpoints: new Set(),
    selectedMemoryAddress: 0,
    memoryView: null,
  });

  const [activeTab, setActiveTab] = useState<'registers' | 'memory' | 'breakpoints'>('registers');
  const [stepCount, setStepCount] = useState(1);
  const runIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const breakpointsMapRef = useRef<Map<number, BreakpointInfo>>(new Map());

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (runIntervalRef.current) {
        clearInterval(runIntervalRef.current);
      }
    };
  }, []);

  // Step execution
  const handleStep = useCallback(() => {
    if (!simulator) return;

    try {
      const state = simulator.step();
      setDebuggerState((prev) => ({
        ...prev,
        currentPC: state.pc,
        totalCycles: state.totalCycles,
        executionState: state.executionState,
        registers: state.registers,
      }));

      // Check for breakpoint
      if (breakpointsMapRef.current.has(state.pc)) {
        const bp = breakpointsMapRef.current.get(state.pc)!;
        bp.hitCount++;
        setDebuggerState((prev) => ({
          ...prev,
          isPaused: true,
          isRunning: false,
          executionState: 'Breakpoint',
        }));
      }
    } catch (error) {
      console.error('Step execution error:', error);
    }
  }, [simulator]);

  // Run execution
  const handleRun = useCallback(() => {
    if (!simulator || debuggerState.isRunning) return;

    setDebuggerState((prev) => ({
      ...prev,
      isRunning: true,
      isPaused: false,
    }));

    runIntervalRef.current = setInterval(() => {
      try {
        const state = simulator.runCycles(100); // Run 100 cycles per interval
        setDebuggerState((prev) => ({
          ...prev,
          currentPC: state.pc,
          totalCycles: state.totalCycles,
          executionState: state.executionState,
          registers: state.registers,
        }));

        // Check for breakpoint
        if (breakpointsMapRef.current.has(state.pc)) {
          const bp = breakpointsMapRef.current.get(state.pc)!;
          bp.hitCount++;
          clearInterval(runIntervalRef.current!);
          setDebuggerState((prev) => ({
            ...prev,
            isRunning: false,
            isPaused: true,
            executionState: 'Breakpoint',
          }));
        }

        // Stop if halted
        if (state.executionState === 'Halted' || state.executionState === 'Fault') {
          clearInterval(runIntervalRef.current!);
          setDebuggerState((prev) => ({
            ...prev,
            isRunning: false,
            isPaused: true,
          }));
        }
      } catch (error) {
        console.error('Run execution error:', error);
        clearInterval(runIntervalRef.current!);
        setDebuggerState((prev) => ({
          ...prev,
          isRunning: false,
          isPaused: true,
        }));
      }
    }, 50); // Update every 50ms (20 FPS)
  }, [simulator, debuggerState.isRunning]);

  // Pause execution
  const handlePause = useCallback(() => {
    if (runIntervalRef.current) {
      clearInterval(runIntervalRef.current);
      runIntervalRef.current = null;
    }

    setDebuggerState((prev) => ({
      ...prev,
      isRunning: false,
      isPaused: true,
    }));
  }, []);

  // Reset execution
  const handleReset = useCallback(() => {
    if (!simulator) return;

    if (runIntervalRef.current) {
      clearInterval(runIntervalRef.current);
      runIntervalRef.current = null;
    }

    simulator.reset();

    setDebuggerState((prev) => ({
      ...prev,
      isRunning: false,
      isPaused: true,
      currentPC: 0,
      totalCycles: 0,
      executionState: 'Halted',
      registers: {},
    }));
  }, [simulator]);

  // Load memory
  const handleLoadMemory = useCallback(
    (address: number) => {
      if (!simulator) return;

      try {
        const memory = simulator.getMemory(address, 256);
        setDebuggerState((prev) => ({
          ...prev,
          selectedMemoryAddress: address,
          memoryView: memory,
        }));
      } catch (error) {
        console.error('Memory load error:', error);
      }
    },
    [simulator]
  );

  // Breakpoint management
  const handleAddBreakpoint = useCallback((address: number) => {
    breakpointsMapRef.current.set(address, {
      address,
      enabled: true,
      hitCount: 0,
    });

    setDebuggerState((prev) => ({
      ...prev,
      breakpoints: new Set(breakpointsMapRef.current.keys()),
    }));
  }, []);

  const handleRemoveBreakpoint = useCallback((address: number) => {
    breakpointsMapRef.current.delete(address);

    setDebuggerState((prev) => ({
      ...prev,
      breakpoints: new Set(breakpointsMapRef.current.keys()),
    }));
  }, []);

  const handleToggleBreakpoint = useCallback((address: number) => {
    const bp = breakpointsMapRef.current.get(address);
    if (bp) {
      bp.enabled = !bp.enabled;
    }
  }, []);

  if (!simulator) {
    return <div className={styles.debuggerPanel}>No simulator loaded</div>;
  }

  return (
    <div className={styles.debuggerPanel}>
      {/* Control Panel */}
      <div className={styles.controlPanel}>
        <div className={styles.controls}>
          <button
            onClick={() => handleStep()}
            disabled={debuggerState.isRunning}
            className={styles.controlButton}
            title="Execute one instruction"
          >
            ⏭ Step
          </button>
          <button
            onClick={handleRun}
            disabled={debuggerState.isRunning}
            className={styles.controlButton}
            title="Run continuously"
          >
            ▶ Run
          </button>
          <button
            onClick={handlePause}
            disabled={!debuggerState.isRunning}
            className={styles.controlButton}
            title="Pause execution"
          >
            ⏸ Pause
          </button>
          <button
            onClick={handleReset}
            className={styles.controlButton}
            title="Reset to initial state"
          >
            🔄 Reset
          </button>
        </div>

        <div className={styles.executionStats}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Status:</span>
            <span className={styles.statValue}>{debuggerState.executionState}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>PC:</span>
            <span className={styles.statValue}>
              0x{debuggerState.currentPC.toString(16).padStart(8, '0').toUpperCase()}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Cycles:</span>
            <span className={styles.statValue}>{debuggerState.totalCycles}</span>
          </div>
        </div>

        <div className={styles.stepControl}>
          <label>
            Steps:
            <input
              type="number"
              value={stepCount}
              onChange={(e) => setStepCount(Math.max(1, parseInt(e.target.value) || 1))}
              min="1"
              max="1000"
              className={styles.stepInput}
            />
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'registers' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('registers')}
        >
          CPU Registers
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'memory' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('memory')}
        >
          Memory
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'breakpoints' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('breakpoints')}
        >
          Breakpoints
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'registers' && (
          <RegisterView registers={debuggerState.registers} highlightPC={true} />
        )}

        {activeTab === 'memory' && (
          <MemoryBrowser
            onAddressChange={handleLoadMemory}
            memoryView={debuggerState.memoryView}
            selectedAddress={debuggerState.selectedMemoryAddress}
          />
        )}

        {activeTab === 'breakpoints' && (
          <BreakpointManager
            breakpoints={breakpointsMapRef.current}
            onAddBreakpoint={handleAddBreakpoint}
            onRemoveBreakpoint={handleRemoveBreakpoint}
            onToggleBreakpoint={handleToggleBreakpoint}
          />
        )}
      </div>
    </div>
  );
};

export default DebuggerPanel;
