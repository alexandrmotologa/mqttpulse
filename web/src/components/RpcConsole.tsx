import React, { useState } from 'react';
import { Send, Terminal, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { RpcTransaction } from '../types';

interface RpcConsoleProps {
  onSendRpc: (params: {
    requestTopic: string;
    payload: unknown;
    responseTopic?: string;
    timeoutMs?: number;
  }) => Promise<any>;
  history: RpcTransaction[];
}

export const RpcConsole: React.FC<RpcConsoleProps> = ({ onSendRpc, history }) => {
  const [requestTopic, setRequestTopic] = useState('devices/node_0001/command');
  const [responseTopic, setResponseTopic] = useState('rpc/responses');
  const [commandPayload, setCommandPayload] = useState(
    JSON.stringify({ action: 'REBOOT_DEVICE', force: true, timestamp: Date.now() }, null, 2)
  );
  const [timeoutMs, setTimeoutMs] = useState(6000);
  const [executing, setExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const presets = [
    {
      label: 'Reboot Device',
      topic: 'devices/node_0001/command',
      payload: { action: 'REBOOT_DEVICE', force: true, timestamp: Date.now() }
    },
    {
      label: 'Zero Calibration',
      topic: 'factory/robots/node_0020/calibrate',
      payload: { action: 'ZERO_AXIS_CALIBRATION', axes: ['j1', 'j2', 'j3'] }
    },
    {
      label: 'Diagnostics Query',
      topic: 'fleet/node_0005/diag',
      payload: { action: 'GET_HEALTH_REPORT', includeCanBus: true }
    }
  ];

  const handleExecute = async () => {
    setExecuting(true);
    setLastResult(null);

    let parsed: any;
    try {
      parsed = JSON.parse(commandPayload);
    } catch {
      parsed = commandPayload;
    }

    try {
      const res = await onSendRpc({
        requestTopic: requestTopic.trim(),
        responseTopic: responseTopic.trim() || undefined,
        payload: parsed,
        timeoutMs
      });
      setLastResult(res);
    } catch (err: unknown) {
      setLastResult({ success: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d131f] rounded-xl border border-slate-800 p-5 space-y-4 font-mono text-xs overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-950/80 text-emerald-400 border border-emerald-800 rounded-lg">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white flex items-center gap-2">
              Bidirectional MQTT 5.0 RPC Console
            </h3>
            <p className="text-slate-400 text-[11px]">
              Request-Response execution paired by ResponseTopic and CorrelationData
            </p>
          </div>
        </div>
      </div>

      {/* Preset Quick Actions */}
      <div>
        <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Command Templates:</label>
        <div className="flex gap-2 flex-wrap">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setRequestTopic(p.topic);
                setCommandPayload(JSON.stringify(p.payload, null, 2));
              }}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded text-xs transition"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Command Setup */}
      <div className="bg-[#111827] p-4 rounded-lg border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Target Command Topic:</label>
            <input
              type="text"
              value={requestTopic}
              onChange={(e) => setRequestTopic(e.target.value)}
              className="w-full bg-[#090d16] border border-slate-700 rounded px-2.5 py-1.5 text-emerald-400 font-semibold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Response Topic:</label>
            <input
              type="text"
              value={responseTopic}
              onChange={(e) => setResponseTopic(e.target.value)}
              className="w-full bg-[#090d16] border border-slate-700 rounded px-2.5 py-1.5 text-sky-400 font-semibold focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 mb-1">RPC Request Payload (JSON):</label>
          <textarea
            rows={4}
            value={commandPayload}
            onChange={(e) => setCommandPayload(e.target.value)}
            className="w-full bg-[#090d16] border border-slate-700 rounded p-2 text-slate-200 focus:outline-none focus:border-emerald-500 leading-relaxed font-mono"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <span>Timeout:</span>
            <input
              type="number"
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value))}
              className="w-20 bg-[#090d16] border border-slate-700 rounded px-2 py-1 text-white text-xs"
            />
            <span>ms</span>
          </div>

          <button
            onClick={handleExecute}
            disabled={executing || !requestTopic}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-semibold transition shadow-lg shadow-emerald-900/30"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{executing ? 'Awaiting Device Response...' : 'Execute RPC Command'}</span>
          </button>
        </div>
      </div>

      {/* Last Result Banner */}
      {lastResult && (
        <div
          className={`p-3 rounded-lg border text-xs ${
            lastResult.success
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/60 border-rose-800 text-rose-200'
          }`}
        >
          <div className="flex items-center justify-between font-bold mb-1">
            <span className="flex items-center gap-1.5">
              {lastResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
              {lastResult.success ? 'Command Executed & Acknowledged' : 'RPC Failed'}
            </span>
            {lastResult.latencyMs !== undefined && (
              <span className="text-sky-300">Round-trip: {lastResult.latencyMs} ms</span>
            )}
          </div>
          {lastResult.error && <div>{lastResult.error}</div>}
          {lastResult.payload && (
            <pre className="mt-1 bg-slate-900/80 p-2 rounded text-[11px] text-emerald-300 overflow-x-auto">
              {typeof lastResult.payload === 'object'
                ? JSON.stringify(lastResult.payload, null, 2)
                : String(lastResult.payload)}
            </pre>
          )}
        </div>
      )}

      {/* Historical RPC Transactions */}
      <div className="bg-[#111827] p-4 rounded-lg border border-slate-800 space-y-2">
        <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" /> Recent RPC Transactions
        </h4>

        {history.length === 0 ? (
          <div className="text-slate-500 text-center py-4">No RPC transactions executed in this session.</div>
        ) : (
          <div className="divide-y divide-slate-800 text-xs">
            {history.slice(0, 5).map((tx) => (
              <div key={tx.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-emerald-400">{tx.requestTopic}</div>
                  <div className="text-[10px] text-slate-500">Correlation: {tx.correlationData}</div>
                </div>
                <div className="text-right">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                      tx.status === 'success'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : tx.status === 'pending'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}
                  >
                    {tx.status} {tx.latencyMs !== undefined ? `(${tx.latencyMs}ms)` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
