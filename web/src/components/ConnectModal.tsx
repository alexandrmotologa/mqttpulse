import React, { useState } from 'react';
import { X, Server, AlertCircle } from 'lucide-react';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (params: {
    url: string;
    clientId?: string;
    protocolVersion?: string;
    clean?: boolean;
    username?: string;
    password?: string;
    topic?: string;
  }) => Promise<void>;
  currentUrl?: string;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  currentUrl
}) => {
  const [url, setUrl] = useState(currentUrl || 'mqtt://127.0.0.1:18883');
  const [protocolVersion, setProtocolVersion] = useState<'5.0' | '3.1.1'>('5.0');
  const [topic, setTopic] = useState('#');
  const [clientId, setClientId] = useState(`mqttpulse_ui_${Math.random().toString(16).substring(2, 8)}`);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [clean, setClean] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const presets = [
    { label: 'Embedded Local Aedes', url: 'mqtt://127.0.0.1:18883', desc: 'Zero config local broker' },
    { label: 'EMQX Public Sandbox', url: 'mqtt://broker.emqx.io:1883', desc: 'Official EMQX testing broker' },
    { label: 'HiveMQ Public Sandbox', url: 'mqtt://broker.hivemq.com:1883', desc: 'Public HiveMQ test cluster' },
    { label: 'Local Mosquitto Standard', url: 'mqtt://localhost:1883', desc: 'Standard local 1883 port' }
  ];

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onConnect({
        url: url.trim(),
        clientId: clientId.trim() || undefined,
        protocolVersion,
        clean,
        username: username.trim() || undefined,
        password: password.trim() || undefined,
        topic: topic.trim() || '#'
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-mono text-xs">
      <div className="bg-[#111827] border border-slate-700/80 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-[#0f172a]">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-sm text-white">Connect to MQTT Broker</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConnect} className="p-5 space-y-4">
          {/* Quick Presets */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1.5 font-semibold">Quick Presets:</label>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((p) => (
                <button
                  type="button"
                  key={p.url}
                  onClick={() => setUrl(p.url)}
                  className={`p-2 rounded border text-left transition ${
                    url === p.url
                      ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-[11px] text-white">{p.label}</div>
                  <div className="text-[10px] text-slate-500 truncate">{p.url}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Broker URL */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Broker URL (TCP/TLS/WebSocket):</label>
            <input
              type="text"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. mqtt://localhost:1883 or wss://broker.emqx.io:8084/mqtt"
              className="w-full bg-[#090d16] border border-slate-700 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Protocol Version */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Protocol Version:</label>
              <select
                value={protocolVersion}
                onChange={(e) => setProtocolVersion(e.target.value as any)}
                className="w-full bg-[#090d16] border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="5.0">MQTT 5.0 (Modern)</option>
                <option value="3.1.1">MQTT 3.1.1 (Legacy)</option>
              </select>
            </div>

            {/* Initial Wildcard Subscription */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Subscribe Topic Filter:</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="#"
                className="w-full bg-[#090d16] border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500 text-emerald-400 font-semibold"
              />
            </div>
          </div>

          {/* Client ID */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Client Identifier:</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-[#090d16] border border-slate-700 rounded px-3 py-1 text-slate-300 focus:outline-none focus:border-emerald-500 text-xs"
            />
          </div>

          {/* Authentication Credentials */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Username (Optional):</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="broker user"
                className="w-full bg-[#090d16] border border-slate-700 rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-emerald-500 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Password (Optional):</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#090d16] border border-slate-700 rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-emerald-500 text-xs"
              />
            </div>
          </div>

          {/* Clean Session */}
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={clean}
                onChange={(e) => setClean(e.target.checked)}
                className="accent-emerald-500"
              />
              <span>Clean Start / Clean Session (Discard old subscriptions on connect)</span>
            </label>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-semibold transition shadow-lg shadow-emerald-900/30"
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
