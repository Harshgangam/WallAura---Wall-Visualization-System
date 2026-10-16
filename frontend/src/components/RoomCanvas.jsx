"use client";

import { useState, useRef, useEffect } from "react";

export default function RoomCanvas({
  originalImageSrc,
  resultImageSrc,
  maskImageSrc,
  components = [],
  viewMode,
  onViewModeChange,
  onCanvasClick,
  onImageUpload,
  loading,
  loadingStatus,
  selectedColor,
}) {
  const [sliderPos, setSliderPos] = useState(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  // Handle click on canvas image to target specific wall surface
  const handleImageClick = (e) => {
    if (loading || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const clickXRelative = e.clientX - rect.left;
    const clickYRelative = e.clientY - rect.top;

    if (
      clickXRelative < 0 ||
      clickYRelative < 0 ||
      clickXRelative > rect.width ||
      clickYRelative > rect.height
    ) {
      return;
    }

    // Scale to original image intrinsic resolution
    const scaleX = imageRef.current.naturalWidth / rect.width;
    const scaleY = imageRef.current.naturalHeight / rect.height;

    const naturalX = Math.round(clickXRelative * scaleX);
    const naturalY = Math.round(clickYRelative * scaleY);

    if (onCanvasClick) {
      onCanvasClick(naturalX, naturalY);
    }
  };

  // Split slider mouse and touch events
  const handleMouseDown = () => setIsDraggingSlider(true);
  const handleMouseUp = () => setIsDraggingSlider(false);

  const handleMouseMove = (e) => {
    if (!isDraggingSlider || !containerRef.current) return;
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
    if (clientX === null) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSliderPos(percent);
  };

  useEffect(() => {
    if (isDraggingSlider) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleMouseMove, { passive: true });
      window.addEventListener("touchend", handleMouseUp);
      window.addEventListener("touchcancel", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("touchend", handleMouseUp);
      window.removeEventListener("touchcancel", handleMouseUp);
    };
  }, [isDraggingSlider]);

  return (
    <div className="rounded-3xl bg-[#15142b]/90 border border-white/10 p-5 shadow-2xl backdrop-blur-xl flex flex-col space-y-4">
      {/* Top Toolbar: Mode selectors, status, download */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        {/* View Mode Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-white/10">
          <button
            type="button"
            onClick={() => onViewModeChange("result")}
            disabled={!resultImageSrc}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === "result"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 disabled:opacity-40"
            }`}
          >
            Painted Room
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange("comparison")}
            disabled={!resultImageSrc || !originalImageSrc}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              viewMode === "comparison"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 disabled:opacity-40"
            }`}
          >
            <span>Before / After</span>
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange("mask")}
            disabled={!maskImageSrc}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              viewMode === "mask"
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 disabled:opacity-40"
            }`}
          >
            <span>Wall Mask Overlay</span>
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange("original")}
            disabled={!originalImageSrc}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === "original"
                ? "bg-slate-700 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 disabled:opacity-40"
            }`}
          >
            Original
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Multi-wall component badges */}
          {components && components.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-2">
              <span className="font-semibold text-slate-300">Walls:</span>
              <button
                type="button"
                onClick={() => onCanvasClick && onCanvasClick(-1, -1)}
                className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-200"
              >
                All Walls ({components.length})
              </button>
              {components.map((c, idx) => (
                <button
                  key={c.id || idx}
                  type="button"
                  onClick={() => onCanvasClick && onCanvasClick(c.centroid[0], c.centroid[1])}
                  className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-indigo-900/60 border border-slate-700 hover:border-indigo-500/50 text-[11px] text-slate-200"
                  title={`Select Wall #${idx + 1}`}
                >
                  Wall {idx + 1}
                </button>
              ))}
            </div>
          )}

          {/* Download button */}
          {resultImageSrc && (
            <a
              href={resultImageSrc}
              download="wallaura_painted_room.png"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-medium transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export PNG</span>
            </a>
          )}
        </div>
      </div>

      {/* Main Canvas Display Area */}
      <div
        ref={containerRef}
        className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-slate-950/80 rounded-xl overflow-hidden border border-white/5 flex items-center justify-center select-none"
      >
        {/* Upload State / Empty State */}
        {!originalImageSrc ? (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-200">Upload Room Photograph</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Drop your interior photo here, or browse files. JPG, PNG, and WebP supported.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs cursor-pointer shadow-lg shadow-indigo-600/25 transition-all">
                <span>Select Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onImageUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  fetch("/room.jpg")
                    .then((res) => res.blob())
                    .then((blob) => {
                      const file = new File([blob], "room.jpg", { type: "image/jpeg" });
                      onImageUpload({ target: { files: [file] } });
                    })
                    .catch(() => {
                      // Fallback if not in public
                      const ev = { target: { files: [] } };
                    });
                }}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-all"
              >
                Load Sample Room
              </button>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* View Mode 1: Repainted Result */}
            {viewMode === "result" && resultImageSrc && (
              <img
                ref={imageRef}
                src={resultImageSrc}
                alt="Repainted Room"
                onClick={handleImageClick}
                className="max-w-full max-h-full object-contain cursor-crosshair"
              />
            )}

            {/* View Mode 2: Original View */}
            {viewMode === "original" && originalImageSrc && (
              <img
                ref={imageRef}
                src={originalImageSrc}
                alt="Original Room"
                onClick={handleImageClick}
                className="max-w-full max-h-full object-contain cursor-crosshair"
              />
            )}

            {/* View Mode 3: Wall Mask Overlay */}
            {viewMode === "mask" && originalImageSrc && (
              <div className="relative max-w-full max-h-full flex items-center justify-center">
                <img
                  ref={imageRef}
                  src={originalImageSrc}
                  alt="Original"
                  onClick={handleImageClick}
                  className="max-w-full max-h-full object-contain cursor-crosshair"
                />
                {maskImageSrc && (
                  <img
                    src={maskImageSrc}
                    alt="Mask Overlay"
                    onClick={handleImageClick}
                    className="absolute inset-0 w-full h-full object-contain mix-blend-screen opacity-70 pointer-events-none filter drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                    style={{
                      filter: "sepia(1) saturate(5) hue-rotate(140deg) brightness(1.2)",
                    }}
                  />
                )}
              </div>
            )}

            {/* View Mode 4: Before / After Split Comparison Slider */}
            {viewMode === "comparison" && originalImageSrc && resultImageSrc && (
              <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
                {/* Result layer (Full) */}
                <img
                  src={resultImageSrc}
                  alt="After"
                  className="absolute max-w-full max-h-full object-contain pointer-events-none"
                />

                {/* Original layer (Clipped by slider) */}
                <div
                  className="absolute inset-0 overflow-hidden flex items-center justify-center"
                  style={{ width: `${sliderPos}%` }}
                >
                  <img
                    src={originalImageSrc}
                    alt="Before"
                    className="max-w-none h-full object-contain pointer-events-none"
                    style={{
                      width: containerRef.current?.clientWidth || "100%",
                    }}
                  />
                </div>

                {/* Vertical Divider handle */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize flex items-center justify-center shadow-[0_0_10px_rgba(0,0,0,0.5)] z-20"
                  style={{ left: `${sliderPos}%` }}
                  onMouseDown={handleMouseDown}
                  onTouchStart={handleMouseDown}
                >
                  <div className="w-8 h-8 -ml-3.5 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-lg border-2 border-indigo-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 9l4-4 4 4m0 6l-4 4-4-4" transform="rotate(90 12 12)" />
                    </svg>
                  </div>
                </div>

                {/* Badges */}
                <span className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-[11px] font-semibold text-white pointer-events-none z-10">
                  Before
                </span>
                <span className="absolute top-3 right-3 px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-[11px] font-semibold text-white pointer-events-none z-10">
                  After
                </span>
              </div>
            )}
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30">
            <div className="w-10 h-10 rounded-full border-3 border-indigo-500 border-t-transparent animate-spin" />
            <p className="text-xs font-semibold text-slate-200 tracking-wide animate-pulse">
              {loadingStatus || "Processing with SegFormer ADE20K..."}
            </p>
          </div>
        )}

        {/* Tip pill at bottom */}
        {originalImageSrc && !loading && (
          <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none z-10">
            <div className="px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/10 text-[11px] text-slate-300 shadow-lg">
              💡 <span className="font-medium text-white">Click any wall</span> on the room to isolate and repaint that specific wall surface
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
