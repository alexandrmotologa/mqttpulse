import React, { useState } from 'react';
import { Send, Plus, Trash2, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

interface PublishTestBenchProps {
  onPublish: (params: {
    topic: string;
    payload: unknown;
    qos?: 0 | 1 | 2;
    retain?: boolean;
    properties?: Record<string, unknown>;
  }) => Promise<{ latencyMs?: number }>;
  defaultTopic?: string;
}

export const PublishTestBench: React.FC<PublishTestBenchProps> = ({ onPublish, defaultTopic }) => {
  const [topic, setTopic] = useState(defaultTopic || 'factory/zone1/sensor/temperature');
  const [payloadText, setPayloadText] = useState(
    JSON.stringify({ temperature: 24.5, humidity: 55.0, status: 'NORMAL' }, null, 2)
  );
  const [qos, setQos] = useState<0 | 1 | 2>(1);
  const [retain, setRetain] = useState(false);
  const [userProps, setUserProps] = useState<Array<{ key: string; value: string }>>([
    { key: 'source', value: 'MQTTPulse_Web_Bench' }
  ]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; latencyMs?: number; error?: string } | null>(null);

  const handleAddProp = () => {
    setUserProps([...userProps, { key: '', value: '' }]);
  };

  const handleRemoveProp = (index: number) => {
    setUserProps(userProps.filter((_, i) => i !== index));
  };

  const handlePropChange = (index: number, field: 'key' | 'value', val: string) => {
    const copy = [...userProps];
    copy[index][field] = val;
    setUserProps(copy);
  };

  const handleSend = async () => {
    setSending(true);
    setResult(null);

    // Format user properties object
    const propertiesObj: Record<string, any> = {};
    const validProps = userProps.filter((p) => p.key.trim() !== '');
    if (validProps.length > 0) {
      const upRecord: Record<string, string> = {};
      for (const p of validProps) {
        upRecord[p.key.trim()] = p.value.trim();
      }
      propertiesObj.userProperties = upRecord;
      propertiesObj.contentType = 'application/json';
    }

    try {
      let parsedPayload: unknown;
      try {
        parsedPayload = JSON.parse(payloadText);
      } catch {
        parsedPayload = payloadText;
      }

      const res = await onPublish({
        topic: topic.trim(),
        payload: parsedPayload,
        qos,
        retain,
        properties: Object.keys(propertiesObj).length > 0 ? propertiesObj : undefined
      });

      setResult({ success: true, latencyMs: res.latencyMs });
    } catch (err: unknown) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d131f] rounded-xl border border-slate-800 p-5 space-y-4 overflow-y-auto font-mono text-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="font-semibold text-sm text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" /> Interactive MQTT 5.0 Publisher Bench
          </h3>
          <p className="text-slate-400 text-[11px]">Inject ad-hoc messages with custom user properties & QoS acknowledgment</p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Topic Input */}
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Target Topic:</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. factory/line1/sensor/temperature"
            className="w-full bg-[#090d16] border border-slate-700 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500 font-semibold text-emerald-400"
          />
        </div>

        {/* Payload Editor */}
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Payload Content (JSON or raw text):</label>
          <textarea
            rows={5}
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            className="w-full bg-[#090d16] border border-slate-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500 leading-relaxed font-mono"
          />
        </div>

        {/* QoS and Retain */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Delivery QoS:</label>
            <select
              value={qos}
              onChange={(e) => setQos(Number(e.target.value) as any)}
              className="w-full bg-[#090d16] border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="0">QoS 0 - At most once (Fire & Forget)</option>
              <option value="1">QoS 1 - At least once (PUBACK)</option>
              <option value="2">QoS 2 - Exactly once (PUBREC / PUBCOMP)</option>
            </select>
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={retain}
                onChange={(e) => setRetain(e.target.checked)}
                className="accent-emerald-500 w-4 h-4"
              />
              <span>Retain message on broker</span>
            </label>
          </div>
        </div>

        {/* MQTT 5.0 User Properties */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-slate-400">MQTT 5.0 User Properties:</span>
            <button
              onClick={handleAddProp}
              className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300"
            >
              <Plus className="w-3 h-3" /> Add Property
            </button>
          </div>

          <div className="space-y-1.5">
            {userProps.map((prop, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Key"
                  value={prop.key}
                  onChange={(e) => handlePropChange(idx, 'key', e.target.value)}
                  className="w-1/3 bg-[#090d16] border border-slate-700 rounded px-2.5 py-1 text-slate-300 text-xs focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={prop.value}
                  onChange={(e) => handlePropChange(idx, 'value', e.target.value)}
                  className="flex-1 bg-[#090d16] border border-slate-700 rounded px-2.5 py-1 text-slate-300 text-xs focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => handleRemoveProp(idx)}
                  className="p-1 text-slate-500 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Publish Action & Status */}
        <div className="pt-3 flex items-center justify-between">
          <button
            onClick={handleSend}
            disabled={sending || !topic}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-md font-semibold transition shadow-lg shadow-emerald-900/30"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{sending ? 'Publishing...' : 'Publish Message'}</span>
          </button>

          {result && (
            <div className="flex items-center gap-1.5 text-xs">
              {result.success ? (
                <div className="flex items-center gap-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Delivered in {result.latencyMs ?? 0} ms</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-rose-400 font-medium">
                  <AlertCircle className="w-4 h-4" />
                  <span>{result.error}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
