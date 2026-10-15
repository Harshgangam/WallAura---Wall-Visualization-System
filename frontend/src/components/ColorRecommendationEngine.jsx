"use client";

import { useState } from "react";
import { ROOM_MOODS, DESIGNER_HARMONIES } from "@/data/colorHarmonies";

export default function ColorRecommendationEngine({
  selectedColor,
  onApplyRecommendation,
}) {
  const [selectedMood, setSelectedMood] = useState("all");

  const filteredHarmonies =
    selectedMood === "all"
      ? DESIGNER_HARMONIES
      : DESIGNER_HARMONIES.filter((h) => h.category === selectedMood);

  return (
    <div className="rounded-3xl bg-[#15142b]/90 border border-white/10 p-5 shadow-2xl backdrop-blur-xl flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              AI Color Harmonies
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Architectural Engine
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Scientifically balanced palettes matching lighting & room mood
          </p>
        </div>
      </div>

      {/* Mood Filter Pills (Scrollable) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs border-b border-white/5 scrollbar-thin">
        {ROOM_MOODS.map((mood) => {
          const isSelected = selectedMood === mood.id;
          return (
            <button
              key={mood.id}
              type="button"
              onClick={() => setSelectedMood(mood.id)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap text-xs font-semibold transition-all flex items-center gap-1.5 ${
                isSelected
                  ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25"
                  : "bg-[#1c1a38] text-slate-400 hover:text-slate-200 hover:bg-[#25224a] border border-white/5"
              }`}
            >
              <span>{mood.icon}</span>
              <span>{mood.label}</span>
            </button>
          );
        })}
      </div>

      {/* Stacked Gradient Recommendation Cards Matching Screenshot Middle Column */}
      <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin">
        {filteredHarmonies.map((item) => {
          const isActive = selectedColor.toLowerCase() === item.primary.hex.toLowerCase();
          return (
            <div
              key={item.id}
              className={`group relative rounded-2xl p-4 transition-all duration-300 shadow-lg cursor-pointer transform hover:-translate-y-0.5 ${
                isActive
                  ? "ring-2 ring-white shadow-indigo-500/40"
                  : "hover:shadow-xl"
              }`}
              style={{ background: item.gradient }}
              onClick={() => onApplyRecommendation(item)}
            >
              <div className="flex items-center justify-between gap-3">
                {/* Left Card Info */}
                <div className="space-y-1 text-white pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold tracking-widest uppercase bg-black/25 px-2 py-0.5 rounded-full backdrop-blur-sm">
                      {item.harmonyScore}% Harmony
                    </span>
                    <span className="text-[10px] font-medium text-white/80">
                      {item.psychology}
                    </span>
                  </div>

                  <h4 className="text-base font-black tracking-tight text-white drop-shadow">
                    {item.title}
                  </h4>

                  <p className="text-[11px] text-white/90 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Swatch chips */}
                  <div className="flex items-center gap-2 pt-1.5">
                    <div className="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded-lg backdrop-blur-sm">
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-sm"
                        style={{ backgroundColor: item.primary.hex }}
                      />
                      <span className="text-[10px] font-bold text-white">
                        Wall: {item.primary.name} ({item.primary.hex})
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-black/20 px-2 py-1 rounded-lg backdrop-blur-sm text-[10px] font-semibold text-white/80">
                      <span>Trim: {item.secondary.name}</span>
                    </div>
                  </div>
                </div>

                {/* Right Circular Action Button matching screenshot */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApplyRecommendation(item);
                  }}
                  className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-transform shadow-md ${
                    isActive
                      ? "bg-white text-indigo-900 ring-2 ring-indigo-400 scale-105"
                      : "bg-white/90 text-slate-900 group-hover:scale-110 group-hover:bg-white"
                  }`}
                  title="Apply this harmony to wall"
                >
                  {isActive ? (
                    <svg className="w-5 h-5 text-indigo-700" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
