import React, { useState } from 'react';
import { InboundMessage } from '../types';
import {
  X,
  Copy,
  Check,
  FileCode,
  Binary,
  Braces,
  Layers,
  Clock,
  Zap,
  GitCompare,
  AlertTriangle,
  Plus,
  RefreshCw,
  Minus
} from 'lucide-react';

interface PacketInspectorProps {
  message: InboundMessage | null;
  onClose: () => void;
}

export const PacketInspector: React.FC<PacketInspectorProps> = ({ message, onClose }) => {
  const [activeTab, setActiveTab] = useState<'decoded' | 'diff' | 'json' | 'hex' | 'raw'>('decoded');
  const [copied, setCopied] = useState(false);

  if (!message) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const userProperties = message.properties?.userProperties
    ? Object.entries(message.properties.userProperties)
    : [];

  const diff = message.diff;

  return (
    <div className="flex flex-col h-full bg-[#111827] border-l border-slate-800 text-slate-200 select-text">
      {/* Drawer Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-[#0f172a]">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate text-white">MQTT Packet Inspector</h3>
            <p className="text-[11px] font-mono text-emerald-400 truncate">{message.topic}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => handleCopy(message.decoded.formattedJson || message.decoded.rawString)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
            title="Copy payload"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Meta Badges */}
      <div className="p-4 border-b border-slate-800 bg-[#0b101b] grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
        <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase block">QoS Level</span>
          <span className="font-semibold text-sky-400">QoS {message.qos}</span>
        </div>
        <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase block">Retained</span>
          <span className={`font-semibold ${message.retain ? 'text-amber-400' : 'text-slate-400'}`}>
            {message.retain ? 'YES' : 'NO'}
          </span>
        </div>
        <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase block">Payload Format</span>
          <span className="font-semibold uppercase text-emerald-400">{message.decoded.format}</span>
        </div>
        <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase block">Payload Size</span>
          <span className="font-semibold text-slate-200">{message.decoded.byteLength} B</span>
        </div>
      </div>

      {/* Timing and Latency Bar */}
      <div className="px-4 py-2 border-b border-slate-800/80 bg-[#131c2e] flex items-center justify-between text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>
            {new Date(message.timestamp).toLocaleTimeString()}.{String(message.timestamp % 1000).padStart(3, '0')}
          </span>
        </div>
        {message.latencyMs !== undefined && (
          <div className="flex items-center gap-1 text-emerald-400 font-semibold">
            <Zap className="w-3.5 h-3.5" />
            <span>Delivery Latency: {message.latencyMs} ms</span>
          </div>
        )}
      </div>

      {/* Schema Drift Warning Alert Banner */}
      {message.drift && message.drift.isDrift && (
        <div className="m-3 p-3 bg-amber-950/70 border border-amber-700/80 rounded-lg text-amber-200 text-xs font-mono">
          <div className="flex items-center gap-2 font-bold text-amber-400 mb-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>Schema Drift Detected ({message.drift.anomalies.length} anomaly)</span>
          </div>
          <div className="space-y-1 text-[11px] text-amber-300/90">
            {message.drift.anomalies.map((a, i) => (
              <div key={i} className="bg-amber-900/40 p-1.5 rounded border border-amber-800/50">
                &bull; {a.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MQTT 5.0 Header Properties */}
      {message.properties && (
        <div className="p-4 border-b border-slate-800 bg-[#0e1524]">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> MQTT 5.0 User Properties & Header
          </h4>

          <div className="space-y-1.5 text-xs font-mono">
            {message.properties.contentType && (
              <div className="flex items-center justify-between py-1 px-2 bg-slate-900/60 rounded border border-slate-800">
                <span className="text-slate-400">Content-Type:</span>
                <span className="text-sky-300">{message.properties.contentType}</span>
              </div>
            )}
            {message.properties.responseTopic && (
              <div className="flex items-center justify-between py-1 px-2 bg-slate-900/60 rounded border border-slate-800">
                <span className="text-slate-400">Response Topic:</span>
                <span className="text-amber-300">{message.properties.responseTopic}</span>
              </div>
            )}
            {message.properties.correlationData && (
              <div className="flex items-center justify-between py-1 px-2 bg-slate-900/60 rounded border border-slate-800">
                <span className="text-slate-400">Correlation Data:</span>
                <span className="text-slate-300">{message.properties.correlationData}</span>
              </div>
            )}
            {userProperties.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">User Properties:</div>
                <div className="divide-y divide-slate-800/80 rounded border border-slate-800 bg-slate-900/80 overflow-hidden">
                  {userProperties.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between px-2.5 py-1 text-[11px]">
                      <span className="text-emerald-400">{k}</span>
                      <span className="text-slate-300">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payload Navigation Tabs */}
      <div className="flex items-center border-b border-slate-800 bg-[#0f172a] px-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('decoded')}
          className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'decoded'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Braces className="w-3.5 h-3.5" /> Decoded View
        </button>

        <button
          onClick={() => setActiveTab('diff')}
          className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'diff'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitCompare className="w-3.5 h-3.5" />
          <span>Payload Diff</span>
          {diff && diff.hasChanges && (
            <span className="text-[10px] px-1 py-0.2 bg-emerald-950 text-emerald-400 rounded border border-emerald-800 font-mono">
              ~{diff.summary.modified}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('json')}
          className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'json'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" /> Formatted JSON
        </button>

        <button
          onClick={() => setActiveTab('hex')}
          className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'hex'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Binary className="w-3.5 h-3.5" /> Hex / ASCII
        </button>

        <button
          onClick={() => setActiveTab('raw')}
          className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'raw'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Raw String
        </button>
      </div>

      {/* Payload Content Area */}
      <div className="flex-1 overflow-auto p-4 bg-[#090d16] font-mono text-xs">
        {activeTab === 'decoded' && (
          <div>
            {message.decoded.metadata && (
              <div className="mb-3 p-2 bg-slate-900 rounded border border-slate-800 text-[11px] text-slate-400">
                <span className="text-sky-400 font-semibold">Protobuf Schema: </span>
                {String(message.decoded.metadata.schema)} &rarr; {String(message.decoded.metadata.type)}
              </div>
            )}
            <pre className="text-emerald-300 leading-relaxed overflow-x-auto whitespace-pre-wrap">
              {message.decoded.formattedJson || message.decoded.rawString || '(No decoded representation)'}
            </pre>
          </div>
        )}

        {/* Real-time Payload Diff Tab */}
        {activeTab === 'diff' && (
          <div>
            {!diff ? (
              <div className="text-slate-500 text-center py-8">
                Initial message on this topic (no previous state available for delta comparison).
              </div>
            ) : !diff.hasChanges ? (
              <div className="p-3 bg-slate-900 rounded border border-slate-800 text-slate-400 text-center">
                Identical to previous message on this topic (0 modifications).
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 pb-2 border-b border-slate-800 text-xs">
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <Plus className="w-3.5 h-3.5" /> {diff.summary.added} Added
                  </span>
                  <span className="flex items-center gap-1 text-amber-400 font-bold">
                    <RefreshCw className="w-3.5 h-3.5" /> {diff.summary.modified} Modified
                  </span>
                  <span className="flex items-center gap-1 text-rose-400 font-bold">
                    <Minus className="w-3.5 h-3.5" /> {diff.summary.deleted} Deleted
                  </span>
                </div>

                <div className="space-y-1.5">
                  {diff.entries.map((e, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded border text-xs leading-relaxed ${
                        e.type === 'modified'
                          ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                          : e.type === 'added'
                          ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                          : 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                      }`}
                    >
                      <div className="font-bold text-white mb-0.5">{e.path}:</div>
                      {e.type === 'modified' && (
                        <div className="flex items-center gap-2 flex-wrap text-[11px]">
                          <span className="line-through text-slate-400">{JSON.stringify(e.oldValue)}</span>
                          <span className="text-amber-400 font-bold">&rarr;</span>
                          <span className="text-emerald-300 font-semibold">{JSON.stringify(e.newValue)}</span>
                        </div>
                      )}
                      {e.type === 'added' && (
                        <div className="text-[11px] text-emerald-300">+ {JSON.stringify(e.newValue)}</div>
                      )}
                      {e.type === 'deleted' && (
                        <div className="text-[11px] text-rose-300">- {JSON.stringify(e.oldValue)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'json' && (
          <pre className="text-sky-300 leading-relaxed overflow-x-auto whitespace-pre-wrap">
            {message.decoded.formattedJson || JSON.stringify(message.decoded.parsed, null, 2)}
          </pre>
        )}

        {activeTab === 'hex' && (
          <div className="divide-y divide-slate-800/40 text-[11px] leading-snug">
            <div className="flex text-slate-500 font-bold pb-1 mb-1 border-b border-slate-800">
              <span className="w-20">Offset</span>
              <span className="flex-1">Hexadecimal Bytes</span>
              <span className="w-36 text-right">ASCII</span>
            </div>
            {message.decoded.hexDump.lines.map((l, idx) => (
              <div key={idx} className="flex py-0.5 hover:bg-slate-900/60">
                <span className="w-20 text-slate-500">{l.offset}</span>
                <span className="flex-1 text-slate-300 tracking-wider">{l.hex}</span>
                <span className="w-36 text-right text-emerald-400 font-medium">{l.ascii}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'raw' && (
          <div className="space-y-3">
            <div>
              <div className="text-slate-500 text-[10px] uppercase mb-1">UTF-8 String:</div>
              <pre className="bg-slate-900/80 p-2 rounded border border-slate-800 text-slate-200 whitespace-pre-wrap break-all">
                {message.decoded.rawString || '(Binary payload)'}
              </pre>
            </div>
            <div>
              <div className="text-slate-500 text-[10px] uppercase mb-1">Raw Hex:</div>
              <pre className="bg-slate-900/80 p-2 rounded border border-slate-800 text-slate-400 whitespace-pre-wrap break-all">
                {message.decoded.hexDump.rawHex}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
