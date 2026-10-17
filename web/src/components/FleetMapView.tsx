import React, { useState, useMemo } from 'react';
import { GeoMarker } from '../types';
import { ZoomIn, ZoomOut, RotateCcw, Compass, Radio } from 'lucide-react';

interface FleetMapViewProps {
  markers: GeoMarker[];
  onSelectTopic?: (topic: string) => void;
}

export const FleetMapView: React.FC<FleetMapViewProps> = ({ markers, onSelectTopic }) => {
  const [selectedMarker, setSelectedMarker] = useState<GeoMarker | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Calculate center and bounds
  const bounds = useMemo(() => {
    if (markers.length === 0) {
      return { minLat: 47.0, maxLat: 47.1, minLon: 28.8, maxLon: 28.9, centerLat: 47.0245, centerLon: 28.8322 };
    }
    const lats = markers.map((m) => m.latitude);
    const lons = markers.map((m) => m.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    return {
      minLat,
      maxLat,
      minLon,
      maxLon,
      centerLat: (minLat + maxLat) / 2,
      centerLon: (minLon + maxLon) / 2
    };
  }, [markers]);

  // Convert lat/lon to map coordinate (width 800, height 500)
  const projectCoord = (lat: number, lon: number) => {
    const mapW = 800;
    const mapH = 500;
    const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.05);
    const lonSpan = Math.max(bounds.maxLon - bounds.minLon, 0.05);

    const x = ((lon - bounds.minLon) / lonSpan) * (mapW - 160) + 80;
    // Invert Y for cartesian
    const y = mapH - (((lat - bounds.minLat) / latSpan) * (mapH - 140) + 70);

    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d131f] rounded-xl border border-slate-800 p-5 space-y-4 font-mono text-xs select-none">
      {/* Map Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-950/80 text-emerald-400 border border-emerald-800 rounded-lg">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white flex items-center gap-2">
              IoT Fleet Geolocation Map
            </h3>
            <p className="text-slate-400 text-[11px]">Real-time spatial tracking of mobile sensors & vehicles</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-emerald-400 font-semibold text-xs">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            {markers.length} Active Nodes on Grid
          </span>
        </div>
      </div>

      {/* Vector Map Canvas / SVG Area */}
      <div
        className="flex-1 bg-[#090d16] rounded-xl border border-slate-800 relative overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <svg
          viewBox="0 0 800 500"
          className="w-full h-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out'
          }}
        >
          {/* Subtle Radar & Coordinate Grid */}
          <defs>
            <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#141d2e" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="800" height="500" fill="url(#gridPattern)" />

          {/* Coordinate Axis Labels */}
          <line x1="80" y1="20" x2="80" y2="480" stroke="#1e293b" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="20" y1="430" x2="780" y2="430" stroke="#1e293b" strokeWidth="1.5" strokeDasharray="3 3" />

          {/* Markers */}
          {markers.map((m) => {
            const { x, y } = projectCoord(m.latitude, m.longitude);
            const isSelected = selectedMarker?.id === m.id;
            const headingDeg = m.heading ?? 0;

            return (
              <g
                key={m.id}
                transform={`translate(${x}, ${y})`}
                className="cursor-pointer transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMarker(m);
                  if (onSelectTopic) onSelectTopic(m.topic);
                }}
              >
                {/* Glow ring */}
                <circle r={isSelected ? 18 : 12} fill="#10b981" opacity={isSelected ? 0.35 : 0.15} />

                {/* Core vehicle node */}
                <circle
                  r={isSelected ? 8 : 6}
                  fill={isSelected ? '#34d399' : '#10b981'}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />

                {/* Heading Arrow */}
                {m.heading !== undefined && (
                  <path
                    d="M 0 -11 L 3 -6 L -3 -6 Z"
                    fill="#38bdf8"
                    transform={`rotate(${headingDeg})`}
                  />
                )}

                {/* Label text */}
                <text
                  x={10}
                  y={4}
                  fill={isSelected ? '#34d399' : '#94a3b8'}
                  fontSize={9}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={isSelected ? 'bold' : 'normal'}
                >
                  {m.id} {m.speedKmh !== undefined ? `(${m.speedKmh} km/h)` : ''}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Zoom & Reset Buttons */}
        <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-[#141c2e]/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700/60 shadow-xl text-slate-300">
          <button
            onClick={() => setZoomLevel((z) => Math.min(z + 0.3, 3.5))}
            className="p-1 hover:text-emerald-400 hover:bg-slate-700/50 rounded transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.max(z - 0.3, 0.6))}
            className="p-1 hover:text-emerald-400 hover:bg-slate-700/50 rounded transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setZoomLevel(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1 hover:text-emerald-400 hover:bg-slate-700/50 rounded transition"
            title="Reset Map Center"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Marker Detail Card */}
        {selectedMarker && (
          <div className="absolute top-4 left-4 bg-[#141c2e]/95 backdrop-blur-md p-3.5 rounded-xl border border-slate-700 shadow-2xl max-w-xs text-xs font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-emerald-400">{selectedMarker.id}</span>
              <button onClick={() => setSelectedMarker(null)} className="text-slate-400 hover:text-white">
                &times;
              </button>
            </div>
            <div className="mt-2 space-y-1 text-slate-300 text-[11px]">
              <div>Topic: <span className="text-white break-all">{selectedMarker.topic}</span></div>
              <div>Lat: <span className="text-sky-300">{selectedMarker.latitude.toFixed(6)}</span></div>
              <div>Lon: <span className="text-sky-300">{selectedMarker.longitude.toFixed(6)}</span></div>
              {selectedMarker.speedKmh !== undefined && (
                <div>Speed: <span className="text-amber-400 font-bold">{selectedMarker.speedKmh} km/h</span></div>
              )}
              {selectedMarker.heading !== undefined && (
                <div>Heading: <span className="text-purple-300">{selectedMarker.heading}&deg;</span></div>
              )}
              {selectedMarker.status && (
                <div>Status: <span className="text-emerald-400 font-semibold">{selectedMarker.status}</span></div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
