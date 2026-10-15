"use client";

import { useState, useMemo } from "react";

export default function LuminanceSpectrumChart({
  selectedColor = "#3944BC",
  timeOfDay = "natural",
  intensity = 1.0,
}) {
  const [activeScrubberIndex, setActiveScrubberIndex] = useState(6);

  // Convert hex to RGB to calculate physical wavelength reflectance curve
  const rgb = useMemo(() => {
    let hex = selectedColor.replace("#", "");
    if (hex.length === 3) {
      hex = hex.split("").map((c) => c + c).join("");
    }
    const num = parseInt(hex, 16) || 0;
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }, [selectedColor]);

  // Generate 12 discrete spectral/hourly reflectance points based on active paint color
  const spectrumPoints = useMemo(() => {
    const normR = rgb.r / 255;
    const normG = rgb.g / 255;
    const normB = rgb.b / 255;

    // 12 points spanning from violet (400nm) through cyan, green, amber to deep red (700nm)
    const points = [
      Math.min(95, Math.max(15, normB * 80 + 10)),           // 01: 400nm Violet
      Math.min(95, Math.max(18, (normB * 0.7 + normG * 0.3) * 85 + 10)), // 02: 430nm Indigo
      Math.min(95, Math.max(22, (normB * 0.5 + normG * 0.5) * 88 + 12)), // 03: 460nm Blue
      Math.min(95, Math.max(25, (normB * 0.3 + normG * 0.7) * 90 + 15)), // 04: 490nm Cyan
      Math.min(95, Math.max(30, normG * 92 + 15)),           // 05: 520nm Mint
      Math.min(95, Math.max(35, (normG * 0.8 + normR * 0.2) * 94 + 12)), // 06: 550nm Green
      Math.min(95, Math.max(38, (normG * 0.5 + normR * 0.5) * 95 + 10)), // 07: 580nm Yellow
      Math.min(95, Math.max(40, (normG * 0.2 + normR * 0.8) * 92 + 12)), // 08: 610nm Amber
      Math.min(95, Math.max(35, normR * 90 + 10)),           // 09: 640nm Orange
      Math.min(95, Math.max(28, normR * 88 + 8)),            // 10: 670nm Crimson
      Math.min(95, Math.max(24, (normR * 0.8 + normB * 0.2) * 82 + 10)), // 11: 700nm Deep Red
      Math.min(95, Math.max(20, (normR * 0.6 + normB * 0.4) * 80 + 12)), // 12: 730nm Near-IR
    ];

    return points.map((val) => Math.round(val * intensity));
  }, [rgb, intensity]);

  // Construct SVG cubic Bezier curve path
  const width = 360;
  const height = 150;
  const paddingX = 20;
  const paddingY = 24;
  const stepX = (width - 2 * paddingX) / (spectrumPoints.length - 1);

  const coords = useMemo(() => {
    return spectrumPoints.map((val, idx) => {
      const x = paddingX + idx * stepX;
      // Invert Y so high values go up
      const y = height - paddingY - (val / 100) * (height - 2 * paddingY);
      return { x, y, val, label: String(idx + 1).padStart(2, "0") };
    });
  }, [spectrumPoints, stepX, height]);

  // Smooth SVG path command
  const pathD = useMemo(() => {
    if (coords.length === 0) return "";
    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i];
      const p1 = coords[i + 1];
      const cx1 = p0.x + (p1.x - p0.x) / 2;
      const cy1 = p0.y;
      const cx2 = p0.x + (p1.x - p0.x) / 2;
      const cy2 = p1.y;
      d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p1.x} ${p1.y}`;
    }
    return d;
  }, [coords]);

  // Area path closing down to bottom
  const areaD = useMemo(() => {
    if (coords.length === 0) return "";
    const last = coords[coords.length - 1];
    const first = coords[0];
    return `${pathD} L ${last.x} ${height - 12} L ${first.x} ${height - 12} Z`;
  }, [pathD, coords, height]);

  const activeNode = coords[activeScrubberIndex] || coords[6];

  return (
    <div className="rounded-3xl bg-[#15142b]/90 border border-white/10 p-5 shadow-2xl backdrop-blur-xl space-y-3">
      {/* Header matching screenshot bottom-right */}
      <div className="flex items-center justify-between pb-1 border-b border-white/5">
        <div>
          <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            Spectral Luminance
          </span>
          <h4 className="text-sm font-black text-white tracking-wide">
            Waveform & Light Reflection
          </h4>
        </div>
        <div className="text-right">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
            DATE
          </span>
          <span className="text-xs font-mono font-bold text-emerald-400">
            23/02/18
          </span>
        </div>
      </div>

      {/* SVG Wave Chart */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair overflow-visible"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clientX = e.clientX - rect.left;
            const ratio = clientX / rect.width;
            const index = Math.round(ratio * (coords.length - 1));
            if (index >= 0 && index < coords.length) {
              setActiveScrubberIndex(index);
            }
          }}
        >
          <defs>
            {/* Multi-stop Stroke Gradient matching screenshot: Rose -> Purple -> Mint */}
            <linearGradient id="waveStrokeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#2dd4bf" />
            </linearGradient>

            {/* Area Fill Gradient with opacity */}
            <linearGradient id="waveAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#15142b" stopOpacity="0.0" />
            </linearGradient>

            {/* Glowing filter for scrubber circle */}
            <filter id="glowCircle" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#ffffff" floodOpacity="0.9" />
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#a855f7" floodOpacity="0.7" />
            </filter>
          </defs>

          {/* Area Fill */}
          <path d={areaD} fill="url(#waveAreaGradient)" />

          {/* Glowing Wave Curve */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#waveStrokeGradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="filter drop-shadow-[0_4px_8px_rgba(168,85,247,0.4)]"
          />

          {/* Scrubber vertical dashed line */}
          {activeNode && (
            <line
              x1={activeNode.x}
              y1={activeNode.y}
              x2={activeNode.x}
              y2={height - 14}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* Glowing White Node on Curve matching screenshot */}
          {activeNode && (
            <g>
              <circle
                cx={activeNode.x}
                cy={activeNode.y}
                r="6.5"
                fill="#ffffff"
                filter="url(#glowCircle)"
              />
              <circle
                cx={activeNode.x}
                cy={activeNode.y}
                r="2.5"
                fill="#8b5cf6"
              />
            </g>
          )}

          {/* Horizontal Axis Values (01 through 12 in neon mint/green matching screenshot) */}
          {coords.map((c, i) => (
            <text
              key={c.label}
              x={c.x}
              y={height - 2}
              textAnchor="middle"
              className={`text-[9px] font-mono font-bold transition-all ${
                i === activeScrubberIndex
                  ? "fill-emerald-300 font-extrabold"
                  : "fill-emerald-600/60"
              }`}
            >
              {c.label}
            </text>
          ))}
        </svg>
      </div>

      {/* Scrubber telemetry readouts */}
      <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Band #{activeNode.label} ({400 + activeScrubberIndex * 30}nm):</span>
          <span className="font-mono font-bold text-white">{activeNode.val}% Reflectance</span>
        </div>
        <span className="font-mono text-[10px] text-indigo-300">
          ΔE* 0.44 Match
        </span>
      </div>
    </div>
  );
}
