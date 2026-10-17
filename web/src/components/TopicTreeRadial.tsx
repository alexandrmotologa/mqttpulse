import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { SerializedTopicNode } from '../types';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface TopicTreeRadialProps {
  data: SerializedTopicNode | null;
  onSelectTopic: (topic: string) => void;
  selectedTopic: string | null;
}

export const TopicTreeRadial: React.FC<TopicTreeRadialProps> = ({
  data,
  onSelectTopic,
  selectedTopic
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    node: SerializedTopicNode | null;
  }>({ visible: false, x: 0, y: 0, node: null });

  // Heatmap color generator based on message rate
  const getNodeColor = (rate: number, isLeaf: boolean) => {
    if (!isLeaf && rate === 0) return '#475569'; // slate-600
    if (rate === 0) return '#64748b'; // slate-500
    if (rate < 5) return '#38bdf8'; // sky-400
    if (rate < 20) return '#10b981'; // emerald-500
    if (rate < 80) return '#f59e0b'; // amber-500
    return '#f43f5e'; // rose-500
  };

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;
    const radius = Math.min(width, height) / 2 - 60;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Setup base SVG structure
    const gMain = svg
      .attr('viewBox', [-width / 2, -height / 2, width, height])
      .append('g')
      .attr('class', 'main-group');

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => {
        gMain.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Build hierarchy
    const root = d3.hierarchy<SerializedTopicNode>(data);
    const tree = d3
      .tree<SerializedTopicNode>()
      .size([2 * Math.PI, radius])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

    tree(root);

    // Radial link generator
    const linkGenerator = d3
      .linkRadial<any, any>()
      .angle((d: any) => d.x)
      .radius((d: any) => d.y);

    // Draw curved radial links
    gMain
      .append('g')
      .attr('fill', 'none')
      .attr('stroke', '#1e293b')
      .attr('stroke-opacity', 0.8)
      .attr('stroke-width', 1.5)
      .selectAll('path')
      .data(root.links())
      .join('path')
      .attr('d', linkGenerator as any)
      .attr('stroke', (d) => {
        const target = d.target.data;
        if (selectedTopic && target.fullTopic === selectedTopic) {
          return '#10b981';
        }
        return target.messagesPerSec > 0 ? '#334155' : '#1e293b';
      })
      .attr('stroke-width', (d) => {
        const target = d.target.data;
        return selectedTopic && target.fullTopic === selectedTopic ? 2.5 : 1.2;
      });

    // Draw nodes
    const nodeGroup = gMain
      .append('g')
      .selectAll('g')
      .data(root.descendants())
      .join('g')
      .attr(
        'transform',
        (d: any) => `rotate(${(d.x * 180) / Math.PI - 90}) translate(${d.y},0)`
      )
      .attr('cursor', 'pointer')
      .on('click', (_event, d) => {
        if (d.data.fullTopic) {
          onSelectTopic(d.data.fullTopic);
        }
      })
      .on('mouseenter', (event, d) => {
        const bounds = containerRef.current?.getBoundingClientRect();
        if (bounds) {
          setTooltip({
            visible: true,
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top - 10,
            node: d.data
          });
        }
      })
      .on('mouseleave', () => {
        setTooltip((prev) => ({ ...prev, visible: false }));
      });

    // Outer glow for active high-rate nodes
    nodeGroup
      .filter((d) => d.data.messagesPerSec > 5)
      .append('circle')
      .attr('r', (d) => {
        const count = d.data.aggregateMessageCount || d.data.messageCount || 1;
        return Math.min(Math.max(Math.log2(count + 2) * 2.5 + 4, 8), 24);
      })
      .attr('fill', (d) => getNodeColor(d.data.messagesPerSec, d.data.isLeaf))
      .attr('opacity', 0.25)
      .attr('class', 'animate-pulse');

    // Core circle
    nodeGroup
      .append('circle')
      .attr('r', (d) => {
        if (d.depth === 0) return 6;
        const count = d.data.aggregateMessageCount || d.data.messageCount || 1;
        return Math.min(Math.max(Math.log2(count + 1) * 1.5 + 3, 4), 14);
      })
      .attr('fill', (d) => getNodeColor(d.data.messagesPerSec, d.data.isLeaf))
      .attr('stroke', (d) => (selectedTopic === d.data.fullTopic ? '#ffffff' : '#0f172a'))
      .attr('stroke-width', (d) => (selectedTopic === d.data.fullTopic ? 2.5 : 1.5));

    // Label text
    nodeGroup
      .append('text')
      .attr('dy', '0.31em')
      .attr('x', (d: any) => (d.x < Math.PI ? 8 : -8))
      .attr('text-anchor', (d: any) => (d.x < Math.PI ? 'start' : 'end'))
      .attr('transform', (d: any) => (d.x >= Math.PI ? 'rotate(180)' : null))
      .text((d) => d.data.name)
      .attr('font-size', (d) => (d.depth <= 1 ? '11px' : '9px'))
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('fill', (d) => (selectedTopic === d.data.fullTopic ? '#34d399' : '#94a3b8'))
      .attr('font-weight', (d) => (d.depth <= 1 ? '600' : '400'));
  }, [data, selectedTopic, onSelectTopic]);

  const handleResetZoom = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(500).call(d3.zoom<SVGSVGElement, unknown>().transform as any, d3.zoomIdentity);
  };

  const handleZoom = (factor: number) => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(d3.zoom<SVGSVGElement, unknown>().scaleBy as any, factor);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#0b101b] rounded-xl border border-slate-800 overflow-hidden select-none">
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-[#141c2e]/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700/60 shadow-xl text-slate-300">
        <button
          onClick={() => handleZoom(1.3)}
          className="p-1 hover:text-emerald-400 hover:bg-slate-700/50 rounded transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(0.7)}
          className="p-1 hover:text-emerald-400 hover:bg-slate-700/50 rounded transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetZoom}
          className="p-1 hover:text-emerald-400 hover:bg-slate-700/50 rounded transition"
          title="Reset Zoom"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Heatmap Legend */}
      <div className="absolute top-4 left-4 bg-[#141c2e]/90 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-700/60 shadow-lg text-xs font-mono">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5 font-semibold">Message Throughput</div>
        <div className="flex items-center gap-2 text-slate-300">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block" /> 0
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" /> &lt;5
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> 5-20
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> 20-80
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> &gt;80/s
          </span>
        </div>
      </div>

      {/* Interactive Tooltip */}
      {tooltip.visible && tooltip.node && (
        <div
          className="absolute pointer-events-none z-50 bg-[#151d2e] border border-slate-700/80 p-3 rounded-lg shadow-2xl text-xs max-w-xs font-mono transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="text-emerald-400 font-bold break-all mb-1">
            {tooltip.node.fullTopic || 'Root Topic Namespace'}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-300 text-[11px] mt-1.5 pt-1.5 border-t border-slate-800">
            <div>Direct Msgs:</div>
            <div className="text-right font-semibold text-white">{tooltip.node.messageCount.toLocaleString()}</div>
            <div>Subtree Msgs:</div>
            <div className="text-right font-semibold text-white">{tooltip.node.aggregateMessageCount.toLocaleString()}</div>
            <div>Throughput:</div>
            <div className="text-right font-semibold text-emerald-300">{tooltip.node.messagesPerSec} msg/s</div>
            <div>Bandwidth:</div>
            <div className="text-right font-semibold text-slate-300">{(tooltip.node.bytesPerSec / 1024).toFixed(1)} KB/s</div>
            {tooltip.node.lastFormat && (
              <>
                <div>Payload Type:</div>
                <div className="text-right uppercase font-bold text-sky-400">{tooltip.node.lastFormat}</div>
              </>
            )}
          </div>
          {tooltip.node.lastPayloadSnippet && (
            <div className="mt-2 text-[10px] text-slate-400 bg-slate-900/80 p-1.5 rounded truncate">
              {tooltip.node.lastPayloadSnippet}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
