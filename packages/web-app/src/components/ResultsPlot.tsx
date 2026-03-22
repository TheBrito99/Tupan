/**
 * Results Visualization Component
 *
 * Generic plotting component for simulator results using Plotly.js
 */

import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';

export interface PlotData {
  type: 'line' | 'scatter' | 'bar' | 'heatmap';
  title: string;
  xaxis: string;
  yaxis: string;
  data: Array<{
    x: number[] | string[];
    y: number[];
    name?: string;
    mode?: string;
  }>;
  layout?: Record<string, any>;
}

interface ResultsPlotProps {
  data: PlotData | null;
  loading?: boolean;
  error?: string | null;
}

export const ResultsPlot: React.FC<ResultsPlotProps> = ({ data, loading = false, error = null }) => {
  const plotData = useMemo(() => {
    if (!data) return [];

    return data.data.map(series => ({
      x: series.x,
      y: series.y,
      name: series.name || 'Series',
      mode: series.mode || (data.type === 'line' ? 'lines' : 'markers'),
      type: data.type as any,
      line: data.type === 'line' ? { shape: 'linear', width: 2 } : undefined,
    }));
  }, [data]);

  const layout = useMemo(() => {
    if (!data) return {};

    return {
      title: { text: data.title, x: 0.5, xanchor: 'center' },
      xaxis: { title: data.xaxis },
      yaxis: { title: data.yaxis },
      hovermode: 'closest',
      margin: { l: 60, r: 40, t: 40, b: 40 },
      font: { family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
      plot_bgcolor: 'transparent',
      paper_bgcolor: 'transparent',
      ...data.layout,
    };
  }, [data]);

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
        <p>📊 Simulating...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#f44336' }}>
        <p>❌ Error: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
        <p>📊 Results will appear here</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Plot
        data={plotData}
        layout={layout}
        config={{
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
        }}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

/**
 * Helper function to generate time-series plot data
 */
export function createTimeSeriesPlot(
  title: string,
  timeArray: number[],
  series: Record<string, number[]>
): PlotData {
  return {
    type: 'line',
    title,
    xaxis: 'Time (s)',
    yaxis: 'Value',
    data: Object.entries(series).map(([name, values]) => ({
      x: timeArray,
      y: values,
      name,
      mode: 'lines',
    })),
  };
}

/**
 * Helper function to generate phase portrait plot (2D system state)
 */
export function createPhasePortraitPlot(
  title: string,
  x: number[],
  y: number[],
  xLabel: string = 'X',
  yLabel: string = 'Y'
): PlotData {
  return {
    type: 'scatter',
    title,
    xaxis: xLabel,
    yaxis: yLabel,
    data: [
      {
        x,
        y,
        name: 'Trajectory',
        mode: 'lines+markers',
      },
    ],
  };
}

/**
 * Helper function to generate frequency response plot (Bode-like)
 */
export function createFrequencyResponsePlot(
  title: string,
  frequency: number[],
  magnitude: number[],
  phase?: number[]
): PlotData {
  const data: PlotData['data'] = [
    {
      x: frequency,
      y: magnitude,
      name: 'Magnitude (dB)',
      mode: 'lines',
    },
  ];

  if (phase) {
    data.push({
      x: frequency,
      y: phase,
      name: 'Phase (°)',
      mode: 'lines',
    });
  }

  return {
    type: 'line',
    title,
    xaxis: 'Frequency (Hz)',
    yaxis: 'Magnitude / Phase',
    data,
  };
}
