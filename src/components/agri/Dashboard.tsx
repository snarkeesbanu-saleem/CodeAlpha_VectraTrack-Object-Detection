import { useEffect, useMemo, useRef } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { drawHeatmap } from "@/lib/hud";
import type { TrackingState } from "./useTracking";
import { StatCards } from "./StatCards";
import { calculateSeverity, calculateYieldRisk } from "@/agriMapper";

const tooltipStyle = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  fontFamily: "monospace",
} as const;

// 7-day historical dataset for trend analytics
const HISTORICAL_7_DAYS = [
  { day: "Day 1 (Mon)", crops: 14, pests: 12, diseases: 6, health: 48 },
  { day: "Day 2 (Tue)", crops: 15, pests: 9, diseases: 5, health: 58 },
  { day: "Day 3 (Wed)", crops: 15, pests: 7, diseases: 4, health: 66 },
  { day: "Day 4 (Thu)", crops: 16, pests: 4, diseases: 3, health: 78 },
  { day: "Day 5 (Fri)", crops: 16, pests: 3, diseases: 2, health: 84 },
  { day: "Day 6 (Sat)", crops: 17, pests: 2, diseases: 1, health: 91 },
  { day: "Day 7 (Today)", crops: 18, pests: 1, diseases: 1, health: 95 },
];

export function Dashboard({ state }: { state: TrackingState }) {
  const heatRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = heatRef.current?.getContext("2d");
    if (!ctx) return;
    drawHeatmap(ctx, state.heatRef.current, state.width, state.height);
  }, [state.series, state.heatRef, state.width, state.height]);

  const breakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of state.rowsRef.current.slice(-4000)) {
      counts.set(r.coco_class, (counts.get(r.coco_class) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.series, state.rowsRef]);

  const speedSeries = useMemo(() => {
    const byFrame = new Map<number, { total: number; n: number }>();
    for (const r of state.rowsRef.current.slice(-3000)) {
      if (r.agri_class !== "pest") continue;
      const b = byFrame.get(r.frame) ?? { total: 0, n: 0 };
      b.total += r.speed;
      b.n += 1;
      byFrame.set(r.frame, b);
    }
    return [...byFrame.entries()]
      .map(([frame, b]) => ({ frame, speed: +(b.total / b.n).toFixed(2) }))
      .slice(-60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.series, state.rowsRef]);

  const severity = calculateSeverity(state.counts.pests, 2, state.counts.crops);
  const yieldRisk = calculateYieldRisk(state.counts.pests, 2, state.counts.crops);

  const kpis = [
    ["Frames processed", state.frame],
    ["Peak pest count", state.totals.maxPests],
    ["Outbreak Severity", severity.badge],
    ["Yield Loss Risk", yieldRisk.riskCategory],
  ] as const;

  return (
    <div className="space-y-6">
      <StatCards {...state.counts} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(([k, v]) => (
          <div key={k} className="panel p-4 bg-slate-900/60 border border-slate-800">
            <p className="text-[11px] tracking-widest text-slate-400 uppercase font-semibold">{k}</p>
            <p className="font-display mt-1 text-lg font-bold text-white">{v}</p>
          </div>
        ))}
      </div>

      {/* 7-DAY HISTORICAL TREND ANALYTICS CHART */}
      <div className="panel p-5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              📅 7-Day Historical Pest & Disease Trend
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Weekly pest outbreak, leaf disease progression, and health recovery curve.
            </p>
          </div>
          <span className="px-2.5 py-1 text-xs font-mono bg-emerald-950 text-emerald-400 rounded border border-emerald-800">
            Field Recovery: +47% Health Boost
          </span>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={HISTORICAL_7_DAYS}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="pests" name="Pest Count" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="diseases" name="Leaf Diseases" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="health" name="Health Score %" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* LIVE REALTIME CROP VS PEST CHART */}
      <div className="panel p-5 bg-slate-900/80 border border-slate-800 rounded-xl">
        <p className="mb-4 text-xs tracking-widest text-slate-400 uppercase font-semibold">
          Real-time Live Monitor Feed (Crop vs Pest Counts)
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={state.series}>
              <defs>
                <linearGradient id="cropFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pestFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="frame" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="crops" stroke="#22c55e" fill="url(#cropFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="pests" stroke="#f59e0b" fill="url(#pestFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* PEST INVASION HEATMAP */}
      <div className="panel p-5 bg-slate-900/80 border border-slate-800 rounded-xl">
        <p className="mb-1 text-xs tracking-widest text-slate-400 uppercase font-semibold">
          Spatial Field Invasion Heatmap (9-Zone Grid)
        </p>
        <p className="mb-4 text-xs text-slate-400">
          Built from pest trajectory coordinates — bright red/amber clusters highlight heavily infested plot zones.
        </p>
        <canvas
          ref={heatRef}
          width={state.width}
          height={state.height}
          className="w-full rounded-lg border border-slate-800"
        />
      </div>

      {/* DETECTIONS BREAKDOWN */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5 bg-slate-900/80 border border-slate-800">
          <p className="mb-4 text-xs tracking-widest text-slate-400 uppercase font-semibold">
            Detections by Class Category
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakdown} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={11} />
                <YAxis type="category" dataKey="name" width={80} stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#1e293b" }} />
                <Bar dataKey="value" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5 bg-slate-900/80 border border-slate-800">
          <p className="mb-4 text-xs tracking-widest text-slate-400 uppercase font-semibold">
            Average Pest Speed Velocity (px / frame)
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={speedSeries}>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis dataKey="frame" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="speed" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ALERT EVENT LOG */}
      <div className="panel p-5 bg-slate-900/80 border border-slate-800 rounded-xl">
        <p className="mb-3 text-xs tracking-widest text-slate-400 uppercase font-semibold">
          Alert Timeline Event Log
        </p>
        {state.logs.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No alert events recorded yet for this session.</p>
        ) : (
          <ol className="space-y-2 border-l border-slate-800 pl-4 text-xs font-mono">
            {state.logs.slice(0, 12).map((l) => (
              <li key={l.id} className="relative">
                <span
                  className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${
                    l.level === "warn" ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                />
                <span className={l.level === "warn" ? "text-amber-400" : "text-emerald-400"}>
                  {l.message}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
