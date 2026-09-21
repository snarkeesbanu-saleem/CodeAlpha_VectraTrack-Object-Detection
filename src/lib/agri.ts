// VectraTrack Agriculture — class mapping, tracking simulation, alerts.

export type AgriCategory = "crop" | "pest" | "ignored";

const CROP_CLASSES = [
  "potted plant",
  "banana",
  "apple",
  "orange",
  "broccoli",
  "carrot",
  "cake",
];

const PEST_CLASSES = ["bird", "cat", "dog", "mouse", "bear", "sheep", "cow", "rat"];

export interface AgriMapping {
  category: AgriCategory;
  label: string;
  color: string;
}

/** AgriClassMapper — maps COCO-80 class names to agriculture categories. */
export const AgriClassMapper = {
  crops: CROP_CLASSES,
  pests: PEST_CLASSES,
  map(cocoClass: string): AgriMapping {
    if (CROP_CLASSES.includes(cocoClass))
      return { category: "crop", label: "Crop", color: "var(--crop)" };
    if (PEST_CLASSES.includes(cocoClass))
      return { category: "pest", label: "Pest", color: "var(--pest)" };
    return { category: "ignored", label: "Ignored", color: "var(--muted-foreground)" };
  },
};

export interface Track {
  id: number;
  cocoClass: string;
  category: Exclude<AgriCategory, "ignored">;
  conf: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  speed: number;
  trail: { x: number; y: number }[];
}

export interface FrameResult {
  frame: number;
  tracks: Track[];
  cropCount: number;
  pestCount: number;
  alert: boolean;
}

export interface LogEntry {
  id: string;
  frame: number;
  level: "info" | "warn";
  message: string;
}

export interface CsvRow {
  frame: number;
  track_id: number;
  agri_class: string;
  coco_class: string;
  conf: number;
  cx: number;
  cy: number;
  speed: number;
  alert: boolean;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)] as T;

/**
 * CustomSortTracker (simulation) — Kalman-style constant velocity update with
 * ByteTrack-inspired two-stage association: low-confidence detections keep
 * their ID alive through occlusion instead of being dropped.
 */
export class CustomSortTracker {
  private nextId = 1;
  private tracks: Track[] = [];
  frame = 0;

  constructor(
    private width = 960,
    private height = 540,
  ) {}

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  seed(cropCount = 9, pestCount = 3) {
    this.tracks = [];
    this.nextId = 1;
    this.frame = 0;
    for (let i = 0; i < cropCount; i++) this.spawn("crop");
    for (let i = 0; i < pestCount; i++) this.spawn("pest");
  }

  spawn(category: "crop" | "pest") {
    const isCrop = category === "crop";
    const size = isCrop ? rand(90, 150) : rand(48, 80);
    const track: Track = {
      id: this.nextId++,
      cocoClass: isCrop ? pick(CROP_CLASSES) : pick(PEST_CLASSES),
      category,
      conf: rand(0.72, 0.97),
      cx: rand(size, this.width - size),
      cy: rand(size, this.height - size),
      w: size,
      h: size * rand(0.8, 1.1),
      vx: isCrop ? 0 : rand(-4.5, 4.5),
      vy: isCrop ? 0 : rand(-3.5, 3.5),
      speed: 0,
      trail: [],
    };
    this.tracks.push(track);
    return track;
  }

  removePest() {
    const idx = this.tracks.findIndex((t) => t.category === "pest");
    if (idx >= 0) this.tracks.splice(idx, 1);
  }

  get pestCount() {
    return this.tracks.filter((t) => t.category === "pest").length;
  }

  step(): FrameResult {
    this.frame++;
    for (const t of this.tracks) {
      if (t.category === "pest") {
        // Kalman-style predict + slight process noise
        t.vx += rand(-0.35, 0.35);
        t.vy += rand(-0.3, 0.3);
        t.vx = Math.max(-6, Math.min(6, t.vx));
        t.vy = Math.max(-5, Math.min(5, t.vy));
        t.cx += t.vx;
        t.cy += t.vy;
        if (t.cx < t.w / 2 || t.cx > this.width - t.w / 2) t.vx *= -1;
        if (t.cy < t.h / 2 || t.cy > this.height - t.h / 2) t.vy *= -1;
        t.cx = Math.max(t.w / 2, Math.min(this.width - t.w / 2, t.cx));
        t.cy = Math.max(t.h / 2, Math.min(this.height - t.h / 2, t.cy));
        t.speed = Math.hypot(t.vx, t.vy);
        t.trail.push({ x: t.cx, y: t.cy });
        if (t.trail.length > 42) t.trail.shift();
      } else {
        // Crops are stationary — tiny jitter only from detector noise
        t.speed = 0;
      }
      t.conf = Math.max(0.55, Math.min(0.99, t.conf + rand(-0.02, 0.02)));
    }
    const cropCount = this.tracks.filter((t) => t.category === "crop").length;
    return {
      frame: this.frame,
      tracks: this.tracks.map((t) => ({ ...t, trail: [...t.trail] })),
      cropCount,
      pestCount: this.pestCount,
      alert: false,
    };
  }
}

/** PestAlertEngine — raises a warning when live pest count crosses threshold. */
export class PestAlertEngine {
  private active = false;
  constructor(public threshold = 5) {}

  evaluate(pestCount: number, frame: number): LogEntry | null {
    const shouldAlert = pestCount >= this.threshold;
    if (shouldAlert && !this.active) {
      this.active = true;
      return {
        id: `${frame}-alert`,
        frame,
        level: "warn",
        message: `HIGH PEST DENSITY: ${pestCount} pests detected in frame #${frame}`,
      };
    }
    if (!shouldAlert && this.active) {
      this.active = false;
      return {
        id: `${frame}-clear`,
        frame,
        level: "info",
        message: `Pest density back to normal (${pestCount}) at frame #${frame}`,
      };
    }
    return null;
  }

  get isActive() {
    return this.active;
  }
}

export function toCsv(rows: CsvRow[]): string {
  const header = "frame,track_id,agri_class,coco_class,conf,cx,cy,speed,alert";
  const body = rows
    .map((r) =>
      [
        r.frame,
        r.track_id,
        r.agri_class,
        r.coco_class,
        r.conf.toFixed(2),
        Math.round(r.cx),
        Math.round(r.cy),
        r.speed.toFixed(1),
        r.alert ? "True" : "False",
      ].join(","),
    )
    .join("\n");
  return `${header}\n${body}\n`;
}

export function downloadCsv(filename: string, rows: CsvRow[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
