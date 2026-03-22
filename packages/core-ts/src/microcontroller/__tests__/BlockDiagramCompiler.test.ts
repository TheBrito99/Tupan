/**
 * BlockDiagramCompiler Unit Tests
 *
 * Tests for compiling visual block diagrams to AST:
 * - Topological sorting
 * - Type checking
 * - Cycle detection
 * - Code generation for all block types
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BlockDiagramCompiler, DataType, BlockNode, CompiledAst } from '../BlockDiagramCompiler';
import { Graph, Node } from '../../graph/Graph';
import { NodeId, PortId, PortDirection } from '../../graph/types';

describe('BlockDiagramCompiler', () => {
  let compiler: BlockDiagramCompiler;

  beforeEach(() => {
    compiler = new BlockDiagramCompiler();
  });

  // ========== Topological Sort Tests ==========

  describe('Topological Sorting', () => {
    it('should sort linear chain of blocks', () => {
      const graph = new Graph();

      // Create: ADC -> PID -> PWM
      const adcId = NodeId.new();
      const pidId = NodeId.new();
      const pwmId = NodeId.new();

      const adc: Node & BlockNode = {
        id: adcId,
        node_type: 'adc',
        blockType: 'adc',
        name: 'adc_input',
        parameters: { channel: 0 },
        inputs: [],
        outputs: [
          {
            id: PortId.new(),
            name: 'voltage',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const pid: Node & BlockNode = {
        id: pidId,
        node_type: 'pid',
        blockType: 'pid',
        name: 'pid_controller',
        parameters: { kp: 1.0, ki: 0.1, kd: 0.0 },
        inputs: [
          {
            id: PortId.new(),
            name: 'error',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
        ],
        outputs: [
          {
            id: PortId.new(),
            name: 'output',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const pwm: Node & BlockNode = {
        id: pwmId,
        node_type: 'pwm',
        blockType: 'pwm',
        name: 'pwm_output',
        parameters: { pin: 3, frequency: 1000 },
        inputs: [
          {
            id: PortId.new(),
            name: 'duty',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
        ],
        outputs: [],
        state: [],
      } as any;

      graph.addNode(adc);
      graph.addNode(pid);
      graph.addNode(pwm);

      // Connect ADC -> PID
      const edge1 = {
        id: { toString: () => '1' },
        source: [adcId, adc.outputs[0].id],
        target: [pidId, pid.inputs[0].id],
        properties: {},
      };

      // Connect PID -> PWM
      const edge2 = {
        id: { toString: () => '2' },
        source: [pidId, pid.outputs[0].id],
        target: [pwmId, pwm.inputs[0].id],
        properties: {},
      };

      graph.addEdge(edge1);
      graph.addEdge(edge2);

      // Compile should succeed
      const ast = compiler.compile(graph);

      expect(ast).toBeDefined();
      expect(ast.globalVariables.length).toBeGreaterThan(0);
      expect(ast.setupStatements.length).toBeGreaterThan(0);
      expect(ast.loopStatements.length).toBeGreaterThan(0);
    });

    it('should detect cycles in graph', () => {
      const graph = new Graph();

      const node1Id = NodeId.new();
      const node2Id = NodeId.new();
      const port1Id = PortId.new();
      const port2Id = PortId.new();

      const node1: Node & BlockNode = {
        id: node1Id,
        node_type: 'const',
        blockType: 'const',
        name: 'const1',
        parameters: { value: 1.0 },
        inputs: [],
        outputs: [
          {
            id: port1Id,
            name: 'out',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const node2: Node & BlockNode = {
        id: node2Id,
        node_type: 'math',
        blockType: 'math',
        name: 'math1',
        parameters: { operation: 'add' },
        inputs: [
          {
            id: port2Id,
            name: 'in',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
        ],
        outputs: [
          {
            id: PortId.new(),
            name: 'out',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      graph.addNode(node1);
      graph.addNode(node2);

      // Create cycle: 1->2->1
      const edge1 = {
        id: { toString: () => '1' },
        source: [node1Id, port1Id],
        target: [node2Id, port2Id],
        properties: {},
      };

      const edge2 = {
        id: { toString: () => '2' },
        source: [node2Id, node2.outputs[0].id],
        target: [node1Id, port1Id],
        properties: {},
      };

      graph.addEdge(edge1);
      graph.addEdge(edge2);

      // Should throw error for cycle
      expect(() => compiler.compile(graph)).toThrow('Cyclic dependency detected');
    });
  });

  // ========== Type Checking Tests ==========

  describe('Type Checking', () => {
    it('should allow number to number connections', () => {
      const graph = new Graph();

      const sourceId = NodeId.new();
      const sinkId = NodeId.new();
      const sourcePortId = PortId.new();
      const sinkPortId = PortId.new();

      const source: Node & BlockNode = {
        id: sourceId,
        node_type: 'const',
        blockType: 'const',
        name: 'source',
        parameters: { value: 5.0 },
        inputs: [],
        outputs: [
          {
            id: sourcePortId,
            name: 'value',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const sink: Node & BlockNode = {
        id: sinkId,
        node_type: 'pwm',
        blockType: 'pwm',
        name: 'pwm',
        parameters: { pin: 3, frequency: 1000 },
        inputs: [
          {
            id: sinkPortId,
            name: 'duty',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
        ],
        outputs: [],
        state: [],
      } as any;

      graph.addNode(source);
      graph.addNode(sink);

      const edge = {
        id: { toString: () => '1' },
        source: [sourceId, sourcePortId],
        target: [sinkId, sinkPortId],
        properties: {},
      };

      graph.addEdge(edge);

      // Should compile without error
      expect(() => compiler.compile(graph)).not.toThrow();
    });

    it('should detect dangling input ports', () => {
      const graph = new Graph();

      const pwmId = NodeId.new();

      const pwm: Node & BlockNode = {
        id: pwmId,
        node_type: 'pwm',
        blockType: 'pwm',
        name: 'pwm',
        parameters: { pin: 3, frequency: 1000 },
        inputs: [
          {
            id: PortId.new(),
            name: 'duty',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
        ],
        outputs: [],
        state: [],
      } as any;

      graph.addNode(pwm);

      // No edges - dangling input
      expect(() => compiler.compile(graph)).toThrow('Dangling input port');
    });
  });

  // ========== PID Block Generation ==========

  describe('PID Block Generation', () => {
    it('should generate PID block with correct parameters', () => {
      const graph = new Graph();

      const constId = NodeId.new();
      const pidId = NodeId.new();

      const constBlock: Node & BlockNode = {
        id: constId,
        node_type: 'const',
        blockType: 'const',
        name: 'error',
        parameters: { value: 0.5 },
        inputs: [],
        outputs: [
          {
            id: PortId.new(),
            name: 'value',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const pidInputPort = PortId.new();
      const pid: Node & BlockNode = {
        id: pidId,
        node_type: 'pid',
        blockType: 'pid',
        name: 'controller',
        parameters: { kp: 2.5, ki: 0.5, kd: 1.0 },
        inputs: [
          {
            id: pidInputPort,
            name: 'error',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
        ],
        outputs: [
          {
            id: PortId.new(),
            name: 'output',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      graph.addNode(constBlock);
      graph.addNode(pid);

      // Connect const -> pid
      graph.addEdge({
        id: { toString: () => '1' },
        source: [constId, constBlock.outputs[0].id],
        target: [pidId, pidInputPort],
        properties: {},
      });

      const ast = compiler.compile(graph);

      // Check generated code
      expect(ast.globalVariables).toContainEqual(
        expect.objectContaining({ name: 'controller_integral' })
      );
      expect(ast.globalVariables).toContainEqual(
        expect.objectContaining({ name: 'controller_prev_error' })
      );
      // Check that setup statements contain KP, KI, KD values
      expect(
        ast.setupStatements.some(s =>
          s.code.includes('controller_KP') && s.code.includes('2.5')
        )
      ).toBe(true);
      expect(
        ast.setupStatements.some(s =>
          s.code.includes('controller_KI') && s.code.includes('0.5')
        )
      ).toBe(true);
      expect(
        ast.setupStatements.some(s =>
          s.code.includes('controller_KD') && s.code.includes('1.0')
        )
      ).toBe(true);
    });
  });

  // ========== Filter Block Generation ==========

  describe('Filter Block Generation', () => {
    it('should generate low-pass filter block', () => {
      const graph = new Graph();

      const constId = NodeId.new();
      const filterId = NodeId.new();

      const constBlock: Node & BlockNode = {
        id: constId,
        node_type: 'const',
        blockType: 'const',
        name: 'signal',
        parameters: { value: 1.5 },
        inputs: [],
        outputs: [
          {
            id: PortId.new(),
            name: 'value',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const filterInputPort = PortId.new();
      const filter: Node & BlockNode = {
        id: filterId,
        node_type: 'filter',
        blockType: 'filter',
        name: 'lpf',
        parameters: { cutoff: 10.0 },
        inputs: [
          {
            id: filterInputPort,
            name: 'input',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
        ],
        outputs: [
          {
            id: PortId.new(),
            name: 'output',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      graph.addNode(constBlock);
      graph.addNode(filter);

      // Connect const -> filter
      graph.addEdge({
        id: { toString: () => '1' },
        source: [constId, constBlock.outputs[0].id],
        target: [filterId, filterInputPort],
        properties: {},
      });

      const ast = compiler.compile(graph);

      expect(ast.globalVariables).toContainEqual(
        expect.objectContaining({ name: 'lpf_output' })
      );
      expect(ast.setupStatements.some(s => s.code.includes('lpf_alpha'))).toBe(true);
    });
  });

  // ========== Math Block Generation ==========

  describe('Math Block Generation', () => {
    it('should generate math block for addition', () => {
      const graph = new Graph();

      const const1Id = NodeId.new();
      const const2Id = NodeId.new();
      const mathId = NodeId.new();

      const const1: Node & BlockNode = {
        id: const1Id,
        node_type: 'const',
        blockType: 'const',
        name: 'const1',
        parameters: { value: 1.0 },
        inputs: [],
        outputs: [
          {
            id: PortId.new(),
            name: 'value',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const const2: Node & BlockNode = {
        id: const2Id,
        node_type: 'const',
        blockType: 'const',
        name: 'const2',
        parameters: { value: 2.0 },
        inputs: [],
        outputs: [
          {
            id: PortId.new(),
            name: 'value',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const mathInputAPort = PortId.new();
      const mathInputBPort = PortId.new();

      const math: Node & BlockNode = {
        id: mathId,
        node_type: 'math',
        blockType: 'math',
        name: 'add_block',
        parameters: { operation: 'add' },
        inputs: [
          {
            id: mathInputAPort,
            name: 'a',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
          {
            id: mathInputBPort,
            name: 'b',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
        ],
        outputs: [
          {
            id: PortId.new(),
            name: 'result',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      graph.addNode(const1);
      graph.addNode(const2);
      graph.addNode(math);

      // Connect const1 -> math.a
      graph.addEdge({
        id: { toString: () => '1' },
        source: [const1Id, const1.outputs[0].id],
        target: [mathId, mathInputAPort],
        properties: {},
      });

      // Connect const2 -> math.b
      graph.addEdge({
        id: { toString: () => '2' },
        source: [const2Id, const2.outputs[0].id],
        target: [mathId, mathInputBPort],
        properties: {},
      });

      const ast = compiler.compile(graph);

      expect(ast.globalVariables).toContainEqual(
        expect.objectContaining({ name: 'add_block_result' })
      );
      expect(ast.loopStatements.some(s => s.code.includes('add'))).toBe(true);
    });

    it('should generate math block for multiplication', () => {
      const graph = new Graph();

      const const1Id = NodeId.new();
      const const2Id = NodeId.new();
      const mathId = NodeId.new();

      const const1: Node & BlockNode = {
        id: const1Id,
        node_type: 'const',
        blockType: 'const',
        name: 'const1',
        parameters: { value: 1.0 },
        inputs: [],
        outputs: [
          {
            id: PortId.new(),
            name: 'value',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const const2: Node & BlockNode = {
        id: const2Id,
        node_type: 'const',
        blockType: 'const',
        name: 'const2',
        parameters: { value: 2.0 },
        inputs: [],
        outputs: [
          {
            id: PortId.new(),
            name: 'value',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const mathInputAPort = PortId.new();
      const mathInputBPort = PortId.new();

      const math: Node & BlockNode = {
        id: mathId,
        node_type: 'math',
        blockType: 'math',
        name: 'multiply',
        parameters: { operation: 'multiply' },
        inputs: [
          {
            id: mathInputAPort,
            name: 'a',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
          {
            id: mathInputBPort,
            name: 'b',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
        ],
        outputs: [
          {
            id: PortId.new(),
            name: 'result',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      graph.addNode(const1);
      graph.addNode(const2);
      graph.addNode(math);

      // Connect const1 -> math.a
      graph.addEdge({
        id: { toString: () => '1' },
        source: [const1Id, const1.outputs[0].id],
        target: [mathId, mathInputAPort],
        properties: {},
      });

      // Connect const2 -> math.b
      graph.addEdge({
        id: { toString: () => '2' },
        source: [const2Id, const2.outputs[0].id],
        target: [mathId, mathInputBPort],
        properties: {},
      });

      const ast = compiler.compile(graph);

      expect(ast.globalVariables).toContainEqual(
        expect.objectContaining({ name: 'multiply_result' })
      );
    });
  });

  // ========== ADC Block Generation ==========

  describe('ADC Block Generation', () => {
    it('should generate Arduino ADC block', () => {
      const graph = new Graph();

      const adcId = NodeId.new();

      const adc: Node & BlockNode = {
        id: adcId,
        node_type: 'adc',
        blockType: 'adc',
        name: 'analog_input',
        parameters: { channel: 2 },
        inputs: [],
        outputs: [
          {
            id: PortId.new(),
            name: 'voltage',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      graph.addNode(adc);

      const ast = compiler.compile(graph, 'arduino');

      expect(ast.globalVariables).toContainEqual(
        expect.objectContaining({ name: 'analog_input_raw' })
      );
      expect(ast.globalVariables).toContainEqual(
        expect.objectContaining({ name: 'analog_input_voltage' })
      );
      expect(
        ast.loopStatements.some(s => s.code.includes('analogRead(A2)'))
      ).toBe(true);
    });

    it('should generate STM32 ADC block', () => {
      const graph = new Graph();

      const adcId = NodeId.new();

      const adc: Node & BlockNode = {
        id: adcId,
        node_type: 'adc',
        blockType: 'adc',
        name: 'adc_ch0',
        parameters: { channel: 0 },
        inputs: [],
        outputs: [
          {
            id: PortId.new(),
            name: 'voltage',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      graph.addNode(adc);

      const ast = compiler.compile(graph, 'stm32f103');

      expect(ast.globalVariables).toContainEqual(
        expect.objectContaining({ name: 'adc_ch0_raw' })
      );
      expect(
        ast.setupStatements.some(s => s.code.includes('STM32'))
      ).toBe(true);
    });

    it('should generate ESP32 ADC block', () => {
      const graph = new Graph();

      const adcId = NodeId.new();

      const adc: Node & BlockNode = {
        id: adcId,
        node_type: 'adc',
        blockType: 'adc',
        name: 'esp_adc',
        parameters: { channel: 3 },
        inputs: [],
        outputs: [
          {
            id: PortId.new(),
            name: 'voltage',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      graph.addNode(adc);

      const ast = compiler.compile(graph, 'esp32');

      expect(ast.globalVariables).toContainEqual(
        expect.objectContaining({ name: 'esp_adc_raw' })
      );
      expect(
        ast.setupStatements.some(s => s.code.includes('ESP32'))
      ).toBe(true);
    });
  });

  // ========== PWM Block Generation ==========

  describe('PWM Block Generation', () => {
    it('should generate PWM output block', () => {
      const graph = new Graph();

      const constId = NodeId.new();
      const pwmId = NodeId.new();

      const constBlock: Node & BlockNode = {
        id: constId,
        node_type: 'const',
        blockType: 'const',
        name: 'pwm_val',
        parameters: { value: 128.0 },
        inputs: [],
        outputs: [
          {
            id: PortId.new(),
            name: 'value',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const pwmInputPort = PortId.new();
      const pwm: Node & BlockNode = {
        id: pwmId,
        node_type: 'pwm',
        blockType: 'pwm',
        name: 'motor_pwm',
        parameters: { pin: 5, frequency: 1000 },
        inputs: [
          {
            id: pwmInputPort,
            name: 'duty',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
        ],
        outputs: [],
        state: [],
      } as any;

      graph.addNode(constBlock);
      graph.addNode(pwm);

      // Connect const -> pwm
      graph.addEdge({
        id: { toString: () => '1' },
        source: [constId, constBlock.outputs[0].id],
        target: [pwmId, pwmInputPort],
        properties: {},
      });

      const ast = compiler.compile(graph);

      expect(ast.globalVariables).toContainEqual(
        expect.objectContaining({ name: 'motor_pwm_duty' })
      );
      expect(ast.setupStatements.some(s => s.code.includes('pinMode(5'))).toBe(
        true
      );
      expect(
        ast.loopStatements.some(s => s.code.includes('analogWrite(5'))
      ).toBe(true);
    });
  });

  // ========== Saturation Block Generation ==========

  describe('Saturation Block Generation', () => {
    it('should generate saturation block with limits', () => {
      const graph = new Graph();

      const constId = NodeId.new();
      const satId = NodeId.new();

      const constBlock: Node & BlockNode = {
        id: constId,
        node_type: 'const',
        blockType: 'const',
        name: 'signal',
        parameters: { value: 500.0 },
        inputs: [],
        outputs: [
          {
            id: PortId.new(),
            name: 'value',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const satInputPort = PortId.new();
      const sat: Node & BlockNode = {
        id: satId,
        node_type: 'saturation',
        blockType: 'saturation',
        name: 'clamp',
        parameters: { min: 0, max: 255 },
        inputs: [
          {
            id: satInputPort,
            name: 'input',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
        ],
        outputs: [
          {
            id: PortId.new(),
            name: 'output',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      graph.addNode(constBlock);
      graph.addNode(sat);

      // Connect const -> sat
      graph.addEdge({
        id: { toString: () => '1' },
        source: [constId, constBlock.outputs[0].id],
        target: [satId, satInputPort],
        properties: {},
      });

      const ast = compiler.compile(graph);

      expect(ast.globalVariables).toContainEqual(
        expect.objectContaining({ name: 'clamp_output' })
      );
      expect(ast.loopStatements.some(s => s.code.includes('[0, 255]'))).toBe(
        true
      );
    });
  });

  // ========== Delay Block Generation ==========

  describe('Delay Block Generation', () => {
    it('should generate delay block', () => {
      const graph = new Graph();

      const constId = NodeId.new();
      const delayId = NodeId.new();

      const constBlock: Node & BlockNode = {
        id: constId,
        node_type: 'const',
        blockType: 'const',
        name: 'signal',
        parameters: { value: 1.0 },
        inputs: [],
        outputs: [
          {
            id: PortId.new(),
            name: 'value',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const delayInputPort = PortId.new();
      const delay: Node & BlockNode = {
        id: delayId,
        node_type: 'delay',
        blockType: 'delay',
        name: 'debounce',
        parameters: { delay_ms: 50 },
        inputs: [
          {
            id: delayInputPort,
            name: 'input',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
        ],
        outputs: [
          {
            id: PortId.new(),
            name: 'output',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      graph.addNode(constBlock);
      graph.addNode(delay);

      // Connect const -> delay
      graph.addEdge({
        id: { toString: () => '1' },
        source: [constId, constBlock.outputs[0].id],
        target: [delayId, delayInputPort],
        properties: {},
      });

      const ast = compiler.compile(graph);

      expect(ast.globalVariables).toContainEqual(
        expect.objectContaining({ name: 'debounce_last_time' })
      );
      expect(ast.loopStatements.some(s => s.code.includes('50 ms'))).toBe(
        true
      );
    });
  });

  // ========== Const Block Generation ==========

  describe('Const Block Generation', () => {
    it('should generate constant value block', () => {
      const graph = new Graph();

      const constId = NodeId.new();

      const constBlock: Node & BlockNode = {
        id: constId,
        node_type: 'const',
        blockType: 'const',
        name: 'gain',
        parameters: { value: 3.14159 },
        inputs: [],
        outputs: [
          {
            id: PortId.new(),
            name: 'value',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      graph.addNode(constBlock);

      const ast = compiler.compile(graph);

      expect(ast.globalVariables).toContainEqual(
        expect.objectContaining({ name: 'gain_value' })
      );
      expect(ast.setupStatements.some(s => s.code.includes('3.141'))).toBe(
        true
      );
    });
  });

  // ========== Integration Tests ==========

  describe('Integration Tests', () => {
    it('should compile ADC -> PID -> PWM chain', () => {
      const graph = new Graph();

      const adcId = NodeId.new();
      const pidId = NodeId.new();
      const pwmId = NodeId.new();

      const adc: Node & BlockNode = {
        id: adcId,
        node_type: 'adc',
        blockType: 'adc',
        name: 'sensor',
        parameters: { channel: 0 },
        inputs: [],
        outputs: [
          {
            id: PortId.new(),
            name: 'voltage',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const pid: Node & BlockNode = {
        id: pidId,
        node_type: 'pid',
        blockType: 'pid',
        name: 'controller',
        parameters: { kp: 1.0, ki: 0.1, kd: 0.0 },
        inputs: [
          {
            id: PortId.new(),
            name: 'error',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
        ],
        outputs: [
          {
            id: PortId.new(),
            name: 'output',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const pwm: Node & BlockNode = {
        id: pwmId,
        node_type: 'pwm',
        blockType: 'pwm',
        name: 'motor',
        parameters: { pin: 3, frequency: 1000 },
        inputs: [
          {
            id: PortId.new(),
            name: 'duty',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
        ],
        outputs: [],
        state: [],
      } as any;

      graph.addNode(adc);
      graph.addNode(pid);
      graph.addNode(pwm);

      // Connect ADC -> PID
      graph.addEdge({
        id: { toString: () => '1' },
        source: [adcId, adc.outputs[0].id],
        target: [pidId, pid.inputs[0].id],
        properties: {},
      });

      // Connect PID -> PWM
      graph.addEdge({
        id: { toString: () => '2' },
        source: [pidId, pid.outputs[0].id],
        target: [pwmId, pwm.inputs[0].id],
        properties: {},
      });

      const ast = compiler.compile(graph);

      expect(ast.includes).toContain('#include <Arduino.h>');
      expect(ast.globalVariables.length).toBeGreaterThan(0);
      expect(ast.setupStatements.length).toBeGreaterThan(0);
      expect(ast.loopStatements.length).toBeGreaterThan(0);
    });

    it('should compile complex diagram with multiple paths', () => {
      const graph = new Graph();

      // Create: [ADC] -> [Math] -> [Saturation] -> [PWM]
      // Also: [Const] -> [Math]

      const adcId = NodeId.new();
      const constId = NodeId.new();
      const mathId = NodeId.new();
      const satId = NodeId.new();
      const pwmId = NodeId.new();

      const adc: Node & BlockNode = {
        id: adcId,
        node_type: 'adc',
        blockType: 'adc',
        name: 'input',
        parameters: { channel: 0 },
        inputs: [],
        outputs: [
          {
            id: PortId.new(),
            name: 'out',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const constBlock: Node & BlockNode = {
        id: constId,
        node_type: 'const',
        blockType: 'const',
        name: 'gain',
        parameters: { value: 2.0 },
        inputs: [],
        outputs: [
          {
            id: PortId.new(),
            name: 'out',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const math: Node & BlockNode = {
        id: mathId,
        node_type: 'math',
        blockType: 'math',
        name: 'multiply',
        parameters: { operation: 'multiply' },
        inputs: [
          {
            id: PortId.new(),
            name: 'a',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
          {
            id: PortId.new(),
            name: 'b',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
        ],
        outputs: [
          {
            id: PortId.new(),
            name: 'out',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const sat: Node & BlockNode = {
        id: satId,
        node_type: 'saturation',
        blockType: 'saturation',
        name: 'clamp',
        parameters: { min: 0, max: 255 },
        inputs: [
          {
            id: PortId.new(),
            name: 'in',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
        ],
        outputs: [
          {
            id: PortId.new(),
            name: 'out',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      const pwm: Node & BlockNode = {
        id: pwmId,
        node_type: 'pwm',
        blockType: 'pwm',
        name: 'output',
        parameters: { pin: 3, frequency: 1000 },
        inputs: [
          {
            id: PortId.new(),
            name: 'in',
            direction: PortDirection.Input,
            dataType: DataType.Number,
          },
        ],
        outputs: [],
        state: [],
      } as any;

      graph.addNode(adc);
      graph.addNode(constBlock);
      graph.addNode(math);
      graph.addNode(sat);
      graph.addNode(pwm);

      // Connect ADC -> Math (input a)
      graph.addEdge({
        id: { toString: () => '1' },
        source: [adcId, adc.outputs[0].id],
        target: [mathId, math.inputs[0].id],
        properties: {},
      });

      // Connect Const -> Math (input b)
      graph.addEdge({
        id: { toString: () => '2' },
        source: [constId, constBlock.outputs[0].id],
        target: [mathId, math.inputs[1].id],
        properties: {},
      });

      // Connect Math -> Saturation
      graph.addEdge({
        id: { toString: () => '3' },
        source: [mathId, math.outputs[0].id],
        target: [satId, sat.inputs[0].id],
        properties: {},
      });

      // Connect Saturation -> PWM
      graph.addEdge({
        id: { toString: () => '4' },
        source: [satId, sat.outputs[0].id],
        target: [pwmId, pwm.inputs[0].id],
        properties: {},
      });

      const ast = compiler.compile(graph);

      expect(ast.globalVariables.length).toBeGreaterThan(0);
      expect(ast.setupStatements.length).toBeGreaterThan(0);
      expect(ast.loopStatements.length).toBeGreaterThan(0);
    });
  });

  // ========== Error Handling Tests ==========

  describe('Error Handling', () => {
    it('should handle empty graph', () => {
      const graph = new Graph();

      const ast = compiler.compile(graph);

      expect(ast.globalVariables.length).toBe(0);
      expect(ast.loopStatements.length).toBe(0);
    });

    it('should sanitize variable names correctly', () => {
      const graph = new Graph();

      const blockId = NodeId.new();

      const block: Node & BlockNode = {
        id: blockId,
        node_type: 'const',
        blockType: 'const',
        name: '123-invalid name!',
        parameters: { value: 1.0 },
        inputs: [],
        outputs: [
          {
            id: PortId.new(),
            name: 'out',
            direction: PortDirection.Output,
            dataType: DataType.Number,
          },
        ],
        state: [],
      } as any;

      graph.addNode(block);

      const ast = compiler.compile(graph);

      // Should have sanitized the name
      expect(
        ast.globalVariables.some(v =>
          v.name.match(/^[a-z_][a-z0-9_]*$/)
        )
      ).toBe(true);
    });
  });
});
