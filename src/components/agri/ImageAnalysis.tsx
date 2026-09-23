import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  ScanLine,
  Download,
  Images,
  Sparkles,
  Cpu,
  Grid,
  ShieldCheck,
  AlertTriangle,
  Camera,
  Play,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { drawHud } from "@/lib/hud";
import { analyzeImageElement, type ImageAnalysisResult } from "@/lib/imageAnalysis";
import { downloadCsv, type CsvRow } from "@/lib/agri";
import {
  calculateSeverity,
  calculateYieldRisk,
  getRemediesForDetections,
  MIN_CONFIDENCE_THRESHOLD,
} from "@/agriMapper";
import { classifyImageQuality, type QualityMetrics } from "@/lib/imageQualityClassifier";
import { evaluateMultiTaskHead } from "@/lib/multiTaskHead";
import { useTranslation } from "@/i18n/TranslationContext";
import { cn } from "@/lib/utils";
import cropRows from "@/assets/sample-crop-rows.jpg";
import pestInvasion from "@/assets/sample-pest-invasion.jpg";
import orchard from "@/assets/sample-orchard.jpg";
import fieldPlot from "@/assets/field-plot.jpg";

const W = 960;
const H = 540;

const SAMPLES = [
  { src: orchard, label: "Fruit Orchard (Apple / Orange Trees)", bias: "crops" as const },
  { src: cropRows, label: "Crop Rows (Paddy / Vegetables)", bias: "crops" as const },
  { src: pestInvasion, label: "Field Pests & Animals (Insects / Wildlife)", bias: "pests" as const },
  { src: fieldPlot, label: "Bare Field / Soil Plot (Empty State)", bias: "none" as const },
];

export function ImageAnalysis({ threshold }: { threshold: number }) {
  const { lang } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [src, setSrc] = useState<string>(SAMPLES[0]!.src);
  const [result, setResult] = useState<ImageAnalysisResult | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [bypassGate, setBypassGate] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confThreshold, setConfThreshold] = useState(MIN_CONFIDENCE_THRESHOLD);

  const runDetection = useCallback(async () => {
    if (!imageRef.current) return;
    setBusy(true);

    try {
      if (!imageRef.current.complete) {
        await new Promise((resolve) => {
          if (imageRef.current) imageRef.current.onload = resolve;
          else resolve(null);
        });
      }

      // Step 1: Pre-Detection Image Quality Classifier
      const qm = classifyImageQuality(imageRef.current);
      setQualityMetrics(qm);

      // If quality is critically poor and user hasn't overridden, gate detection
      if (qm.isGated && !bypassGate) {
        setBusy(false);
        return;
      }

      // Step 2: Deep ML Inference (TensorFlow COCO-SSD + Foliage Analysis)
      const res = await analyzeImageElement(imageRef.current, W, H, confThreshold, lang);
      setResult(res);
    } catch (err) {
      console.error("Inference error:", err);
    } finally {
      setBusy(false);
    }
  }, [confThreshold, lang, bypassGate]);

  useEffect(() => {
    setBypassGate(false);
    runDetection();
  }, [src, confThreshold, runDetection]);

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
      showDensityGrid: showGrid,
    });
  }, [result, threshold, showGrid]);

  const onFile = (file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSrc(url);
  };

  const exportCsv = () => {
    if (!result) return;
    const rows: CsvRow[] = result.detections.map((d) => ({
      frame: 1,
      track_id: d.id,
      agri_class: d.category,
      coco_class: d.cocoClass,
      display_name: d.displayName,
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
      {/* CONFIDENCE & DENSITY GRID CONTROLLER */}
      <div className="panel p-4 bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="h-4 w-4" /> AI Neural Filter:
          </span>
          <span className="text-xs text-slate-300">
            Min Confidence: <strong className="text-emerald-400">{(confThreshold * 100).toFixed(0)}%</strong>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="range"
            min="0.30"
            max="0.85"
            step="0.05"
            value={confThreshold}
            onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
            className="w-40 accent-emerald-500 cursor-pointer"
          />
          <button
            type="button"
            onClick={() => setShowGrid((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg border font-bold transition cursor-pointer ${
              showGrid
                ? "bg-emerald-950 text-emerald-300 border-emerald-500"
                : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
            }`}
          >
            <Grid className="h-3.5 w-3.5" />
            <span>{showGrid ? "Hide Sector Grid (A1-D6)" : "Show Density Grid"}</span>
          </button>
        </div>
      </div>

      {/* 🔍 PRE-DETECTION IMAGE QUALITY CLASSIFIER GATING CARD */}
      {qualityMetrics && (
        <div
          className={`panel p-4 rounded-xl border-2 transition ${
            qualityMetrics.isGated && !bypassGate
              ? "bg-red-950/30 border-red-600"
              : qualityMetrics.verdict === "EXCELLENT"
              ? "bg-emerald-950/20 border-emerald-600/50"
              : "bg-amber-950/20 border-amber-600/50"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Pre-Detection Image Quality Classifier
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="px-2.5 py-0.5 rounded text-[11px] font-bold"
                style={{ backgroundColor: qualityMetrics.badgeColor, color: "#ffffff" }}
              >
                {qualityMetrics.statusBadge}
              </span>
              <span className="text-xs font-mono text-slate-300">
                Score: <strong>{qualityMetrics.overallQualityScore}/100</strong>
              </span>
            </div>
          </div>

          {/* Quality Metric Gauges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3">
            <div className="p-2.5 rounded bg-slate-950/70 border border-slate-800">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>Sharpness (Laplacian)</span>
                <span className="text-white font-bold">{qualityMetrics.sharpnessScore}%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{ width: `${qualityMetrics.sharpnessScore}%` }}
                />
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-950/70 border border-slate-800">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>Exposure (Lighting)</span>
                <span className="text-white font-bold">{qualityMetrics.exposureScore}%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="bg-sky-500 h-full rounded-full transition-all"
                  style={{ width: `${qualityMetrics.exposureScore}%` }}
                />
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-950/70 border border-slate-800">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>Dynamic Contrast</span>
                <span className="text-white font-bold">{qualityMetrics.contrastScore}%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full transition-all"
                  style={{ width: `${qualityMetrics.contrastScore}%` }}
                />
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-950/70 border border-slate-800">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>Vegetation Index</span>
                <span className="text-white font-bold">{qualityMetrics.vegetationIndex}%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all"
                  style={{ width: `${qualityMetrics.vegetationIndex}%` }}
                />
              </div>
            </div>
          </div>

          {/* Actionable recommendations & Gate Override */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-xs text-slate-300">
              💡 <em>{qualityMetrics.recommendations[0]}</em>
            </p>
            {qualityMetrics.isGated && !bypassGate && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setBypassGate(true);
                  runDetection();
                }}
                className="text-xs cursor-pointer"
              >
                Override & Run Detection Anyway
              </Button>
            )}
          </div>
        </div>
      )}

      {/* STAT CARDS & SEVERITY */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="panel p-4 bg-slate-900/60 border border-emerald-900/40">
          <p className="text-[11px] tracking-widest text-emerald-400 uppercase font-semibold">Crops / Plants</p>
          <p className="font-display mt-2 text-3xl font-bold text-emerald-400">{result?.crops ?? 0}</p>
        </div>

        <div className="panel p-4 bg-slate-900/60 border border-amber-900/40">
          <p className="text-[11px] tracking-widest text-amber-400 uppercase font-semibold">Pests / Animals</p>
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
            ref={imageRef}
            src={src}
            alt="Field image under analysis"
            width={1088}
            height={608}
            crossOrigin="anonymous"
            onLoad={runDetection}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <canvas ref={canvasRef} width={W} height={H} className="absolute inset-0 h-full w-full" />

          {/* STATUS overlays */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="rounded bg-black/80 px-2.5 py-1 text-[11px] font-mono text-emerald-400 border border-emerald-500/30">
              {busy ? "Running Neural Inference…" : alert ? "⚠️ PEST ALERT THRESHOLD EXCEEDED" : "TensorFlow.js COCO-SSD + ByteTrack"}
            </span>
            {showGrid && (
              <span className="rounded bg-emerald-950 px-2.5 py-1 text-[11px] font-mono text-emerald-300 border border-emerald-600">
                Grid: 24 Sectors (A1-D6)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex flex-wrap items-center gap-3">
        <label>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button asChild className="bg-emerald-600 hover:bg-emerald-500 cursor-pointer">
            <span>
              <Upload className="mr-2 h-4 w-4" /> Upload Farm / Animal / Plant Photo
            </span>
          </Button>
        </label>
        <Button variant="secondary" onClick={runDetection} disabled={busy}>
          <ScanLine className="mr-2 h-4 w-4 text-emerald-400" /> Re-Scan Image
        </Button>
        <Button variant="outline" onClick={exportCsv} disabled={!result} className="border-slate-700">
          <Download className="mr-2 h-4 w-4" /> Export CSV Report
        </Button>
      </div>

      {/* SAMPLE FIELD IMAGES */}
      <div className="panel p-4 bg-slate-900/60 border border-slate-800">
        <p className="mb-3 flex items-center gap-2 text-xs tracking-widest text-slate-400 uppercase font-semibold">
          <Images className="h-4 w-4 text-emerald-400" /> Pre-Set Agronomy & Farm Datasets
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setSrc(s.src)}
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

      {/* 🧬 MULTI-TASK JOINT HEAD DETECTIONS BREAKDOWN (PEST + DISEASE JOINT PREDICTIONS) */}
      {result && result.detections.length > 0 && (
        <div className="panel p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-400" />
              Multi-Task Joint Head: Pest & Disease Pathology ({result.detections.length} Targets)
            </h4>
            <span className="text-[11px] font-mono text-emerald-400">
              Joint Pathology Index (JPI) Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {result.detections.map((d) => {
              const multiTask = evaluateMultiTaskHead(d.cocoClass, d.conf, d.category);
              return (
                <div
                  key={d.id}
                  className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{d.emoji}</span>
                      <div>
                        <p className="font-bold text-white">{d.displayName}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-mono">
                          {d.category} · Target #{d.id}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                      {(d.conf * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* Multi-Task Pathology Bar */}
                  <div className="pt-1 border-t border-slate-900 space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400">Joint Pathology Index (JPI):</span>
                      <span className={`font-bold font-mono ${multiTask.jointPathologyIndex > 60 ? "text-red-400" : "text-amber-400"}`}>
                        {multiTask.jointPathologyIndex}/100
                      </span>
                    </div>

                    {multiTask.synergyDetected && multiTask.synergyDescription && (
                      <p className="text-[10px] text-amber-300 font-sans bg-amber-950/40 p-1 rounded border border-amber-800/40">
                        ⚠️ <strong>Disease Vector:</strong> {multiTask.synergyDescription}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  {rem.type}
                </span>
              </div>
              <p className="text-xs text-slate-200">{rem.remedyEn}</p>
              <p className="text-xs text-emerald-300 font-sans">{rem.remedyTa}</p>
              <p className="text-[11px] text-slate-400 font-mono">💊 Dosage: {rem.dosage}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
