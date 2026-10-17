import React, { useState } from 'react';
import { SerializedTopicNode } from '../types';
import { ChevronRight, ChevronDown, Folder, Tag, Activity } from 'lucide-react';

interface TopicTreeIndentedProps {
  data: SerializedTopicNode | null;
  onSelectTopic: (topic: string) => void;
  selectedTopic: string | null;
}

interface TreeNodeRowProps {
  node: SerializedTopicNode;
  level: number;
  onSelectTopic: (topic: string) => void;
  selectedTopic: string | null;
}

const TreeNodeRow: React.FC<TreeNodeRowProps> = ({
  node,
  level,
  onSelectTopic,
  selectedTopic
}) => {
  const [expanded, setExpanded] = useState<boolean>(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedTopic === node.fullTopic;

  const getRateBadge = (rate: number) => {
    if (rate <= 0) return null;
    let color = 'bg-sky-950 text-sky-400 border-sky-800/60';
    if (rate >= 5 && rate < 20) color = 'bg-emerald-950 text-emerald-400 border-emerald-800/60';
    else if (rate >= 20 && rate < 80) color = 'bg-amber-950 text-amber-400 border-amber-800/60';
    else if (rate >= 80) color = 'bg-rose-950 text-rose-400 border-rose-800/60';

    return (
      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-mono ${color}`}>
        <Activity className="w-2.5 h-2.5 animate-pulse" />
        {rate} msg/s
      </span>
    );
  };

  return (
    <div>
      <div
        onClick={() => {
          if (node.fullTopic) onSelectTopic(node.fullTopic);
        }}
        className={`flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer transition text-xs font-mono select-none ${
          isSelected
            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
            : 'hover:bg-slate-800/60 text-slate-300'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="p-0.5 text-slate-400 hover:text-white rounded"
            >
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-4" />
          )}

          {hasChildren ? (
            <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          ) : (
            <Tag className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
          )}

          <span className="font-medium truncate">{node.name}</span>

          {node.lastFormat && (
            <span className="text-[9px] uppercase px-1 py-0.2 bg-slate-800 text-slate-400 rounded border border-slate-700/60">
              {node.lastFormat}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-slate-400 flex-shrink-0">
          {getRateBadge(node.messagesPerSec)}

          <span className="text-[11px] text-slate-400 font-medium">
            {(node.aggregateMessageCount || node.messageCount).toLocaleString()} msgs
          </span>

          <span className="text-[10px] text-slate-500 w-16 text-right">
            {((node.aggregateByteCount || node.byteCount) / 1024).toFixed(1)} KB
          </span>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="border-l border-slate-800/80 ml-4">
          {node.children!.map((child) => (
            <TreeNodeRow
              key={child.fullTopic || child.name}
              node={child}
              level={level + 1}
              onSelectTopic={onSelectTopic}
              selectedTopic={selectedTopic}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const TopicTreeIndented: React.FC<TopicTreeIndentedProps> = ({
  data,
  onSelectTopic,
  selectedTopic
}) => {
  if (!data || (!data.children && !data.isLeaf)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center text-xs">
        <Folder className="w-8 h-8 text-slate-700 mb-2" />
        No topics discovered yet. Connect a broker or run the simulator to stream topics.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-2 space-y-0.5 bg-[#0b101b] rounded-xl border border-slate-800 font-mono">
      {data.children && data.children.length > 0 ? (
        data.children.map((child) => (
          <TreeNodeRow
            key={child.fullTopic || child.name}
            node={child}
            level={0}
            onSelectTopic={onSelectTopic}
            selectedTopic={selectedTopic}
          />
        ))
      ) : (
        <TreeNodeRow node={data} level={0} onSelectTopic={onSelectTopic} selectedTopic={selectedTopic} />
      )}
    </div>
  );
};
