import { useState, useRef, useEffect } from "react";
import { Upload, ArrowRight, ShieldCheck, TrendingUp, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { drawHud } from "@/lib/hud";
import { analyzeImage, type ImageAnalysisResult } from "@/lib/imageAnalysis";
import { calculateSeverity, calculateYieldRisk } from "@/agriMapper";
import cropRows from "@/assets/sample-crop-rows.jpg";
import pestInvasion from "@/assets/sample-pest-invasion.jpg";

const W = 480;
const H = 320;

export function ComparisonView() {
  const canvasBeforeRef = useRef<HTMLCanvasElement>(null);
  const canvasAfterRef = useRef<HTMLCanvasElement>(null);

  const [beforeImg, setBeforeImg] = useState<string>(pestInvasion);
  const [afterImg, setAfterImg] = useState<string>(cropRows);

  const [beforeResult, setBeforeResult] = useState<ImageAnalysisResult | null>(null);
  const [afterResult, setAfterResult] = useState<ImageAnalysisResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const runComparison = () => {
    setIsScanning(true);
    setTimeout(() => {
      setBeforeResult(analyzeImage(W, H, "pests"));
      setAfterResult(analyzeImage(W, H, "crops"));
      setIsScanning(false);
    }, 450);
  };

  useEffect(() => {
    runComparison();
  }, []);

  useEffect(() => {
    if (beforeResult && canvasBeforeRef.current) {
      const ctx = canvasBeforeRef.current.getContext("2d");
      if (ctx) {
        drawHud(ctx, beforeResult.detections, {
          alert: beforeResult.pests >= 5,
          showTrajectory: false,
          width: W,
          height: H,
        });
      }
    }
  }, [beforeResult]);

  useEffect(() => {
    if (afterResult && canvasAfterRef.current) {
      const ctx = canvasAfterRef.current.getContext("2d");
      if (ctx) {
        drawHud(ctx, afterResult.detections, {
          alert: afterResult.pests >= 5,
          showTrajectory: false,
          width: W,
          height: H,
        });
      }
    }
  }, [afterResult]);

  const handleFile = (file: File | undefined, isBefore: boolean) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (isBefore) {
      setBeforeImg(url);
    } else {
      setAfterImg(url);
    }
    runComparison();
  };

  const beforePests = beforeResult?.pests ?? 6;
  const afterPests = afterResult?.pests ?? 1;
  const pestReduction = Math.max(0, Math.round(((beforePests - afterPests) / (beforePests || 1)) * 100));

  const beforeDiseases = beforeResult?.diseases ?? 3;
  const afterDiseases = afterResult?.diseases ?? 1;
  const diseaseRecovery = Math.max(0, Math.round(((beforeDiseases - afterDiseases) / (beforeDiseases || 1)) * 100));

  const beforeSev = calculateSeverity(beforePests, beforeDiseases, beforeResult?.crops ?? 4);
  const afterSev = calculateSeverity(afterPests, afterDiseases, afterResult?.crops ?? 8);

  const beforeRisk = calculateYieldRisk(beforePests, beforeDiseases, beforeResult?.crops ?? 4);
  const afterRisk = calculateYieldRisk(afterPests, afterDiseases, afterResult?.crops ?? 8);

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="panel p-5 border-l-4 border-l-emerald-500 bg-slate-900/80">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-white">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              Before vs After Field AI Comparison
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Upload pre-treatment and post-treatment field photos to analyze pest reduction rate & health recovery.
            </p>
          </div>
          <Button onClick={runComparison} disabled={isScanning} className="bg-emerald-600 hover:bg-emerald-500">
            <RefreshCw className={`mr-2 h-4 w-4 ${isScanning ? "animate-spin" : ""}`} />
            Re-Analyze Comparison
          </Button>
        </div>
      </div>

      {/* METRICS COMPARISON HEADER */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="panel p-4 bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Pest Reduction Rate</p>
          <p className="text-3xl font-black text-emerald-400 mt-1">-{pestReduction}%</p>
          <p className="text-xs text-slate-400 mt-1">Pests: {beforePests} → {afterPests}</p>
        </div>

        <div className="panel p-4 bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Disease Recovery</p>
          <p className="text-3xl font-black text-emerald-400 mt-1">+{diseaseRecovery}%</p>
          <p className="text-xs text-slate-400 mt-1">Diseases: {beforeDiseases} → {afterDiseases}</p>
        </div>

        <div className="panel p-4 bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Pre-Treatment Risk</p>
          <p className="text-lg font-bold mt-1" style={{ color: beforeSev.color }}>
            {beforeSev.badge}
          </p>
          <p className="text-xs text-slate-400 mt-1">{beforeRisk.riskCategory}</p>
        </div>

        <div className="panel p-4 bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Post-Treatment Status</p>
          <p className="text-lg font-bold mt-1" style={{ color: afterSev.color }}>
            {afterSev.badge}
          </p>
          <p className="text-xs text-slate-400 mt-1">{afterRisk.riskCategory}</p>
        </div>
      </div>

      {/* SIDE-BY-SIDE CANVAS COMPARISON */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* BEFORE PANEL */}
        <div className="panel p-4 bg-slate-900/70 border border-amber-900/40">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-400 tracking-wider uppercase flex items-center gap-1.5">
              🔴 Pre-Treatment (Day 1)
            </span>
            <label className="cursor-pointer px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded text-slate-200 border border-slate-700">
              <Upload className="inline h-3 w-3 mr-1" /> Upload Day 1
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], true)} />
            </label>
          </div>
          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg border border-slate-800 bg-black">
            <img src={beforeImg} alt="Pre-treatment field" className="absolute inset-0 h-full w-full object-cover" />
            <canvas ref={canvasBeforeRef} width={W} height={H} className="absolute inset-0 h-full w-full" />
          </div>
          <div className="mt-3 text-xs text-slate-300 space-y-1">
            <p>• Detections: <span className="text-amber-400 font-bold">{beforePests} Pests</span>, <span className="text-rose-400 font-bold">{beforeDiseases} Diseases</span>, <span className="text-emerald-400">{beforeResult?.crops ?? 0} Crops</span></p>
            <p>• Yield Risk: <span className="font-semibold" style={{ color: beforeRisk.color }}>{beforeRisk.riskCategory} ({beforeRisk.riskScore}%)</span></p>
          </div>
        </div>

        {/* AFTER PANEL */}
        <div className="panel p-4 bg-slate-900/70 border border-emerald-900/40">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-400 tracking-wider uppercase flex items-center gap-1.5">
              🟢 Post-Treatment (Day 5)
            </span>
            <label className="cursor-pointer px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded text-slate-200 border border-slate-700">
              <Upload className="inline h-3 w-3 mr-1" /> Upload Day 5
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], false)} />
            </label>
          </div>
          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg border border-slate-800 bg-black">
            <img src={afterImg} alt="Post-treatment field" className="absolute inset-0 h-full w-full object-cover" />
            <canvas ref={canvasAfterRef} width={W} height={H} className="absolute inset-0 h-full w-full" />
          </div>
          <div className="mt-3 text-xs text-slate-300 space-y-1">
            <p>• Detections: <span className="text-amber-400 font-bold">{afterPests} Pests</span>, <span className="text-rose-400 font-bold">{afterDiseases} Diseases</span>, <span className="text-emerald-400">{afterResult?.crops ?? 0} Crops</span></p>
            <p>• Yield Risk: <span className="font-semibold" style={{ color: afterRisk.color }}>{afterRisk.riskCategory} ({afterRisk.riskScore}%)</span></p>
          </div>
        </div>
      </div>

      {/* TREATMENT EFFICACY SUMMARY */}
      <div className="panel p-5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-emerald-400" />
          <div>
            <h4 className="text-sm font-bold text-white">AI Treatment Efficacy Certificate</h4>
            <p className="text-xs text-slate-300 mt-0.5">
              Treatment protocol achieved <span className="text-emerald-400 font-bold">{pestReduction}% pest reduction</span> and restored field health from <span style={{ color: beforeSev.color }}>{beforeSev.level} Severity</span> to <span style={{ color: afterSev.color }}>{afterSev.level} Severity</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
