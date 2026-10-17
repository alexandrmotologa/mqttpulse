import React, { useState, useMemo } from 'react';
import { InboundMessage } from '../types';
import { Search, Filter, Play, Pause, Trash2 } from 'lucide-react';

interface MessageStreamTableProps {
  messages: InboundMessage[];
  onSelectMessage: (msg: InboundMessage) => void;
  selectedMessageId: string | null;
  onClear: () => void;
}

export const MessageStreamTable: React.FC<MessageStreamTableProps> = ({
  messages,
  onSelectMessage,
  selectedMessageId,
  onClear
}) => {
  const [filterText, setFilterText] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [selectedQoS, setSelectedQoS] = useState<string>('all');
  const [retainedOnly, setRetainedOnly] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Filter messages
  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      // 1. Text filter on topic or payload preview
      if (filterText) {
        const query = filterText.toLowerCase();
        const topicMatch = msg.topic.toLowerCase().includes(query);
        const payloadMatch =
          msg.decoded.rawString.toLowerCase().includes(query) ||
          msg.decoded.formattedJson.toLowerCase().includes(query);
        if (!topicMatch && !payloadMatch) return false;
      }

      // 2. Format filter
      if (selectedFormat !== 'all' && msg.decoded.format !== selectedFormat) {
        return false;
      }

      // 3. QoS filter
      if (selectedQoS !== 'all' && msg.qos !== Number(selectedQoS)) {
        return false;
      }

      // 4. Retained filter
      if (retainedOnly && !msg.retain) {
        return false;
      }

      return true;
    });
  }, [messages, filterText, selectedFormat, selectedQoS, retainedOnly]);

  const getFormatBadge = (format: string) => {
    switch (format) {
      case 'json':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-mono">JSON</span>;
      case 'protobuf':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950 text-purple-400 border border-purple-800/60 font-mono">PROTO</span>;
      case 'cbor':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-950 text-sky-400 border border-sky-800/60 font-mono">CBOR</span>;
      case 'msgpack':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950 text-amber-400 border border-amber-800/60 font-mono">MSGPACK</span>;
      case 'hex':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950 text-rose-400 border border-rose-800/60 font-mono">HEX</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700 font-mono">RAW</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d131f] rounded-xl border border-slate-800 overflow-hidden font-mono">
      {/* Table Filter Toolbar */}
      <div className="p-3 border-b border-slate-800 bg-[#111827] flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by topic or payload content..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#090d16] border border-slate-700/80 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Format selector */}
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="bg-[#090d16] border border-slate-700/80 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Formats</option>
            <option value="json">JSON</option>
            <option value="protobuf">Protobuf</option>
            <option value="cbor">CBOR</option>
            <option value="msgpack">MessagePack</option>
            <option value="hex">Hex / Binary</option>
          </select>

          {/* QoS selector */}
          <select
            value={selectedQoS}
            onChange={(e) => setSelectedQoS(e.target.value)}
            className="bg-[#090d16] border border-slate-700/80 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All QoS</option>
            <option value="0">QoS 0</option>
            <option value="1">QoS 1</option>
            <option value="2">QoS 2</option>
          </select>

          {/* Retain toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200 select-none">
            <input
              type="checkbox"
              checked={retainedOnly}
              onChange={(e) => setRetainedOnly(e.target.checked)}
              className="accent-emerald-500"
            />
            <span>Retain only</span>
          </label>

          {/* Pause stream button */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded border transition ${
              isPaused
                ? 'bg-amber-950/80 text-amber-400 border-amber-800'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title={isPaused ? 'Resume stream' : 'Pause stream'}
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            <span>{isPaused ? 'Paused' : 'Live'}</span>
          </button>

          {/* Clear button */}
          <button
            onClick={onClear}
            className="p-1 hover:text-rose-400 text-slate-500 hover:bg-slate-800 rounded transition"
            title="Clear message table"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-slate-800 bg-[#0f172a] text-[11px] font-semibold text-slate-400 uppercase tracking-wider select-none">
        <div className="col-span-2">Time</div>
        <div className="col-span-3">Topic</div>
        <div className="col-span-1 text-center">QoS</div>
        <div className="col-span-1 text-center">Format</div>
        <div className="col-span-4">Payload Preview</div>
        <div className="col-span-1 text-right">Size</div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 text-xs">
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-center p-4">
            <Filter className="w-6 h-6 mb-2 opacity-50" />
            <p>No messages match the active filters or no messages received yet.</p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isSelected = selectedMessageId === msg.id;
            const snippet =
              msg.decoded.format === 'hex'
                ? `Binary (${msg.decoded.byteLength} B)`
                : msg.decoded.formattedJson.replace(/\s+/g, ' ').substring(0, 100);

            return (
              <div
                key={msg.id}
                onClick={() => onSelectMessage(msg)}
                className={`grid grid-cols-12 gap-2 px-3 py-2 cursor-pointer transition items-center ${
                  isSelected
                    ? 'bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500'
                    : 'hover:bg-slate-800/50 text-slate-300'
                }`}
              >
                {/* Time */}
                <div className="col-span-2 text-slate-400 text-[11px] truncate">
                  {new Date(msg.timestamp).toLocaleTimeString()}.{String(msg.timestamp % 1000).padStart(3, '0')}
                </div>

                {/* Topic */}
                <div className="col-span-3 font-semibold text-emerald-400 truncate flex items-center gap-1.5" title={msg.topic}>
                  {msg.retain && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="Retained message" />
                  )}
                  <span className="truncate">{msg.topic}</span>
                </div>

                {/* QoS */}
                <div className="col-span-1 text-center">
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-sky-400 font-medium">
                    {msg.qos}
                  </span>
                </div>

                {/* Format */}
                <div className="col-span-1 text-center flex justify-center">
                  {getFormatBadge(msg.decoded.format)}
                </div>

                {/* Payload snippet */}
                <div className="col-span-4 text-slate-400 text-[11px] truncate" title={snippet}>
                  {snippet}
                </div>

                {/* Size */}
                <div className="col-span-1 text-right text-slate-500 text-[11px]">
                  {msg.decoded.byteLength} B
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Table Footer Status */}
      <div className="px-3 py-1.5 border-t border-slate-800 bg-[#0b101b] flex items-center justify-between text-[11px] text-slate-500 select-none">
        <span>Showing {filteredMessages.length} of {messages.length} buffered messages</span>
        <span>Click any row to open Packet Inspector</span>
      </div>
    </div>
  );
};
