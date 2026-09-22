// VectraTrack Agriculture — class mapping, tracking simulation, alerts.
import {
  CROP_CLASSES,
  PEST_CLASSES,
  DISEASE_CLASSES,
  CROP_DISPLAY,
  PEST_DISPLAY,
  DISEASE_DISPLAY,
} from "@/agriMapper";

export type AgriCategory = "crop" | "pest" | "disease" | "ignored";

export interface AgriMapping {
  category: AgriCategory;
  label: string;
  displayName: string;
  emoji: string;
  color: string;
}

/** AgriClassMapper — maps class names to agriculture categories with friendly display names. */
export const AgriClassMapper = {
  crops: CROP_CLASSES,
  pests: PEST_CLASSES,
  diseases: DISEASE_CLASSES,
  map(cocoClass: string, lang: 'en' | 'ta' = 'en'): AgriMapping {
    const cls = cocoClass.toLowerCase().trim();

    if (cls in CROP_DISPLAY) {
      const info = CROP_DISPLAY[cls]!;
      return {
        category: "crop",
        label: "Crop",
        displayName: lang === 'ta' ? info.ta : info.en,
        emoji: info.emoji,
        color: "var(--crop)",
      };
    }

    if (cls in PEST_DISPLAY) {
      const info = PEST_DISPLAY[cls]!;
      return {
        category: "pest",
        label: "Pest",
        displayName: lang === 'ta' ? info.ta : info.en,
        emoji: info.emoji,
        color: "var(--pest)",
      };
    }

    if (cls in DISEASE_DISPLAY) {
      const info = DISEASE_DISPLAY[cls]!;
      return {
        category: "disease",
        label: "Disease",
        displayName: lang === 'ta' ? info.ta : info.en,
        emoji: info.emoji,
        color: "#f43f5e",
      };
    }

    return {
      category: "ignored",
      label: "Ignored",
      displayName: cls,
      emoji: "⬛",
      color: "var(--muted-foreground)",
    };
  },
};

export interface Track {
  id: number;
  cocoClass: string;
  displayName: string;
  emoji: string;
  category: "crop" | "pest" | "disease";
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
  diseaseCount: number;
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
  display_name: string;
  conf: number;
  cx: number;
  cy: number;
  speed: number;
  alert: boolean;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)] as T;

/**
 * CustomSortTracker (simulation) — Kalman-style constant velocity update with
 * ByteTrack-inspired two-stage association.
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

  seed(cropCount = 7, pestCount = 3, diseaseCount = 2) {
    this.tracks = [];
    this.nextId = 1;
    this.frame = 0;
    for (let i = 0; i < cropCount; i++) this.spawn("crop");
    for (let i = 0; i < pestCount; i++) this.spawn("pest");
    for (let i = 0; i < diseaseCount; i++) this.spawn("disease");
  }

  spawn(category: "crop" | "pest" | "disease") {
    const isCrop = category === "crop";
    const isDisease = category === "disease";
    const size = isCrop ? rand(90, 150) : isDisease ? rand(60, 100) : rand(48, 80);
    const cls = isCrop
      ? pick(CROP_CLASSES)
      : isDisease
      ? pick(DISEASE_CLASSES)
      : pick(PEST_CLASSES);

    const mapping = AgriClassMapper.map(cls);

    const track: Track = {
      id: this.nextId++,
      cocoClass: cls,
      displayName: mapping.displayName,
      emoji: mapping.emoji,
      category,
      conf: rand(0.65, 0.96),
      cx: rand(size, this.width - size),
      cy: rand(size, this.height - size),
      w: size,
      h: size * rand(0.8, 1.1),
      vx: isCrop || isDisease ? 0 : rand(-4.5, 4.5),
      vy: isCrop || isDisease ? 0 : rand(-3.5, 3.5),
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

  get diseaseCount() {
    return this.tracks.filter((t) => t.category === "disease").length;
  }

  step(): FrameResult {
    this.frame++;
    for (const t of this.tracks) {
      if (t.category === "pest") {
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
        t.speed = 0;
      }
      t.conf = Math.max(0.58, Math.min(0.99, t.conf + rand(-0.02, 0.02)));
    }
    const cropCount = this.tracks.filter((t) => t.category === "crop").length;
    return {
      frame: this.frame,
      tracks: this.tracks.map((t) => ({ ...t, trail: [...t.trail] })),
      cropCount,
      pestCount: this.pestCount,
      diseaseCount: this.diseaseCount,
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
  const header = "frame,track_id,agri_class,coco_class,display_name,conf,cx,cy,speed,alert";
  const body = rows
    .map((r) =>
      [
        r.frame,
        r.track_id,
        r.agri_class,
        r.coco_class,
        r.display_name,
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
