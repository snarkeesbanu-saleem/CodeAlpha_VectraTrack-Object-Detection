import { toCsv } from "@/lib/agri";
import type { TrackingState } from "./useTracking";

export function Report({ state }: { state: TrackingState }) {
  const rows = state.rowsRef.current;
  const pestRows = rows.filter((r) => r.agri_class === "pest");
  const avgSpeed = pestRows.length
    ? pestRows.reduce((s, r) => s + r.speed, 0) / pestRows.length
    : 0;
  const avgConf = rows.length ? rows.reduce((s, r) => s + r.conf, 0) / rows.length : 0;
  const sample = rows.slice(-6);

  const stats = [
    ["Frames processed", state.frame],
    ["Detection rows logged", rows.length],
    ["Peak crop count", state.totals.crops],
    ["Peak pest count", state.totals.maxPests],
    ["Pest alerts raised", state.totals.alerts],
    ["Alert threshold", `${state.threshold} pests / frame`],
    ["Avg pest speed", `${avgSpeed.toFixed(2)} px/frame`],
    ["Avg detection confidence", `${(avgConf * 100).toFixed(1)}%`],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="panel p-6">
        <h2 className="text-xl font-bold">Session summary</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Auto-generated from the current monitoring session — ready to present.
        </p>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border bg-card/40 p-3">
              <dt className="text-[11px] tracking-widest text-muted-foreground uppercase">{k}</dt>
              <dd className="font-display mt-1 text-lg">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="panel p-6">
        <h3 className="text-base font-bold">Pipeline</h3>
        <pre className="mt-3 overflow-x-auto text-xs leading-relaxed text-muted-foreground">{`Video input (camera / uploaded field video)
        ↓
YOLOv8 detection (80 COCO classes)
        ↓
AgriClassMapper → crop / pest / ignored
        ↓
CustomSortTracker (Kalman + ByteTrack 2-stage association)
        ↓
Unique IDs · class-wise counting · pest-only trajectory
occlusion handling · PestAlertEngine
        ↓
Dashboard: live HUD · filters · statistics · CSV export`}</pre>
      </div>

      <div className="panel p-6">
        <h3 className="text-base font-bold">CSV sample (agriculture format)</h3>
        <pre className="mt-3 overflow-x-auto text-xs text-muted-foreground">
          {sample.length ? toCsv(sample) : "frame,track_id,agri_class,coco_class,conf,cx,cy,speed,alert"}
        </pre>
      </div>
    </div>
  );
}
