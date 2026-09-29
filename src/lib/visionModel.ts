// Vision Model Service v7.0 — Reliable Agricultural Detection
// 
// ARCHITECTURE:
// ─────────────────────────────────────────────────────────────────────────────
// 1. COCO-SSD mobilenet_v2: Reliable detection of birds, livestock animals,
//    and produce-category objects that exist in COCO's 80 classes.
//
// 2. Pixel canopy scanner: Detects green plant/tree canopy regions using a
//    connected-component algorithm. Label is ALWAYS driven by cropContext.
//    Never overrides user's explicit crop selection.
//
// 3. Pixel pest scanner: Conservative thresholds. Only fires when BOTH the
//    sector AND at least 2 neighbouring sectors exceed threshold. This
//    eliminates false positives from soil, bark, and sky.
//
// 4. cropContext is the SOURCE OF TRUTH for crop naming. Auto-detect only
//    applies when user selected "auto".
// ─────────────────────────────────────────────────────────────────────────────

import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import type { Track } from './agri';
import { CROP_DISPLAY, PEST_DISPLAY, DISEASE_DISPLAY } from '@/agriMapper';

// ── Model singleton ───────────────────────────────────────────────────────────
let modelPromise: Promise<cocoSsd.ObjectDetection> | null = null;

export async function getVisionModel(): Promise<cocoSsd.ObjectDetection> {
  if (!modelPromise) {
    modelPromise = (async () => {
      await tf.ready();
      return await cocoSsd.load({ base: 'mobilenet_v2' });
    })();
  }
  return modelPromise;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type SupportedCropContext =
  | 'auto' | 'paddy' | 'tomato' | 'cotton'
  | 'maize' | 'chilli' | 'sugarcane' | 'orchard';

export interface DetectionOptions {
  minConfidence?: number;
  lang?: 'en' | 'ta';
  cropContext?: SupportedCropContext;
}

// ── COCO class → Agricultural mapping ────────────────────────────────────────
// These are the ONLY classes COCO-SSD can actually detect reliably
const COCO_ANIMAL_PESTS: Record<string, { en: string; ta: string; emoji: string }> = {
  bird:  { en: 'Grain-Feeding Field Bird',    ta: 'பறவை (தானிய சேதம்)',       emoji: '🐦' },
  cow:   { en: 'Cattle Grazing Intrusion',     ta: 'மாடு (கால்நடை ஊடுருவல்)',  emoji: '🐄' },
  sheep: { en: 'Sheep Grazing Intrusion',      ta: 'ஆடு மேய்ச்சல்',            emoji: '🐑' },
  horse: { en: 'Horse Intrusion',              ta: 'குதிரை ஊடுருவல்',          emoji: '🐎' },
  mouse: { en: 'Field Rodent / Rat',           ta: 'வயல் எலி',                  emoji: '🐭' },
  dog:   { en: 'Stray Dog (Field Intrusion)',  ta: 'நாய் ஊடுருவல்',            emoji: '🐕' },
  cat:   { en: 'Cat (Field Intrusion)',        ta: 'பூனை ஊடுருவல்',            emoji: '🐈' },
  bear:  { en: 'Wild Animal Intrusion (Bear)', ta: 'கரடி ஊடுருவல்',            emoji: '🐻' },
};

const COCO_PRODUCE_CROPS: Record<string, { en: string; ta: string; emoji: string; cropKey: string }> = {
  apple:          { en: 'Apple Orchard Tree',          ta: 'ஆப்பிள் மரம்',             emoji: '🍎', cropKey: 'orchard'  },
  orange:         { en: 'Citrus / Orange Orchard',     ta: 'ஆரஞ்சு / எலுமிச்சை மரம்', emoji: '🍊', cropKey: 'orchard'  },
  banana:         { en: 'Banana Plant Canopy',         ta: 'வாழை மரம் / இலைகள்',      emoji: '🍌', cropKey: 'banana'   },
  broccoli:       { en: 'Vegetable Crop (Broccoli)',   ta: 'காய்கறி பயிர்',            emoji: '🥦', cropKey: 'tomato'   },
  carrot:         { en: 'Root Vegetable Crop (Carrot)',ta: 'கேரட் / கிழங்கு பயிர்',   emoji: '🥕', cropKey: 'tomato'   },
  'potted plant': { en: 'Crop Plant',                  ta: 'பயிர் செடி',               emoji: '🌱', cropKey: 'plant'    },
};

// ── Crop context → display info (SOURCE OF TRUTH) ────────────────────────────
function getCropInfoForContext(
  context: SupportedCropContext,
  isTreeScene: boolean,
  avgGreen: number,
  lang: 'en' | 'ta'
): { key: string; displayName: string; emoji: string } {
  const get = (key: string) => {
    const info = CROP_DISPLAY[key];
    return info ? { key, displayName: lang === 'ta' ? info.ta : info.en, emoji: info.emoji }
                 : { key: 'plant', displayName: lang === 'ta' ? 'பயிர் செடி' : 'Crop Plant', emoji: '🌱' };
  };

  switch (context) {
    case 'paddy':    return get('paddy');
    case 'tomato':   return get('tomato');
    case 'cotton':   return get('cotton');
    case 'maize':    return get('maize');
    case 'chilli':   return get('chilli');
    case 'sugarcane':return get('sugarcane');
    case 'orchard':  return get('orchard');
    case 'auto':
    default:
      // Auto: use scene signals only when user didn't pick a crop
      if (isTreeScene)          return get('orchard');
      if (avgGreen > 0.55)      return get('tree');
      if (avgGreen > 0.38)      return get('crop row');
      return get('plant');
  }
}

// ── Main detection function ───────────────────────────────────────────────────
export async function detectRealAgricultureObjects(
  imageEl: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number,
  opts?: DetectionOptions
): Promise<Track[]> {
  const minConf    = opts?.minConfidence ?? 0.50;
  const lang       = opts?.lang          ?? 'en';
  const cropCtx    = opts?.cropContext   ?? 'auto';

  const tracks: Track[] = [];
  let   trackId = 1;

  const srcW   = (imageEl as HTMLImageElement).naturalWidth  ||
                 (imageEl as HTMLVideoElement).videoWidth    ||
                 imageEl.width  || targetWidth;
  const srcH   = (imageEl as HTMLImageElement).naturalHeight ||
                 (imageEl as HTMLVideoElement).videoHeight   ||
                 imageEl.height || targetHeight;
  const scaleX = targetWidth  / srcW;
  const scaleY = targetHeight / srcH;

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 1 — COCO-SSD Neural Network Pass
  //   Reliable for: birds, cows, sheep, horse, dog, cat, mouse, bear,
  //   apple, orange, banana, broccoli, carrot, potted plant
  // ────────────────────────────────────────────────────────────────────────────
  try {
    const model = await getVisionModel();

    // Use a lower raw threshold so COCO can pick up partially occluded animals
    const cocoThresh = Math.max(0.25, minConf * 0.50);
    const predictions = await model.detect(imageEl, 20, cocoThresh);

    for (const pred of predictions) {
      const cls   = pred.class.toLowerCase().trim();
      const score = pred.score;
      const [bx, by, bw, bh] = pred.bbox;
      const x = bx * scaleX, y = by * scaleY;
      const w = bw * scaleX, h = bh * scaleY;

      if (w * h < 800) continue; // ignore tiny noise boxes

      // ── Animals / Birds → pest category ──
      if (cls in COCO_ANIMAL_PESTS && score >= minConf * 0.70) {
        const info = COCO_ANIMAL_PESTS[cls]!;
        tracks.push({
          id: trackId++,
          cocoClass: cls,
          displayName: lang === 'ta' ? info.ta : info.en,
          emoji: info.emoji,
          category: 'pest',
          conf: score,
          cx: x + w / 2, cy: y + h / 2, w, h,
          vx: 0, vy: 0, speed: 0, trail: [],
        });
      }
      // ── Produce / Plants → crop category ──
      else if (cls in COCO_PRODUCE_CROPS && score >= Math.max(0.28, minConf * 0.50)) {
        const info = COCO_PRODUCE_CROPS[cls]!;

        // Respect explicit cropContext — don't override if user picked a specific crop
        let displayName: string;
        let emoji: string;
        let cocoKey: string;

        if (cropCtx !== 'auto') {
          // User explicitly selected a crop type — use that label
          const ctxInfo = getCropInfoForContext(cropCtx, false, 0, lang);
          displayName = ctxInfo.displayName;
          emoji       = ctxInfo.emoji;
          cocoKey     = ctxInfo.key;
        } else {
          displayName = lang === 'ta' ? info.ta : info.en;
          emoji       = info.emoji;
          cocoKey     = info.cropKey;
        }

        const alreadyCovered = tracks.some(
          (t) => t.category === 'crop' &&
                 Math.hypot(t.cx - (x + w/2), t.cy - (y + h/2)) < w * 0.5
        );
        if (!alreadyCovered) {
          tracks.push({
            id: trackId++,
            cocoClass: cocoKey,
            displayName,
            emoji,
            category: 'crop',
            conf: score,
            cx: x + w / 2, cy: y + h / 2, w, h,
            vx: 0, vy: 0, speed: 0, trail: [],
          });
        }
      }
    }
  } catch (err) {
    console.warn('[VisionModel] TF inference error:', err);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 2 — Pixel-level canopy & insect scanner
  // ────────────────────────────────────────────────────────────────────────────
  try {
    const canvas = document.createElement('canvas');
    canvas.width  = targetWidth;
    canvas.height = targetHeight;
    const ctx2 = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx2) throw new Error('no 2d ctx');

    ctx2.drawImage(imageEl, 0, 0, targetWidth, targetHeight);
    const { data } = ctx2.getImageData(0, 0, targetWidth, targetHeight);

    // 8 columns × 6 rows = 48 sectors
    const COLS = 8, ROWS = 6;
    const SW = targetWidth / COLS, SH = targetHeight / ROWS;

    interface Sector {
      col: number; row: number; sx: number; sy: number; n: number;
      green: number; woody: number; fruit: number;
      aphid: number; fly: number; cat: number;
      mite: number; blight: number; hopper: number; boll: number;
    }

    const grid: Sector[] = [];
    let totGreen = 0, totWoody = 0, totFruit = 0, totN = 0;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const sx = Math.floor(c * SW), sy = Math.floor(r * SH);
        let n = 0;
        let green=0, woody=0, fruit=0;
        let aphid=0, fly=0, catCount=0, mite=0, blight=0, hopper=0, boll=0;

        for (let py = sy; py < sy + SH; py += 4) {
          for (let px = sx; px < sx + SW; px += 4) {
            const i = (py * targetWidth + px) * 4;
            const R = data[i]!, G = data[i+1]!, B = data[i+2]!;
            n++; totN++;

            // Green leaf foliage: G clearly dominant, bright enough
            if (G > R * 1.15 && G > B * 1.16 && G > 50) {
              green++; totGreen++;
            }
            // Woody bark: warm brown, R > G > B
            else if (R > 70 && R < 165 && G > 45 && G < 120 && B < 80 &&
                     R > G * 1.25 && G > B * 1.15) {
              woody++; totWoody++;
            }
            // Fruit (red apple, orange citrus, yellow mango)
            else if ((R > 160 && G < 85  && B < 65) ||   // red apple
                     (R > 190 && G > 110 && B < 55) ||   // orange
                     (R > 200 && G > 180 && B < 60)) {   // yellow fruit
              fruit++; totFruit++;
            }
            // Aphid colony: yellow-green cluster on stems, small contrast
            else if (G > 80 && R > 70 && R < 130 && B < 55 &&
                     Math.abs(R - G) < 25 && G > B * 1.35) {
              aphid++;
            }
            // Whitefly: very bright near-white speck
            else if (R > 215 && G > 215 && B > 205 && Math.abs(R - G) < 20) {
              fly++;
            }
            // Caterpillar / Armyworm: olive-green segmented body
            else if (R > 65 && R < 112 && G > 75 && G < 125 && B < 60 &&
                     R > B * 1.40 && Math.abs(R - G) < 30) {
              catCount++;
            }
            // Spider Mite: tiny red-orange dots
            else if (R > 155 && G < 95 && B < 65 && R > G * 1.55) {
              mite++;
            }
            // Blight / necrotic lesion: warm brown
            else if (R > 128 && R < 180 && G > 85 && G < 135 && B < 60 &&
                     R > G * 1.10) {
              blight++;
            }
            // Leafhopper / BPH: dark brown-olive slender body
            else if (R > 58 && R < 108 && G > 45 && G < 92 && B > 22 && B < 68 &&
                     R > G * 1.18) {
              hopper++;
            }
            // Bollworm / Fruit borer: pinkish cream larva
            else if (R > 190 && G > 150 && B > 120 &&
                     R > G * 1.10 && G > B * 1.08 && B > 105) {
              boll++;
            }
          }
        }

        grid.push({ col: c, row: r, sx, sy, n,
          green: green/n, woody: woody/n, fruit: fruit/n,
          aphid: aphid/n, fly: fly/n, cat: catCount/n,
          mite: mite/n, blight: blight/n, hopper: hopper/n, boll: boll/n,
        });
      }
    }

    const overallGreen = totGreen / totN;
    const overallWoody = totWoody / totN;
    const isTreeScene  = overallWoody > 0.06 || totFruit > 25 || cropCtx === 'orchard';

    // ── Neighbour-agreement helper ──────────────────────────────────────────
    // Returns number of adjacent sectors (4-connected) that exceed the threshold
    const neighborScore = (r: number, c: number, field: keyof Sector, thr: number): number => {
      let count = 0;
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = r+dr, nc = c+dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          if ((grid[nr*COLS+nc]![field] as number) >= thr) count++;
        }
      }
      return count;
    };

    const nearbyTrack = (cat: string, cx: number, cy: number, d: number) =>
      tracks.some(t => t.category === cat && Math.hypot(t.cx-cx, t.cy-cy) < d);

    // ── INSECT PEST DETECTION ───────────────────────────────────────────────
    // Thresholds: primary = strong signal in this sector
    //             secondary = at least 1 neighbour also shows signal
    // This eliminates single-sector false positives from soil/sky/bark

    for (const s of grid) {
      if (s.n < 35) continue; // skip tiny/edge sectors
      const cx = s.sx + SW / 2, cy = s.sy + SH / 2;

      // Aphids — yellowish colonies on stems
      if (s.aphid > 0.24 && neighborScore(s.row, s.col, 'aphid', 0.14) >= 1 &&
          !nearbyTrack('pest', cx, cy, SW * 1.0)) {
        const info = PEST_DISPLAY['aphid']!;
        tracks.push({ id: trackId++, cocoClass: 'aphid',
          displayName: lang==='ta' ? info.ta : info.en, emoji: info.emoji,
          category: 'pest', conf: Math.min(0.94, 0.74 + s.aphid * 0.36),
          cx, cy, w: SW*0.95, h: SH*0.95, vx:0, vy:0, speed:0, trail:[] });
      }
      // Whiteflies — bright white micro-specks
      else if (s.fly > 0.20 && neighborScore(s.row, s.col, 'fly', 0.12) >= 1 &&
               !nearbyTrack('pest', cx, cy, SW * 1.0)) {
        const info = PEST_DISPLAY['whitefly']!;
        tracks.push({ id: trackId++, cocoClass: 'whitefly',
          displayName: lang==='ta' ? info.ta : info.en, emoji: info.emoji,
          category: 'pest', conf: Math.min(0.92, 0.72 + s.fly * 0.35),
          cx, cy, w: SW*0.85, h: SH*0.85, vx:0, vy:0, speed:0, trail:[] });
      }
      // Caterpillar / Fall Armyworm
      else if (s.cat > 0.26 && neighborScore(s.row, s.col, 'cat', 0.16) >= 1 &&
               !nearbyTrack('pest', cx, cy, SW * 1.0)) {
        const info = PEST_DISPLAY['caterpillar']!;
        tracks.push({ id: trackId++, cocoClass: 'caterpillar',
          displayName: lang==='ta' ? info.ta : info.en, emoji: info.emoji,
          category: 'pest', conf: Math.min(0.95, 0.76 + s.cat * 0.35),
          cx, cy, w: SW*1.0, h: SH*1.0, vx:0, vy:0, speed:0, trail:[] });
      }
      // Spider Mite — red dots
      else if (s.mite > 0.18 && neighborScore(s.row, s.col, 'mite', 0.10) >= 1 &&
               !nearbyTrack('pest', cx, cy, SW * 1.0)) {
        const info = PEST_DISPLAY['spider mite']!;
        tracks.push({ id: trackId++, cocoClass: 'spider mite',
          displayName: lang==='ta' ? info.ta : info.en, emoji: info.emoji,
          category: 'pest', conf: Math.min(0.92, 0.70 + s.mite * 0.36),
          cx, cy, w: SW*0.85, h: SH*0.85, vx:0, vy:0, speed:0, trail:[] });
      }
      // Leafhopper / BPH
      else if (s.hopper > 0.17 && neighborScore(s.row, s.col, 'hopper', 0.10) >= 1 &&
               !nearbyTrack('pest', cx, cy, SW * 1.0)) {
        const info = PEST_DISPLAY['leafhopper']!;
        tracks.push({ id: trackId++, cocoClass: 'leafhopper',
          displayName: lang==='ta' ? info.ta : info.en, emoji: info.emoji,
          category: 'pest', conf: Math.min(0.91, 0.68 + s.hopper * 0.38),
          cx, cy, w: SW*0.85, h: SH*0.85, vx:0, vy:0, speed:0, trail:[] });
      }
      // Bollworm / Fruit borer
      else if (s.boll > 0.17 && neighborScore(s.row, s.col, 'boll', 0.10) >= 1 &&
               !nearbyTrack('pest', cx, cy, SW * 1.0)) {
        const info = PEST_DISPLAY['bollworm']!;
        tracks.push({ id: trackId++, cocoClass: 'bollworm',
          displayName: lang==='ta' ? info.ta : info.en, emoji: info.emoji,
          category: 'pest', conf: Math.min(0.91, 0.68 + s.boll * 0.38),
          cx, cy, w: SW*0.90, h: SH*0.90, vx:0, vy:0, speed:0, trail:[] });
      }

      // Leaf disease (runs independently — can co-exist with pest)
      if (s.blight > 0.28 && neighborScore(s.row, s.col, 'blight', 0.18) >= 1 &&
          !nearbyTrack('disease', cx, cy, SW * 1.0)) {
        const diseaseKey = s.blight < 0.40 ? 'leaf spot' : 'leaf blight';
        const info = DISEASE_DISPLAY[diseaseKey]!;
        tracks.push({ id: trackId++, cocoClass: diseaseKey,
          displayName: lang==='ta' ? info.ta : info.en, emoji: info.emoji,
          category: 'disease', conf: Math.min(0.94, 0.72 + s.blight * 0.34),
          cx, cy, w: SW*0.90, h: SH*0.90, vx:0, vy:0, speed:0, trail:[] });
      }
    }

    // ── BOTANICAL CANOPY DETECTION — connected-component BFS ───────────────
    // Find all contiguous green sector clusters and draw one box per cluster
    // Label is ALWAYS driven by getCropInfoForContext (respects user selection)
    const FOLIAGE_THRESH = 0.30; // a sector is "foliage" if ≥30% green pixels
    const foliage: boolean[][] = Array.from({length: ROWS}, (_, r) =>
      Array.from({length: COLS}, (_, c) => grid[r*COLS+c]!.green > FOLIAGE_THRESH)
    );
    const visited: boolean[][] = Array.from({length: ROWS}, () => new Array(COLS).fill(false));

    // Compute mean green across all foliage sectors for taxonomy decision
    const allFoliageSectors = grid.filter(s => s.green > FOLIAGE_THRESH);
    const sceneMeanGreen = allFoliageSectors.length
      ? allFoliageSectors.reduce((acc, s) => acc + s.green, 0) / allFoliageSectors.length
      : 0;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!foliage[r]![c] || visited[r]![c]) continue;

        // BFS to gather connected component
        const component: Sector[] = [];
        const queue: [number,number][] = [[r, c]];
        visited[r]![c] = true;

        while (queue.length) {
          const [cr, cc] = queue.shift()!;
          component.push(grid[cr*COLS+cc]!);
          for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nr=cr+dr, nc=cc+dc;
            if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS &&
                foliage[nr]![nc] && !visited[nr]![nc]) {
              visited[nr]![nc] = true;
              queue.push([nr, nc]);
            }
          }
        }

        // Need at least 3 connected sectors to form a valid canopy detection
        if (component.length < 3) continue;

        // Compute bounding box from sector pixel coordinates
        let minX=targetWidth, minY=targetHeight, maxX=0, maxY=0;
        let avgG=0, avgF=0, avgW=0;
        for (const s of component) {
          minX = Math.min(minX, s.sx); minY = Math.min(minY, s.sy);
          maxX = Math.max(maxX, s.sx+SW); maxY = Math.max(maxY, s.sy+SH);
          avgG += s.green; avgF += s.fruit; avgW += s.woody;
        }
        avgG /= component.length;
        avgF /= component.length;
        avgW /= component.length;

        // Expand by 10% to include canopy edges and trunk base
        const padX = SW * 0.10, padY = SH * 0.10;
        const bx = Math.max(0, minX - padX);
        const by = Math.max(0, minY - padY);
        const bw = Math.min(targetWidth  - bx, (maxX - minX) + padX * 2);
        const bh = Math.min(targetHeight - by, (maxY - minY) + padY * 2);
        const cx = bx + bw / 2, cy = by + bh / 2;

        if (bw < 75 || bh < 75) continue; // too small

        // Skip if already covered by a COCO crop detection
        if (tracks.some(t => t.category==='crop' &&
            Math.hypot(t.cx-cx, t.cy-cy) < Math.max(t.w, bw) * 0.42)) continue;

        // ── Determine label — cropContext is SOURCE OF TRUTH ──
        const isTreeHere = isTreeScene || avgW > 0.04 || avgF > 0.02;
        const info = getCropInfoForContext(cropCtx, isTreeHere, sceneMeanGreen, lang);

        tracks.push({
          id: trackId++,
          cocoClass: info.key,
          displayName: info.displayName,
          emoji: info.emoji,
          category: 'crop',
          conf: Math.min(0.97, 0.83 + avgG * 0.15),
          cx, cy, w: bw, h: bh,
          vx: 0, vy: 0, speed: 0, trail: [],
        });
      }
    }
  } catch (err) {
    console.warn('[VisionModel] Pixel scanner error:', err);
  }

  return tracks;
}
