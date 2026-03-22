/**
 * Peripheral View - GPIO/ADC/PWM State Visualization
 *
 * Displays real-time state of microcontroller peripherals:
 * - GPIO pin digital state (HIGH/LOW)
 * - ADC analog values (0-1023 or 0-4095)
 * - PWM output duty cycle (0-100%)
 * - Timer state and count
 * - UART serial data
 */

import React, { useState, useCallback } from 'react';
import styles from './PeripheralView.module.css';

// ========== Type Definitions ==========

export interface GpioPin {
  number: number;
  port: string;  // 'A', 'B', 'C', 'D', etc.
  state: boolean; // true = HIGH, false = LOW
  mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP';
}

export interface AdcChannel {
  number: number;
  value: number;    // 0-1023 (10-bit) or 0-4095 (12-bit)
  maxValue: number; // 1023 or 4095
  voltage?: number; // 0-5V or 0-3.3V
  reference: number; // 5.0 or 3.3 volts
}

export interface PwmPin {
  number: number;
  timer: number;
  channel: number;
  dutyCycle: number;  // 0-100
  frequency: number;  // Hz
  state: boolean;     // PWM active/inactive
}

export interface TimerState {
  number: number;
  count: number;
  prescaler: number;
  maxCount: number;
  running: boolean;
}

export interface UartData {
  port: number;
  baudRate: number;
  txBuffer: string[];
  rxBuffer: string[];
  totalTransmitted: number;
  totalReceived: number;
}

export interface PeripheralState {
  gpios: GpioPin[];
  adcs: AdcChannel[];
  pwms: PwmPin[];
  timers: TimerState[];
  uarts: UartData[];
}

interface PeripheralViewProps {
  peripheralState: PeripheralState;
  selectedGpio?: number;
  onGpioSelect?: (pinNumber: number) => void;
}

// ========== GPIO Pin Visualization Component ==========

const GpioVisualization: React.FC<{ pin: GpioPin; selected?: boolean }> = ({
  pin,
  selected,
}) => {
  const pinLabel = `${pin.port}${pin.number}`;
  const pinColor = pin.state ? '#4caf50' : '#999';
  const modeColor = {
    INPUT: '#2196f3',
    OUTPUT: '#ff9800',
    INPUT_PULLUP: '#673ab7',
  }[pin.mode];

  return (
    <div className={`${styles.gpioPin} ${selected ? styles.selected : ''}`}>
      <div className={styles.pinHeader}>
        <span className={styles.pinLabel}>{pinLabel}</span>
        <span className={styles.pinMode}>{pin.mode.replace('_', ' ')}</span>
      </div>

      <div className={styles.pinState}>
        <div
          className={styles.pinCircle}
          style={{ backgroundColor: pinColor }}
          title={pin.state ? 'HIGH (5V or 3.3V)' : 'LOW (0V)'}
        />
        <span className={styles.stateLabel}>{pin.state ? 'HIGH' : 'LOW'}</span>
      </div>

      <div className={styles.pinIndicator} style={{ backgroundColor: modeColor }} />
    </div>
  );
};

// ========== ADC Channel Visualization Component ==========

const AdcChannelVisualization: React.FC<{ channel: AdcChannel }> = ({ channel }) => {
  const percentage = (channel.value / channel.maxValue) * 100;
  const voltage =
    channel.voltage !== undefined
      ? channel.voltage.toFixed(2)
      : ((channel.value / channel.maxValue) * channel.reference).toFixed(2);

  return (
    <div className={styles.adcChannel}>
      <div className={styles.adcHeader}>
        <span className={styles.adcLabel}>ADC{channel.number}</span>
        <span className={styles.adcValue}>{channel.value.toString().padStart(4, ' ')}</span>
      </div>

      <div className={styles.adcBar}>
        <div
          className={styles.adcFill}
          style={{
            width: `${percentage}%`,
            backgroundColor: `hsl(${(percentage / 100) * 120}, 70%, 50%)`,
          }}
        />
      </div>

      <div className={styles.adcFooter}>
        <span className={styles.adcPercentage}>{percentage.toFixed(1)}%</span>
        <span className={styles.adcVoltage}>{voltage}V</span>
      </div>
    </div>
  );
};

// ========== PWM Output Visualization Component ==========

const PwmVisualization: React.FC<{ pwm: PwmPin }> = ({ pwm }) => {
  const wavelengthPx = 60;
  const frequency = pwm.frequency || 1000;
  const period = 1000000 / frequency; // microseconds

  return (
    <div className={styles.pwmContainer}>
      <div className={styles.pwmHeader}>
        <span className={styles.pwmLabel}>PWM {pwm.number} (T{pwm.timer})</span>
        <span className={styles.pwmFrequency}>{frequency.toLocaleString()} Hz</span>
      </div>

      <div className={styles.pwmWaveform}>
        {/* Visual PWM waveform representation */}
        <svg height="40" width="100%" className={styles.pwmSvg}>
          {/* High phase */}
          <rect
            x="0"
            y="10"
            width={`${pwm.dutyCycle}%`}
            height="20"
            fill="#4caf50"
            opacity="0.8"
          />
          {/* Low phase */}
          <rect
            x={`${pwm.dutyCycle}%`}
            y="10"
            width={`${100 - pwm.dutyCycle}%`}
            height="20"
            fill="#f44336"
            opacity="0.3"
          />
          {/* Divider line */}
          <line x1="0" y1="20" x2="100%" y2="20" stroke="#999" strokeWidth="1" />
        </svg>
      </div>

      <div className={styles.pwmFooter}>
        <span className={styles.pwmDuty}>{pwm.dutyCycle.toFixed(1)}% duty</span>
        <span className={styles.pwmStatus}>
          {pwm.state ? (
            <span className={styles.statusActive}>●</span>
          ) : (
            <span className={styles.statusInactive}>○</span>
          )}
          {pwm.state ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className={styles.pwmStats}>
        <small>Period: {period.toFixed(1)} µs</small>
      </div>
    </div>
  );
};

// ========== Timer State Component ==========

const TimerVisualization: React.FC<{ timer: TimerState }> = ({ timer }) => {
  const percentage = (timer.count / timer.maxCount) * 100;

  return (
    <div className={styles.timerContainer}>
      <div className={styles.timerHeader}>
        <span className={styles.timerLabel}>Timer {timer.number}</span>
        <span className={styles.timerCount}>
          {timer.count} / {timer.maxCount}
        </span>
      </div>

      <div className={styles.timerBar}>
        <div
          className={styles.timerFill}
          style={{
            width: `${percentage}%`,
            backgroundColor: timer.running ? '#2196f3' : '#ccc',
          }}
        />
      </div>

      <div className={styles.timerFooter}>
        <span className={styles.timerPercentage}>{percentage.toFixed(1)}%</span>
        <span className={styles.timerPrescaler}>PSC: {timer.prescaler}</span>
        <span className={styles.timerStatus}>
          {timer.running ? (
            <span className={styles.statusRunning}>▶</span>
          ) : (
            <span className={styles.statusStopped}>⏸</span>
          )}
        </span>
      </div>
    </div>
  );
};

// ========== UART Data Component ==========

const UartVisualization: React.FC<{ uart: UartData }> = ({ uart }) => {
  const recentTx = uart.txBuffer.slice(-10).join('');
  const recentRx = uart.rxBuffer.slice(-10).join('');

  return (
    <div className={styles.uartContainer}>
      <div className={styles.uartHeader}>
        <span className={styles.uartLabel}>UART {uart.port}</span>
        <span className={styles.uartBaud}>{uart.baudRate} bps</span>
      </div>

      <div className={styles.uartStreams}>
        <div className={styles.uartStream}>
          <div className={styles.streamLabel}>TX</div>
          <div className={styles.streamData}>
            {recentTx || <span className={styles.empty}>(no data)</span>}
          </div>
          <div className={styles.streamCount}>{uart.totalTransmitted} bytes</div>
        </div>

        <div className={styles.uartStream}>
          <div className={styles.streamLabel}>RX</div>
          <div className={styles.streamData}>
            {recentRx || <span className={styles.empty}>(no data)</span>}
          </div>
          <div className={styles.streamCount}>{uart.totalReceived} bytes</div>
        </div>
      </div>
    </div>
  );
};

// ========== Main Peripheral View Component ==========

export const PeripheralView: React.FC<PeripheralViewProps> = ({
  peripheralState,
  selectedGpio,
  onGpioSelect,
}) => {
  const [expandedSection, setExpandedSection] = useState<string>('gpio');

  const toggleSection = useCallback((section: string) => {
    setExpandedSection(expandedSection === section ? '' : section);
  }, [expandedSection]);

  const handleGpioClick = useCallback(
    (pinNumber: number) => {
      onGpioSelect?.(pinNumber);
    },
    [onGpioSelect]
  );

  return (
    <div className={styles.peripheralView}>
      {/* GPIO Section */}
      <div className={styles.section}>
        <div
          className={`${styles.sectionHeader} ${
            expandedSection === 'gpio' ? styles.expanded : ''
          }`}
          onClick={() => toggleSection('gpio')}
        >
          <span className={styles.sectionTitle}>
            {expandedSection === 'gpio' ? '▼' : '▶'} GPIO Pins
          </span>
          <span className={styles.sectionCount}>
            {peripheralState.gpios.length} pins
          </span>
        </div>

        {expandedSection === 'gpio' && (
          <div className={styles.sectionContent}>
            <div className={styles.gpioPinGrid}>
              {peripheralState.gpios.map((pin) => (
                <div
                  key={`${pin.port}${pin.number}`}
                  onClick={() => handleGpioClick(pin.number)}
                >
                  <GpioVisualization
                    pin={pin}
                    selected={selectedGpio === pin.number}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ADC Section */}
      {peripheralState.adcs.length > 0 && (
        <div className={styles.section}>
          <div
            className={`${styles.sectionHeader} ${
              expandedSection === 'adc' ? styles.expanded : ''
            }`}
            onClick={() => toggleSection('adc')}
          >
            <span className={styles.sectionTitle}>
              {expandedSection === 'adc' ? '▼' : '▶'} Analog Input (ADC)
            </span>
            <span className={styles.sectionCount}>
              {peripheralState.adcs.length} channels
            </span>
          </div>

          {expandedSection === 'adc' && (
            <div className={styles.sectionContent}>
              <div className={styles.adcChannelGrid}>
                {peripheralState.adcs.map((channel) => (
                  <AdcChannelVisualization key={channel.number} channel={channel} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PWM Section */}
      {peripheralState.pwms.length > 0 && (
        <div className={styles.section}>
          <div
            className={`${styles.sectionHeader} ${
              expandedSection === 'pwm' ? styles.expanded : ''
            }`}
            onClick={() => toggleSection('pwm')}
          >
            <span className={styles.sectionTitle}>
              {expandedSection === 'pwm' ? '▼' : '▶'} PWM Output
            </span>
            <span className={styles.sectionCount}>
              {peripheralState.pwms.length} pins
            </span>
          </div>

          {expandedSection === 'pwm' && (
            <div className={styles.sectionContent}>
              {peripheralState.pwms.map((pwm) => (
                <PwmVisualization key={pwm.number} pwm={pwm} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timer Section */}
      {peripheralState.timers.length > 0 && (
        <div className={styles.section}>
          <div
            className={`${styles.sectionHeader} ${
              expandedSection === 'timer' ? styles.expanded : ''
            }`}
            onClick={() => toggleSection('timer')}
          >
            <span className={styles.sectionTitle}>
              {expandedSection === 'timer' ? '▼' : '▶'} Timers
            </span>
            <span className={styles.sectionCount}>
              {peripheralState.timers.length} timers
            </span>
          </div>

          {expandedSection === 'timer' && (
            <div className={styles.sectionContent}>
              {peripheralState.timers.map((timer) => (
                <TimerVisualization key={timer.number} timer={timer} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* UART Section */}
      {peripheralState.uarts.length > 0 && (
        <div className={styles.section}>
          <div
            className={`${styles.sectionHeader} ${
              expandedSection === 'uart' ? styles.expanded : ''
            }`}
            onClick={() => toggleSection('uart')}
          >
            <span className={styles.sectionTitle}>
              {expandedSection === 'uart' ? '▼' : '▶'} Serial (UART)
            </span>
            <span className={styles.sectionCount}>
              {peripheralState.uarts.length} ports
            </span>
          </div>

          {expandedSection === 'uart' && (
            <div className={styles.sectionContent}>
              {peripheralState.uarts.map((uart) => (
                <UartVisualization key={uart.port} uart={uart} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {peripheralState.gpios.length === 0 &&
        peripheralState.adcs.length === 0 &&
        peripheralState.pwms.length === 0 &&
        peripheralState.timers.length === 0 &&
        peripheralState.uarts.length === 0 && (
          <div className={styles.emptyState}>
            <p>No peripheral state available</p>
            <small>Connect microcontroller simulator to view peripheral data</small>
          </div>
        )}
    </div>
  );
};

export default PeripheralView;
