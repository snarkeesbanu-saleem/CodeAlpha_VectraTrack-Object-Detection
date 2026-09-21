import type { Track } from "./agri";

const CROP = "#22c55e";
const PEST = "#f59e0b";
const PEST_ALERT = "#ef4444";

function bracket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  const len = Math.min(w, h) * 0.28;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  const corners: [number, number, number, number][] = [
    [x, y + len, x, y],
    [x, y, x + len, y],
    [x + w - len, y, x + w, y],
    [x + w, y, x + w, y + len],
    [x + w, y + h - len, x + w, y + h],
    [x + w, y + h, x + w - len, y + h],
    [x + len, y + h, x, y + h],
    [x, y + h, x, y + h - len],
  ];
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of corners) {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  tracks: Track[],
  opts: { alert: boolean; showTrajectory: boolean; width: number; height: number },
) {
  ctx.clearRect(0, 0, opts.width, opts.height);

  for (const t of tracks) {
    const isPest = t.category === "pest";
    const color = isPest ? (opts.alert ? PEST_ALERT : PEST) : CROP;
    const x = t.cx - t.w / 2;
    const y = t.cy - t.h / 2;

    if (isPest && opts.showTrajectory && t.trail.length > 1) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      t.trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.globalAlpha = 1;

      // future projection arrow
      const px = t.cx + t.vx * 12;
      const py = t.cy + t.vy * 12;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(t.cx, t.cy);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    bracket(ctx, x, y, t.w, t.h, color);

    const label = `#${t.id} ${isPest ? "Pest" : "Crop"} [${t.cocoClass}]`;
    ctx.font = "12px 'Share Tech Mono', monospace";
    const tw = ctx.measureText(label).width + 12;
    ctx.fillStyle = "rgba(2, 12, 6, 0.82)";
    ctx.fillRect(x, y - 20, tw, 18);
    ctx.fillStyle = color;
    ctx.fillRect(x, y - 20, 3, 18);
    ctx.fillText(label, x + 8, y - 7);

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "10px 'Share Tech Mono', monospace";
    ctx.fillText(`${(t.conf * 100).toFixed(0)}%`, x + t.w - 28, y + t.h + 12);
  }
}

export function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(4, 16, 10, 1)";
  ctx.fillRect(0, 0, width, height);
  for (const p of points) {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 34);
    g.addColorStop(0, "rgba(239, 68, 68, 0.28)");
    g.addColorStop(0.5, "rgba(245, 158, 11, 0.14)");
    g.addColorStop(1, "rgba(245, 158, 11, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(34, 197, 94, 0.12)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += width / 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += height / 6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}
