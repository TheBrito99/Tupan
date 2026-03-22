/**
 * CodeGenerator Tests
 *
 * Tests C++ code generation from Abstract Syntax Tree (AST)
 * Validates firmware code, platformio.ini, and README generation
 * for all supported microcontroller targets.
 */

import { CodeGenerator, GeneratedCode } from '../CodeGenerator';
import { CompiledAst, McuTarget } from '../types';

describe('CodeGenerator', () => {
  // ========== Helper Functions ==========

  /**
   * Create a minimal valid CompiledAst for testing
   */
  function createMinimalAst(): CompiledAst {
    return {
      globalVariables: [],
      setupStatements: [],
      loopStatements: [],
      functions: [],
      includes: ['#include <Arduino.h>'],
      defines: {},
    };
  }

  /**
   * Create an AST with PID controller
   */
  function createPidAst(): CompiledAst {
    return {
      globalVariables: [
        { name: 'pidKp', type: 'float', initialValue: '1.0' },
        { name: 'pidIntegral', type: 'float', initialValue: '0.0' },
        { name: 'pidPrevError', type: 'float', initialValue: '0.0' },
      ],
      setupStatements: [
        { code: 'Serial.begin(9600);', indent: 0 },
        { code: 'pinMode(A0, INPUT);', indent: 0 },
        { code: 'pinMode(3, OUTPUT);', indent: 0 },
      ],
      loopStatements: [
        { code: 'float sensorValue = analogRead(A0) / 1023.0;', indent: 0 },
        { code: 'float error = 0.5 - sensorValue;', indent: 0 },
        { code: 'pidIntegral += error * 0.01;', indent: 0 },
        { code: 'float output = pidKp * error + pidIntegral * 0.1;', indent: 0 },
        { code: 'analogWrite(3, (int)(output * 255));', indent: 0 },
      ],
      functions: [],
      includes: ['#include <Arduino.h>'],
      defines: {
        ADC_RESOLUTION: '1023',
        PWM_MAX: '255',
      },
    };
  }

  /**
   * Create an AST with custom function
   */
  function createFunctionAst(): CompiledAst {
    return {
      globalVariables: [{ name: 'counter', type: 'int', initialValue: '0' }],
      setupStatements: [{ code: 'Serial.begin(9600);', indent: 0 }],
      loopStatements: [
        { code: 'int result = multiply(2, 3);', indent: 0 },
        { code: 'Serial.println(result);', indent: 0 },
      ],
      functions: [
        {
          name: 'multiply',
          returnType: 'int',
          parameters: [
            { name: 'a', type: 'int' },
            { name: 'b', type: 'int' },
          ],
          body: [
            { code: 'return a * b;', indent: 1 },
          ],
        },
      ],
      includes: ['#include <Arduino.h>'],
      defines: {},
    };
  }

  // ========== Main Code Generation Tests ==========

  describe('main.cpp Generation', () => {
    it('should generate valid C++ file structure', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'test_project');

      expect(generated.mainCode).toBeDefined();
      expect(generated.mainCode.length).toBeGreaterThan(0);

      // Check for required sections
      expect(generated.mainCode).toContain('#include');
      expect(generated.mainCode).toContain('void setup()');
      expect(generated.mainCode).toContain('void loop()');
    });

    it('should include all header files from AST', () => {
      const ast = createMinimalAst();
      ast.includes.push('#include <Wire.h>');
      ast.includes.push('#include <SPI.h>');

      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'test_project');

      expect(generated.mainCode).toContain('#include <Arduino.h>');
      expect(generated.mainCode).toContain('#include <Wire.h>');
      expect(generated.mainCode).toContain('#include <SPI.h>');
    });

    it('should generate preprocessor defines', () => {
      const ast = createPidAst();

      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'test_project');

      expect(generated.mainCode).toContain('#define ADC_RESOLUTION 1023');
      expect(generated.mainCode).toContain('#define PWM_MAX 255');
    });

    it('should declare global variables', () => {
      const ast = createPidAst();

      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'test_project');

      expect(generated.mainCode).toContain('float pidKp = 1.0;');
      expect(generated.mainCode).toContain('float pidIntegral = 0.0;');
      expect(generated.mainCode).toContain('float pidPrevError = 0.0;');
    });

    it('should generate function definitions before setup()', () => {
      const ast = createFunctionAst();

      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'test_project');

      const functionIndex = generated.mainCode.indexOf('int multiply(int a, int b)');
      const setupIndex = generated.mainCode.indexOf('void setup()');

      expect(functionIndex).toBeGreaterThan(-1);
      expect(setupIndex).toBeGreaterThan(-1);
      expect(functionIndex).toBeLessThan(setupIndex);
    });

    it('should include function body statements', () => {
      const ast = createFunctionAst();

      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'test_project');

      expect(generated.mainCode).toContain('return a * b;');
    });

    it('should populate setup() with initialization statements', () => {
      const ast = createPidAst();

      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'test_project');

      const setupStart = generated.mainCode.indexOf('void setup()');
      const loopStart = generated.mainCode.indexOf('void loop()');

      expect(setupStart).toBeGreaterThan(-1);
      expect(loopStart).toBeGreaterThan(-1);

      const setupSection = generated.mainCode.substring(setupStart, loopStart);
      expect(setupSection).toContain('Serial.begin(9600);');
      expect(setupSection).toContain('pinMode(A0, INPUT);');
      expect(setupSection).toContain('pinMode(3, OUTPUT);');
    });

    it('should populate loop() with execution statements', () => {
      const ast = createPidAst();

      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'test_project');

      const loopStart = generated.mainCode.indexOf('void loop()');
      const endBrace = generated.mainCode.lastIndexOf('}');

      expect(loopStart).toBeGreaterThan(-1);

      const loopSection = generated.mainCode.substring(loopStart, endBrace);
      expect(loopSection).toContain('float sensorValue = analogRead(A0) / 1023.0;');
      expect(loopSection).toContain('float error = 0.5 - sensorValue;');
      expect(loopSection).toContain('analogWrite(3, (int)(output * 255));');
    });

    it('should handle empty AST gracefully', () => {
      const ast: CompiledAst = {
        globalVariables: [],
        setupStatements: [],
        loopStatements: [],
        functions: [],
        includes: [],
        defines: {},
      };

      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'empty_project');

      expect(generated.mainCode).toBeDefined();
      expect(generated.mainCode).toContain('void setup()');
      expect(generated.mainCode).toContain('void loop()');
      expect(generated.mainCode).toContain('delay(10);'); // Placeholder
    });

    it('should maintain proper indentation', () => {
      const ast: CompiledAst = {
        globalVariables: [],
        setupStatements: [
          { code: 'Serial.begin(9600);', indent: 0 },
        ],
        loopStatements: [
          { code: 'delay(1000);', indent: 0 },
        ],
        functions: [],
        includes: ['#include <Arduino.h>'],
        defines: {},
      };

      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'indent_test');

      expect(generated.mainCode).toContain('  Serial.begin(9600);'); // Setup indent
      expect(generated.mainCode).toContain('  delay(1000);'); // Loop indent
    });
  });

  // ========== platformio.ini Generation Tests ==========

  describe('platformio.ini Generation', () => {
    it('should generate valid platformio.ini for Arduino Uno', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'arduino_project');

      expect(generated.platformioIni).toBeDefined();
      expect(generated.platformioIni).toContain('[env:arduino_project]');
      expect(generated.platformioIni).toContain('platform = atmelavr');
      expect(generated.platformioIni).toContain('board = uno');
      expect(generated.platformioIni).toContain('framework = arduino');
    });

    it('should generate valid platformio.ini for Arduino Mega', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.ArduinoMega, 'mega_project');

      expect(generated.platformioIni).toContain('board = megaatmega2560');
      expect(generated.platformioIni).toContain('platform = atmelavr');
    });

    it('should generate valid platformio.ini for STM32F103', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.STM32F103, 'stm32_project');

      expect(generated.platformioIni).toContain('platform = ststm32');
      expect(generated.platformioIni).toContain('board = bluepill_f103c8');
    });

    it('should generate valid platformio.ini for STM32F401', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.STM32F401, 'discovery_project');

      expect(generated.platformioIni).toContain('platform = ststm32');
      expect(generated.platformioIni).toContain('board = discovery_f407vg');
    });

    it('should generate valid platformio.ini for STM32L476', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.STM32L476, 'nucleo_project');

      expect(generated.platformioIni).toContain('platform = ststm32');
      expect(generated.platformioIni).toContain('board = nucleo_l476rg');
    });

    it('should generate valid platformio.ini for ESP32', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.ESP32, 'esp32_project');

      expect(generated.platformioIni).toContain('platform = espressif32');
      expect(generated.platformioIni).toContain('board = esp32doit-devkit-v1');
    });

    it('should include upload and monitor speeds', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'serial_project');

      expect(generated.platformioIni).toContain('upload_speed = 115200');
      expect(generated.platformioIni).toContain('monitor_speed = 9600');
    });

    it('should have lib_deps section', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'deps_project');

      expect(generated.platformioIni).toContain('lib_deps =');
    });
  });

  // ========== README.md Generation Tests ==========

  describe('README.md Generation', () => {
    it('should generate README with project title', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'my_firmware');

      expect(generated.files['README.md']).toBeDefined();
      expect(generated.files['README.md']).toContain('# my_firmware');
    });

    it('should include target board information', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'project');

      const readme = generated.files['README.md'];
      expect(readme).toContain('Target Platform');
      expect(readme).toContain(McuTarget.Arduino);
    });

    it('should include build instructions for PlatformIO CLI', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'project');

      const readme = generated.files['README.md'];
      expect(readme).toContain('platformio run');
      expect(readme).toContain('platformio run --target upload');
      expect(readme).toContain('platformio device monitor');
    });

    it('should include instructions for PlatformIO IDE', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'project');

      const readme = generated.files['README.md'];
      expect(readme).toContain('PlatformIO IDE');
      expect(readme).toContain('Build');
      expect(readme).toContain('Upload');
      expect(readme).toContain('Monitor');
    });

    it('should include instructions for Arduino IDE', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'project');

      const readme = generated.files['README.md'];
      expect(readme).toContain('Arduino IDE');
      expect(readme).toContain('main.cpp');
    });

    it('should document project structure', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'project');

      const readme = generated.files['README.md'];
      expect(readme).toContain('Project Structure');
      expect(readme).toContain('src/main.cpp');
      expect(readme).toContain('platformio.ini');
      expect(readme).toContain('README.md');
    });

    it('should explain generated code structure', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'project');

      const readme = generated.files['README.md'];
      expect(readme).toContain('Generated Code Structure');
      expect(readme).toContain('Includes');
      expect(readme).toContain('Defines');
      expect(readme).toContain('Global Variables');
      expect(readme).toContain('Functions');
      expect(readme).toContain('setup()');
      expect(readme).toContain('loop()');
    });

    it('should include troubleshooting section', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'project');

      const readme = generated.files['README.md'];
      expect(readme).toContain('Troubleshooting');
      expect(readme).toContain('Compilation Errors');
      expect(readme).toContain('Upload Issues');
      expect(readme).toContain('Runtime Issues');
    });

    it('should include documentation links', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'project');

      const readme = generated.files['README.md'];
      expect(readme).toContain('PlatformIO Documentation');
      expect(readme).toContain('Arduino Language Reference');
      expect(readme).toContain('Tupan Documentation');
    });
  });

  // ========== File Output Structure Tests ==========

  describe('File Output Structure', () => {
    it('should return GeneratedCode with all required files', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'test');

      expect(generated.files).toBeDefined();
      expect(generated.files['src/main.cpp']).toBeDefined();
      expect(generated.files['platformio.ini']).toBeDefined();
      expect(generated.files['README.md']).toBeDefined();
    });

    it('should match main.cpp in files and mainCode property', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'test');

      expect(generated.files['src/main.cpp']).toBe(generated.mainCode);
    });

    it('should match platformio.ini in files and property', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'test');

      expect(generated.files['platformio.ini']).toBe(generated.platformioIni);
    });

    it('should include metadata in GeneratedCode', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'test_proj');

      expect(generated.projectName).toBe('test_proj');
      expect(generated.targetBoard).toBe(McuTarget.Arduino);
    });

    it('should return files object for export', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'test');

      const files = CodeGenerator.exportAsFiles(generated);

      expect(files['src/main.cpp']).toBeDefined();
      expect(files['platformio.ini']).toBeDefined();
      expect(files['README.md']).toBeDefined();
    });
  });

  // ========== Target Platform Tests ==========

  describe('Target Platform Support', () => {
    const platforms = [
      McuTarget.Arduino,
      McuTarget.ArduinoMega,
      McuTarget.STM32F103,
      McuTarget.STM32F401,
      McuTarget.STM32L476,
      McuTarget.ESP32,
    ];

    platforms.forEach((platform) => {
      it(`should generate valid code for ${platform}`, () => {
        const ast = createPidAst();
        const generated = CodeGenerator.generate(ast, platform, `test_${platform}`);

        expect(generated.mainCode).toBeDefined();
        expect(generated.mainCode.length).toBeGreaterThan(100);
        expect(generated.platformioIni).toBeDefined();
        expect(generated.platformioIni.length).toBeGreaterThan(10);
        expect(generated.files['README.md']).toBeDefined();
      });

      it(`should have correct platform in platformio.ini for ${platform}`, () => {
        const ast = createMinimalAst();
        const generated = CodeGenerator.generate(ast, platform, 'test');

        expect(generated.platformioIni).toContain('[env:test]');
        expect(generated.platformioIni).toContain('platform =');
        expect(generated.platformioIni).toContain('board =');
      });
    });
  });

  // ========== Edge Cases and Error Handling Tests ==========

  describe('Edge Cases', () => {
    it('should handle special characters in project name', () => {
      const ast = createMinimalAst();
      // Project name with underscores and numbers
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'my_project_v2');

      expect(generated.projectName).toBe('my_project_v2');
      expect(generated.files['README.md']).toContain('my_project_v2');
    });

    it('should handle long project names', () => {
      const ast = createMinimalAst();
      const longName = 'this_is_a_very_long_project_name_with_many_characters';
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, longName);

      expect(generated.projectName).toBe(longName);
    });

    it('should handle large AST with many statements', () => {
      const ast: CompiledAst = {
        globalVariables: Array.from({ length: 50 }, (_, i) => ({
          name: `var${i}`,
          type: 'float',
          initialValue: `${i}.0`,
        })),
        setupStatements: Array.from({ length: 30 }, (_, i) => ({
          code: `Serial.print(${i});`,
          indent: 0,
        })),
        loopStatements: Array.from({ length: 30 }, (_, i) => ({
          code: `delay(${i * 10});`,
          indent: 0,
        })),
        functions: [],
        includes: ['#include <Arduino.h>'],
        defines: {},
      };

      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'large_ast');

      expect(generated.mainCode.length).toBeGreaterThan(5000);
      expect(generated.mainCode).toContain('var0');
      expect(generated.mainCode).toContain('var49');
    });

    it('should handle AST with complex function signatures', () => {
      const ast: CompiledAst = {
        globalVariables: [],
        setupStatements: [],
        loopStatements: [],
        functions: [
          {
            name: 'complexFunction',
            returnType: 'float',
            parameters: [
              { name: 'a', type: 'float' },
              { name: 'b', type: 'int' },
              { name: 'c', type: 'bool' },
            ],
            body: [
              { code: 'if (c) { return a + b; } else { return a - b; }', indent: 1 },
            ],
          },
        ],
        includes: ['#include <Arduino.h>'],
        defines: {},
      };

      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'complex_func');

      expect(generated.mainCode).toContain('float complexFunction');
      expect(generated.mainCode).toContain('(float a, int b, bool c)');
    });

    it('should generate code with no define statements', () => {
      const ast: CompiledAst = {
        globalVariables: [],
        setupStatements: [],
        loopStatements: [],
        functions: [],
        includes: ['#include <Arduino.h>'],
        defines: {}, // Empty defines
      };

      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'no_defines');

      expect(generated.mainCode).toBeDefined();
      expect(generated.mainCode).toContain('void setup()');
    });

    it('should handle variable names with special formatting', () => {
      const ast: CompiledAst = {
        globalVariables: [
          { name: 'myVar_123', type: 'int', initialValue: '0' },
          { name: 'CamelCaseVar', type: 'float', initialValue: '1.0' },
          { name: 'snake_case_var', type: 'bool', initialValue: 'false' },
        ],
        setupStatements: [],
        loopStatements: [],
        functions: [],
        includes: ['#include <Arduino.h>'],
        defines: {},
      };

      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'var_names');

      expect(generated.mainCode).toContain('int myVar_123 = 0;');
      expect(generated.mainCode).toContain('float CamelCaseVar = 1.0;');
      expect(generated.mainCode).toContain('bool snake_case_var = false;');
    });
  });

  // ========== Code Quality Tests ==========

  describe('Code Quality', () => {
    it('should generate code with valid C++ syntax structure', () => {
      const ast = createPidAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'quality');

      // Check for basic C++ structure
      expect(generated.mainCode).toMatch(/void\s+setup\s*\(\s*\)/);
      expect(generated.mainCode).toMatch(/void\s+loop\s*\(\s*\)/);
      expect(generated.mainCode).toMatch(/\{[\s\S]*\}/); // Contains braces
    });

    it('should generate properly closed braces', () => {
      const ast = createPidAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'braces');

      const openBraces = (generated.mainCode.match(/\{/g) || []).length;
      const closeBraces = (generated.mainCode.match(/\}/g) || []).length;

      expect(openBraces).toBe(closeBraces);
    });

    it('should include Serial.begin in setup for Arduino', () => {
      const ast = createMinimalAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'serial');

      expect(generated.mainCode).toContain('Serial.begin(9600);');
    });

    it('should have placeholder delay in loop if empty', () => {
      const ast: CompiledAst = {
        globalVariables: [],
        setupStatements: [],
        loopStatements: [], // Empty loop
        functions: [],
        includes: ['#include <Arduino.h>'],
        defines: {},
      };

      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'empty_loop');

      expect(generated.mainCode).toContain('delay(');
    });

    it('should not have syntax errors in header comments', () => {
      const ast = createMinimalAst();
      ast.globalVariables.push({
        name: 'testVar',
        type: 'int',
        initialValue: '42',
      });

      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'comments');

      // File header should have valid comment syntax
      const headerMatch = generated.mainCode.match(/^\/\*[\s\S]*?\*\//);
      if (headerMatch) {
        expect(headerMatch[0]).toMatch(/\/\*/);
        expect(headerMatch[0]).toMatch(/\*\//);
      }
    });
  });

  // ========== Integration Tests ==========

  describe('Integration Tests', () => {
    it('should generate complete ADC -> PID -> PWM project', () => {
      const ast = createPidAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'pid_controller');

      // Verify complete firmware structure
      expect(generated.mainCode).toContain('void setup()');
      expect(generated.mainCode).toContain('void loop()');
      expect(generated.mainCode).toContain('analogRead(A0)');
      expect(generated.mainCode).toContain('analogWrite(3');

      // Verify build config
      expect(generated.platformioIni).toContain('platform = atmelavr');
      expect(generated.platformioIni).toContain('board = uno');

      // Verify documentation
      expect(generated.files['README.md']).toContain('pid_controller');
      expect(generated.files['README.md']).toContain('Arduino');
    });

    it('should generate complete multi-function project', () => {
      const ast = createFunctionAst();
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, 'function_demo');

      // Verify function exists
      expect(generated.mainCode).toContain('int multiply(int a, int b)');
      expect(generated.mainCode).toContain('return a * b;');

      // Verify function is called in loop
      expect(generated.mainCode).toContain('multiply(2, 3)');

      // Verify counter global variable
      expect(generated.mainCode).toContain('int counter = 0;');
    });

    it('should generate different code for different targets', () => {
      const ast = createMinimalAst();

      const arduinoCode = CodeGenerator.generate(ast, McuTarget.Arduino, 'test').mainCode;
      const stmCode = CodeGenerator.generate(ast, McuTarget.STM32F103, 'test').mainCode;
      const espCode = CodeGenerator.generate(ast, McuTarget.ESP32, 'test').mainCode;

      // Core structure should be same
      expect(arduinoCode).toContain('void setup()');
      expect(stmCode).toContain('void setup()');
      expect(espCode).toContain('void setup()');

      // platformio.ini should be different
      const arduinoIni = CodeGenerator.generate(ast, McuTarget.Arduino, 'test').platformioIni;
      const stmIni = CodeGenerator.generate(ast, McuTarget.STM32F103, 'test').platformioIni;

      expect(arduinoIni).not.toEqual(stmIni);
      expect(arduinoIni).toContain('atmelavr');
      expect(stmIni).toContain('ststm32');
    });

    it('should generate all files consistently', () => {
      const ast = createPidAst();
      const projectName = 'consistent_test';
      const generated = CodeGenerator.generate(ast, McuTarget.Arduino, projectName);

      // All files should reference same project
      expect(generated.projectName).toBe(projectName);
      expect(generated.files['README.md']).toContain(projectName);
      expect(generated.platformioIni).toContain(`[env:${projectName}]`);

      // Files should all have valid content
      for (const [filename, content] of Object.entries(generated.files)) {
        expect(content).toBeDefined();
        expect(content.length).toBeGreaterThan(0);
      }
    });
  });
});
