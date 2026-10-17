import React, { useState } from 'react';
import { FleetStats, FleetConfig } from '../types';
import { Play, Square, RotateCcw, Cpu, WifiOff, AlertTriangle, ShieldAlert, Zap, Radio } from 'lucide-react';

interface FleetControlsProps {
  stats: FleetStats | null;
  config: FleetConfig | null;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onUpdateConfig: (newConfig: Partial<FleetConfig>) => void;
}

export const FleetControls: React.FC<FleetControlsProps> = ({
  stats,
  config,
  onStart,
  onStop,
  onReset,
  onUpdateConfig
}) => {
  const isRunning = stats?.running ?? false;

  // Local state for smooth slider adjustments
  const [fleetSize, setFleetSize] = useState<number>(config?.fleetSize ?? 50);
  const [intervalMs, setIntervalMs] = useState<number>(config?.intervalMs ?? 1000);
  const [jitterMaxMs, setJitterMaxMs] = useState<number>(config?.chaos.jitterMaxMs ?? 0);
  const [dropRatePct, setDropRatePct] = useState<number>(config?.chaos.dropRatePct ?? 0);
  const [disconnectRatePct, setDisconnectRatePct] = useState<number>(config?.chaos.disconnectRatePct ?? 0);
  const [corruptRatePct, setCorruptRatePct] = useState<number>(config?.chaos.corruptRatePct ?? 0);

  const handleApplyConfig = (overrides: Partial<FleetConfig> = {}) => {
    onUpdateConfig({
      fleetSize,
      intervalMs,
      chaos: {
        jitterMinMs: jitterMaxMs > 0 ? Math.floor(jitterMaxMs / 3) : 0,
        jitterMaxMs,
        dropRatePct,
        disconnectRatePct,
        corruptRatePct
      },
      ...overrides
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0d131f] rounded-xl border border-slate-800 p-5 space-y-6 overflow-y-auto font-mono text-xs">
      {/* Simulator Header & Status */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg border ${isRunning ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
            <Radio className={`w-5 h-5 ${isRunning ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white">IoT Device Fleet Simulator</h3>
            <p className="text-slate-400 text-[11px]">Synthetic telemetry generation with physics modeling & chaos injection</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-md font-semibold transition shadow-lg shadow-rose-900/30"
            >
              <Square className="w-3.5 h-3.5" /> Stop Fleet
            </button>
          ) : (
            <button
              onClick={() => {
                handleApplyConfig();
                onStart();
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-semibold transition shadow-lg shadow-emerald-900/30"
            >
              <Play className="w-3.5 h-3.5" /> Start Fleet
            </button>
          )}

          <button
            onClick={onReset}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700 transition"
            title="Reset telemetry counters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Live Telemetry Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#111827] p-3 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Active Nodes</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-white font-sans">{stats?.fleetSize ?? fleetSize}</span>
            <span className="text-[11px] text-emerald-400">virtual devices</span>
          </div>
        </div>

        <div className="bg-[#111827] p-3 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Publish Throughput</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-emerald-400 font-sans">{stats?.messagesPerSec ?? 0}</span>
            <span className="text-[11px] text-slate-400">msg/sec</span>
          </div>
        </div>

        <div className="bg-[#111827] p-3 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Published Count</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-sky-400 font-sans">{(stats?.totalPublished ?? 0).toLocaleString()}</span>
            <span className="text-[11px] text-slate-400">msgs</span>
          </div>
        </div>

        <div className="bg-[#111827] p-3 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Injected Faults</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-amber-400 font-sans">
              {((stats?.totalDropped ?? 0) + (stats?.totalDisconnects ?? 0) + (stats?.totalCorrupted ?? 0)).toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400">drops/drops</span>
          </div>
        </div>
      </div>

      {/* Fleet Configuration Settings */}
      <div className="bg-[#111827] p-4 rounded-lg border border-slate-800 space-y-4">
        <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-400" /> Fleet Device Setup
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Fleet Size Slider */}
          <div>
            <div className="flex justify-between items-center mb-1 text-slate-300">
              <span>Fleet Size:</span>
              <span className="font-bold text-emerald-400">{fleetSize} virtual devices</span>
            </div>
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={fleetSize}
              onChange={(e) => {
                const val = Number(e.target.value);
                setFleetSize(val);
                handleApplyConfig({ fleetSize: val });
              }}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
              <span>10</span>
              <span>250</span>
              <span>500</span>
              <span>1,000 nodes</span>
            </div>
          </div>

          {/* Publication Frequency Slider */}
          <div>
            <div className="flex justify-between items-center mb-1 text-slate-300">
              <span>Publish Interval:</span>
              <span className="font-bold text-sky-400">{intervalMs} ms</span>
            </div>
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={intervalMs}
              onChange={(e) => {
                const val = Number(e.target.value);
                setIntervalMs(val);
                handleApplyConfig({ intervalMs: val });
              }}
              className="w-full accent-sky-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
              <span>100ms (burst)</span>
              <span>1,000ms (1 Hz)</span>
              <span>5,000ms</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {/* Profile Selector */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Sensor Telemetry Profile:</label>
            <select
              value={config?.profile ?? 'mixed'}
              onChange={(e) => onUpdateConfig({ profile: e.target.value as any })}
              className="w-full bg-[#090d16] border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="mixed">Mixed Fleet (All 5 Sensor Types)</option>
              <option value="fleet_vehicle">Connected Vehicle (GPS, OBD-II)</option>
              <option value="hvac_industrial">Industrial HVAC (Temp, Flow, Delta-P)</option>
              <option value="smart_meter">Smart Energy Meter (Power, Grid Hz)</option>
              <option value="weather_station">Weather Station (Barometer, Wind)</option>
              <option value="robotics_actuator">Robotic Arm Joint (6-Axis, Torque)</option>
            </select>
          </div>

          {/* Telemetry Format */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Serialization Format:</label>
            <select
              value={config?.format ?? 'json'}
              onChange={(e) => onUpdateConfig({ format: e.target.value as any })}
              className="w-full bg-[#090d16] border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="json">JSON (UTF-8)</option>
              <option value="protobuf">Protocol Buffers (.proto)</option>
              <option value="cbor">CBOR (Binary Object)</option>
              <option value="msgpack">MessagePack (Binary)</option>
            </select>
          </div>

          {/* QoS Level */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">MQTT Delivery QoS:</label>
            <select
              value={config?.qos ?? 0}
              onChange={(e) => onUpdateConfig({ qos: Number(e.target.value) as any })}
              className="w-full bg-[#090d16] border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="0">QoS 0 (At most once)</option>
              <option value="1">QoS 1 (At least once / PUBACK)</option>
              <option value="2">QoS 2 (Exactly once / 4-way)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Network Chaos Engineering Panel */}
      <div className="bg-[#111827] p-4 rounded-lg border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Network Chaos Injection
          </h4>
          <span className="text-[10px] text-slate-500">Injects artificial packet lag, loss, and disconnects</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Jitter Delay Slider */}
          <div>
            <div className="flex justify-between items-center mb-1 text-slate-300">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Latency Jitter:
              </span>
              <span className="font-bold text-amber-400">{jitterMaxMs} ms</span>
            </div>
            <input
              type="range"
              min="0"
              max="2000"
              step="50"
              value={jitterMaxMs}
              onChange={(e) => {
                const val = Number(e.target.value);
                setJitterMaxMs(val);
                handleApplyConfig({
                  chaos: {
                    ...config?.chaos,
                    jitterMinMs: val > 0 ? Math.floor(val / 3) : 0,
                    jitterMaxMs: val,
                    dropRatePct,
                    disconnectRatePct,
                    corruptRatePct
                  } as any
                });
              }}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
              <span>0ms (none)</span>
              <span>500ms</span>
              <span>2,000ms (high lag)</span>
            </div>
          </div>

          {/* Packet Drop Rate Slider */}
          <div>
            <div className="flex justify-between items-center mb-1 text-slate-300">
              <span className="flex items-center gap-1.5">
                <WifiOff className="w-3.5 h-3.5 text-rose-400" /> Packet Drop Rate:
              </span>
              <span className="font-bold text-rose-400">{dropRatePct}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={dropRatePct}
              onChange={(e) => {
                const val = Number(e.target.value);
                setDropRatePct(val);
                handleApplyConfig({
                  chaos: {
                    ...config?.chaos,
                    jitterMinMs: jitterMaxMs > 0 ? Math.floor(jitterMaxMs / 3) : 0,
                    jitterMaxMs,
                    dropRatePct: val,
                    disconnectRatePct,
                    corruptRatePct
                  } as any
                });
              }}
              className="w-full accent-rose-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
              <span>0%</span>
              <span>15%</span>
              <span>50% (severe loss)</span>
            </div>
          </div>

          {/* Disconnect Frequency Slider */}
          <div>
            <div className="flex justify-between items-center mb-1 text-slate-300">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-purple-400" /> Random Disconnect Rate:
              </span>
              <span className="font-bold text-purple-400">{disconnectRatePct}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={disconnectRatePct}
              onChange={(e) => {
                const val = Number(e.target.value);
                setDisconnectRatePct(val);
                handleApplyConfig({
                  chaos: {
                    ...config?.chaos,
                    jitterMinMs: jitterMaxMs > 0 ? Math.floor(jitterMaxMs / 3) : 0,
                    jitterMaxMs,
                    dropRatePct,
                    disconnectRatePct: val,
                    corruptRatePct
                  } as any
                });
              }}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
              <span>0%</span>
              <span>5%</span>
              <span>20% (unstable)</span>
            </div>
          </div>

          {/* Payload Bit Corruption Slider */}
          <div>
            <div className="flex justify-between items-center mb-1 text-slate-300">
              <span>Bit Corruption Rate:</span>
              <span className="font-bold text-red-400">{corruptRatePct}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={corruptRatePct}
              onChange={(e) => {
                const val = Number(e.target.value);
                setCorruptRatePct(val);
                handleApplyConfig({
                  chaos: {
                    ...config?.chaos,
                    jitterMinMs: jitterMaxMs > 0 ? Math.floor(jitterMaxMs / 3) : 0,
                    jitterMaxMs,
                    dropRatePct,
                    disconnectRatePct,
                    corruptRatePct: val
                  } as any
                });
              }}
              className="w-full accent-red-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
              <span>0% (clean)</span>
              <span>5%</span>
              <span>10% (corrupted)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
