"use client";

import { useState, useMemo } from "react";
import { COLOR_CATEGORIES, ALL_550_COLORS } from "@/data/colors550";

export default function ColorPicker({
  selectedColor,
  onColorChange,
  recommendedColors = [],
  dominantColors = [],
}) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [customHex, setCustomHex] = useState(selectedColor);

  // Categories list with count
  const categoriesList = useMemo(() => {
    return ["All", ...Object.keys(COLOR_CATEGORIES)];
  }, []);

  // Filtered colors based on activeCategory and searchQuery
  const displayedColors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let baseList =
      activeCategory === "All"
        ? ALL_550_COLORS
        : (COLOR_CATEGORIES[activeCategory] || []).map((c) => ({
            ...c,
            category: activeCategory,
          }));

    if (q) {
      baseList = baseList.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.hex.toLowerCase().includes(q) ||
          (c.category && c.category.toLowerCase().includes(q))
      );
    }
    return baseList;
  }, [activeCategory, searchQuery]);

  const handleCustomHexChange = (e) => {
    const val = e.target.value;
    setCustomHex(val);
    if (/^#[0-9A-F]{6}$/i.test(val)) {
      onColorChange(val.toUpperCase());
    }
  };

  const selectColor = (hex) => {
    const formatted = hex.toUpperCase();
    setCustomHex(formatted);
    onColorChange(formatted);
  };

  // Find metadata of currently selected color
  const selectedMeta = useMemo(() => {
    const found = ALL_550_COLORS.find(
      (c) => c.hex.toLowerCase() === selectedColor.toLowerCase()
    );
    return found || { name: "Custom Pigment", category: "Custom", hex: selectedColor };
  }, [selectedColor]);

  return (
    <div className="rounded-3xl bg-[#15142b]/90 border border-white/10 p-5 shadow-2xl backdrop-blur-xl space-y-4">
      {/* Header & Active Color Card */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-200">550 Colors Library</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              552 Architectural Swatches
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Active: <span className="font-semibold text-slate-200">{selectedMeta.name}</span>
            {selectedMeta.category && (
              <span className="text-slate-500"> ({selectedMeta.category})</span>
            )}
          </p>
        </div>

        {/* Selected Swatch Pill */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-white/15 shadow-sm">
          <div
            className="w-6 h-6 rounded-lg border border-white/30 shadow-inner"
            style={{ backgroundColor: selectedColor }}
          />
          <span className="font-mono text-xs font-bold text-slate-200">{selectedColor}</span>
        </div>
      </div>

      {/* AI Color Recommendations */}
      {recommendedColors && recommendedColors.length > 0 && (
        <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/20 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-medium text-indigo-300">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.001z" />
              </svg>
              <span>Harmonized with Room Furnishings</span>
            </div>
            <span className="text-[10px] text-indigo-400/80">AI Recommended</span>
          </div>

          <div className="flex items-center gap-2">
            {recommendedColors.map((color, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => selectColor(color)}
                className={`group relative flex-1 h-8 rounded-lg border transition-all ${
                  selectedColor.toLowerCase() === color.toLowerCase()
                    ? "ring-2 ring-indigo-400 border-white scale-105 shadow-md shadow-indigo-500/20"
                    : "border-white/10 hover:border-white/40"
                }`}
                style={{ backgroundColor: color }}
                title={`Room Harmonized: ${color}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search 550 colors (e.g. Cobalt, Alabaster, Sage, #3944BC)..."
          className="w-full bg-slate-900/90 border border-slate-700/60 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Color Family Category Pills (Horizontal scrollable) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs border-b border-slate-800 scrollbar-thin">
        {categoriesList.map((cat) => {
          const isSelected = activeCategory === cat;
          const count =
            cat === "All"
              ? ALL_550_COLORS.length
              : (COLOR_CATEGORIES[cat] || []).length;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap text-xs font-medium transition-all flex items-center gap-1.5 ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                  : "bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-white/5"
              }`}
            >
              <span>{cat}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Swatch Status Bar */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
        <span>
          Showing <span className="font-semibold text-slate-200">{displayedColors.length}</span> colors
          {searchQuery && ` matching "${searchQuery}"`}
        </span>
        <span className="text-slate-500 text-[10px]">Click any swatch to repaint</span>
      </div>

      {/* 550 Swatches Grid (Scrollable) */}
      <div className="max-h-72 overflow-y-auto pr-1 grid grid-cols-4 sm:grid-cols-5 gap-2 scrollbar-thin">
        {displayedColors.length === 0 ? (
          <div className="col-span-full py-8 text-center text-xs text-slate-400">
            No colors found matching &quot;{searchQuery}&quot;. Try another name or hex code.
          </div>
        ) : (
          displayedColors.map((item, index) => {
            const isSelected = selectedColor.toLowerCase() === item.hex.toLowerCase();
            return (
              <button
                key={`${item.hex}-${index}`}
                type="button"
                onClick={() => selectColor(item.hex)}
                className={`group flex flex-col items-center gap-1.5 p-2 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "bg-indigo-950/80 border-indigo-400 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-400 scale-[1.02]"
                    : "bg-slate-900/60 border-white/5 hover:border-white/25 hover:bg-slate-800/60 hover:scale-[1.02]"
                }`}
                title={`${item.name} (${item.hex}) - ${item.category || activeCategory}`}
              >
                <div
                  className="w-full h-8 rounded-lg border border-black/30 shadow-inner group-hover:shadow-md transition-shadow relative overflow-hidden"
                  style={{ backgroundColor: item.hex }}
                >
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <svg className="w-3.5 h-3.5 text-white drop-shadow" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="w-full text-center">
                  <span className="text-[11px] font-medium text-slate-200 block truncate leading-tight">
                    {item.name}
                  </span>
                  <span className="font-mono text-[9px] text-slate-400 block truncate">
                    {item.hex}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Custom Color Input & Wheel */}
      <div className="pt-3 border-t border-slate-800 flex items-center gap-3">
        <label className="text-xs text-slate-400 whitespace-nowrap">Custom Pigment:</label>
        <div className="relative flex-1 flex items-center gap-2">
          <input
            type="color"
            value={selectedColor}
            onChange={(e) => selectColor(e.target.value)}
            className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
            title="Open color wheel"
          />
          <input
            type="text"
            value={customHex}
            onChange={handleCustomHexChange}
            placeholder="#3944BC"
            maxLength={7}
            className="flex-1 bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 uppercase"
          />
          <button
            type="button"
            onClick={() => selectColor(customHex)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-all"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
