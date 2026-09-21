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

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontFamily: "var(--font-mono)",
} as const;

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

  const kpis = [
    ["Frames processed", state.frame],
    ["Peak pest count", state.totals.maxPests],
    ["Alerts raised", state.totals.alerts],
    ["Rows logged", state.rowsRef.current.length],
  ] as const;

  return (
    <div className="space-y-4">
      <StatCards {...state.counts} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(([k, v]) => (
          <div key={k} className="panel p-4">
            <p className="text-[11px] tracking-widest text-muted-foreground uppercase">{k}</p>
            <p className="font-display mt-1 text-xl">{v}</p>
          </div>
        ))}
      </div>

      <div className="panel p-5">
        <p className="mb-4 text-xs tracking-widest text-muted-foreground uppercase">
          Crop vs pest count over time
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={state.series}>
              <defs>
                <linearGradient id="cropFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pestFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="frame" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontFamily: "var(--font-mono)",
                }}
              />
              <Area
                type="monotone"
                dataKey="crops"
                stroke="var(--chart-1)"
                fill="url(#cropFill)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="pests"
                stroke="var(--chart-2)"
                fill="url(#pestFill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel p-5">
        <p className="mb-1 text-xs tracking-widest text-muted-foreground uppercase">
          Pest invasion heatmap
        </p>
        <p className="mb-4 text-xs text-muted-foreground">
          Built from pest trajectory positions only — bright zones are the most invaded crop areas.
        </p>
        <canvas
          ref={heatRef}
          width={state.width}
          height={state.height}
          className="w-full rounded-lg border border-border"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <p className="mb-4 text-xs tracking-widest text-muted-foreground uppercase">
            Detections by COCO class
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakdown} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={80}
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--border)" }} />
                <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5">
          <p className="mb-4 text-xs tracking-widest text-muted-foreground uppercase">
            Average pest speed (px / frame)
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={speedSeries}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="frame" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="speed"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <p className="mb-3 text-xs tracking-widest text-muted-foreground uppercase">
          Alert timeline
        </p>
        {state.logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No alert events recorded yet.</p>
        ) : (
          <ol className="space-y-2 border-l border-border pl-4 text-sm">
            {state.logs.slice(0, 12).map((l) => (
              <li key={l.id} className="relative">
                <span
                  className={`absolute -left-[21px] top-2 h-2 w-2 rounded-full ${
                    l.level === "warn" ? "bg-alert" : "bg-crop"
                  }`}
                />
                <span className={l.level === "warn" ? "text-alert" : "text-crop"}>
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
