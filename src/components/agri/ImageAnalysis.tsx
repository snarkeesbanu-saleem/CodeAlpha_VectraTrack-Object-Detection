import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, ScanLine, Download, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { drawHud } from "@/lib/hud";
import { analyzeImage, type ImageAnalysisResult } from "@/lib/imageAnalysis";
import { downloadCsv, type CsvRow } from "@/lib/agri";
import { cn } from "@/lib/utils";
import cropRows from "@/assets/sample-crop-rows.jpg";
import pestInvasion from "@/assets/sample-pest-invasion.jpg";
import orchard from "@/assets/sample-orchard.jpg";
import fieldPlot from "@/assets/field-plot.jpg";

const W = 960;
const H = 540;

const SAMPLES = [
  { src: cropRows, label: "Broccoli rows", bias: "crops" as const },
  { src: pestInvasion, label: "Pest invasion", bias: "pests" as const },
  { src: orchard, label: "Orchard + livestock", bias: "balanced" as const },
  { src: fieldPlot, label: "Field plot", bias: "balanced" as const },
];

export function ImageAnalysis({ threshold }: { threshold: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [src, setSrc] = useState<string>(SAMPLES[0]!.src);
  const [bias, setBias] = useState<"balanced" | "crops" | "pests">("crops");
  const [result, setResult] = useState<ImageAnalysisResult | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    (nextBias = bias) => {
      setBusy(true);
      window.setTimeout(() => {
        setResult(analyzeImage(W, H, nextBias));
        setBusy(false);
      }, 420);
    },
    [bias],
  );

  useEffect(() => {
    run("crops");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Crops found", value: result?.crops ?? 0, tone: "text-crop" },
          { label: "Pests found", value: result?.pests ?? 0, tone: "text-pest" },
          {
            label: "Avg confidence",
            value: `${((result?.avgConf ?? 0) * 100).toFixed(0)}%`,
            tone: "text-foreground",
          },
          {
            label: "Inference",
            value: `${result?.durationMs ?? 0} ms`,
            tone: "text-foreground",
          },
        ].map((c) => (
          <div key={c.label} className="panel p-4">
            <p className="text-xs tracking-widest text-muted-foreground uppercase">{c.label}</p>
            <p className={cn("font-display mt-2 text-2xl font-bold", c.tone)}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="panel grid-lines relative overflow-hidden">
        <div className="relative mx-auto aspect-[16/9] w-full max-w-[960px]">
          <img
            src={src}
            alt="Field image under analysis"
            width={1088}
            height={608}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="absolute inset-0 h-full w-full"
          />
          <div className="absolute top-3 left-3 rounded bg-background/70 px-2 py-1 text-[11px] tracking-widest uppercase">
            {busy ? "Scanning…" : alert ? "⚠️ Pest alert" : "Single-frame analysis"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button asChild>
            <span>
              <Upload className="mr-2 h-4 w-4" /> Upload field image
            </span>
          </Button>
        </label>
        <Button variant="secondary" onClick={() => run()} disabled={busy}>
          <ScanLine className="mr-2 h-4 w-4" /> Re-run detection
        </Button>
        <Button variant="outline" onClick={exportCsv} disabled={!result}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="panel p-4">
        <p className="mb-3 flex items-center gap-2 text-xs tracking-widest text-muted-foreground uppercase">
          <Images className="h-4 w-4" /> Sample field images
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
                src === s.src ? "border-crop" : "border-border hover:border-crop/60",
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
              <span className="block px-2 py-1 text-[11px] text-muted-foreground">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel max-h-56 overflow-y-auto p-4">
        <p className="mb-2 text-xs tracking-widest text-muted-foreground uppercase">
          Detections in this image
        </p>
        <ul className="space-y-1 text-sm">
          {(result?.detections ?? []).map((d) => (
            <li key={d.id} className={d.category === "pest" ? "text-pest" : "text-crop"}>
              #{d.id} {d.category === "pest" ? "Pest" : "Crop"} [{d.cocoClass}] ·{" "}
              {(d.conf * 100).toFixed(0)}% · ({Math.round(d.cx)}, {Math.round(d.cy)})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
