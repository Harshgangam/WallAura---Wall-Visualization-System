"use client";

import { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/Navbar";
import Paint3DScene from "@/components/Paint3DScene";
import RoomCanvas from "@/components/RoomCanvas";
import ColorPicker from "@/components/ColorPicker";
import SheenSelector from "@/components/SheenSelector";
import LightingControls from "@/components/LightingControls";
import ColorRecommendationEngine from "@/components/ColorRecommendationEngine";
import AnalyticsGauges from "@/components/AnalyticsGauges";
import LuminanceSpectrumChart from "@/components/LuminanceSpectrumChart";
import { ALL_550_COLORS } from "@/data/colors550";

const CLOUD_API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://wallaura-wall-visualization-system.onrender.com";

// Determine resilient API endpoints based on environment:
// 1. /api/py (Vercel edge proxy - completely bypasses ISP/DNS blocks on Indian mobile 5G like Jio/Airtel)
// 2. Direct Render cloud backend as fallback
// 3. Localhost only when actually running on a local machine
const getApiHosts = () => {
  if (typeof window === "undefined") {
    return [CLOUD_API_URL];
  }

  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (isLocal) {
    return [
      "http://127.0.0.1:8000",
      "http://localhost:8000",
      CLOUD_API_URL,
    ];
  }

  // On deployed Vercel production:
  // 1. Same-origin relative path (e.g. /api/detect-and-apply proxied through Vercel Edge)
  // 2. /api/py alias
  // 3. Direct Render cloud backend as fallback
  return ["", "/api/py", CLOUD_API_URL];
};

// Client-side image optimizer: automatically downscales high-res smartphone camera photos (e.g. 12-48MP)
// to a clean 1280px JPEG (~250 KB) before upload. This prevents mobile upload timeouts and eliminates 4.5MB Vercel payload limits.
async function downscaleImageIfNeeded(file, maxDimension = 1280) {
  if (!file) return file;

  return new Promise((resolve) => {
    let url = "";
    try {
      url = URL.createObjectURL(file);
    } catch (_) {
      return resolve(file);
    }

    const timer = setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch (_) {}
      resolve(file);
    }, 6000);

    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      try { URL.revokeObjectURL(url); } catch (_) {}

      let { width, height } = img;
      if (!width || !height || Math.max(width, height) <= maxDimension) {
        resolve(file);
        return;
      }

      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const resizedFile = new File(
              [blob],
              file.name ? file.name.replace(/\.[^/.]+$/, ".jpg") : "room.jpg",
              { type: "image/jpeg", lastModified: Date.now() }
            );
            resolve(resizedFile);
          } else {
            resolve(file);
          }
        },
        "image/jpeg",
        0.85
      );
    };

    img.onerror = () => {
      clearTimeout(timer);
      try { URL.revokeObjectURL(url); } catch (_) {}
      resolve(file);
    };

    img.src = url;
  });
}

// Instant client-side fallback renderer: blends paint color onto wall mask using HTML5 canvas
async function clientSideRecolorFallback(imageSrc, maskSrc, colorHex) {
  if (!imageSrc || !maskSrc) return null;
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const mask = new Image();
        mask.crossOrigin = "anonymous";
        mask.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);

          // 1. Draw base room image
          ctx.drawImage(img, 0, 0);

          // 2. Create isolated tinted wall layer
          const tintCanvas = document.createElement("canvas");
          tintCanvas.width = img.width;
          tintCanvas.height = img.height;
          const tintCtx = tintCanvas.getContext("2d");
          if (!tintCtx) return resolve(null);

          tintCtx.drawImage(mask, 0, 0);
          tintCtx.globalCompositeOperation = "source-in";
          tintCtx.fillStyle = colorHex;
          tintCtx.fillRect(0, 0, img.width, img.height);

          // 3. Composite with multiply blend to preserve shadows and textures
          ctx.save();
          ctx.globalAlpha = 0.88;
          ctx.globalCompositeOperation = "multiply";
          ctx.drawImage(tintCanvas, 0, 0);
          ctx.restore();

          resolve(canvas.toDataURL("image/png"));
        };
        mask.onerror = () => resolve(null);
        mask.src = maskSrc;
      };
      img.onerror = () => resolve(null);
      img.src = imageSrc;
    } catch (_) {
      resolve(null);
    }
  });
}

async function safeApiFetch(endpoint, options = {}, maxRetries = 6, onRetry = null) {
  let lastError = null;
  const hosts = getApiHosts();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    for (const host of hosts) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const reqOptions = {
          ...options,
          signal: controller.signal,
        };

        // If bodyFactory is provided, generate a fresh FormData instance for each retry attempt
        // (prevents consumed stream errors in mobile browsers)
        if (typeof options.bodyFactory === "function") {
          reqOptions.body = options.bodyFactory();
        }

        let targetUrl = `${host}${endpoint}`;
        if (host === "/api/py" && endpoint.startsWith("/api/")) {
          targetUrl = `/api/py${endpoint.slice(4)}`;
        }

        const res = await fetch(targetUrl, reqOptions);
        clearTimeout(timeoutId);
        // If response is OK (200-299) or real client error (400, 422), return it.
        // If 404 or >= 500, fall through and try next host in the list!
        if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 404)) {
          return res;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (attempt < maxRetries) {
      if (onRetry) {
        onRetry(attempt, maxRetries);
      }
      // Progressive backoff to accommodate Render free-tier cold starts (~30-45s)
      const delay = Math.min(1800 * attempt, 8000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw (
    lastError ||
    new Error(
      "WallAura AI cloud is waking up or unreachable. Please wait 15 seconds and try again."
    )
  );
}

export default function Home() {
  const [file, setFile] = useState(null);
  const [originalImageSrc, setOriginalImageSrc] = useState(null);
  const [resultImageSrc, setResultImageSrc] = useState(null);
  const [maskImageSrc, setMaskImageSrc] = useState(null);
  const [maskB64, setMaskB64] = useState("");
  const [fgMaskB64, setFgMaskB64] = useState("");
  const [components, setComponents] = useState([]);

  const [selectedColor, setSelectedColor] = useState("#3944BC");
  const [selectedSheen, setSelectedSheen] = useState("eggshell");
  const [timeOfDay, setTimeOfDay] = useState("natural");
  const [intensity, setIntensity] = useState(1.0);
  const [lightStrength, setLightStrength] = useState(0.3);
  const [specularBoost, setSpecularBoost] = useState(0.5);

  const [viewMode, setViewMode] = useState("result");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [backendConnected, setBackendConnected] = useState(false);
  const [recommendedColors, setRecommendedColors] = useState([]);
  const [dominantColors, setDominantColors] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [show3DStudio, setShow3DStudio] = useState(true);

  // Active color metadata
  const activeColorMeta = useMemo(() => {
    const found = ALL_550_COLORS.find(
      (c) => c.hex.toLowerCase() === selectedColor.toLowerCase()
    );
    return found || { name: "Royal Blue Accent", category: "Blues & Teals", hex: selectedColor };
  }, [selectedColor]);

  // Handle new room photograph upload
  const handleImageUpload = async (e) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setErrorMsg("");
    setLoading(true);
    setLoadingStatus("Preparing image for AI analysis...");

    const uploadedFile = await downscaleImageIfNeeded(rawFile, 1280);
    setFile(uploadedFile);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      setOriginalImageSrc(ev.target.result);
      try {
        await triggerFullDetectionAndApply(
          uploadedFile,
          selectedColor,
          selectedSheen,
          timeOfDay,
          intensity,
          lightStrength
        );
      } catch (err) {
        // Handled gracefully in triggerFullDetectionAndApply
      }
    };
    reader.readAsDataURL(uploadedFile);
  };

  // Full detection & application (runs SegFormer semantic inference)
  const triggerFullDetectionAndApply = async (
    targetFile,
    color,
    sheen,
    tod,
    intens,
    lightStr,
    clickX = -1,
    clickY = -1,
    isInitial = false
  ) => {
    if (!targetFile) return;
    setLoading(true);
    setLoadingStatus(
      clickX >= 0
        ? `Isolating wall region at (${clickX}, ${clickY})...`
        : "Running SegFormer ADE20K semantic wall segmentation..."
    );
    setErrorMsg("");

    try {
      const buildFormData = () => {
        const formData = new FormData();
        formData.append("file", targetFile);
        formData.append("color", color);
        formData.append("sheen", sheen);
        formData.append("time_of_day", tod);
        formData.append("intensity", intens.toString());
        formData.append("light_strength", lightStr.toString());
        formData.append("click_x", clickX.toString());
        formData.append("click_y", clickY.toString());
        return formData;
      };

      const res = await safeApiFetch(
        "/api/detect-and-apply",
        {
          method: "POST",
          bodyFactory: buildFormData,
        },
        6,
        (attempt, max) => {
          setLoadingStatus(`Connecting to AI model on Render... (attempt ${attempt}/${max})`);
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `Server error: ${res.status}`);
      }

      const data = await res.json();
      if (data.success) {
        setResultImageSrc(`data:image/png;base64,${data.result}`);
        setMaskImageSrc(`data:image/png;base64,${data.mask}`);
        setMaskB64(data.mask);
        setFgMaskB64(data.foregroundMask || "");
        setComponents(data.components || []);
        if (data.recommendedColors?.length) {
          setRecommendedColors(data.recommendedColors);
        }
        if (data.dominantColors?.length) {
          setDominantColors(data.dominantColors);
        }
      } else {
        if (!isInitial) {
          setErrorMsg("Wall detection failed. Please try clicking directly on the wall.");
        }
      }
    } catch (err) {
      console.warn("[WallAura] Connection notice:", err.message);
      if (!isInitial) {
        setErrorMsg(
          err.message ||
            "Could not connect to WallAura AI service. Make sure backend is running or waking up on Render."
        );
      }
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
  };

  // Fast recoloring using cached mask (avoids re-running semantic inference)
  const triggerFastRecolor = async (color, sheen, tod, intens, lightStr) => {
    if (!file || !maskB64) return;
    setLoading(true);
    setLoadingStatus("Applying paint finish...");
    setErrorMsg("");

    // Optimistically render instantly using HTML5 canvas (< 10ms)
    const instantPreview = await clientSideRecolorFallback(originalImageSrc, maskImageSrc, color);
    if (instantPreview) {
      setResultImageSrc(instantPreview);
    }

    try {
      const buildFormData = () => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("mask_b64", maskB64);
        formData.append("color", color);
        formData.append("sheen", sheen);
        formData.append("time_of_day", tod);
        formData.append("intensity", intens.toString());
        formData.append("light_strength", lightStr.toString());
        if (fgMaskB64) {
          formData.append("fg_b64", fgMaskB64);
        }
        return formData;
      };

      const res = await safeApiFetch(
        "/api/apply-color",
        {
          method: "POST",
          bodyFactory: buildFormData,
        },
        5,
        (attempt, max) => {
          setLoadingStatus(`Refining with PBR sheen... (${attempt}/${max})`);
        }
      );

      if (res && res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setResultImageSrc(url);
      }
    } catch (err) {
      console.warn("[WallAura] Cloud recolor notice:", err.message);
      // If cloud is waking up or offline, the instantPreview is already visible!
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
  };

  // User clicked on a specific wall coordinate on the image
  const handleCanvasClick = (x, y) => {
    if (!file) return;
    triggerFullDetectionAndApply(
      file,
      selectedColor,
      selectedSheen,
      timeOfDay,
      intensity,
      lightStrength,
      x,
      y
    );
  };

  // Auto load room.jpg on initial mount with pre-rendered results (0s delay on mobile)
  useEffect(() => {
    let isMounted = true;

    async function loadSampleRoom() {
      try {
        // Immediately present pre-rendered default room and mask (zero waiting, zero delay on mobile)
        setOriginalImageSrc("/room.jpg");
        setResultImageSrc("/room_result.png");
        setMaskImageSrc("/room_mask.png");
        setComponents([
          { id: 1, label: 1, area: 318849, area_fraction: 0.66, centroid: [399, 249], bbox: [0, 0, 800, 600] }
        ]);
        setRecommendedColors(["#BBA3A3", "#86C4C4", "#CDB197", "#D09EB6", "#2F4F4F"]);

        // Fetch sample file in background so recoloring works immediately
        const res = await fetch("/room.jpg");
        if (res.ok && isMounted) {
          const blob = await res.blob();
          const sampleFile = new File([blob], "room.jpg", { type: "image/jpeg" });
          setFile(sampleFile);
        }

        // Fetch mask blob and convert to base64 so bucket clicks are active
        const maskRes = await fetch("/room_mask.png");
        if (maskRes.ok && isMounted) {
          const maskBlob = await maskRes.blob();
          const maskReader = new FileReader();
          maskReader.onload = (e) => {
            if (isMounted && e.target?.result) {
              const b64 = e.target.result.split(",")[1];
              setMaskB64(b64);
            }
          };
          maskReader.readAsDataURL(maskBlob);
        }
      } catch (err) {
        // Silently handled
      }
    }

    loadSampleRoom();

    return () => {
      isMounted = false;
    };
  }, []);

  // Update handlers
  const handleColorChange = (newColor) => {
    setSelectedColor(newColor);
    if (maskB64) {
      triggerFastRecolor(newColor, selectedSheen, timeOfDay, intensity, lightStrength);
    }
  };

  const handleSheenChange = (newSheen) => {
    setSelectedSheen(newSheen);
    if (maskB64) {
      triggerFastRecolor(selectedColor, newSheen, timeOfDay, intensity, lightStrength);
    }
  };

  const handleTimeOfDayChange = (newTod) => {
    setTimeOfDay(newTod);
    if (maskB64) {
      triggerFastRecolor(selectedColor, selectedSheen, newTod, intensity, lightStrength);
    }
  };

  const handleIntensityChange = (newIntensity) => {
    setIntensity(newIntensity);
    if (maskB64) {
      triggerFastRecolor(selectedColor, selectedSheen, timeOfDay, newIntensity, lightStrength);
    }
  };

  const handleLightStrengthChange = (newStr) => {
    setLightStrength(newStr);
    if (maskB64) {
      triggerFastRecolor(selectedColor, selectedSheen, timeOfDay, intensity, newStr);
    }
  };

  // Quick Action Handlers matching screenshot buttons
  const handleExport = () => {
    if (!resultImageSrc) {
      alert("Please upload and paint a room first to export.");
      return;
    }
    const link = document.createElement("a");
    link.href = resultImageSrc;
    link.download = `wallaura-room-${selectedColor.replace("#", "")}.png`;
    link.click();
  };

  const handleShare = () => {
    const text = `WallAura Paint Spec: ${activeColorMeta.name} (${selectedColor}), Finish: ${selectedSheen}, Sun: ${timeOfDay} - Powered by GGR & Sons Hardware Shop`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      alert(`Copied Paint Spec (${selectedColor}) to clipboard!`);
    } else {
      alert(text);
    }
  };

  const handleApplyRecommendation = (harmony) => {
    setSelectedColor(harmony.primary.hex);
    if (harmony.recommendedSheen) {
      setSelectedSheen(harmony.recommendedSheen);
    }
    if (harmony.recommendedLighting) {
      setTimeOfDay(harmony.recommendedLighting);
    }
    if (maskB64) {
      triggerFastRecolor(
        harmony.primary.hex,
        harmony.recommendedSheen || selectedSheen,
        harmony.recommendedLighting || timeOfDay,
        intensity,
        lightStrength
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0e0d1e] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar with 3D GGR & Sons Badge */}
      <Navbar
        backendConnected={backendConnected}
        setBackendConnected={setBackendConnected}
      />

      <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Error notification banner */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-2.5">
              <svg className="w-5 h-5 text-rose-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg("")}
              className="text-rose-400 hover:text-white px-2 py-1 rounded"
            >
              ✕
            </button>
          </div>
        )}

        {/* 3D Acrylic Paint Studio Hero Banner with Toggle */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-300">
                3D Interactive Acrylic Paint Studio
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShow3DStudio(!show3DStudio)}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#1c1a38] border border-white/10"
            >
              <span>{show3DStudio ? "Collapse 3D Studio" : "Expand 3D Studio"}</span>
              <svg
                className={`w-3.5 h-3.5 transform transition-transform ${show3DStudio ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {show3DStudio && (
            <div className="transition-all duration-500">
              <Paint3DScene
                selectedColor={selectedColor}
                onColorSelect={handleColorChange}
              />
            </div>
          )}
        </section>

        {/* Room Canvas Visualizer Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-300">
                Live Room Segmentation & Color Preview
              </h2>
            </div>
            {originalImageSrc && (
              <div className="flex items-center gap-4 text-xs">
                <label className="hover:text-indigo-400 cursor-pointer flex items-center gap-1.5 transition-colors text-slate-300">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Upload Custom Room</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          <RoomCanvas
            originalImageSrc={originalImageSrc}
            resultImageSrc={resultImageSrc}
            maskImageSrc={maskImageSrc}
            components={components}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onCanvasClick={handleCanvasClick}
            onImageUpload={handleImageUpload}
            loading={loading}
            loadingStatus={loadingStatus}
            selectedColor={selectedColor}
          />
        </section>

        {/* Futuristic 3-Column Color Dashboard Directly Matching the Reference Screenshot */}
        <section className="space-y-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between px-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-pink-500 to-indigo-600 text-white shadow-md shadow-pink-500/20">
                  WallAura Pro Suite
                </span>
                <h2 className="text-lg font-black tracking-tight text-white">
                  Futuristic Color Studio & Recommendation Dashboard
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-dimensional architectural telemetry, stacked gradient harmonies & photometric controls
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-start">
            {/* Column 1: Left Controls (4 Cols) - 4 Gradient Sliders, Neon Pills, Sheen, 550 Library */}
            <div className="lg:col-span-4 space-y-6">
              <LightingControls
                intensity={intensity}
                onIntensityChange={handleIntensityChange}
                timeOfDay={timeOfDay}
                onTimeOfDayChange={handleTimeOfDayChange}
                lightStrength={lightStrength}
                onLightStrengthChange={handleLightStrengthChange}
                specularBoost={specularBoost}
                onSpecularBoostChange={setSpecularBoost}
                onExport={handleExport}
                onShare={handleShare}
                onOpenNew={() => {
                  if (file) {
                    triggerFullDetectionAndApply(
                      file,
                      selectedColor,
                      selectedSheen,
                      timeOfDay,
                      intensity,
                      lightStrength
                    );
                  }
                }}
                onSettings={() => {
                  window.open(`${CLOUD_API_URL}/docs`, "_blank");
                }}
              />

              <SheenSelector
                selectedSheen={selectedSheen}
                onSheenChange={handleSheenChange}
              />

              <ColorPicker
                selectedColor={selectedColor}
                onColorChange={handleColorChange}
                recommendedColors={recommendedColors}
                dominantColors={dominantColors}
              />
            </div>

            {/* Column 2: Middle Column (4 Cols) - Stacked Gradient Cards Matching Screenshot */}
            <div className="lg:col-span-4 space-y-6">
              <ColorRecommendationEngine
                selectedColor={selectedColor}
                onApplyRecommendation={handleApplyRecommendation}
              />
            </div>

            {/* Column 3: Right Column (4 Cols) - 4 Radial Gauges & Wave Spectrum Chart */}
            <div className="lg:col-span-4 space-y-6">
              <AnalyticsGauges
                wallCoverage={85}
                lightingFidelity={94}
                harmonyScore={96}
                pigmentSaturation={Math.round(intensity * 100)}
                activeColorName={activeColorMeta.name}
                activeColorHex={selectedColor}
                activeCategory={activeColorMeta.category}
              />

              <LuminanceSpectrumChart
                selectedColor={selectedColor}
                timeOfDay={timeOfDay}
                intensity={intensity}
              />
            </div>
          </div>
        </section>
      </main>

      {/* Footer with GGR & Sons Hardware Shop Recognition */}
      <footer className="rounded-t-3xl bg-[#121124] border-t border-white/10 py-6 px-6 text-center text-xs text-slate-400 mt-12 space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="font-extrabold text-white text-sm tracking-wide">WallAura v2.0</span>
          <span className="text-slate-600">•</span>
          <span className="badge-3d-hardware rounded-lg px-2.5 py-1 text-[11px] font-bold text-amber-300">
            Powered by GGR & Sons Hardware Shop
          </span>
          <span className="text-slate-600">•</span>
          <span>Photometric SegFormer AI</span>
          <span className="text-slate-600">•</span>
          <span>PBR Microfacet BRDF</span>
          <span className="text-slate-600">•</span>
          <span>550 Architectural Colors</span>
        </div>
        <p className="text-[11px] text-slate-500">
          Hyper-realistic real-time wall segmentation and color visualization system. All paint codes calibrated for physical tinting.
        </p>
      </footer>
    </div>
  );
}
