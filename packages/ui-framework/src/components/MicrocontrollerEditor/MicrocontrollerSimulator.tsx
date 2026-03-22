/**
 * Microcontroller Simulator - Complete Integration
 *
 * Integrates BlockDiagramEditor, DebuggerPanel, and PeripheralView
 * with WASM microcontroller simulator backend.
 *
 * Workflow:
 * 1. Create block diagram (visual programming)
 * 2. Compile to C++ firmware
 * 3. Load firmware into WASM simulator
 * 4. Debug with step/run/pause controls
 * 5. Inspect register state, memory, and peripherals
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import BlockDiagramEditor from './BlockDiagramEditor';
import DebuggerPanel, { DebuggerState } from './DebuggerPanel';
import PeripheralView, { PeripheralState, GpioPin, AdcChannel, PwmPin, TimerState, UartData } from './PeripheralView';
import { MicrocontrollerBridge } from '../../microcontroller/MicrocontrollerBridge';
import { BlockDiagramCompiler } from '../../microcontroller/BlockDiagramCompiler';
import { CodeGenerator, GeneratedProject } from '../../microcontroller/CodeGenerator';
import styles from './MicrocontrollerSimulator.module.css';

// ========== Type Definitions ==========

export type McuTarget = 'arduino' | 'stm32f103' | 'stm32f401' | 'esp32';

interface SimulatorConfig {
  target: McuTarget;
  projectName: string;
  autoCompile: boolean;
  autoSimulate: boolean;
}

interface SimulationState {
  isLoaded: boolean;
  isSimulating: boolean;
  generatedCode: GeneratedProject | null;
  compilationError: string | null;
  firmwareBytes: Uint8Array | null;
}

// ========== Mock State Generator Functions ==========

function generateMockGpioState(): GpioPin[] {
  const ports = ['A', 'B', 'C', 'D'];
  const pins: GpioPin[] = [];

  for (const port of ports) {
    for (let i = 0; i < 16; i++) {
      pins.push({
        number: i,
        port,
        state: Math.random() > 0.5,
        mode: ['INPUT', 'OUTPUT', 'INPUT_PULLUP'][Math.floor(Math.random() * 3)] as any,
      });
    }
  }

  return pins;
}

function generateMockAdcState(): AdcChannel[] {
  const channels: AdcChannel[] = [];

  for (let i = 0; i < 8; i++) {
    const value = Math.floor(Math.random() * 1023);
    const voltage = (value / 1023) * 5.0;

    channels.push({
      number: i,
      value,
      maxValue: 1023,
      voltage,
      reference: 5.0,
    });
  }

  return channels;
}

function generateMockPwmState(): PwmPin[] {
  const pins: PwmPin[] = [];

  for (let i = 0; i < 4; i++) {
    pins.push({
      number: i,
      timer: Math.floor(i / 2) + 1,
      channel: (i % 2) + 1,
      dutyCycle: Math.random() * 100,
      frequency: 1000 + Math.floor(Math.random() * 5000),
      state: Math.random() > 0.5,
    });
  }

  return pins;
}

function generateMockTimerState(): TimerState[] {
  const timers: TimerState[] = [];

  for (let i = 0; i < 2; i++) {
    timers.push({
      number: i + 1,
      count: Math.floor(Math.random() * 65535),
      prescaler: 1,
      maxCount: 65535,
      running: Math.random() > 0.5,
    });
  }

  return timers;
}

function generateMockUartState(): UartData[] {
  return [
    {
      port: 0,
      baudRate: 9600,
      txBuffer: ['H', 'e', 'l', 'l', 'o'],
      rxBuffer: ['D', 'a', 't', 'a'],
      totalTransmitted: 42,
      totalReceived: 17,
    },
  ];
}

// ========== Main Microcontroller Simulator Component ==========

export const MicrocontrollerSimulator: React.FC = () => {
  // Configuration
  const [config, setConfig] = useState<SimulatorConfig>({
    target: 'arduino',
    projectName: 'firmware_project',
    autoCompile: true,
    autoSimulate: false,
  });

  // Simulation state
  const [simState, setSimState] = useState<SimulationState>({
    isLoaded: false,
    isSimulating: false,
    generatedCode: null,
    compilationError: null,
    firmwareBytes: null,
  });

  // Debugger state
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

  // Peripheral state
  const [peripheralState, setPeripheralState] = useState<PeripheralState>({
    gpios: [],
    adcs: [],
    pwms: [],
    timers: [],
    uarts: [],
  });

  // Bridge and compiler references
  const bridgeRef = useRef<MicrocontrollerBridge | null>(null);
  const compilerRef = useRef<BlockDiagramCompiler | null>(null);
  const generatorRef = useRef<CodeGenerator | null>(null);

  // ========== Initialization ==========

  useEffect(() => {
    // Initialize WASM bridge
    const initializeBridge = async () => {
      try {
        const bridge = new MicrocontrollerBridge();
        await bridge.loadFirmware(new Uint8Array()); // Empty firmware initially
        bridgeRef.current = bridge;
      } catch (error) {
        console.error('Failed to initialize WASM bridge:', error);
      }
    };

    initializeBridge();

    // Initialize peripheral state with mock data
    setPeripheralState({
      gpios: generateMockGpioState(),
      adcs: generateMockAdcState(),
      pwms: generateMockPwmState(),
      timers: generateMockTimerState(),
      uarts: generateMockUartState(),
    });
  }, []);

  // ========== Compilation Handler ==========

  const handleCompile = useCallback(
    async (graph: any) => {
      try {
        setSimState((prev) => ({ ...prev, compilationError: null }));

        // Step 1: Compile block diagram to AST
        const compiler = new BlockDiagramCompiler();
        const ast = compiler.compile(graph, config.target);

        // Step 2: Generate C++ code
        const generator = new CodeGenerator();
        const project = generator.generate(ast, config.target, config.projectName);

        // Update state with generated code
        setSimState((prev) => ({
          ...prev,
          generatedCode: project,
        }));

        // Step 3: Optional auto-simulate
        if (config.autoSimulate && project.files['src/main.cpp']) {
          // In real scenario, would compile and load firmware bytes
          // For now, use mock firmware
          const mockFirmwareBytes = new Uint8Array(1024); // Placeholder
          setSimState((prev) => ({
            ...prev,
            firmwareBytes: mockFirmwareBytes,
            isLoaded: true,
          }));
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown compilation error';
        setSimState((prev) => ({
          ...prev,
          compilationError: errorMsg,
        }));
      }
    },
    [config]
  );

  // ========== Simulation Handler ==========

  const handleLoadFirmware = useCallback(async () => {
    if (!simState.generatedCode) {
      alert('Please compile a project first');
      return;
    }

    try {
      // In real scenario, would compile C++ code and get firmware bytes
      // For now, use mock bytes
      const mockFirmwareBytes = new Uint8Array(1024);

      if (bridgeRef.current) {
        await bridgeRef.current.loadFirmware(mockFirmwareBytes);
        setSimState((prev) => ({
          ...prev,
          isLoaded: true,
          firmwareBytes: mockFirmwareBytes,
        }));
      }
    } catch (error) {
      alert('Failed to load firmware: ' + (error as Error).message);
    }
  }, [simState.generatedCode]);

  const handleStep = useCallback(() => {
    if (!simState.isLoaded || !bridgeRef.current) {
      alert('Firmware not loaded');
      return;
    }

    try {
      const state = bridgeRef.current.step();
      setDebuggerState((prev) => ({
        ...prev,
        currentPC: state.pc,
        totalCycles: state.totalCycles,
        registers: state.registers,
      }));

      // Update peripheral state based on register values
      updatePeripheralsFromCpuState(state);
    } catch (error) {
      alert('Simulation step failed: ' + (error as Error).message);
    }
  }, [simState.isLoaded]);

  const handleRunCycles = useCallback((cycles: number) => {
    if (!simState.isLoaded || !bridgeRef.current) {
      alert('Firmware not loaded');
      return;
    }

    try {
      const state = bridgeRef.current.runCycles(cycles);
      setDebuggerState((prev) => ({
        ...prev,
        currentPC: state.pc,
        totalCycles: state.totalCycles,
        registers: state.registers,
      }));

      // Update peripherals
      updatePeripheralsFromCpuState(state);
    } catch (error) {
      alert('Simulation failed: ' + (error as Error).message);
    }
  }, [simState.isLoaded]);

  const handleReset = useCallback(() => {
    if (!simState.isLoaded || !bridgeRef.current) {
      return;
    }

    try {
      bridgeRef.current.reset();
      setDebuggerState((prev) => ({
        ...prev,
        currentPC: 0,
        totalCycles: 0,
        registers: {},
      }));
    } catch (error) {
      alert('Reset failed: ' + (error as Error).message);
    }
  }, [simState.isLoaded]);

  const handleSetBreakpoint = useCallback((address: number) => {
    if (!bridgeRef.current) {
      return;
    }

    try {
      bridgeRef.current.setBreakpoint(address);
      setDebuggerState((prev) => ({
        ...prev,
        breakpoints: new Set(prev.breakpoints).add(address),
      }));
    } catch (error) {
      alert('Failed to set breakpoint: ' + (error as Error).message);
    }
  }, []);

  // ========== Peripheral State Updates ==========

  const updatePeripheralsFromCpuState = useCallback((cpuState: any) => {
    // Simulate updates to peripheral state based on CPU registers
    // In real implementation, would read actual peripheral registers

    setPeripheralState((prev) => {
      // Example: update first GPIO pin based on some register
      const updatedGpios = [...prev.gpios];
      if (updatedGpios.length > 0) {
        updatedGpios[0] = {
          ...updatedGpios[0],
          state: (cpuState.totalCycles % 2) === 0,
        };
      }

      // Example: update ADC channels with simulated values
      const updatedAdcs = prev.adcs.map((adc) => ({
        ...adc,
        value: Math.floor(
          ((cpuState.totalCycles + adc.number) % 1024)
        ),
      }));

      // Example: update PWM duty cycle
      const updatedPwms = prev.pwms.map((pwm) => ({
        ...pwm,
        dutyCycle: (cpuState.totalCycles % 100),
      }));

      return {
        ...prev,
        gpios: updatedGpios,
        adcs: updatedAdcs,
        pwms: updatedPwms,
      };
    });
  }, []);

  // ========== UI Layout ==========

  return (
    <div className={styles.microcontrollerSimulator}>
      {/* Top Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarSection}>
          <label htmlFor="target-select">Target Board:</label>
          <select
            id="target-select"
            value={config.target}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                target: e.target.value as McuTarget,
              }))
            }
            className={styles.selectInput}
          >
            <option value="arduino">Arduino Uno</option>
            <option value="stm32f103">STM32F103 (Blue Pill)</option>
            <option value="stm32f401">STM32F401 (Discovery)</option>
            <option value="esp32">ESP32 (DevKit)</option>
          </select>
        </div>

        <div className={styles.toolbarSection}>
          <label htmlFor="project-name">Project:</label>
          <input
            id="project-name"
            type="text"
            value={config.projectName}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                projectName: e.target.value,
              }))
            }
            className={styles.projectNameInput}
            placeholder="Enter project name"
          />
        </div>

        <div className={styles.toolbarSection}>
          <button onClick={handleLoadFirmware} className={styles.loadButton}>
            Load Firmware
          </button>
        </div>

        {simState.isLoaded && (
          <div className={styles.statusBadge}>
            ✓ Firmware Loaded
          </div>
        )}

        {simState.compilationError && (
          <div className={styles.errorBadge}>
            ✗ {simState.compilationError}
          </div>
        )}
      </div>

      {/* Main Content Area - 3 Columns */}
      <div className={styles.mainLayout}>
        {/* Left: Block Diagram Editor */}
        <div className={styles.editorPanel}>
          <div className={styles.panelLabel}>Block Diagram Editor</div>
          <BlockDiagramEditor
            targetBoard={config.target}
            onCompile={handleCompile}
            onSimulate={handleLoadFirmware}
          />
        </div>

        {/* Center: Debugger */}
        <div className={styles.debuggerPanel}>
          <div className={styles.panelLabel}>Debugger</div>
          {simState.isLoaded ? (
            <DebuggerPanel
              onStep={handleStep}
              onRunCycles={handleRunCycles}
              onReset={handleReset}
              onSetBreakpoint={handleSetBreakpoint}
              debuggerState={debuggerState}
            />
          ) : (
            <div className={styles.placeholderPanel}>
              Compile and load firmware to start debugging
            </div>
          )}
        </div>

        {/* Right: Peripherals */}
        <div className={styles.peripheralPanel}>
          <div className={styles.panelLabel}>Peripherals</div>
          {simState.isLoaded ? (
            <PeripheralView peripheralState={peripheralState} />
          ) : (
            <div className={styles.placeholderPanel}>
              Load firmware to view peripheral state
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MicrocontrollerSimulator;
