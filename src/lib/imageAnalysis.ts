// Single-image analysis — simulated YOLOv8 + AgriClassMapper pass over a still frame.
import { AgriClassMapper, type Track } from "./agri";

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)] as T;

export interface ImageAnalysisResult {
  detections: Track[];
  crops: number;
  pests: number;
  avgConf: number;
  durationMs: number;
}

/** Runs a simulated detection pass over an image of the given dimensions. */
export function analyzeImage(
  width: number,
  height: number,
  bias: "balanced" | "crops" | "pests" = "balanced",
): ImageAnalysisResult {
  const start = performance.now();
  const cropCount =
    bias === "pests" ? Math.round(rand(2, 5)) : Math.round(rand(6, 12));
  const pestCount =
    bias === "crops" ? Math.round(rand(0, 2)) : Math.round(rand(3, 9));

  const detections: Track[] = [];
  let id = 1;
  const make = (category: "crop" | "pest") => {
    const isCrop = category === "crop";
    const size = isCrop ? rand(0.1, 0.18) * width : rand(0.05, 0.1) * width;
    detections.push({
      id: id++,
      cocoClass: isCrop ? pick(AgriClassMapper.crops) : pick(AgriClassMapper.pests),
      category,
      conf: rand(0.68, 0.97),
      cx: rand(size, width - size),
      cy: rand(size, height - size),
      w: size,
      h: size * rand(0.8, 1.15),
      vx: 0,
      vy: 0,
      speed: 0,
      trail: [],
    });
  };
  for (let i = 0; i < cropCount; i++) make("crop");
  for (let i = 0; i < pestCount; i++) make("pest");

  const avgConf = detections.reduce((s, d) => s + d.conf, 0) / (detections.length || 1);
  return {
    detections,
    crops: cropCount,
    pests: pestCount,
    avgConf,
    durationMs: Math.round(performance.now() - start + rand(28, 90)),
  };
}
