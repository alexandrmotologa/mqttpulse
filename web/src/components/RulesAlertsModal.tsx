import React, { useState } from 'react';
import { X, Bell, Plus, Trash2, AlertTriangle, Info, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { RuleDefinition, AlertEvent, RuleOperator, AlertSeverity } from '../types';

interface RulesAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: RuleDefinition[];
  alerts: AlertEvent[];
  onAddRule: (rule: RuleDefinition) => Promise<void>;
  onDeleteRule: (id: string) => Promise<void>;
  onToggleRule: (id: string, enabled: boolean) => Promise<void>;
  onClearAlerts: () => Promise<void>;
  onMarkRead: () => Promise<void>;
}

export const RulesAlertsModal: React.FC<RulesAlertsModalProps> = ({
  isOpen,
  onClose,
  rules,
  alerts,
  onAddRule,
  onDeleteRule,
  onToggleRule,
  onClearAlerts,
  onMarkRead
}) => {
  const [activeTab, setActiveTab] = useState<'alerts' | 'rules'>('alerts');

  // New rule form state
  const [name, setName] = useState('');
  const [topicFilter, setTopicFilter] = useState('sensors/+/temperature');
  const [field, setField] = useState('temperature');
  const [operator, setOperator] = useState<RuleOperator>('>');
  const [value, setValue] = useState('30.0');
  const [severity, setSeverity] = useState<AlertSeverity>('warning');

  if (!isOpen) return null;

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !field) return;

    const numVal = Number(value);
    const finalVal = isNaN(numVal) ? value : numVal;

    await onAddRule({
      id: `rule_${Date.now()}`,
      name: name.trim(),
      topicFilter: topicFilter.trim(),
      field: field.trim(),
      operator,
      value: finalVal,
      severity,
      enabled: true,
      cooldownMs: 5000
    });

    setName('');
    setValue('30.0');
  };

  const getSeverityBadge = (sev: AlertSeverity) => {
    switch (sev) {
      case 'critical':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-rose-950 text-rose-400 border border-rose-800 font-bold uppercase">
            <AlertOctagon className="w-3 h-3" /> Critical
          </span>
        );
      case 'warning':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-950 text-amber-400 border border-amber-800 font-bold uppercase">
            <AlertTriangle className="w-3 h-3" /> Warning
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-sky-950 text-sky-400 border border-sky-800 font-bold uppercase">
            <Info className="w-3 h-3" /> Info
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-mono text-xs select-none">
      <div className="bg-[#111827] border border-slate-700/80 rounded-xl shadow-2xl max-w-2xl w-full h-[580px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-[#0f172a]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-sm text-white">Rule Triggers & Telemetry Alerts</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center border-b border-slate-800 bg-[#0e1524] px-4">
          <button
            onClick={() => {
              setActiveTab('alerts');
              onMarkRead();
            }}
            className={`py-2.5 px-4 font-semibold text-xs border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'alerts'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Alerts History</span>
            {alerts.filter((a) => !a.read).length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`py-2.5 px-4 font-semibold text-xs border-b-2 transition ${
              activeTab === 'rules'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Configure Rules ({rules.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 select-text">
          {activeTab === 'alerts' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">{alerts.length} Triggered Alert Events</span>
                {alerts.length > 0 && (
                  <button
                    onClick={onClearAlerts}
                    className="flex items-center gap-1 text-slate-400 hover:text-rose-400 text-xs transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear All
                  </button>
                )}
              </div>

              {alerts.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <CheckCircle2 className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  No alerts triggered. System telemetry within nominal bounds.
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((a) => (
                    <div
                      key={a.id}
                      className={`p-3 rounded-lg border flex items-start justify-between gap-3 ${
                        a.severity === 'critical'
                          ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                          : a.severity === 'warning'
                          ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                          : 'bg-slate-900 border-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getSeverityBadge(a.severity)}
                          <span className="font-bold text-white">{a.ruleName}</span>
                        </div>
                        <div className="text-[11px] text-slate-300">{a.message}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Topic: {a.topic} &bull; Condition: {a.expectedCondition}
                        </div>
                      </div>

                      <div className="text-right text-[10px] text-slate-400 whitespace-nowrap">
                        {new Date(a.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-5">
              {/* Add New Rule Form */}
              <form onSubmit={handleCreateRule} className="bg-[#090d16] p-4 rounded-lg border border-slate-800 space-y-3">
                <h4 className="font-semibold text-white uppercase tracking-wider text-xs flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-emerald-400" /> Create Anomaly Trigger Rule
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Rule Name:</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Engine Overheating"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#111827] border border-slate-700 rounded px-2.5 py-1 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Topic Filter (+/#):</label>
                    <input
                      type="text"
                      required
                      value={topicFilter}
                      onChange={(e) => setTopicFilter(e.target.value)}
                      className="w-full bg-[#111827] border border-slate-700 rounded px-2.5 py-1 text-emerald-400 font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">Field Path:</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. zoneTemperatureC"
                      value={field}
                      onChange={(e) => setField(e.target.value)}
                      className="w-full bg-[#111827] border border-slate-700 rounded px-2.5 py-1 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Operator:</label>
                    <select
                      value={operator}
                      onChange={(e) => setOperator(e.target.value as any)}
                      className="w-full bg-[#111827] border border-slate-700 rounded px-2 py-1 text-slate-200"
                    >
                      <option value=">">&gt; (Greater)</option>
                      <option value="<">&lt; (Less)</option>
                      <option value=">=">&gt;= (Greater/Eq)</option>
                      <option value="<=">&lt;= (Less/Eq)</option>
                      <option value="==">== (Equals)</option>
                      <option value="!=">!= (Not Equal)</option>
                      <option value="contains">contains</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Threshold Value:</label>
                    <input
                      type="text"
                      required
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className="w-full bg-[#111827] border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Severity:</span>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as any)}
                      className="bg-[#111827] border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-300"
                    >
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold text-xs transition"
                  >
                    Add Trigger Rule
                  </button>
                </div>
              </form>

              {/* Active Rules List */}
              <div className="space-y-2">
                <div className="text-[11px] text-slate-400 font-semibold uppercase">Existing Rules:</div>
                {rules.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(r.severity)}
                        <span className="font-bold text-white">{r.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Topic: <span className="text-emerald-400">{r.topicFilter}</span> &bull; Condition:{' '}
                        <span className="text-sky-300">{r.field} {r.operator} {String(r.value)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 select-none">
                        <input
                          type="checkbox"
                          checked={r.enabled}
                          onChange={(e) => onToggleRule(r.id, e.target.checked)}
                          className="accent-emerald-500"
                        />
                        <span>{r.enabled ? 'Enabled' : 'Disabled'}</span>
                      </label>

                      <button
                        onClick={() => onDeleteRule(r.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
