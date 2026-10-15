"use client";

import { useMemo } from "react";

function CircularGauge({ value, label, subtitle, colorGradient, strokeColor, trackColor = "#1e1b38" }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center p-3">
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 140 140">
          {/* Background Track */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="transparent"
            stroke={trackColor}
            strokeWidth="14"
            className="opacity-70"
          />
          {/* Active Gradient Arc */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="transparent"
            stroke={`url(#${colorGradient})`}
            strokeWidth="14"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center Percentage Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-black tracking-tight text-white drop-shadow-md">
            {Math.round(value)}%
          </span>
          <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-0.5">
            {subtitle}
          </span>
        </div>
      </div>

      <span className="text-xs font-semibold text-slate-300 mt-1 text-center">
        {label}
      </span>
    </div>
  );
}

export default function AnalyticsGauges({
  wallCoverage = 85,
  lightingFidelity = 94,
  harmonyScore = 96,
  pigmentSaturation = 100,
  activeColorName = "Royal Blue",
  activeColorHex = "#3944BC",
  activeCategory = "Blues & Teals",
}) {
  return (
    <div className="rounded-3xl bg-[#15142b]/90 border border-white/10 p-5 shadow-2xl backdrop-blur-xl space-y-4">
      {/* SVG Gradients Definition */}
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          {/* Mint to Cyan (85% Gauge) */}
          <linearGradient id="mintCyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f2fe" />
            <stop offset="100%" stopColor="#38ef7d" />
          </linearGradient>

          {/* Purple to Violet (75% Gauge) */}
          <linearGradient id="purpleViolet" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#7e22ce" />
          </linearGradient>

          {/* Yellow to Orange (45% Gauge) */}
          <linearGradient id="yellowOrange" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>

          {/* Electric Blue (60% Gauge) */}
          <linearGradient id="electricBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
      </svg>

      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <div>
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
            Room AI Analytics
          </h3>
          <p className="text-[11px] text-slate-400">
            Real-time optical segmentation & relighting metrics
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          Live Telemetry
        </span>
      </div>

      {/* 2x2 Circular Gauges Grid matching Screenshot Top-Right */}
      <div className="grid grid-cols-2 gap-2">
        <CircularGauge
          value={wallCoverage}
          subtitle="Wall Mask"
          label="Wall Coverage"
          colorGradient="mintCyan"
        />
        <CircularGauge
          value={lightingFidelity}
          subtitle="Fidelity"
          label="Shadow Retention"
          colorGradient="purpleViolet"
        />
        <CircularGauge
          value={harmonyScore}
          subtitle="Aesthetic"
          label="Color Harmony"
          colorGradient="yellowOrange"
        />
        <CircularGauge
          value={pigmentSaturation}
          subtitle="Coverage"
          label="Pigment Depth"
          colorGradient="electricBlue"
        />
      </div>

      {/* Active Paint Telemetry Pill Bar (Matching middle pill in screenshot) */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-[#1c1a38] border border-white/5 shadow-inner">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-white/30 shadow-md flex-shrink-0"
            style={{ backgroundColor: activeColorHex }}
          />
          <div>
            <span className="text-xs font-bold text-white block leading-tight">
              {activeColorName}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {activeColorHex} • {activeCategory}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-right">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">PBR Sheen</span>
            <span className="text-xs font-bold text-emerald-400">BRDF Active</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Pigment</span>
            <span className="text-xs font-bold text-indigo-300">100% Solid</span>
          </div>
        </div>
      </div>
    </div>
  );
}
