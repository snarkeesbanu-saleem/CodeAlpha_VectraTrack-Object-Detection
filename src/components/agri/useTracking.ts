import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CustomSortTracker,
  PestAlertEngine,
  type CsvRow,
  type FrameResult,
  type LogEntry,
  type Track,
} from "@/lib/agri";

export type ClassFilter = "all" | "crops" | "pests";

export interface Series {
  frame: number;
  crops: number;
  pests: number;
}

const WIDTH = 960;
const HEIGHT = 540;

export function useTracking(cropType = "paddy", lang: "en" | "ta" = "en") {
  const trackerRef = useRef(new CustomSortTracker(WIDTH, HEIGHT, cropType, lang));
  const alertRef = useRef(new PestAlertEngine(5));
  const rowsRef = useRef<CsvRow[]>([]);
  const heatRef = useRef<{ x: number; y: number }[]>([]);

  const [running, setRunning] = useState(false);
  const [threshold, setThreshold] = useState(5);
  const [filter, setFilter] = useState<ClassFilter>("all");
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [frameResult, setFrameResult] = useState<FrameResult | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [totals, setTotals] = useState({ crops: 0, pests: 0, maxPests: 0, alerts: 0 });

  useEffect(() => {
    alertRef.current.threshold = threshold;
  }, [threshold]);

  // Synchronize field crop and language with tracker
  useEffect(() => {
    trackerRef.current.setContext(cropType, lang);
  }, [cropType, lang]);

  const reset = useCallback(() => {
    trackerRef.current.seed(9, 3);
    alertRef.current = new PestAlertEngine(threshold);
    rowsRef.current = [];
    heatRef.current = [];
    setLogs([]);
    setSeries([]);
    setTotals({ crops: 0, pests: 0, maxPests: 0, alerts: 0 });
    setFrameResult(trackerRef.current.step());
  }, [threshold]);

  useEffect(() => {
    trackerRef.current.seed(9, 3);
    setFrameResult(trackerRef.current.step());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropType, lang]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = 0;
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      if (ts - last < 1000 / 24) return;
      last = ts;

      const tracker = trackerRef.current;
      // occasional pest ingress / egress into the field of view
      if (Math.random() < 0.012) tracker.spawn("pest");
      if (Math.random() < 0.008 && tracker.pestCount > 1) tracker.removePest();

      const result = tracker.step();
      const alertActive = result.pestCount >= alertRef.current.threshold;
      result.alert = alertActive;
      setFrameResult(result);

      const entry = alertRef.current.evaluate(result.pestCount, result.frame);
      if (entry) {
        setLogs((prev) => [entry, ...prev].slice(0, 60));
        if (entry.level === "warn") setTotals((t) => ({ ...t, alerts: t.alerts + 1 }));
      }

      for (const t of result.tracks) {
        if (t.category === "pest") heatRef.current.push({ x: t.cx, y: t.cy });
        rowsRef.current.push({
          frame: result.frame,
          track_id: t.id,
          agri_class: t.category,
          coco_class: t.cocoClass,
          conf: t.conf,
          cx: t.cx,
          cy: t.cy,
          speed: t.speed,
          alert: alertActive && t.category === "pest",
        });
      }
      if (rowsRef.current.length > 20000) rowsRef.current.splice(0, 5000);
      if (heatRef.current.length > 4000) heatRef.current.splice(0, 1000);

      if (result.frame % 6 === 0) {
        setSeries((prev) =>
          [...prev, { frame: result.frame, crops: result.cropCount, pests: result.pestCount }].slice(
            -60,
          ),
        );
      }
      setTotals((t) => ({
        ...t,
        crops: Math.max(t.crops, result.cropCount),
        pests: Math.max(t.pests, result.pestCount),
        maxPests: Math.max(t.maxPests, result.pestCount),
      }));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const visibleTracks: Track[] = useMemo(() => {
    const tracks = frameResult?.tracks ?? [];
    if (filter === "crops") return tracks.filter((t) => t.category === "crop");
    if (filter === "pests") return tracks.filter((t) => t.category === "pest");
    return tracks;
  }, [frameResult, filter]);

  const counts = useMemo(() => {
    const tracks = frameResult?.tracks ?? [];
    const crops = tracks.filter((t) => t.category === "crop").length;
    const pests = tracks.filter((t) => t.category === "pest").length;
    return { crops, pests, active: crops + pests, alert: pests >= threshold };
  }, [frameResult, threshold]);

  return {
    width: WIDTH,
    height: HEIGHT,
    running,
    setRunning,
    threshold,
    setThreshold,
    filter,
    setFilter,
    showTrajectory,
    setShowTrajectory,
    frame: frameResult?.frame ?? 0,
    visibleTracks,
    counts,
    logs,
    series,
    totals,
    reset,
    rowsRef,
    heatRef,
  };
}

export type TrackingState = ReturnType<typeof useTracking>;
