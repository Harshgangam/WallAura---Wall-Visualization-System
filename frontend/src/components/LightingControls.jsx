"use client";

import { useState } from "react";

const TIME_PRESETS = [
  { id: "natural", label: "Natural Room", icon: "🌤️", val: 0.1 },
  { id: "morning", label: "Morning Sun", icon: "🌅", val: 0.3 },
  { id: "midday", label: "Midday Noon", icon: "☀️", val: 0.5 },
  { id: "golden_hour", label: "Golden Hour", icon: "🌇", val: 0.75 },
  { id: "evening_lamp", label: "Warm Lamp", icon: "🛋️", val: 0.95 },
];

export default function LightingControls({
  intensity,
  onIntensityChange,
  timeOfDay,
  onTimeOfDayChange,
  lightStrength,
  onLightStrengthChange,
  specularBoost = 0.5,
  onSpecularBoostChange,
  onExport,
  onShare,
  onOpenNew,
  onSettings,
}) {
  // Pill toggles state matching screenshot top-left
  const [toggleState, setToggleState] = useState({
    smartShadows: true,
    hdrBounce: true,
    microfacet: false,
    ambientOcclusion: true,
  });

  return (
    <div className="rounded-3xl bg-[#15142b]/90 border border-white/10 p-5 shadow-2xl backdrop-blur-xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Relighting & Optics
          </span>
          <h3 className="text-sm font-black text-white tracking-wide">
            Studio Lighting Controls
          </h3>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
          Photometric Engine
        </span>
      </div>

      {/* 4 Neon Pill Toggles (Matching top-left row in reference screenshot) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Toggle 1: Cyan/Blue */}
        <button
          type="button"
          onClick={() =>
            setToggleState((prev) => ({ ...prev, smartShadows: !prev.smartShadows }))
          }
          className={`relative h-9 rounded-full px-1.5 flex items-center transition-all ${
            toggleState.smartShadows
              ? "bg-gradient-to-r from-cyan-400 to-blue-500 justify-end shadow-lg shadow-cyan-500/30"
              : "bg-[#232047] justify-start border border-white/10"
          }`}
        >
          <span className="text-[10px] font-extrabold text-white px-2 select-none">
            {toggleState.smartShadows ? "HDR" : "RAW"}
          </span>
          <div className="w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
          </div>
        </button>

        {/* Toggle 2: Purple/Violet */}
        <button
          type="button"
          onClick={() =>
            setToggleState((prev) => ({ ...prev, hdrBounce: !prev.hdrBounce }))
          }
          className={`relative h-9 rounded-full px-1.5 flex items-center transition-all ${
            toggleState.hdrBounce
              ? "bg-gradient-to-r from-purple-500 to-indigo-600 justify-end shadow-lg shadow-purple-500/30"
              : "bg-[#232047] justify-start border border-white/10"
          }`}
        >
          <span className="text-[10px] font-extrabold text-white px-2 select-none">
            {toggleState.hdrBounce ? "PBR" : "OFF"}
          </span>
          <div className="w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          </div>
        </button>

        {/* Toggle 3: Coral/Red with target ring */}
        <button
          type="button"
          onClick={() =>
            setToggleState((prev) => ({ ...prev, microfacet: !prev.microfacet }))
          }
          className={`relative h-9 rounded-full px-1.5 flex items-center transition-all ${
            toggleState.microfacet
              ? "bg-gradient-to-r from-rose-500 to-amber-500 justify-end shadow-lg shadow-rose-500/30"
              : "bg-[#232047] justify-start border border-white/10"
          }`}
        >
          <span className="text-[10px] font-extrabold text-white px-2 select-none">
            {toggleState.microfacet ? "RAY" : "DIFF"}
          </span>
          <div className="w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-rose-500" />
          </div>
        </button>

        {/* Toggle 4: Mint/Green */}
        <button
          type="button"
          onClick={() =>
            setToggleState((prev) => ({ ...prev, ambientOcclusion: !prev.ambientOcclusion }))
          }
          className={`relative h-9 rounded-full px-1.5 flex items-center transition-all ${
            toggleState.ambientOcclusion
              ? "bg-gradient-to-r from-emerald-400 to-teal-500 justify-end shadow-lg shadow-emerald-500/30"
              : "bg-[#232047] justify-start border border-white/10"
          }`}
        >
          <span className="text-[10px] font-extrabold text-white px-2 select-none">
            {toggleState.ambientOcclusion ? "OCC" : "FLAT"}
          </span>
          <div className="w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
        </button>
      </div>

      {/* 4 Colorful Gradient Sliders Matching Screenshot Left Column */}
      <div className="space-y-4 pt-1">
        {/* Slider 1: Coral / Warm Orange to Yellow Gradient */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#f87171]" />
              Paint Application Opacity
            </span>
            <span className="font-mono font-extrabold text-amber-300">
              {Math.round(intensity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.2"
            max="1.0"
            step="0.02"
            value={intensity}
            onChange={(e) => onIntensityChange(parseFloat(e.target.value))}
            className="screenshot-slider w-full cursor-pointer shadow-md"
            style={{
              background: "linear-gradient(90deg, #f87171 0%, #fb923c 50%, #fbbf24 100%)",
            }}
          />
        </div>

        {/* Slider 2: Bright Turquoise to Sky Blue Gradient */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#06b6d4]" />
              Sun Track & Directional Angle
            </span>
            <span className="font-mono font-extrabold text-cyan-300">
              {timeOfDay.toUpperCase()}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="4"
            step="1"
            value={TIME_PRESETS.findIndex((p) => p.id === timeOfDay) >= 0 ? TIME_PRESETS.findIndex((p) => p.id === timeOfDay) : 0}
            onChange={(e) => {
              const idx = parseInt(e.target.value, 10);
              if (TIME_PRESETS[idx]) {
                onTimeOfDayChange(TIME_PRESETS[idx].id);
              }
            }}
            className="screenshot-slider w-full cursor-pointer shadow-md"
            style={{
              background: "linear-gradient(90deg, #06b6d4 0%, #38bdf8 50%, #3b82f6 100%)",
            }}
          />
        </div>

        {/* Slider 3: Neon Mint to Emerald Green Gradient */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#34d399]" />
              Directional Light Intensity
            </span>
            <span className="font-mono font-extrabold text-emerald-300">
              {Math.round(lightStrength * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.02"
            value={lightStrength}
            onChange={(e) => onLightStrengthChange(parseFloat(e.target.value))}
            className="screenshot-slider w-full cursor-pointer shadow-md"
            style={{
              background: "linear-gradient(90deg, #34d399 0%, #10b981 50%, #059669 100%)",
            }}
          />
        </div>

        {/* Slider 4: Purple / Violet to Electric Indigo Gradient */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#c084fc]" />
              Ambient Shadow Preservation
            </span>
            <span className="font-mono font-extrabold text-purple-300">
              {Math.round((specularBoost || 0.5) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={specularBoost || 0.5}
            onChange={(e) => onSpecularBoostChange && onSpecularBoostChange(parseFloat(e.target.value))}
            className="screenshot-slider w-full cursor-pointer shadow-md"
            style={{
              background: "linear-gradient(90deg, #c084fc 0%, #a855f7 50%, #6366f1 100%)",
            }}
          />
        </div>
      </div>

      {/* Neon Action Buttons in 2 Columns matching screenshot */}
      <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/5">
        <button
          type="button"
          onClick={onExport}
          className="h-10 rounded-full font-extrabold text-xs text-white uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25 hover:opacity-95 hover:scale-[1.02] active:scale-95 transition-all"
        >
          DOWNLOAD
        </button>

        <button
          type="button"
          onClick={onShare}
          className="h-10 rounded-full font-extrabold text-xs text-white uppercase tracking-wider bg-gradient-to-r from-amber-400 to-orange-500 shadow-lg shadow-amber-500/25 hover:opacity-95 hover:scale-[1.02] active:scale-95 transition-all"
        >
          SHARE
        </button>

        <button
          type="button"
          onClick={onOpenNew}
          className="h-10 rounded-full font-extrabold text-xs text-white uppercase tracking-wider bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg shadow-purple-600/25 hover:opacity-95 hover:scale-[1.02] active:scale-95 transition-all"
        >
          HARMONIES
        </button>

        <button
          type="button"
          onClick={onOpenNew}
          className="h-10 rounded-full font-extrabold text-xs text-white uppercase tracking-wider bg-gradient-to-r from-rose-500 to-pink-600 shadow-lg shadow-rose-500/25 hover:opacity-95 hover:scale-[1.02] active:scale-95 transition-all"
        >
          RE-SEGMENT
        </button>

        <button
          type="button"
          onClick={onSettings}
          className="h-10 rounded-full font-extrabold text-xs text-white uppercase tracking-wider bg-gradient-to-r from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/25 hover:opacity-95 hover:scale-[1.02] active:scale-95 transition-all"
        >
          GGR STORE
        </button>

        <button
          type="button"
          onClick={onSettings}
          className="h-10 rounded-full font-extrabold text-xs text-white uppercase tracking-wider bg-gradient-to-r from-slate-700 to-indigo-900 shadow-lg shadow-slate-900/50 border border-white/10 hover:opacity-95 hover:scale-[1.02] active:scale-95 transition-all"
        >
          SETTINGS
        </button>
      </div>

      {/* Quick Navigation Pills matching screenshot bottom-left */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center gap-3 p-2 rounded-2xl bg-[#1c1a38] border border-white/5 hover:border-indigo-500/40 transition-all cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-cyan-400 text-slate-900 flex items-center justify-center font-bold text-xs shadow-md">
            AI
          </div>
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
            SegFormer Semantic Neural Mask
          </span>
        </div>

        <div className="flex items-center gap-3 p-2 rounded-2xl bg-[#1c1a38] border border-white/5 hover:border-indigo-500/40 transition-all cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-md">
            PBR
          </div>
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
            Microfacet Specular Reflectance
          </span>
        </div>

        <div className="flex items-center gap-3 p-2 rounded-2xl bg-[#1c1a38] border border-white/5 hover:border-indigo-500/40 transition-all cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center font-bold text-xs shadow-md">
            550
          </div>
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
            GGR Architectural Paint Library
          </span>
        </div>
      </div>
    </div>
  );
}
