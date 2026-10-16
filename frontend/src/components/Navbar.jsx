"use client";

import { useEffect, useState } from "react";

export default function Navbar({ backendConnected, setBackendConnected }) {
  const [modelStatus, setModelStatus] = useState("Checking...");

  const CLOUD_API_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    "https://wallaura-wall-visualization-system.onrender.com";

  useEffect(() => {
    const checkHealth = async () => {
      const endpoints = [
        "/api/py/health",
        `${CLOUD_API_URL}/api/health`,
        ...(typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1")
          ? [
              "http://127.0.0.1:8000/api/health",
              "http://localhost:8000/api/health",
            ]
          : []),
      ];

      for (const url of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            if (data && data.status === "healthy") {
              setBackendConnected(true);
              setModelStatus("SegFormer ADE20K Active");
              return;
            }
          }
        } catch (err) {
          // Fall through to next endpoint
        }
      }
      setBackendConnected(false);
      setModelStatus("Waking AI Cloud (~30s)...");
    };

    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, [setBackendConnected, CLOUD_API_URL]);

  return (
    <header className="glass-panel sticky top-0 z-50 border-b border-white/10 px-6 py-3.5 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo and branding */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3.5">
            {/* Tool Heading */}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  WallAura
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  v2.0 PBR
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">AI-Powered Room Visualization & Relighting</p>
            </div>

            {/* Elegant Divider */}
            <div className="hidden sm:block h-8 w-[1px] bg-gradient-to-b from-transparent via-slate-600/60 to-transparent" />

            {/* Shop Branding: Powered by GGR & Sons Hardware shop */}
            <div className="badge-3d-hardware rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-lg">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                Powered by
              </span>
              <span className="text-3d-gold text-sm sm:text-base font-extrabold tracking-wide uppercase">
                GGR & Sons
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-300/95 tracking-wide uppercase px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/30 shadow-sm whitespace-nowrap">
                <svg className="w-2.5 h-2.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                Hardware Shop
              </span>
            </div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-slate-900/60 border border-slate-700/50 text-[11px] sm:text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                backendConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
              }`}
            />
            <span className="text-slate-300 font-medium whitespace-nowrap">{modelStatus}</span>
          </div>

          <a
            href={`${CLOUD_API_URL}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-md border border-slate-700/50 hover:bg-slate-800/50 transition-colors"
          >
            API Docs
          </a>
        </div>
      </div>
    </header>
  );
}
