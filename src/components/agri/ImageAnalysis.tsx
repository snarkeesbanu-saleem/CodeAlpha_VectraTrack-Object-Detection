import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, ScanLine, Download, Images, ShieldAlert, Sparkles, Activity, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { drawHud } from "@/lib/hud";
import { analyzeImage, type ImageAnalysisResult } from "@/lib/imageAnalysis";
import { downloadCsv, type CsvRow } from "@/lib/agri";
import {
  calculateSeverity,
  calculateYieldRisk,
  getRemediesForDetections,
  MIN_CONFIDENCE_THRESHOLD,
} from "@/agriMapper";
import { cn } from "@/lib/utils";
import cropRows from "@/assets/sample-crop-rows.jpg";
import pestInvasion from "@/assets/sample-pest-invasion.jpg";
import orchard from "@/assets/sample-orchard.jpg";
import fieldPlot from "@/assets/field-plot.jpg";

const W = 960;
const H = 540;

const SAMPLES = [
  { src: cropRows, label: "Healthy Crops (Broccoli)", bias: "crops" as const },
  { src: pestInvasion, label: "Pest Outbreak (Aphids/Mites)", bias: "pests" as const },
  { src: orchard, label: "Leaf Blight & Disease Spot", bias: "diseases" as const },
  { src: fieldPlot, label: "Blank Field / No Crops", bias: "none" as const },
];

export function ImageAnalysis({ threshold }: { threshold: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [src, setSrc] = useState<string>(SAMPLES[0]!.src);
  const [bias, setBias] = useState<"balanced" | "crops" | "pests" | "diseases" | "none">("crops");
  const [result, setResult] = useState<ImageAnalysisResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [confThreshold, setConfThreshold] = useState(MIN_CONFIDENCE_THRESHOLD);

  const run = useCallback(
    (nextBias = bias) => {
      setBusy(true);
      window.setTimeout(() => {
        setResult(analyzeImage(W, H, nextBias, confThreshold));
        setBusy(false);
      }, 380);
    },
    [bias, confThreshold],
  );

  useEffect(() => {
    run("crops");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confThreshold]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    if (!result) {
      ctx.clearRect(0, 0, W, H);
      return;
    }
    drawHud(ctx, result.detections, {
      alert: result.pests >= threshold,
      showTrajectory: false,
      width: W,
      height: H,
    });
  }, [result, threshold]);

  const onFile = (file?: File) => {
    if (!file) return;
    setSrc(URL.createObjectURL(file));
    setBias("balanced");
    run("balanced");
  };

  const exportCsv = () => {
    if (!result) return;
    const rows: CsvRow[] = result.detections.map((d) => ({
      frame: 1,
      track_id: d.id,
      agri_class: d.category,
      coco_class: d.cocoClass,
      conf: d.conf,
      cx: d.cx,
      cy: d.cy,
      speed: 0,
      alert: d.category === "pest" && result.pests >= threshold,
    }));
    downloadCsv("vectratrack-image-analysis.csv", rows);
  };

  const alert = !!result && result.pests >= threshold;
  const severity = calculateSeverity(result?.pests ?? 0, result?.diseases ?? 0, result?.crops ?? 0);
  const yieldRisk = calculateYieldRisk(result?.pests ?? 0, result?.diseases ?? 0, result?.crops ?? 0);
  const remedies = getRemediesForDetections(result?.detections ?? []);

  return (
    <div className="space-y-6">
      {/* CONFIDENCE & THRESHOLD CONTROLLER */}
      <div className="panel p-4 bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider">
            Precision Filter:
          </span>
          <span className="text-xs text-slate-300">
            Min Confidence Threshold: <strong className="text-emerald-400">{(confThreshold * 100).toFixed(0)}%</strong>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0.45"
            max="0.85"
            step="0.05"
            value={confThreshold}
            onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
            className="w-48 accent-emerald-500 cursor-pointer"
          />
          <span className="text-[11px] text-slate-400">Box Area Limit: ≥ 1,200 px²</span>
        </div>
      </div>

      {/* STAT CARDS & SEVERITY */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="panel p-4 bg-slate-900/60 border border-emerald-900/40">
          <p className="text-[11px] tracking-widest text-emerald-400 uppercase font-semibold">Crops Found</p>
          <p className="font-display mt-2 text-3xl font-bold text-emerald-400">{result?.crops ?? 0}</p>
        </div>

        <div className="panel p-4 bg-slate-900/60 border border-amber-900/40">
          <p className="text-[11px] tracking-widest text-amber-400 uppercase font-semibold">Pests Found</p>
          <p className="font-display mt-2 text-3xl font-bold text-amber-400">{result?.pests ?? 0}</p>
        </div>

        <div className="panel p-4 bg-slate-900/60 border border-rose-900/40">
          <p className="text-[11px] tracking-widest text-rose-400 uppercase font-semibold">Leaf Diseases</p>
          <p className="font-display mt-2 text-3xl font-bold text-rose-400">{result?.diseases ?? 0}</p>
        </div>

        <div className="panel p-4 bg-slate-900/60 border border-slate-800">
          <p className="text-[11px] tracking-widest text-slate-400 uppercase font-semibold">Outbreak Severity</p>
          <p className="font-display mt-2 text-lg font-bold" style={{ color: severity.color }}>
            {severity.badge}
          </p>
        </div>

        <div className="panel p-4 bg-slate-900/60 border border-slate-800">
          <p className="text-[11px] tracking-widest text-slate-400 uppercase font-semibold">Yield Loss Risk</p>
          <p className="font-display mt-2 text-base font-bold" style={{ color: yieldRisk.color }}>
            {yieldRisk.riskCategory}
          </p>
        </div>
      </div>

      {/* MAIN HUD IMAGE SCAN CANVAS */}
      <div className="panel grid-lines relative overflow-hidden rounded-xl border border-slate-800">
        <div className="relative mx-auto aspect-[16/9] w-full max-w-[960px] bg-black">
          <img
            src={src}
            alt="Field image under analysis"
            width={1088}
            height={608}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <canvas ref={canvasRef} width={W} height={H} className="absolute inset-0 h-full w-full" />

          {/* STATUS overlays */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="rounded bg-black/80 px-2.5 py-1 text-[11px] font-mono text-emerald-400 border border-emerald-500/30">
              {busy ? "Scanning Image…" : alert ? "⚠️ PEST ALERT THRESHOLD EXCEEDED" : "YOLOv8 Dual Detection Scan"}
            </span>
            {result?.quality && (
              <span
                className="rounded px-2.5 py-1 text-[11px] font-mono font-bold text-white shadow"
                style={{ backgroundColor: result.quality.badgeColor }}
              >
                {result.quality.statusText}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex flex-wrap items-center gap-3">
        <label>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
            <span>
              <Upload className="mr-2 h-4 w-4" /> Upload Field Photo
            </span>
          </Button>
        </label>
        <Button variant="secondary" onClick={() => run()} disabled={busy}>
          <ScanLine className="mr-2 h-4 w-4 text-emerald-400" /> Re-Scan Image
        </Button>
        <Button variant="outline" onClick={exportCsv} disabled={!result} className="border-slate-700">
          <Download className="mr-2 h-4 w-4" /> Export CSV Report
        </Button>
      </div>

      {/* SAMPLE FIELD IMAGES */}
      <div className="panel p-4 bg-slate-900/60 border border-slate-800">
        <p className="mb-3 flex items-center gap-2 text-xs tracking-widest text-slate-400 uppercase font-semibold">
          <Images className="h-4 w-4 text-emerald-400" /> Pre-Set Agronomy Datasets
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setSrc(s.src);
                setBias(s.bias);
                run(s.bias);
              }}
              className={cn(
                "group overflow-hidden rounded-lg border text-left transition",
                src === s.src ? "border-emerald-500 ring-1 ring-emerald-500" : "border-slate-800 hover:border-emerald-500/50",
              )}
            >
              <img
                src={s.src}
                alt={s.label}
                width={1088}
                height={608}
                loading="lazy"
                className="h-20 w-full object-cover transition group-hover:scale-105"
              />
              <span className="block px-2.5 py-1.5 text-[11px] text-slate-300 font-medium">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* AI TREATMENT RECOMMENDATION PANEL */}
      <div className="panel p-5 bg-slate-900/90 border border-emerald-800/40 rounded-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Sparkles className="h-5 w-5 text-emerald-400" />
          <div>
            <h3 className="text-sm font-bold text-white">AI Treatment Recommendation & Remedial Plan</h3>
            <p className="text-xs text-slate-400">Automated agronomy protocol matched to detected crop pests & diseases.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {remedies.map((rem, idx) => (
            <div key={idx} className="p-4 bg-slate-950/70 border border-slate-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400">{rem.target}</span>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  {rem.type} Protocol
                </span>
              </div>
              <p className="text-xs text-slate-200 font-medium">🇬🇧 {rem.remedyEn}</p>
              <p className="text-xs text-emerald-300/90 font-medium">🇮🇳 {rem.remedyTa}</p>
              <p className="text-[11px] text-slate-400 font-mono">Dosage: {rem.dosage}</p>
            </div>
          ))}
        </div>
      </div>

      {/* DETECTIONS LIST TABLE */}
      <div className="panel max-h-60 overflow-y-auto p-4 bg-slate-900/60 border border-slate-800">
        <p className="mb-2 text-xs tracking-widest text-slate-400 uppercase font-semibold">
          Active Detections (Confidence ≥ {(confThreshold * 100).toFixed(0)}%)
        </p>
        {!result?.detections || result.detections.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 italic text-center">ℹ️ No Crop / Pest / Disease Detected in this frame.</p>
        ) : (
          <ul className="space-y-1.5 text-xs font-mono">
            {result.detections.map((d) => (
              <li
                key={d.id}
                className={
                  d.category === "disease"
                    ? "text-rose-400"
                    : d.category === "pest"
                    ? "text-amber-400"
                    : "text-emerald-400"
                }
              >
                #{d.id} {d.category.toUpperCase()} [{d.cocoClass}] · Conf: {(d.conf * 100).toFixed(0)}% · Center: ({Math.round(d.cx)}, {Math.round(d.cy)})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
