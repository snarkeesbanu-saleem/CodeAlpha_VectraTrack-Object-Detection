/**
 * Density Map & Grid-Based Severity Engine
 *
 * Divides the visual field into an NxM spatial sector grid (e.g. 6 columns x 4 rows, A1-D6),
 * calculates local pest & disease density, identifies cluster hotspots, and pinpoints
 * exact sectors needing targeted spot spraying.
 */

import type { Track } from "./agri";

export interface SectorMetric {
  id: string; // e.g. "A1", "B3"
  col: number; // 0 to cols-1
  row: number; // 0 to rows-1
  bounds: { x: number; y: number; w: number; h: number };
  pestCount: number;
  diseaseCount: number;
  cropCount: number;
  densityScore: number; // 0.0 to 1.0 normalized
  severityLevel: "safe" | "moderate" | "warning" | "hotspot";
  color: string;
}

export interface GridSeverityResult {
  cols: number;
  rows: number;
  sectors: SectorMetric[];
  hotspots: SectorMetric[];
  highestSector: SectorMetric | null;
  overallPattern: "Uniform / Dispersed" | "Localized Cluster" | "Severe Hotspot Outbreak";
  recommendedAction: string;
}

const ROW_LABELS = ["A", "B", "C", "D", "E", "F"];

export function computeDensityGrid(
  tracks: Track[],
  width: number,
  height: number,
  cols = 6,
  rows = 4
): GridSeverityResult {
  const sectorW = width / cols;
  const sectorH = height / rows;
  const sectors: SectorMetric[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rowLabel = ROW_LABELS[r] ?? `R${r + 1}`;
      const sectorId = `${rowLabel}${c + 1}`;
      const bounds = {
        x: c * sectorW,
        y: r * sectorH,
        w: sectorW,
        h: sectorH,
      };

      // Count tracks inside this sector
      let pestCount = 0;
      let diseaseCount = 0;
      let cropCount = 0;

      for (const t of tracks) {
        if (
          t.cx >= bounds.x &&
          t.cx < bounds.x + bounds.w &&
          t.cy >= bounds.y &&
          t.cy < bounds.y + bounds.h
        ) {
          if (t.category === "pest") pestCount++;
          else if (t.category === "disease") diseaseCount++;
          else if (t.category === "crop") cropCount++;
        }
      }

      // Threat density score (weighted: pests 2.0x, diseases 3.0x)
      const rawScore = pestCount * 2.0 + diseaseCount * 3.0;
      const densityScore = Math.min(1.0, rawScore / 8.0);

      let severityLevel: SectorMetric["severityLevel"] = "safe";
      let color = "rgba(34, 197, 94, 0.08)"; // subtle green

      if (pestCount >= 3 || diseaseCount >= 2 || rawScore >= 6) {
        severityLevel = "hotspot";
        color = "rgba(239, 68, 68, 0.35)"; // crimson alert
      } else if (pestCount >= 2 || diseaseCount >= 1 || rawScore >= 3.5) {
        severityLevel = "warning";
        color = "rgba(249, 115, 22, 0.28)"; // orange warning
      } else if (rawScore > 0) {
        severityLevel = "moderate";
        color = "rgba(234, 179, 8, 0.18)"; // yellow moderate
      }

      sectors.push({
        id: sectorId,
        col: c,
        row: r,
        bounds,
        pestCount,
        diseaseCount,
        cropCount,
        densityScore,
        severityLevel,
        color,
      });
    }
  }

  // Filter hotspots and find peak sector
  const hotspots = sectors.filter((s) => s.severityLevel === "hotspot" || s.severityLevel === "warning");
  const highestSector = [...sectors].sort((a, b) => b.densityScore - a.densityScore)[0] ?? null;

  let overallPattern: GridSeverityResult["overallPattern"] = "Uniform / Dispersed";
  let recommendedAction = "Normal field conditions. Maintain regular perimeter scouting.";

  if (hotspots.length >= 4) {
    overallPattern = "Severe Hotspot Outbreak";
    const ids = hotspots.slice(0, 3).map((h) => h.id).join(", ");
    recommendedAction = `Multi-sector epidemic detected in ${ids}. Initiate broad-spectrum botanical or biological spray immediately across infested zones.`;
  } else if (hotspots.length >= 1) {
    overallPattern = "Localized Cluster";
    const ids = hotspots.map((h) => h.id).join(", ");
    recommendedAction = `Localized pest/disease cluster identified in Sector ${ids}. Direct targeted spot-spraying here to prevent migration without wasting pesticide.`;
  }

  return {
    cols,
    rows,
    sectors,
    hotspots,
    highestSector,
    overallPattern,
    recommendedAction,
  };
}

/** Draws the grid overlay and hotspot bounding alerts onto canvas */
export function drawDensityGridOverlay(
  ctx: CanvasRenderingContext2D,
  grid: GridSeverityResult,
  showLabels = true
): void {
  ctx.save();

  for (const s of grid.sectors) {
    // Fill sector with density heat color
    ctx.fillStyle = s.color;
    ctx.fillRect(s.bounds.x, s.bounds.y, s.bounds.w, s.bounds.h);

    // Draw boundary grid lines
    ctx.strokeStyle =
      s.severityLevel === "hotspot"
        ? "rgba(239, 68, 68, 0.85)"
        : s.severityLevel === "warning"
        ? "rgba(249, 115, 22, 0.6)"
        : "rgba(34, 197, 94, 0.22)";
    ctx.lineWidth = s.severityLevel === "hotspot" ? 2.5 : 1;
    ctx.strokeRect(s.bounds.x, s.bounds.y, s.bounds.w, s.bounds.h);

    // Pulsing corner markers for critical hotspots
    if (s.severityLevel === "hotspot") {
      ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
      ctx.beginPath();
      ctx.arc(s.bounds.x + 8, s.bounds.y + 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sector ID label (e.g. A1, B3)
    if (showLabels) {
      ctx.font = "bold 11px 'Share Tech Mono', monospace";
      ctx.fillStyle = s.severityLevel === "hotspot" ? "#fca5a5" : "rgba(255, 255, 255, 0.55)";
      ctx.fillText(s.id, s.bounds.x + 6, s.bounds.y + 16);

      // Mini count badge
      if (s.pestCount > 0 || s.diseaseCount > 0) {
        const text = `🪲${s.pestCount}${s.diseaseCount > 0 ? ` 🍂${s.diseaseCount}` : ""}`;
        ctx.font = "10px sans-serif";
        ctx.fillStyle = s.severityLevel === "hotspot" ? "#ef4444" : "#fbbf24";
        ctx.fillText(text, s.bounds.x + 6, s.bounds.y + s.bounds.h - 6);
      }
    }
  }

  ctx.restore();
}
