"""
VectraTrack Agriculture — Mapping & Analytics Engine
======================================================
Innovative modules:
  AgriClassMapper      — COCO-80 → Crop / Pest / Ignore
  PestAlertEngine      — Density threshold alert + event log
  ProximityDetector    — Detects when pest enters crop's safety radius
  ZoneAnalyzer         — 3×3 grid zone monitoring (invasion hotspot map)
  PestSpeedClassifier  — Slow / Medium / Fast pest movement tagging
  FieldHealthScorer    — 0-100 composite Field Health Score per frame
  AgriTelemetryLogger  — Agriculture-format CSV (agri_class, zone, alert, health)
"""

import numpy as np
import cv2
from collections import defaultdict

# ── COCO class list (80 classes, 0-indexed) ──────────────────────────────────
COCO_CLASSES = [
    "person","bicycle","car","motorcycle","airplane","bus","train","truck","boat",
    "traffic light","fire hydrant","stop sign","parking meter","bench",
    "bird","cat","dog","horse","sheep","cow","elephant","bear","zebra","giraffe",
    "backpack","umbrella","handbag","tie","suitcase","frisbee","skis",
    "snowboard","sports ball","kite","baseball bat","baseball glove",
    "skateboard","surfboard","tennis racket",
    "bottle","wine glass","cup","fork","knife","spoon","bowl",
    "banana","apple","sandwich","orange","broccoli","carrot","hot dog",
    "pizza","donut","cake",
    "chair","couch","potted plant","bed","dining table","toilet",
    "tv","laptop","mouse","remote","keyboard","cell phone",
    "microwave","oven","toaster","sink","refrigerator","book",
    "clock","vase","scissors","teddy bear","hair drier","toothbrush",
]

# ── Agriculture class mapping ─────────────────────────────────────────────────
#   (coco_name) → (agri_category, display_emoji_label)
AGRI_MAP = {
    # Crops
    "banana":       ("crop", "🍌 Banana"),
    "apple":        ("crop", "🍎 Apple"),
    "orange":       ("crop", "🍊 Orange"),
    "broccoli":     ("crop", "🥦 Broccoli"),
    "carrot":       ("crop", "🥕 Carrot"),
    "potted plant": ("crop", "🌱 Plant"),
    "cake":         ("crop", "🌾 Grain"),
    "donut":        ("crop", "🌾 Crop"),
    # Pests
    "bird":         ("pest", "🐦 Bird"),
    "cat":          ("pest", "🐱 Cat"),
    "dog":          ("pest", "🐕 Dog"),
    "mouse":        ("pest", "🐭 Rodent"),
    "bear":         ("pest", "🐻 Bear"),
    "elephant":     ("pest", "🐘 Elephant"),
    "cow":          ("pest", "🐄 Bovine"),
    "sheep":        ("pest", "🐑 Sheep"),
    "horse":        ("pest", "🐎 Horse"),
    "zebra":        ("pest", "🦓 Zebra"),
}

# Colour palette (BGR for OpenCV)
CROP_BGR   = (34,  197,  94)   # green
PEST_BGR   = (11,  158, 245)   # amber
ALERT_BGR  = (68,   68, 239)   # red
WHITE_BGR  = (255, 255, 255)

# Colour palette (RGB for Streamlit)
CROP_RGB   = (34,  197,  94)
PEST_RGB   = (245, 158,  11)
ALERT_RGB  = (239,  68,  68)


# ── 1. Agriculture Class Mapper ───────────────────────────────────────────────

class AgriClassMapper:
    """Maps COCO class IDs to agriculture categories."""

    def get(self, cls_id: int):
        """
        Returns (category, emoji_label, bgr_colour) or ('ignore', None, None).
        category: 'crop' | 'pest' | 'ignore'
        """
        if 0 <= cls_id < len(COCO_CLASSES):
            name = COCO_CLASSES[cls_id]
            if name in AGRI_MAP:
                cat, label = AGRI_MAP[name]
                colour = CROP_BGR if cat == "crop" else PEST_BGR
                return cat, label, colour
        return "ignore", None, None

    def coco_name(self, cls_id: int) -> str:
        if 0 <= cls_id < len(COCO_CLASSES):
            return COCO_CLASSES[cls_id]
        return "unknown"

    def filter_detections(self, detections, mode="all"):
        """
        Filter detection array (N,6) by agriculture category.
        mode: 'all' | 'crop' | 'pest'
        Returns filtered detections and their categories list.
        """
        if len(detections) == 0:
            return detections, []
        kept, cats = [], []
        for det in detections:
            cls_id = int(det[5]) if det.shape[0] > 5 else -1
            cat, label, _ = self.get(cls_id)
            if cat == "ignore":
                continue
            if mode == "crop"  and cat != "crop": continue
            if mode == "pest"  and cat != "pest": continue
            kept.append(det)
            cats.append(cat)
        if not kept:
            return np.empty((0, 6)), []
        return np.array(kept), cats


# ── 2. Pest Alert Engine ──────────────────────────────────────────────────────

class PestAlertEngine:
    """
    Fires alerts when live pest count ≥ threshold.
    Tracks alert history and per-class pest counts.
    """

    def __init__(self, threshold=5):
        self.threshold   = threshold
        self.alert_log   = []          # {frame, pest_count, triggered}
        self.total_alerts = 0

    def check(self, tracks, frame_idx, mapper):
        """Returns (is_alert, pest_count, crop_count)."""
        pest_count = sum(1 for t in tracks
                         if mapper.get(t.get("cls",-1))[0] == "pest")
        crop_count = sum(1 for t in tracks
                         if mapper.get(t.get("cls",-1))[0] == "crop")
        triggered  = pest_count >= self.threshold
        entry = {"frame": frame_idx, "pest_count": pest_count,
                 "crop_count": crop_count, "alert": triggered}
        self.alert_log.append(entry)
        if triggered:
            self.total_alerts += 1
        return triggered, pest_count, crop_count


# ── 3. Proximity Detector ─────────────────────────────────────────────────────

class ProximityDetector:
    """
    Innovative Feature — Detects when a pest track enters the safety radius
    of a crop track. Generates proximity events used for early warning.
    """

    def __init__(self, radius_px=80):
        self.radius   = radius_px
        self.events   = []
        self._warned  = set()   # (pest_id, crop_id) pairs already warned

    def check(self, tracks, frame_idx, mapper):
        """
        Returns list of proximity events this frame:
          {frame, pest_id, pest_label, crop_id, crop_label, dist_px}
        """
        crops = [(t, mapper.get(t.get("cls",-1)))
                 for t in tracks if mapper.get(t.get("cls",-1))[0] == "crop"]
        pests = [(t, mapper.get(t.get("cls",-1)))
                 for t in tracks if mapper.get(t.get("cls",-1))[0] == "pest"]

        new_events = []
        for pt, (_, plabel, _) in pests:
            px, py = pt.get("centre", ((pt["bbox"][0]+pt["bbox"][2])/2,
                                       (pt["bbox"][1]+pt["bbox"][3])/2))
            for ct, (_, clabel, _) in crops:
                cx, cy = ct.get("centre", ((ct["bbox"][0]+ct["bbox"][2])/2,
                                           (ct["bbox"][1]+ct["bbox"][3])/2))
                dist = np.hypot(px - cx, py - cy)
                key  = (pt["id"], ct["id"])
                if dist <= self.radius:
                    if key not in self._warned:
                        ev = {"frame":frame_idx, "pest_id":pt["id"],
                              "pest_label":plabel or "pest",
                              "crop_id":ct["id"], "crop_label":clabel or "crop",
                              "dist_px":round(dist, 1)}
                        new_events.append(ev)
                        self.events.append(ev)
                        self._warned.add(key)
                else:
                    self._warned.discard(key)
        return new_events


# ── 4. Zone Analyzer ─────────────────────────────────────────────────────────

class ZoneAnalyzer:
    """
    Innovative Feature — Divides the frame into an N×N grid.
    Counts crops and pests per zone each frame.
    Builds cumulative zone invasion map for hotspot detection.
    """

    def __init__(self, frame_w, frame_h, grid_n=3):
        self.w      = frame_w
        self.h      = frame_h
        self.n      = grid_n
        # Accumulated pest counts per zone (for heatmap)
        self.pest_accum  = np.zeros((grid_n, grid_n), dtype=np.float32)
        self.crop_accum  = np.zeros((grid_n, grid_n), dtype=np.float32)
        self.frame_count = 0
        self.zone_history = []   # per-frame list of dicts

    def _zone(self, cx, cy):
        col = min(int(cx / self.w * self.n), self.n - 1)
        row = min(int(cy / self.h * self.n), self.n - 1)
        return row, col

    def update(self, tracks, mapper):
        pest_grid = np.zeros((self.n, self.n), dtype=int)
        crop_grid = np.zeros((self.n, self.n), dtype=int)
        for trk in tracks:
            cx, cy = trk.get("centre", ((trk["bbox"][0]+trk["bbox"][2])/2,
                                         (trk["bbox"][1]+trk["bbox"][3])/2))
            cat = mapper.get(trk.get("cls",-1))[0]
            row, col = self._zone(cx, cy)
            if cat == "pest":
                pest_grid[row, col] += 1
                self.pest_accum[row, col] += 1.0
            elif cat == "crop":
                crop_grid[row, col] += 1
                self.crop_accum[row, col] += 1.0
        self.frame_count += 1
        self.zone_history.append({"pest_grid": pest_grid.copy(),
                                   "crop_grid": crop_grid.copy()})
        return pest_grid, crop_grid

    def hotspot_zone(self):
        """Returns (row, col) of zone with highest cumulative pest count."""
        if self.pest_accum.max() == 0:
            return None
        idx = np.unravel_index(np.argmax(self.pest_accum), self.pest_accum.shape)
        return idx

    def render_grid_overlay(self, frame, pest_grid, crop_grid):
        """Draw semi-transparent zone grid onto frame."""
        h, w = frame.shape[:2]
        zh, zw = h // self.n, w // self.n
        overlay = frame.copy()
        for r in range(self.n):
            for c in range(self.n):
                x1, y1 = c*zw, r*zh
                x2, y2 = x1+zw, y1+zh
                pests = pest_grid[r, c]
                crops = crop_grid[r, c]
                if pests > 0:
                    alpha = min(0.15 + pests * 0.1, 0.5)
                    cv2.rectangle(overlay, (x1,y1),(x2,y2), ALERT_BGR, -1)
                    cv2.addWeighted(overlay,(alpha), frame,(1-alpha),0,frame)
                elif crops > 0:
                    alpha = min(0.08 + crops * 0.05, 0.3)
                    cv2.rectangle(overlay, (x1,y1),(x2,y2), CROP_BGR, -1)
                    cv2.addWeighted(overlay,(alpha), frame,(1-alpha),0,frame)
                cv2.rectangle(frame,(x1,y1),(x2,y2),(80,80,80),1,cv2.LINE_AA)
                zone_name = f"Z{r*self.n+c+1}"
                cv2.putText(frame, zone_name, (x1+4, y1+14),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.35, (150,150,150), 1, cv2.LINE_AA)
                if pests > 0 or crops > 0:
                    info = f"C:{crops} P:{pests}"
                    cv2.putText(frame, info, (x1+4, y2-6),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.3,
                                ALERT_BGR if pests > 0 else CROP_BGR, 1, cv2.LINE_AA)
        return frame

    def get_invasion_heatmap_png(self):
        """Returns PNG bytes of the cumulative pest zone heatmap."""
        if self.pest_accum.max() == 0:
            blank = np.zeros((300, 300, 3), dtype=np.uint8)
            _, buf = cv2.imencode(".png", blank)
            return buf.tobytes()
        norm = (self.pest_accum / (self.pest_accum.max() + 1e-6) * 255).astype(np.uint8)
        # Scale up for visibility
        large = cv2.resize(norm, (300, 300), interpolation=cv2.INTER_NEAREST)
        coloured = cv2.applyColorMap(large, cv2.COLORMAP_HOT)
        # Draw grid labels
        cell = 300 // self.n
        for r in range(self.n):
            for c in range(self.n):
                x, y = c*cell + 4, r*cell + 20
                cv2.putText(coloured, f"Z{r*self.n+c+1}",
                            (x,y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 1)
        _, buf = cv2.imencode(".png", coloured)
        return buf.tobytes()


# ── 5. Pest Speed Classifier ──────────────────────────────────────────────────

class PestSpeedClassifier:
    """
    Innovative Feature — Classifies pest movement speed and behaviour.
    Slow  : < 1.5 px/frame  → likely foraging / stationary
    Medium: 1.5–5  px/frame → walking / hopping
    Fast  : > 5    px/frame → flying / running — most dangerous
    """
    SLOW   = ("🐌 Foraging",  0,   1.5)
    MEDIUM = ("🚶 Walking",   1.5, 5.0)
    FAST   = ("💨 Flying",    5.0, 999)

    @staticmethod
    def classify(speed_px_per_frame: float) -> str:
        if speed_px_per_frame < 1.5:  return "Foraging"
        if speed_px_per_frame < 5.0:  return "Walking"
        return "Flying"

    @staticmethod
    def label(speed_px_per_frame: float) -> str:
        if speed_px_per_frame < 1.5:  return "🐌 Foraging"
        if speed_px_per_frame < 5.0:  return "🚶 Walking"
        return "💨 Flying"


# ── 6. Field Health Scorer ────────────────────────────────────────────────────

class FieldHealthScorer:
    """
    Innovative Feature — Computes a 0–100 Field Health Score each frame.

    Formula:
      base               = 100
      - 4   per pest present
      + 1.5 per crop present
      - 8   per proximity alert this frame
      Clamped [0, 100], smoothed with EMA (α=0.15)
    """

    def __init__(self):
        self.score          = 100.0
        self.history        = []
        self.alpha          = 0.15      # EMA smoothing

    def update(self, crop_count, pest_count, proximity_count):
        raw = 100.0
        raw -= pest_count      * 4.0
        raw += crop_count      * 1.5
        raw -= proximity_count * 8.0
        raw  = max(0.0, min(100.0, raw))
        # Exponential moving average
        self.score = self.alpha * raw + (1 - self.alpha) * self.score
        self.score = round(self.score, 1)
        self.history.append(self.score)
        return self.score

    @staticmethod
    def grade(score: float) -> tuple:
        """Returns (grade_str, hex_colour)."""
        if score >= 75: return ("🟢 Healthy",   "#22c55e")
        if score >= 45: return ("🟡 Moderate",  "#f59e0b")
        return              ("🔴 Critical",  "#ef4444")

    def recommendation(self) -> str:
        if self.score >= 75:
            return "✅ Field is healthy. Continue routine monitoring."
        if self.score >= 45:
            return ("⚠️ Moderate pest pressure detected. "
                    "Inspect highlighted zones and consider targeted intervention.")
        return ("🚨 CRITICAL: High pest density threatening crops. "
                "Immediate intervention recommended. Deploy pest control in red zones.")


# ── 7. Agriculture Telemetry Logger ──────────────────────────────────────────

class AgriTelemetryLogger:
    """Enhanced CSV logger with agriculture-specific columns."""

    def __init__(self):
        self.rows        = []
        self.prox_rows   = []
        self.alert_rows  = []
        self.mapper      = AgriClassMapper()
        self.speed_clf   = PestSpeedClassifier()

    def log_frame(self, frame_idx, tracks, pest_alert,
                  crop_count, pest_count, health_score,
                  zone_analyzer, fps=0.0):
        for trk in tracks:
            cls_id   = trk.get("cls", -1)
            cat, label, _ = self.mapper.get(cls_id)
            if cat == "ignore": continue
            coco_name = self.mapper.coco_name(cls_id)
            bbox      = trk.get("bbox", [0,0,0,0])
            cx, cy    = trk.get("centre", ((bbox[0]+bbox[2])/2, (bbox[1]+bbox[3])/2))
            speed     = trk.get("speed", 0.0)
            zone_str  = ""
            if zone_analyzer:
                r, c = zone_analyzer._zone(cx, cy)
                zone_str = f"Z{r*zone_analyzer.n+c+1}"
            self.rows.append({
                "frame":        frame_idx,
                "fps":          round(fps, 1),
                "track_id":     trk["id"],
                "agri_class":   cat,
                "coco_class":   coco_name,
                "display_label":label,
                "conf":         trk.get("conf", 0.0),
                "x1":           bbox[0], "y1": bbox[1],
                "x2":           bbox[2], "y2": bbox[3],
                "cx":           round(cx, 1), "cy": round(cy, 1),
                "speed_px_f":   speed,
                "behaviour":    self.speed_clf.classify(speed) if cat=="pest" else "Stationary",
                "zone":         zone_str,
                "age_frames":   trk.get("age", 0),
                "occluded":     int(trk.get("occluded", False)),
                "pest_alert":   int(pest_alert),
                "health_score": health_score,
                "total_crops":  crop_count,
                "total_pests":  pest_count,
            })

    def log_proximity(self, events):
        self.prox_rows.extend(events)

    def log_alert(self, frame_idx, pest_count, health_score):
        self.alert_rows.append({
            "frame":        frame_idx,
            "pest_count":   pest_count,
            "health_score": health_score,
        })

    def get_tracks_csv(self) -> bytes:
        import io, csv
        if not self.rows: return b""
        buf = io.StringIO()
        w   = csv.DictWriter(buf, fieldnames=list(self.rows[0].keys()))
        w.writeheader(); w.writerows(self.rows)
        return buf.getvalue().encode()

    def get_proximity_csv(self) -> bytes:
        import io, csv
        if not self.prox_rows: return b""
        buf = io.StringIO()
        w   = csv.DictWriter(buf, fieldnames=list(self.prox_rows[0].keys()))
        w.writeheader(); w.writerows(self.prox_rows)
        return buf.getvalue().encode()

    def get_alerts_csv(self) -> bytes:
        import io, csv
        if not self.alert_rows: return b""
        buf = io.StringIO()
        w   = csv.DictWriter(buf, fieldnames=list(self.alert_rows[0].keys()))
        w.writeheader(); w.writerows(self.alert_rows)
        return buf.getvalue().encode()

    def reset(self):
        self.rows = []; self.prox_rows = []; self.alert_rows = []


# ── Drawing Helper ────────────────────────────────────────────────────────────

def draw_agri_overlay(frame, tracks, mapper, alert_active,
                      show_trail=True, trail_len=30,
                      show_future=True, show_zones=False,
                      zone_analyzer=None, pest_grid=None, crop_grid=None,
                      proximity_events=None, display_mode="all",
                      speed_clf=None):
    """Draw agriculture HUD on frame (in-place)."""
    h, w = frame.shape[:2]

    # Zone grid overlay
    if show_zones and zone_analyzer and pest_grid is not None:
        frame = zone_analyzer.render_grid_overlay(frame, pest_grid, crop_grid)

    for trk in tracks:
        cls_id = trk.get("cls", -1)
        cat, label, colour = mapper.get(cls_id)
        if cat == "ignore": continue
        if display_mode == "crop" and cat != "crop": continue
        if display_mode == "pest" and cat != "pest": continue

        occ    = trk.get("occluded", False)
        x1,y1,x2,y2 = trk["bbox"]
        speed  = trk.get("speed", 0.0)

        # Pests flash red during alert
        if cat == "pest" and alert_active:
            colour = ALERT_BGR

        # Trail — only for pests (crops don't move)
        if show_trail and cat == "pest" and len(trk.get("history",[])) > 1:
            hist = trk["history"][-trail_len:]
            for i in range(1, len(hist)):
                a = i / len(hist)
                c = tuple(int(v*a) for v in colour)
                cv2.line(frame, (int(hist[i-1][0]),int(hist[i-1][1])),
                         (int(hist[i][0]),int(hist[i][1])), c,
                         max(1,int(a*2)), cv2.LINE_AA)

        # Future prediction — pests only
        if show_future and cat == "pest" and not occ and len(trk.get("future",[])) > 1:
            fut = trk["future"]
            for i in range(1, len(fut)):
                if i % 2 == 0: continue
                cv2.line(frame, (int(fut[i-1][0]),int(fut[i-1][1])),
                         (int(fut[i][0]),int(fut[i][1])), (255,255,255), 1, cv2.LINE_AA)

        # Bounding box
        box_col = colour if not occ else (100,100,100)
        cv2.rectangle(frame,(x1,y1),(x2,y2), box_col, 2, cv2.LINE_AA)
        # Corner brackets
        bl = min(14,(x2-x1)//4,(y2-y1)//4)
        for px,py,dx,dy in [(x1,y1,1,1),(x2,y1,-1,1),(x1,y2,1,-1),(x2,y2,-1,-1)]:
            cv2.line(frame,(px,py),(px+dx*bl,py),box_col,2,cv2.LINE_AA)
            cv2.line(frame,(px,py),(px,py+dy*bl),box_col,2,cv2.LINE_AA)

        # Label
        spd_tag = ""
        if cat == "pest" and speed_clf:
            spd_tag = f" {speed_clf.label(speed)}"
        lbl = f"#{trk['id']} {label or cat}{spd_tag}"
        (tw,th),_ = cv2.getTextSize(lbl, cv2.FONT_HERSHEY_SIMPLEX, 0.38, 1)
        lx,ly = x1, max(y1-5, 12)
        cv2.rectangle(frame,(lx-2,ly-th-4),(lx+tw+4,ly+2),(5,15,5),cv2.FILLED)
        cv2.putText(frame, lbl, (lx,ly), cv2.FONT_HERSHEY_SIMPLEX,
                    0.38, box_col, 1, cv2.LINE_AA)

        # Proximity alert ring
        if proximity_events:
            for ev in proximity_events:
                if ev["pest_id"] == trk["id"]:
                    cx_t = (x1+x2)//2; cy_t = (y1+y2)//2
                    cv2.circle(frame,(cx_t,cy_t),30,ALERT_BGR,2,cv2.LINE_AA)

    # Top HUD bar
    alert_txt = " ⚠ PEST ALERT!" if alert_active else ""
    hud = f"VectraTrack Agriculture{alert_txt}"
    hud_col = ALERT_BGR if alert_active else CROP_BGR
    cv2.putText(frame, hud, (8,20), cv2.FONT_HERSHEY_SIMPLEX,
                0.55, hud_col, 1, cv2.LINE_AA)

    return frame
