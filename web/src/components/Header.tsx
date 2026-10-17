import React from 'react';
import {
  Activity,
  Server,
  Zap,
  Radio,
  Cpu,
  Send,
  Trash2,
  ListTree
} from 'lucide-react';
import { ConnectionStatus, GlobalStats } from '../types';

interface HeaderProps {
  status: ConnectionStatus;
  brokerUrl: string;
  stats: GlobalStats;
  embeddedRunning: boolean;
  activeView: 'radial' | 'indented' | 'simulator' | 'publisher';
  setActiveView: (view: 'radial' | 'indented' | 'simulator' | 'publisher') => void;
  onOpenConnectModal: () => void;
  onDisconnect: () => void;
  onToggleEmbedded: (action: 'start' | 'stop') => void;
  onClear: () => void;
  simulatorRunning: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  brokerUrl,
  stats,
  embeddedRunning,
  activeView,
  setActiveView,
  onOpenConnectModal,
  onDisconnect,
  onToggleEmbedded,
  onClear,
  simulatorRunning
}) => {
  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 text-[11px] font-mono shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold">CONNECTED</span>
            <span className="text-emerald-500/80 max-w-[150px] truncate">({brokerUrl || 'broker'})</span>
          </div>
        );
      case 'connecting':
      case 'reconnecting':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/80 text-[11px] font-mono">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="font-semibold uppercase">{status}</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-mono">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="font-semibold">DISCONNECTED</span>
          </div>
        );
    }
  };

  return (
    <header className="bg-[#0b101b] border-b border-slate-800 px-5 py-3 flex flex-wrap items-center justify-between gap-4 select-none">
      {/* Brand & Connection State */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-950/50">
            <Activity className="w-5 h-5 text-emerald-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-tight text-white font-mono">MQTTPulse</h1>
              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-950 text-emerald-400 rounded border border-emerald-800 font-mono font-semibold">
                MQTT 5.0
              </span>
            </div>
          </div>
        </div>

        <div className="hidden sm:block">{getStatusBadge()}</div>
      </div>

      {/* Real-time Global Throughput Metrics */}
      <div className="hidden lg:flex items-center gap-4 text-xs font-mono bg-[#111827] px-4 py-1.5 rounded-lg border border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Topics:</span>
          <span className="font-bold text-white">{stats.totalTopics}</span>
        </div>
        <div className="w-px h-3 bg-slate-800" />
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Messages:</span>
          <span className="font-bold text-white">{stats.totalMessages.toLocaleString()}</span>
        </div>
        <div className="w-px h-3 bg-slate-800" />
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Rate:</span>
          <span className="font-bold text-emerald-400 flex items-center gap-1">
            <Zap className="w-3 h-3 animate-pulse" /> {stats.messagesPerSec} msg/s
          </span>
        </div>
        <div className="w-px h-3 bg-slate-800" />
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Throughput:</span>
          <span className="font-bold text-sky-400">{(stats.bytesPerSec / 1024).toFixed(1)} KB/s</span>
        </div>
      </div>

      {/* Main View Switcher & Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Navigation Tabs */}
        <div className="flex items-center bg-[#111827] p-1 rounded-lg border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setActiveView('radial')}
            className={`flex items-center gap-1 px-3 py-1 rounded transition ${
              activeView === 'radial'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Radial Tree</span>
          </button>

          <button
            onClick={() => setActiveView('indented')}
            className={`flex items-center gap-1 px-3 py-1 rounded transition ${
              activeView === 'indented'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListTree className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Topic List</span>
          </button>

          <button
            onClick={() => setActiveView('simulator')}
            className={`flex items-center gap-1 px-3 py-1 rounded transition ${
              activeView === 'simulator'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="hidden md:inline">IoT Simulator</span>
            {simulatorRunning && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />}
          </button>

          <button
            onClick={() => setActiveView('publisher')}
            className={`flex items-center gap-1 px-3 py-1 rounded transition ${
              activeView === 'publisher'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Publisher</span>
          </button>
        </div>

        {/* Embedded Broker Button */}
        <button
          onClick={() => onToggleEmbedded(embeddedRunning ? 'stop' : 'start')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition ${
            embeddedRunning
              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
          }`}
          title={embeddedRunning ? 'Embedded Broker Active (18883)' : 'Launch In-Memory Embedded Broker'}
        >
          <Server className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">{embeddedRunning ? 'Broker: ON' : 'Embedded Broker'}</span>
        </button>

        {/* Connect / Disconnect */}
        {status === 'connected' ? (
          <button
            onClick={onDisconnect}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs font-mono transition"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={onOpenConnectModal}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-mono font-semibold text-xs transition shadow-md shadow-emerald-950"
          >
            <Server className="w-3.5 h-3.5" />
            <span>Connect Broker</span>
          </button>
        )}

        {/* Clear Data */}
        <button
          onClick={onClear}
          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg border border-transparent hover:border-slate-700 transition"
          title="Clear topic tree & message buffer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
