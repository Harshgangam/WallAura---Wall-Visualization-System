"use client";

const SHEENS = [
  {
    id: "matte",
    name: "Matte",
    desc: "Flat velvety finish, zero glare, conceals surface imperfections",
    glossLevel: "0–5%",
    gradient: "from-slate-700 to-slate-900",
    activeGlow: "ring-slate-400 shadow-slate-500/30",
  },
  {
    id: "eggshell",
    name: "Eggshell",
    desc: "Soft low luster with gentle ambient diffusion (most popular)",
    glossLevel: "10–25%",
    gradient: "from-indigo-600 to-purple-700",
    activeGlow: "ring-indigo-400 shadow-indigo-500/30",
  },
  {
    id: "satin",
    name: "Satin",
    desc: "Silky pearl sheen with smooth directional highlights",
    glossLevel: "25–35%",
    gradient: "from-blue-600 to-cyan-600",
    activeGlow: "ring-cyan-400 shadow-cyan-500/30",
  },
  {
    id: "semi-gloss",
    name: "Semi-Gloss",
    desc: "Reflective sleek finish with crisp specular light bounce",
    glossLevel: "35–70%",
    gradient: "from-emerald-600 to-teal-700",
    activeGlow: "ring-emerald-400 shadow-emerald-500/30",
  },
  {
    id: "gloss",
    name: "High Gloss",
    desc: "Dramatic glass-like lacquer with mirror specular highlight",
    glossLevel: "70–90%",
    gradient: "from-amber-500 to-rose-600",
    activeGlow: "ring-amber-400 shadow-amber-500/30",
  },
];

export default function SheenSelector({ selectedSheen, onSheenChange }) {
  return (
    <div className="rounded-3xl bg-[#15142b]/90 border border-white/10 p-5 shadow-2xl backdrop-blur-xl space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Surface Finish
          </span>
          <h3 className="text-sm font-black text-white tracking-wide">
            Paint Sheen & Specular (BRDF)
          </h3>
        </div>
        <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          {SHEENS.find((s) => s.id === selectedSheen)?.glossLevel} Specular
        </span>
      </div>

      {/* Sheen pill selectors */}
      <div className="grid grid-cols-5 gap-2">
        {SHEENS.map((sheen) => {
          const isSelected = selectedSheen === sheen.id;
          return (
            <button
              key={sheen.id}
              type="button"
              onClick={() => onSheenChange(sheen.id)}
              className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl border transition-all text-center ${
                isSelected
                  ? `bg-gradient-to-b ${sheen.gradient} border-white/40 text-white ring-2 ${sheen.activeGlow} shadow-lg scale-105`
                  : "bg-[#1c1a38] border-white/5 text-slate-400 hover:text-slate-200 hover:bg-[#25224a]"
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full mb-1.5 transition-all shadow-sm"
                style={{
                  backgroundColor: isSelected ? "#ffffff" : "#64748b",
                  boxShadow: isSelected ? "0 0 8px #ffffff" : "none",
                }}
              />
              <span className="text-xs font-black truncate w-full">{sheen.name}</span>
              <span className="text-[9px] font-mono opacity-80 mt-0.5">{sheen.glossLevel}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400 italic pt-1">
        💡 {SHEENS.find((s) => s.id === selectedSheen)?.desc}
      </p>
    </div>
  );
}
