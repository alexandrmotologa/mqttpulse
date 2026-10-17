import React from 'react';
import {
  Activity,
  Server,
  Zap,
  Radio,
  Cpu,
  Send,
  Trash2,
  ListTree,
  LineChart,
  MapPin,
  Terminal,
  Bell,
  Disc,
  Volume2,
  VolumeX
} from 'lucide-react';
import { ConnectionStatus, GlobalStats } from '../types';

export type MainViewType = 'radial' | 'indented' | 'simulator' | 'publisher' | 'plotter' | 'map' | 'rpc';

interface HeaderProps {
  status: ConnectionStatus;
  brokerUrl: string;
  stats: GlobalStats;
  embeddedRunning: boolean;
  activeView: MainViewType;
  setActiveView: (view: MainViewType) => void;
  onOpenConnectModal: () => void;
  onDisconnect: () => void;
  onToggleEmbedded: (action: 'start' | 'stop') => void;
  onClear: () => void;
  simulatorRunning: boolean;
  unreadAlertsCount?: number;
  onOpenRulesModal?: () => void;
  isRecording?: boolean;
  recordingCount?: number;
  onToggleRecording?: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
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
  simulatorRunning,
  unreadAlertsCount = 0,
  onOpenRulesModal,
  isRecording = false,
  recordingCount = 0,
  onToggleRecording,
  isMuted = false,
  onToggleMute
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
        <div className="flex items-center bg-[#111827] p-1 rounded-lg border border-slate-800 text-xs font-mono overflow-x-auto max-w-[620px] scrollbar-none">
          <button
            onClick={() => setActiveView('radial')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition whitespace-nowrap ${
              activeView === 'radial'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Radial Topic Tree (D3)"
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Radial</span>
          </button>

          <button
            onClick={() => setActiveView('indented')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition whitespace-nowrap ${
              activeView === 'indented'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Indented Topic List"
          >
            <ListTree className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">List</span>
          </button>

          <button
            onClick={() => setActiveView('plotter')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition whitespace-nowrap ${
              activeView === 'plotter'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Live Telemetry Plotter (Time-Series)"
          >
            <LineChart className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Plotter</span>
          </button>

          <button
            onClick={() => setActiveView('map')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition whitespace-nowrap ${
              activeView === 'map'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Fleet Geolocation Map"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Map</span>
          </button>

          <button
            onClick={() => setActiveView('rpc')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition whitespace-nowrap ${
              activeView === 'rpc'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="MQTT 5.0 RPC Console"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">RPC</span>
          </button>

          <button
            onClick={() => setActiveView('simulator')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition whitespace-nowrap ${
              activeView === 'simulator'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="IoT Fleet Chaos Simulator"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Simulator</span>
            {simulatorRunning && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />}
          </button>

          <button
            onClick={() => setActiveView('publisher')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition whitespace-nowrap ${
              activeView === 'publisher'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Publish Test Bench"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Publish</span>
          </button>
        </div>

        {/* Telemetry Session Recording (REC) Button */}
        {onToggleRecording && (
          <button
            onClick={onToggleRecording}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition ${
              isRecording
                ? 'bg-rose-950/80 text-rose-400 border-rose-800 shadow-sm shadow-rose-950'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title={isRecording ? `Recording active (${recordingCount} pkts). Click to stop & save session` : 'Start Telemetry Session Recording'}
          >
            <Disc className={`w-3.5 h-3.5 ${isRecording ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`} />
            <span className="hidden xl:inline">{isRecording ? `REC (${recordingCount})` : 'Record'}</span>
          </button>
        )}

        {/* Rules & Telemetry Alerts Button */}
        {onOpenRulesModal && (
          <button
            onClick={onOpenRulesModal}
            className="relative p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-xs font-mono transition"
            title="Rules & Telemetry Alerts Engine"
          >
            <Bell className="w-4 h-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center animate-bounce">
                {unreadAlertsCount > 99 ? '99+' : unreadAlertsCount}
              </span>
            )}
          </button>
        )}

        {/* Audio Micro-Interactions Toggle Button */}
        {onToggleMute && (
          <button
            onClick={onToggleMute}
            className={`p-1.5 rounded-lg border text-xs font-mono transition ${
              isMuted
                ? 'bg-slate-800/80 text-slate-500 border-slate-700'
                : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700'
            }`}
            title={isMuted ? 'Unmute Audio Micro-Interactions' : 'Mute Audio Micro-Interactions'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        )}

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
