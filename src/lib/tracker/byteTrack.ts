/**
 * ByteTrack / BoT-SORT Multi-Object Tracking Engine
 *
 * Implements:
 * 1. Two-stage data association (high-score matches first, low-score matches recover occlusions).
 * 2. Track lifecycle state machine: Tentative -> Confirmed -> Lost -> Removed.
 * 3. Constant velocity Kalman-style motion state estimation [x, y, w, h, vx, vy, vw, vh].
 * 4. BoT-SORT motion vector smoothing to prevent ID switches during erratic pest flight/movement.
 */

export interface BoundingBox {
  x: number; // top-left x
  y: number; // top-left y
  w: number;
  h: number;
}

export interface ByteDetection {
  bbox: BoundingBox;
  score: number;
  cocoClass: string;
  displayName: string;
  emoji: string;
  category: "crop" | "pest" | "disease";
}

export type TrackState = "tentative" | "confirmed" | "lost" | "removed";

export interface KalmanState {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  vw: number;
  vh: number;
}

export class STrack {
  public id: number;
  public state: TrackState = "tentative";
  public kState: KalmanState;
  public score: number;
  public cocoClass: string;
  public displayName: string;
  public emoji: string;
  public category: "crop" | "pest" | "disease";
  public age = 0;
  public hits = 0;
  public lostFrames = 0;
  public trail: { x: number; y: number }[] = [];

  constructor(id: number, det: ByteDetection) {
    this.id = id;
    this.kState = {
      x: det.bbox.x,
      y: det.bbox.y,
      w: det.bbox.w,
      h: det.bbox.h,
      vx: 0,
      vy: 0,
      vw: 0,
      vh: 0,
    };
    this.score = det.score;
    this.cocoClass = det.cocoClass;
    this.displayName = det.displayName;
    this.emoji = det.emoji;
    this.category = det.category;
    this.hits = 1;
    this.trail.push({ x: det.bbox.x + det.bbox.w / 2, y: det.bbox.y + det.bbox.h / 2 });
  }

  public predict(): void {
    // Constant velocity forward step
    this.kState.x += this.kState.vx;
    this.kState.y += this.kState.vy;
    this.kState.w += this.kState.vw;
    this.kState.h += this.kState.vh;

    // Decay velocity slightly for stability
    this.kState.vx *= 0.96;
    this.kState.vy *= 0.96;
    this.kState.vw *= 0.92;
    this.kState.vh *= 0.92;

    this.age++;
    if (this.state !== "tentative") {
      this.lostFrames++;
    }
  }

  public update(det: ByteDetection): void {
    // Smoothed velocity estimation (BoT-SORT EMA filter)
    const alpha = 0.65;
    const newVx = det.bbox.x - this.kState.x;
    const newVy = det.bbox.y - this.kState.y;
    const newVw = det.bbox.w - this.kState.w;
    const newVh = det.bbox.h - this.kState.h;

    this.kState.vx = alpha * this.kState.vx + (1 - alpha) * newVx;
    this.kState.vy = alpha * this.kState.vy + (1 - alpha) * newVy;
    this.kState.vw = alpha * this.kState.vw + (1 - alpha) * newVw;
    this.kState.vh = alpha * this.kState.vh + (1 - alpha) * newVh;

    this.kState.x = det.bbox.x;
    this.kState.y = det.bbox.y;
    this.kState.w = det.bbox.w;
    this.kState.h = det.bbox.h;

    this.score = det.score;
    this.lostFrames = 0;
    this.hits++;

    if (this.state === "tentative" && this.hits >= 2) {
      this.state = "confirmed";
    } else if (this.state === "lost") {
      this.state = "confirmed";
    }

    const cx = this.kState.x + this.kState.w / 2;
    const cy = this.kState.y + this.kState.h / 2;
    this.trail.push({ x: cx, y: cy });
    if (this.trail.length > 40) {
      this.trail.shift();
    }
  }

  public markLost(): void {
    this.state = "lost";
  }

  public markRemoved(): void {
    this.state = "removed";
  }

  public get cx(): number {
    return this.kState.x + this.kState.w / 2;
  }

  public get cy(): number {
    return this.kState.y + this.kState.h / 2;
  }

  public get speed(): number {
    return Math.hypot(this.kState.vx, this.kState.vy);
  }
}

/** Calculate Intersection over Union */
export function calculateIoU(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);

  const w = Math.max(0, x2 - x1);
  const h = Math.max(0, y2 - y1);
  const inter = w * h;
  if (inter === 0) return 0;

  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

export interface ByteTrackerOptions {
  highScoreThresh?: number; // threshold for Stage 1 match (default: 0.6)
  lowScoreThresh?: number;  // threshold for Stage 2 recovery match (default: 0.2)
  matchThresh?: number;     // IoU distance threshold for Stage 1 (default: 0.45)
  secondMatchThresh?: number; // IoU distance threshold for Stage 2 (default: 0.30)
  maxLostFrames?: number;   // frames before track is discarded (default: 30)
}

export class ByteTracker {
  private nextId = 1;
  private trackedStracks: STrack[] = [];
  private lostStracks: STrack[] = [];
  private removedStracks: STrack[] = [];
  private frameCount = 0;

  private highScoreThresh: number;
  private lowScoreThresh: number;
  private matchThresh: number;
  private secondMatchThresh: number;
  private maxLostFrames: number;

  constructor(opts?: ByteTrackerOptions) {
    this.highScoreThresh = opts?.highScoreThresh ?? 0.60;
    this.lowScoreThresh = opts?.lowScoreThresh ?? 0.20;
    this.matchThresh = opts?.matchThresh ?? 0.45;
    this.secondMatchThresh = opts?.secondMatchThresh ?? 0.30;
    this.maxLostFrames = opts?.maxLostFrames ?? 30;
  }

  public reset(): void {
    this.nextId = 1;
    this.trackedStracks = [];
    this.lostStracks = [];
    this.removedStracks = [];
    this.frameCount = 0;
  }

  public update(detections: ByteDetection[]): STrack[] {
    this.frameCount++;

    // Step 1: Predict new locations of all tracks
    const allTracks = [...this.trackedStracks, ...this.lostStracks];
    for (const track of allTracks) {
      track.predict();
    }

    // Step 2: Separate detections into high score and low score pools
    const detsHigh: ByteDetection[] = [];
    const detsLow: ByteDetection[] = [];

    for (const det of detections) {
      if (det.score >= this.highScoreThresh) {
        detsHigh.push(det);
      } else if (det.score >= this.lowScoreThresh) {
        detsLow.push(det);
      }
    }

    // Step 3: First Association (High-score detections with confirmed active tracks)
    const confirmedTracks = this.trackedStracks.filter((t) => t.state === "confirmed");
    const unconfirmedTracks = this.trackedStracks.filter((t) => t.state === "tentative");
    const trackPool = [...confirmedTracks, ...this.lostStracks];

    const {
      matches: matchesHigh,
      unmatchedTracks: unmatchedTracks1,
      unmatchedDetections: unmatchedDetsHigh,
    } = this.linearAssignment(trackPool, detsHigh, this.matchThresh);

    for (const [tIdx, dIdx] of matchesHigh) {
      trackPool[tIdx]!.update(detsHigh[dIdx]!);
    }

    // Step 4: Second Association (Low-score detections with remaining unmatched tracks to recover occlusions)
    const remainingTracks = unmatchedTracks1.map((idx) => trackPool[idx]!);
    const {
      matches: matchesLow,
      unmatchedTracks: unmatchedTracks2,
    } = this.linearAssignment(remainingTracks, detsLow, this.secondMatchThresh);

    for (const [tIdx, dIdx] of matchesLow) {
      remainingTracks[tIdx]!.update(detsLow[dIdx]!);
    }

    // Step 5: Mark unmatched tracks as lost or removed
    for (const idx of unmatchedTracks2) {
      const track = remainingTracks[idx]!;
      if (track.state !== "lost") {
        track.markLost();
      }
      if (track.lostFrames > this.maxLostFrames) {
        track.markRemoved();
      }
    }

    // Step 6: Associate remaining high-score detections with unconfirmed (tentative) tracks
    const remainingDets = unmatchedDetsHigh.map((idx) => detsHigh[idx]!);
    const {
      matches: matchesTentative,
      unmatchedTracks: unmatchedTentative,
      unmatchedDetections: brandNewDets,
    } = this.linearAssignment(unconfirmedTracks, remainingDets, 0.40);

    for (const [tIdx, dIdx] of matchesTentative) {
      unconfirmedTracks[tIdx]!.update(remainingDets[dIdx]!);
    }

    for (const idx of unmatchedTentative) {
      unconfirmedTracks[idx]!.markRemoved();
    }

    // Step 7: Initialize new tentative tracks from brand new high-score detections
    for (const idx of brandNewDets) {
      const det = remainingDets[idx]!;
      const newTrack = new STrack(this.nextId++, det);
      this.trackedStracks.push(newTrack);
    }

    // Step 8: Update internal track state lists
    const activeConfirmed: STrack[] = [];
    const activeLost: STrack[] = [];

    for (const track of [...this.trackedStracks, ...this.lostStracks]) {
      if (track.state === "confirmed" || track.state === "tentative") {
        if (!activeConfirmed.some((t) => t.id === track.id)) {
          activeConfirmed.push(track);
        }
      } else if (track.state === "lost" && track.lostFrames <= this.maxLostFrames) {
        if (!activeLost.some((t) => t.id === track.id)) {
          activeLost.push(track);
        }
      }
    }

    this.trackedStracks = activeConfirmed;
    this.lostStracks = activeLost;

    // Return all confirmed & visible tentative tracks
    return this.trackedStracks.filter((t) => t.state === "confirmed" || t.hits >= 1);
  }

  /** Greedy IoU assignment between tracks and detections */
  private linearAssignment(
    tracks: STrack[],
    detections: ByteDetection[],
    threshold: number
  ): {
    matches: [number, number][];
    unmatchedTracks: number[];
    unmatchedDetections: number[];
  } {
    if (tracks.length === 0 || detections.length === 0) {
      return {
        matches: [],
        unmatchedTracks: tracks.map((_, i) => i),
        unmatchedDetections: detections.map((_, i) => i),
      };
    }

    const matches: [number, number][] = [];
    const usedTracks = new Set<number>();
    const usedDets = new Set<number>();

    // Build cost / IoU matrix
    const pairs: { tIdx: number; dIdx: number; iou: number }[] = [];
    for (let tIdx = 0; tIdx < tracks.length; tIdx++) {
      const trackBox = {
        x: tracks[tIdx]!.kState.x,
        y: tracks[tIdx]!.kState.y,
        w: tracks[tIdx]!.kState.w,
        h: tracks[tIdx]!.kState.h,
      };
      for (let dIdx = 0; dIdx < detections.length; dIdx++) {
        const iou = calculateIoU(trackBox, detections[dIdx]!.bbox);
        if (iou >= threshold) {
          pairs.push({ tIdx, dIdx, iou });
        }
      }
    }

    // Sort descending by IoU
    pairs.sort((a, b) => b.iou - a.iou);

    for (const pair of pairs) {
      if (!usedTracks.has(pair.tIdx) && !usedDets.has(pair.dIdx)) {
        usedTracks.add(pair.tIdx);
        usedDets.add(pair.dIdx);
        matches.push([pair.tIdx, pair.dIdx]);
      }
    }

    const unmatchedTracks: number[] = [];
    for (let i = 0; i < tracks.length; i++) {
      if (!usedTracks.has(i)) unmatchedTracks.push(i);
    }

    const unmatchedDetections: number[] = [];
    for (let j = 0; j < detections.length; j++) {
      if (!usedDets.has(j)) unmatchedDetections.push(j);
    }

    return { matches, unmatchedTracks, unmatchedDetections };
  }
}
