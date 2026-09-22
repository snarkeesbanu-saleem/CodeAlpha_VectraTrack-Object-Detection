import { Printer, Download, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCsv, downloadCsv, type CsvRow } from "@/lib/agri";
import type { TrackingState } from "./useTracking";
import { calculateSeverity, calculateYieldRisk, getRemediesForDetections } from "@/agriMapper";

export function Report({ state }: { state: TrackingState }) {
  const rows = state.rowsRef.current;
  const pestRows = rows.filter((r) => r.agri_class === "pest");
  const avgSpeed = pestRows.length ? pestRows.reduce((s, r) => s + r.speed, 0) / pestRows.length : 0;
  const avgConf = rows.length ? rows.reduce((s, r) => s + r.conf, 0) / rows.length : 0;
  const sample = rows.slice(-8);

  const severity = calculateSeverity(state.counts.pests, 1, state.counts.crops);
  const yieldRisk = calculateYieldRisk(state.counts.pests, 1, state.counts.crops);
  const remedies = getRemediesForDetections(
    state.visibleTracks.map((t) => ({ cocoClass: t.cocoClass, category: t.category }))
  );

  const stats = [
    ["Frames Processed", state.frame],
    ["Detection Rows Logged", rows.length],
    ["Peak Crop Count", state.totals.crops],
    ["Peak Pest Count", state.totals.maxPests],
    ["Outbreak Severity", severity.badge],
    ["Yield Loss Risk", yieldRisk.riskCategory],
    ["Avg Pest Speed", `${avgSpeed.toFixed(2)} px/frame`],
    ["Avg Detection Confidence", `${(avgConf * 100).toFixed(1)}%`],
  ] as const;

  const handlePrint = () => {
    window.print();
  };

  const handleCsvDownload = () => {
    downloadCsv("vectratrack-agricultural-audit-report.csv", rows as CsvRow[]);
  };

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="panel p-5 bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            Automated Agronomic Diagnostic Certificate & Report
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Auto-generated PDF/Print summary report from session telemetry and precision AI detection.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-500">
            <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
          </Button>
          <Button variant="outline" onClick={handleCsvDownload} className="border-slate-700">
            <Download className="mr-2 h-4 w-4" /> Export CSV Log
          </Button>
        </div>
      </div>

      {/* PRINTABLE DIAGNOSTIC CERTIFICATE */}
      <div className="panel p-8 bg-slate-950 border border-slate-800 rounded-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
              VectraTrack Agriculture v4.5
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              Field Telemetry & Outbreak Audit Report
            </h1>
          </div>
          <div className="text-right text-xs text-slate-400 font-mono">
            <p>Report Date: {new Date().toLocaleDateString()}</p>
            <p>Status: Verified Audit Log</p>
          </div>
        </div>

        {/* METRICS GRID */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3.5">
              <p className="text-[11px] tracking-widest text-slate-400 uppercase font-semibold">{k}</p>
              <p className="font-display mt-1 text-base font-bold text-white">{v}</p>
            </div>
          ))}
        </div>

        {/* SEVERITY ASSESSMENT */}
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg space-y-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" /> Agronomic Outbreak Severity Assessment
          </h3>
          <p className="text-xs text-slate-300">
            Current Outbreak Status: <span className="font-bold" style={{ color: severity.color }}>{severity.badge}</span> (Pest Density Ratio: {severity.pestDensity})
          </p>
          <p className="text-xs text-slate-400">{yieldRisk.description}</p>
        </div>

        {/* AI TREATMENT PLAN SUMMARY */}
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg space-y-3">
          <h3 className="text-sm font-bold text-white">Recommended Agronomic Treatment Plan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {remedies.map((r, i) => (
              <div key={i} className="p-3 bg-slate-950 border border-slate-800 rounded text-xs space-y-1">
                <p className="font-bold text-emerald-400">{r.target} [{r.type}]</p>
                <p className="text-slate-200">🇬🇧 {r.remedyEn}</p>
                <p className="text-emerald-300">🇮🇳 {r.remedyTa}</p>
                <p className="text-slate-400 font-mono">Dosage: {r.dosage}</p>
              </div>
            ))}
          </div>
        </div>

        {/* PIPELINE SYSTEM DIAGRAM */}
        <div>
          <h3 className="text-sm font-bold text-white mb-2">Detection Pipeline System Architecture</h3>
          <pre className="overflow-x-auto text-xs leading-relaxed text-slate-400 font-mono bg-slate-950 p-4 rounded-lg border border-slate-800">{`Video / Photo Input → Precision YOLOv8 Detector (Min Conf ≥ 0.58, Size ≥ 1,200 px²)
        ↓
AgriClassMapper → Dual Detection (🌱 Crop, 🐛 Pest, 🍂 Leaf Disease)
        ↓
CustomSortTracker (Kalman Filter + ByteTrack 2-Stage Occlusion Handling)
        ↓
PestAlertEngine → Severity Calculator + Yield Loss Risk Prediction Engine
        ↓
FieldBot AI Agronomist → Actionable Treatment Protocol (Organic/Chemical)`}</pre>
        </div>

        {/* CSV LOG SAMPLE */}
        <div>
          <h3 className="text-sm font-bold text-white mb-2">Logged Audit Data Sample</h3>
          <pre className="overflow-x-auto text-xs text-slate-400 font-mono bg-slate-950 p-4 rounded-lg border border-slate-800">
            {sample.length ? toCsv(sample) : "frame,track_id,agri_class,coco_class,conf,cx,cy,speed,alert"}
          </pre>
        </div>
      </div>
    </div>
  );
}
