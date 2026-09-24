/**
 * Cloud Vision & Ensemble AI Service for VectraTrack
 *
 * Combines:
 * 1. Roboflow YOLOv8: High-precision localization & bounding boxes for tiny insect pests & birds
 * 2. Hugging Face ViT: 98%+ Foliar Plant Disease Diagnosis & 400+ Avian Species Classification
 * 3. Local MobileNet/ByteTrack: Edge fallback when offline or without API keys
 */

import { AgriClassMapper, type Track } from "./agri";
import { CROP_DISPLAY, PEST_DISPLAY, DISEASE_DISPLAY } from "@/agriMapper";
import { detectRealAgricultureObjects, type SupportedCropContext } from "./visionModel";

export type AIEngineMode = "ensemble" | "roboflow" | "huggingface" | "local";

export interface StoredCloudConfig {
  roboflowKey: string;
  roboflowModel: string;
  hfToken: string;
  engineMode: AIEngineMode;
}

export interface DiseaseDiagnosis {
  rawLabel: string;
  cropName: string;
  diseaseName: string;
  confidence: number;
  treatmentAdvice: string;
  treatmentAdviceTa: string;
}

export interface BirdDiagnosis {
  speciesName: string;
  confidence: number;
  scientificName?: string;
  threatLevel: "Harmless" | "Grain-Feeder (Pest)" | "Predator (Beneficial)";
}

export interface EnsembleAnalysisResult {
  detections: (Track & { engineSource: "yolov8" | "huggingface" | "local" })[];
  crops: number;
  pests: number;
  diseases: number;
  avgConf: number;
  durationMs: number;
  engineUsed: string;
  diseaseDiagnosis?: DiseaseDiagnosis;
  birdDiagnosis?: BirdDiagnosis;
}

// ── LOCAL STORAGE CREDENTIAL HELPERS ───────────────────────────────────────────
const STORAGE_KEYS = {
  ROBOFLOW_KEY: "vectratrack_roboflow_key",
  ROBOFLOW_MODEL: "vectratrack_roboflow_model",
  HF_TOKEN: "vectratrack_hf_token",
  ENGINE_MODE: "vectratrack_engine_mode",
};

export function getStoredCloudConfig(): StoredCloudConfig {
  if (typeof window === "undefined") {
    return {
      roboflowKey: "",
      roboflowModel: "agricultural-pests/1",
      hfToken: "",
      engineMode: "ensemble",
    };
  }
  return {
    roboflowKey: localStorage.getItem(STORAGE_KEYS.ROBOFLOW_KEY) || "",
    roboflowModel: localStorage.getItem(STORAGE_KEYS.ROBOFLOW_MODEL) || "agricultural-pests/1",
    hfToken: localStorage.getItem(STORAGE_KEYS.HF_TOKEN) || "",
    engineMode: (localStorage.getItem(STORAGE_KEYS.ENGINE_MODE) as AIEngineMode) || "ensemble",
  };
}

export function saveStoredCloudConfig(config: Partial<StoredCloudConfig>): void {
  if (typeof window === "undefined") return;
  if (config.roboflowKey !== undefined) localStorage.setItem(STORAGE_KEYS.ROBOFLOW_KEY, config.roboflowKey.trim());
  if (config.roboflowModel !== undefined) localStorage.setItem(STORAGE_KEYS.ROBOFLOW_MODEL, config.roboflowModel.trim());
  if (config.hfToken !== undefined) localStorage.setItem(STORAGE_KEYS.HF_TOKEN, config.hfToken.trim());
  if (config.engineMode !== undefined) localStorage.setItem(STORAGE_KEYS.ENGINE_MODE, config.engineMode);
}

// ── IMAGE CONVERSION UTILITIES ────────────────────────────────────────────────
export async function imageElementToBlob(imgEl: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const w = imgEl.naturalWidth || imgEl.width || 800;
  const h = imgEl.naturalHeight || imgEl.height || 600;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create 2D canvas context");
  ctx.drawImage(imgEl, 0, 0, w, h);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to convert image to Blob"));
    }, "image/jpeg", 0.92);
  });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      if (base64) resolve(base64);
      else reject(new Error("Base64 conversion failed"));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── 1. ROBOFLOW YOLOV8 CLIENT ─────────────────────────────────────────────────
export interface RoboflowPrediction {
  x: number; // center x
  y: number; // center y
  width: number;
  height: number;
  class: string;
  confidence: number;
}

export async function detectWithRoboflow(
  blob: Blob,
  targetWidth: number,
  targetHeight: number,
  apiKey: string,
  modelId = "agricultural-pests/1",
  minConf = 0.40,
  lang: "en" | "ta" = "en"
): Promise<(Track & { engineSource: "yolov8" })[]> {
  const base64Image = await blobToBase64(blob);

  // Format endpoint URL
  const endpoint = `https://detect.roboflow.com/${modelId}?api_key=${apiKey}&confidence=${Math.round(minConf * 100)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: base64Image,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Roboflow API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const predictions: RoboflowPrediction[] = data.predictions || [];
  const srcW = data.image?.width || targetWidth;
  const srcH = data.image?.height || targetHeight;
  const scaleX = targetWidth / srcW;
  const scaleY = targetHeight / srcH;

  const tracks: (Track & { engineSource: "yolov8" })[] = [];
  let trackId = 1;

  for (const pred of predictions) {
    if (pred.confidence < minConf) continue;

    const rawCls = pred.class.toLowerCase().trim();
    const mapping = AgriClassMapper.map(rawCls, lang);

    // Determine category based on classification
    let category: "crop" | "pest" | "disease" = mapping.category === "ignored" ? "pest" : (mapping.category as any);
    if (rawCls.includes("crop") || rawCls.includes("leaf") || rawCls.includes("plant")) {
      category = "crop";
    }

    const cx = pred.x * scaleX;
    const cy = pred.y * scaleY;
    const w = pred.width * scaleX;
    const h = pred.height * scaleY;

    tracks.push({
      id: trackId++,
      cocoClass: rawCls,
      displayName: mapping.displayName || pred.class,
      emoji: mapping.emoji || "🪲",
      category,
      conf: pred.confidence,
      cx,
      cy,
      w,
      h,
      vx: 0,
      vy: 0,
      speed: 0,
      trail: [],
      engineSource: "yolov8",
    });
  }

  return tracks;
}

// ── 2. HUGGING FACE VIT & ZERO-SHOT CLIENT ────────────────────────────────────
// Model 1: Plant Disease Classification (98.4% Accuracy)
const HF_PLANT_DISEASE_MODEL = "dima806/crop_plant_disease_detection";
// Model 2: Bird Species Classification (96.8% Accuracy)
const HF_BIRD_SPECIES_MODEL = "dennisjooo/Birds-Classifier-ViT";
// Model 3: Zero-Shot Object Detection
const HF_OWL_DETECTION_MODEL = "google/owlvit-base-patch32";

export async function classifyDiseaseHuggingFace(
  blob: Blob,
  hfToken: string
): Promise<DiseaseDiagnosis | null> {
  const url = `https://api-inference.huggingface.co/models/${HF_PLANT_DISEASE_MODEL}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hfToken}`,
    },
    body: blob,
  });

  if (!res.ok) {
    console.warn("Hugging Face Plant Disease notice:", await res.text());
    return null;
  }

  const results: { label: string; score: number }[] = await res.json();
  if (!Array.isArray(results) || results.length === 0) return null;

  const top = results[0]!;
  const raw = top.label.replace(/___/g, " - ").replace(/_/g, " ");
  const parts = raw.split(" - ");
  const crop = parts[0] || "Crop";
  const disease = parts[1] || "Healthy / Normal";

  let treatmentEn = "Foliage in healthy condition. Maintain scheduled monitoring.";
  let treatmentTa = "பயிர் இலைகள் நல்ல நிலையில் உள்ளன. தொடர் கண்காணிப்பு செய்யவும்.";

  if (disease.toLowerCase().includes("blight")) {
    treatmentEn = "Apply Copper Oxychloride (2.5g/L) or Mancozeb to halt fungal/bacterial lesion expansion.";
    treatmentTa = "காப்பர் ஆக்ஸிகுளோரைடு (2.5g/லிட்டர்) தெளித்து கருகல் நோயை கட்டுப்படுத்தவும்.";
  } else if (disease.toLowerCase().includes("spot")) {
    treatmentEn = "Spray Propiconazole (1ml/L) or Carbendazim. Avoid overhead irrigation.";
    treatmentTa = "புரோபிகோனசோல் (1மிலி/லிட்டர்) தெளித்து இலைப்புள்ளி பரவலைத் தடுக்கவும்.";
  } else if (disease.toLowerCase().includes("rust")) {
    treatmentEn = "Apply Hexaconazole or Tebuconazole foliar spray during morning hours.";
    treatmentTa = "ஹெக்ஸாகோனசோல் தெளித்து துரு நோயை கட்டுப்படுத்தவும்.";
  } else if (disease.toLowerCase().includes("mildew")) {
    treatmentEn = "Apply Wettable Sulphur (2g/L) or Neem Oil (3ml/L) on affected canopies.";
    treatmentTa = "நனைக்கக்கூடிய கந்தகம் (2g/L) அல்லது வேப்பெண்ணெய் தெளிக்கவும்.";
  }

  return {
    rawLabel: top.label,
    cropName: crop,
    diseaseName: disease,
    confidence: Number((top.score * 100).toFixed(1)),
    treatmentAdvice: treatmentEn,
    treatmentAdviceTa: treatmentTa,
  };
}

export async function classifyBirdHuggingFace(
  blob: Blob,
  hfToken: string
): Promise<BirdDiagnosis | null> {
  const url = `https://api-inference.huggingface.co/models/${HF_BIRD_SPECIES_MODEL}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hfToken}`,
    },
    body: blob,
  });

  if (!res.ok) {
    console.warn("Hugging Face Bird Species notice:", await res.text());
    return null;
  }

  const results: { label: string; score: number }[] = await res.json();
  if (!Array.isArray(results) || results.length === 0) return null;

  const top = results[0]!;
  const name = top.label.toUpperCase();

  let threat: BirdDiagnosis["threatLevel"] = "Harmless";
  if (name.includes("CROW") || name.includes("SPARROW") || name.includes("PIGEON") || name.includes("WEAVER")) {
    threat = "Grain-Feeder (Pest)";
  } else if (name.includes("OWL") || name.includes("KESTREL") || name.includes("HAWK")) {
    threat = "Predator (Beneficial)";
  }

  return {
    speciesName: top.label,
    confidence: Number((top.score * 100).toFixed(1)),
    threatLevel: threat,
  };
}

// ── 3. ENSEMBLE PIPELINE RUNNER ──────────────────────────────────────────────
export async function runEnsembleInference(
  imageEl: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  opts: {
    confThreshold: number;
    lang: "en" | "ta";
    cropContext: SupportedCropContext;
    config: StoredCloudConfig;
  }
): Promise<EnsembleAnalysisResult> {
  const startTime = performance.now();
  const { confThreshold, lang, cropContext, config } = opts;
  const { roboflowKey, roboflowModel, hfToken, engineMode } = config;

  let detections: (Track & { engineSource: "yolov8" | "huggingface" | "local" })[] = [];
  let diseaseDiag: DiseaseDiagnosis | undefined;
  let birdDiag: BirdDiagnosis | undefined;
  let engineUsed = "Local MobileNet + ByteTrack";

  const hasRoboflow = Boolean(roboflowKey && roboflowKey.trim().length > 5);
  const hasHf = Boolean(hfToken && hfToken.trim().length > 5);

  // If user requested cloud/ensemble and at least one API key is present:
  if ((engineMode === "ensemble" || engineMode === "roboflow" || engineMode === "huggingface") && (hasRoboflow || hasHf)) {
    try {
      const blob = await imageElementToBlob(imageEl);

      // Branch 1: Roboflow YOLOv8 Object Detection
      if ((engineMode === "ensemble" || engineMode === "roboflow") && hasRoboflow) {
        try {
          const rfTracks = await detectWithRoboflow(
            blob,
            targetWidth,
            targetHeight,
            roboflowKey,
            roboflowModel,
            confThreshold,
            lang
          );
          if (rfTracks.length > 0) {
            detections.push(...rfTracks);
            engineUsed = engineMode === "ensemble" ? "Ensemble (YOLOv8 + Hugging Face)" : "Roboflow YOLOv8 Cloud";
          }
        } catch (rfErr) {
          console.warn("Roboflow inference failed, continuing ensemble:", rfErr);
        }
      }

      // Branch 2: Hugging Face Deep ViT Classifications
      if ((engineMode === "ensemble" || engineMode === "huggingface") && hasHf) {
        try {
          // Run disease classification
          const dPromise = classifyDiseaseHuggingFace(blob, hfToken);
          // Check if bird is detected to trigger avian classifier
          const hasBird = detections.some((d) => d.cocoClass.includes("bird") || d.displayName.toLowerCase().includes("bird"));
          const bPromise = hasBird ? classifyBirdHuggingFace(blob, hfToken) : Promise.resolve(null);

          const [dRes, bRes] = await Promise.all([dPromise, bPromise]);
          if (dRes) diseaseDiag = dRes;
          if (bRes) {
            birdDiag = bRes;
            // Refine bird track label if present
            for (const t of detections) {
              if (t.cocoClass.includes("bird") || t.displayName.toLowerCase().includes("bird")) {
                t.displayName = `${bRes.speciesName} (${bRes.threatLevel})`;
                t.emoji = "🐦";
                t.conf = Math.max(t.conf, bRes.confidence / 100);
              }
            }
          }
          if (!engineUsed.includes("Ensemble")) {
            engineUsed = "Hugging Face ViT Cloud";
          }
        } catch (hfErr) {
          console.warn("Hugging Face inference notice:", hfErr);
        }
      }
    } catch (e) {
      console.warn("Cloud pipeline error, falling back to local engine:", e);
    }
  }

  // Fallback: If no detections found from cloud or in local mode, run local engine
  if (detections.length === 0 || engineMode === "local") {
    const localTracks = await detectRealAgricultureObjects(imageEl, targetWidth, targetHeight, {
      minConfidence: confThreshold,
      lang,
      cropContext,
    });
    detections = localTracks.map((t) => ({ ...t, engineSource: "local" as const }));
    engineUsed = "Local MobileNet + ByteTrack (Edge)";
  }

  const crops = detections.filter((d) => d.category === "crop").length;
  const pests = detections.filter((d) => d.category === "pest").length;
  const diseases = detections.filter((d) => d.category === "disease").length;
  const avgConf = detections.length
    ? detections.reduce((acc, d) => acc + d.conf, 0) / detections.length
    : 0;

  return {
    detections,
    crops,
    pests,
    diseases,
    avgConf,
    durationMs: Math.round(performance.now() - startTime),
    engineUsed,
    diseaseDiagnosis: diseaseDiag,
    birdDiagnosis: birdDiag,
  };
}
