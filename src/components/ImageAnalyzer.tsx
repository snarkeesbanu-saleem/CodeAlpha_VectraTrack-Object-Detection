import React, { useState, useRef, useEffect } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import { Upload, Image as ImageIcon, Sparkles, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface ImageAnalyzerProps {
  confidenceThreshold: number;
}

interface ImageDetection {
  class: string;
  category: 'crop' | 'pest' | 'ignored';
  score: number;
  bbox: [number, number, number, number];
}

const SAMPLE_IMAGES = [
  {
    name: '🥦 Broccoli & Veggie Field',
    url: 'https://images.unsplash.com/photo-1584270354949-c26b0d5b4a0c?auto=format&fit=crop&w=800&q=80',
    desc: 'Simulated crop field with broccoli, carrots, and potted plants'
  },
  {
    name: '🍎 Apple Orchard',
    url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=800&q=80',
    desc: 'High-density fruit crop canopy'
  },
  {
    name: '🐦 Field Pest Infestation',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80',
    desc: 'Wildlife and bird pest activity near crop zones'
  }
];

export default function ImageAnalyzer({ confidenceThreshold }: ImageAnalyzerProps) {
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [isModelLoading, setIsModelLoading] = useState<boolean>(true);
  const [imageSrc, setImageSrc] = useState<string>(SAMPLE_IMAGES[0].url);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [detections, setDetections] = useState<ImageDetection[]>([]);
  const [cropCount, setCropCount] = useState<number>(0);
  const [pestCount, setPestCount] = useState<number>(0);

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load COCO-SSD model for image analysis
  useEffect(() => {
    let active = true;
    async function loadModel() {
      try {
        await tf.ready();
        const loadedModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        if (active) {
          setModel(loadedModel);
          setIsModelLoading(false);
        }
      } catch (err) {
        console.error('Failed to load TF model for ImageAnalyzer:', err);
        if (active) setIsModelLoading(false);
      }
    }
    loadModel();
    return () => { active = false; };
  }, []);

  // Run analysis whenever image changes or model loads
  const analyzeImage = async () => {
    if (!model || !imgRef.current || !canvasRef.current) return;

    setIsAnalyzing(true);
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Ensure canvas dimensions match image
    canvas.width = img.naturalWidth || img.width || 640;
    canvas.height = img.naturalHeight || img.height || 480;

    // Draw base image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    try {
      const predictions = await model.detect(img);

      const cropsSet = new Set(['apple', 'orange', 'broccoli', 'carrot', 'potted plant', 'banana', 'cake']);
      const pestsSet = new Set(['bird', 'mouse', 'cat', 'dog', 'bear', 'sheep', 'cow', 'rat']);

      let cCount = 0;
      let pCount = 0;

      const results: ImageDetection[] = predictions
        .filter(p => p.score >= confidenceThreshold)
        .map(p => {
          const cls = p.class.toLowerCase();
          const category: 'crop' | 'pest' | 'ignored' = cropsSet.has(cls) ? 'crop' : pestsSet.has(cls) ? 'pest' : 'ignored';
          
          if (category === 'crop') cCount++;
          if (category === 'pest') pCount++;

          return {
            class: p.class,
            category,
            score: p.score,
            bbox: p.bbox as [number, number, number, number]
          };
        });

      setDetections(results);
      setCropCount(cCount);
      setPestCount(pCount);

      // Draw bounding boxes on canvas
      results.forEach((det, idx) => {
        const [x, y, w, h] = det.bbox;
        const color = det.category === 'crop' ? '#22c55e' : det.category === 'pest' ? '#f59e0b' : '#64748b';

        // Box border
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);

        // Corner accents
        ctx.fillStyle = color;
        ctx.fillRect(x - 2, y - 2, 8, 8);
        ctx.fillRect(x + w - 6, y - 2, 8, 8);
        ctx.fillRect(x - 2, y + h - 6, 8, 8);
        ctx.fillRect(x + w - 6, y + h - 6, 8, 8);

        // Label background tag
        const labelText = `#${idx + 1} ${det.category.toUpperCase()}: ${det.class} (${(det.score * 100).toFixed(0)}%)`;
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        const textWidth = ctx.measureText(labelText).width;

        ctx.fillStyle = det.category === 'crop' ? 'rgba(22, 101, 52, 0.9)' : det.category === 'pest' ? 'rgba(146, 64, 14, 0.9)' : 'rgba(30, 41, 59, 0.9)';
        ctx.fillRect(x, Math.max(0, y - 22), textWidth + 12, 22);

        // Text label
        ctx.fillStyle = '#ffffff';
        ctx.fillText(labelText, x + 6, Math.max(15, y - 6));
      });

    } catch (err) {
      console.warn('Image analysis notice:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setImageSrc(evt.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Controls */}
      <div className="agri-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-emerald-400" />
            Static Agricultural Image Analyzer
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload field photographs or select preset sample images to run multi-class AI detection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.4)] transition"
          >
            <Upload className="w-4 h-4" />
            Upload Local Image
          </button>
        </div>
      </div>

      {/* Preset Sample Images */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {SAMPLE_IMAGES.map((sample) => (
          <button
            key={sample.name}
            onClick={() => setImageSrc(sample.url)}
            className={`agri-card p-3 text-left transition hover:border-emerald-500/50 ${imageSrc === sample.url ? 'border-emerald-500 bg-emerald-950/40' : ''}`}
          >
            <span className="font-bold text-xs text-emerald-400 block mb-1">{sample.name}</span>
            <p className="text-[11px] text-slate-400 line-clamp-2">{sample.desc}</p>
          </button>
        ))}
      </div>

      {/* Image Display & Bounding Box Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Canvas Area (8 Cols) */}
        <div className="lg:col-span-8 agri-card p-4 flex flex-col items-center">
          
          <div className="relative w-full max-w-2xl rounded-xl overflow-hidden bg-black border border-emerald-900/60 flex items-center justify-center min-h-[300px]">
            {/* Hidden Source Image */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Agricultural Crop"
              crossOrigin="anonymous"
              onLoad={analyzeImage}
              className="hidden"
            />

            {/* Bounding Box Overlay Canvas */}
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto rounded-lg shadow-2xl"
            />

            {/* Loading Indicator */}
            {(isModelLoading || isAnalyzing) && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 text-emerald-400 font-mono-tech text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                <span>Running Computer Vision Weights...</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between w-full mt-3 text-xs font-mono-tech text-slate-400">
            <span>Status: <strong className="text-emerald-400">{isAnalyzing ? 'Analyzing...' : 'Ready'}</strong></span>
            <span>Confidence Cutoff: <strong className="text-emerald-400">{(confidenceThreshold * 100).toFixed(0)}%</strong></span>
          </div>
        </div>

        {/* Results Breakdown Sidebar (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Summary Card */}
          <div className="agri-card p-4 space-y-3">
            <h4 className="text-xs font-mono-tech text-slate-400 uppercase tracking-wider">
              📊 Detection Summary
            </h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#09170e] p-3 rounded-lg border border-emerald-900/40 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-mono-tech block">CROPS DETECTED</span>
                <span className="text-2xl font-bold font-mono-tech text-emerald-400">{cropCount}</span>
              </div>
              <div className="bg-[#1c1308] p-3 rounded-lg border border-amber-900/40 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-mono-tech block">PESTS DETECTED</span>
                <span className="text-2xl font-bold font-mono-tech text-amber-400">{pestCount}</span>
              </div>
            </div>
          </div>

          {/* Detections List */}
          <div className="agri-card p-4 space-y-3">
            <h4 className="text-xs font-mono-tech text-slate-400 uppercase tracking-wider">
              📋 Bounding Box List ({detections.length})
            </h4>

            <div className="space-y-2 max-h-60 overflow-y-auto text-xs font-mono-tech">
              {detections.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No crops or pests detected above threshold.</p>
              ) : (
                detections.map((det, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border flex items-center justify-between ${
                      det.category === 'crop'
                        ? 'bg-[#09170e] border-emerald-900/50 text-emerald-300'
                        : det.category === 'pest'
                        ? 'bg-[#1c1308] border-amber-900/50 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div>
                      <span className="font-bold mr-1">#{idx + 1}</span>
                      <span>{det.class}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-black/40">
                      {(det.score * 100).toFixed(0)}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
