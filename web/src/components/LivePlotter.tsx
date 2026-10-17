import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, LineChart } from 'lucide-react';
import { TimeSeriesPoint } from '../types';

interface LivePlotterProps {
  initialTopic?: string | null;
}

export const LivePlotter: React.FC<LivePlotterProps> = ({ initialTopic }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [availableTopics, setAvailableTopics] = useState<Record<string, string[]>>({});
  const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic || '');
  const [selectedField, setSelectedField] = useState<string>('');
  const [history, setHistory] = useState<TimeSeriesPoint[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  // Poll available topics and current time-series data
  useEffect(() => {
    fetch('/api/timeseries')
      .then((r) => r.json())
      .then((d) => {
        if (d.available) {
          setAvailableTopics(d.available);
          const topics = Object.keys(d.available);
          if (topics.length > 0 && !selectedTopic) {
            setSelectedTopic(topics[0]);
            if (d.available[topics[0]].length > 0) {
              setSelectedField(d.available[topics[0]][0]);
            }
          }
        }
      })
      .catch(() => {});
  }, [selectedTopic]);

  // When selected topic changes, set default field
  useEffect(() => {
    if (selectedTopic && availableTopics[selectedTopic] && availableTopics[selectedTopic].length > 0) {
      if (!availableTopics[selectedTopic].includes(selectedField)) {
        setSelectedField(availableTopics[selectedTopic][0]);
      }
    }
  }, [selectedTopic, availableTopics, selectedField]);

  // High frequency polling for active series
  useEffect(() => {
    if (!selectedTopic || isPaused) return;

    const interval = setInterval(() => {
      fetch(`/api/timeseries?topic=${encodeURIComponent(selectedTopic)}`)
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.points)) {
            setHistory(d.points);
          }
        })
        .catch(() => {});
    }, 500);

    return () => clearInterval(interval);
  }, [selectedTopic, isPaused]);

  // Draw chart onto Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Extract values for the selected field
    const values = history
      .map((p) => p.values[selectedField])
      .filter((v) => typeof v === 'number' && !isNaN(v));

    if (values.length < 2) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting live telemetry samples on this topic...', width / 2, height / 2);
      return;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min === 0 ? 1 : max - min;
    const padding = 40;

    // Background grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
      const y = padding + ((height - padding * 2) / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      const labelVal = (max - (range / 4) * i).toFixed(1);
      ctx.fillStyle = '#64748b';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(labelVal, padding - 8, y + 3);
    }

    // Draw continuous curve
    const stepX = (width - padding * 2) / (values.length - 1);
    ctx.beginPath();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;

    for (let i = 0; i < values.length; i++) {
      const x = padding + i * stepX;
      const normalized = (values[i] - min) / range;
      const y = height - padding - normalized * (height - padding * 2);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Area fill gradient under curve
    const grad = ctx.createLinearGradient(0, padding, 0, height - padding);
    grad.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
    grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    ctx.lineTo(padding + (values.length - 1) * stepX, height - padding);
    ctx.lineTo(padding, height - padding);
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw latest point dot
    const latestVal = values[values.length - 1];
    const latestX = padding + (values.length - 1) * stepX;
    const latestNorm = (latestVal - min) / range;
    const latestY = height - padding - latestNorm * (height - padding * 2);

    ctx.beginPath();
    ctx.arc(latestX, latestY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#34d399';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [history, selectedField]);

  const activeValues = history
    .map((p) => p.values[selectedField])
    .filter((v) => typeof v === 'number' && !isNaN(v));

  const minVal = activeValues.length > 0 ? Math.min(...activeValues).toFixed(2) : '--';
  const maxVal = activeValues.length > 0 ? Math.max(...activeValues).toFixed(2) : '--';
  const avgVal =
    activeValues.length > 0
      ? (activeValues.reduce((a, b) => a + b, 0) / activeValues.length).toFixed(2)
      : '--';
  const latestVal = activeValues.length > 0 ? activeValues[activeValues.length - 1].toFixed(2) : '--';

  return (
    <div className="flex flex-col h-full bg-[#0d131f] rounded-xl border border-slate-800 p-5 space-y-4 font-mono text-xs">
      {/* Plotter Header & Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-950/80 text-emerald-400 border border-emerald-800 rounded-lg">
            <LineChart className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white flex items-center gap-2">Live Telemetry Plotter</h3>
            <p className="text-slate-400 text-[11px]">Real-time high-frequency time-series trend analysis</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition ${
              isPaused
                ? 'bg-amber-950/80 text-amber-400 border-amber-800'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
          <button
            onClick={() => setHistory([])}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-md border border-slate-700 transition"
            title="Clear buffer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#111827] p-3 rounded-lg border border-slate-800">
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Select Topic:</label>
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="w-full bg-[#090d16] border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 font-semibold text-emerald-400"
          >
            {Object.keys(availableTopics).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Telemetry Metric Key:</label>
          <select
            value={selectedField}
            onChange={(e) => setSelectedField(e.target.value)}
            disabled={!selectedTopic || !availableTopics[selectedTopic]}
            className="w-full bg-[#090d16] border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 font-semibold text-sky-400"
          >
            {(availableTopics[selectedTopic] || []).map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="bg-[#111827] p-2.5 rounded-lg border border-slate-800 text-center">
          <span className="text-[10px] text-slate-500 uppercase block">Current</span>
          <span className="text-base font-bold text-emerald-400 font-sans">{latestVal}</span>
        </div>
        <div className="bg-[#111827] p-2.5 rounded-lg border border-slate-800 text-center">
          <span className="text-[10px] text-slate-500 uppercase block">Min</span>
          <span className="text-base font-bold text-sky-400 font-sans">{minVal}</span>
        </div>
        <div className="bg-[#111827] p-2.5 rounded-lg border border-slate-800 text-center">
          <span className="text-[10px] text-slate-500 uppercase block">Max</span>
          <span className="text-base font-bold text-rose-400 font-sans">{maxVal}</span>
        </div>
        <div className="bg-[#111827] p-2.5 rounded-lg border border-slate-800 text-center">
          <span className="text-[10px] text-slate-500 uppercase block">Average</span>
          <span className="text-base font-bold text-amber-400 font-sans">{avgVal}</span>
        </div>
      </div>

      {/* Canvas Chart Area */}
      <div className="flex-1 min-h-[260px] bg-[#090d16] rounded-lg border border-slate-800 relative overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} width={750} height={320} className="w-full h-full" />
      </div>
    </div>
  );
};
