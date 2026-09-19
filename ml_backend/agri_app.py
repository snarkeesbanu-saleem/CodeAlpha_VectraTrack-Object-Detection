"""
VectraTrack Agriculture — Streamlit Web App (v1.0)
====================================================
Project: VectraTrack: Real-time Multi-Object Tracking System
         for Crop and Pest Monitoring in Precision Agriculture

Tabs:
  1. 🎥 Live Monitor     — Real-time webcam crop/pest detection
  2. 📹 Field Analysis   — Upload farm video → full annotated analysis
  3. 📊 Dashboard        — Analytics: health score, zone map, speed, proximity
  4. 📋 Project Report   — Auto-generated session summary & recommendations

Innovative Features:
  • Field Health Score (0-100 composite metric)
  • 3×3 Zone Invasion Map (hotspot detection)
  • Crop-Pest Proximity Alert (real-time early warning)
  • Pest Speed / Behaviour Classification
  • Dual-colour HUD (Green=Crop, Amber=Pest, Red=Alert)
  • ByteTrack 2-Stage occlusion-robust tracking
  • 3 downloadable CSVs (telemetry + proximity + alerts)
"""

import streamlit as st
from ultralytics import YOLO
import cv2
import numpy as np
import tempfile
import time
import threading
import pandas as pd

from custom_tracker import CustomSortTracker
from agri_mapper import (
    AgriClassMapper, PestAlertEngine, ProximityDetector,
    ZoneAnalyzer, PestSpeedClassifier, FieldHealthScorer,
    AgriTelemetryLogger, draw_agri_overlay,
    CROP_RGB, PEST_RGB, ALERT_RGB,
)

try:
    from streamlit_webrtc import webrtc_streamer, WebRtcMode, RTCConfiguration
    import av
    WEBRTC_OK = True
except ImportError:
    WEBRTC_OK = False

# ── Page Config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="VectraTrack Agriculture",
    page_icon="🌾",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── CSS — Agriculture Green Theme ─────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');
header{visibility:hidden;} footer{visibility:hidden;} .stDeployButton{display:none;}

.stApp{
  background:radial-gradient(ellipse at 10% 10%,#052e10 0%,#020d04 55%,#010801 100%);
  font-family:'Share Tech Mono',monospace; color:#d4f5d4;
}
[data-testid="stSidebar"]{
  background:rgba(3,15,5,0.95)!important;
  border-right:1px solid rgba(34,197,94,0.3);
  backdrop-filter:blur(14px);
}
[data-testid="stSidebar"]*{color:#86efac!important;font-family:'Share Tech Mono',monospace!important;}
h1{
  font-family:'Orbitron',sans-serif!important; color:#fff!important;
  text-shadow:0 0 5px #fff,0 0 20px #22c55e,0 0 50px #22c55e,0 0 90px #16a34a;
  letter-spacing:4px; text-transform:uppercase; text-align:center;
}
h2,h3{font-family:'Orbitron',sans-serif!important; color:#4ade80!important;
      letter-spacing:2px; text-shadow:0 0 10px rgba(34,197,94,0.5);}
[data-testid="stTabs"] button{
  font-family:'Orbitron',sans-serif!important; color:#86efac!important;
  font-size:0.78rem!important; letter-spacing:1px; text-transform:uppercase;
  border-radius:8px 8px 0 0!important;
}
[data-testid="stTabs"] button[aria-selected="true"]{
  color:#fff!important; background:rgba(34,197,94,0.12)!important;
  border-bottom:2px solid #22c55e!important;
  box-shadow:0 0 12px rgba(34,197,94,0.3);
}
[data-testid="stMetric"]{
  background:rgba(34,197,94,0.07); border:1px solid rgba(34,197,94,0.22);
  border-radius:12px; padding:1rem; box-shadow:0 0 15px rgba(34,197,94,0.08);
}
[data-testid="stMetricLabel"]{color:#86efac!important;font-size:0.75rem!important;}
[data-testid="stMetricValue"]{color:#fff!important;font-family:'Orbitron',sans-serif!important;}
.stButton>button,.stDownloadButton>button{
  background:linear-gradient(90deg,rgba(22,101,52,0.2),rgba(34,197,94,0.35))!important;
  color:#fff!important; border:1px solid #22c55e!important; border-radius:8px!important;
  box-shadow:0 0 12px rgba(34,197,94,0.35); font-family:'Orbitron',sans-serif!important;
  text-transform:uppercase; letter-spacing:2px; font-weight:700; transition:all 0.3s;
}
.stButton>button:hover,.stDownloadButton>button:hover{
  background:#22c55e!important; box-shadow:0 0 25px #22c55e!important;
  transform:translateY(-2px);
}
.alert-box{
  background:rgba(239,68,68,0.15); border:2px solid #ef4444;
  border-radius:12px; padding:1rem; text-align:center;
  animation:pulse 1s infinite alternate;
}
@keyframes pulse{from{box-shadow:0 0 10px rgba(239,68,68,0.4);}
                 to{box-shadow:0 0 30px rgba(239,68,68,0.9);}}
hr{border-color:rgba(34,197,94,0.2)!important;}
</style>
""", unsafe_allow_html=True)

# ── Header ────────────────────────────────────────────────────────────────────
st.markdown("""
<div style='text-align:center;padding:0.8rem 0 1.2rem;'>
<h1>🌾 VECTRATRACK AGRICULTURE 🌾</h1>
<p style='color:#86efac;font-size:0.85rem;letter-spacing:3px;'>
REAL-TIME CROP & PEST MONITORING · BYTETRACK 2-STAGE · ZONE ANALYSIS · HEALTH SCORE
</p></div>
""", unsafe_allow_html=True)

# ── Model ─────────────────────────────────────────────────────────────────────
@st.cache_resource
def load_model():
    return YOLO("yolov8n.pt")
model = load_model()

# ── Shared instances ──────────────────────────────────────────────────────────
mapper    = AgriClassMapper()
speed_clf = PestSpeedClassifier()

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## ⚙️ MONITORING CONFIG")
    st.markdown("---")
    st.markdown("### 🎯 Detection")
    conf_high     = st.slider("Detection Confidence",  0.2, 0.9, 0.45, 0.05)
    conf_low      = st.slider("Low-Conf (Occlusion)",  0.05,0.4, 0.10, 0.05)
    iou_thr       = st.slider("IoU Threshold",         0.1, 0.9, 0.30, 0.05)
    st.markdown("---")
    st.markdown("### 🚨 Pest Alert")
    pest_thresh   = st.slider("Alert Threshold (pests)", 1, 20, 5)
    prox_radius   = st.slider("Proximity Radius (px)",  30, 200, 80)
    st.markdown("---")
    st.markdown("### 🗺️ Display")
    display_mode  = st.radio("Show Objects", ["all","crop","pest"],
                             format_func=lambda x: {"all":"🌱+🐛 All","crop":"🌱 Crops Only","pest":"🐛 Pests Only"}[x])
    show_trail    = st.toggle("Pest Trails",           value=True)
    show_future   = st.toggle("Future Prediction",     value=True)
    show_zones    = st.toggle("Zone Grid Overlay",     value=True)
    trail_len     = st.slider("Trail Length",          5, 60, 35)
    st.markdown("---")
    st.markdown("""
    <div style='font-size:0.7rem;color:#166534;text-align:center;line-height:2;'>
    VectraTrack Agriculture v1.0<br>
    🌾 Precision Agriculture AI<br>
    ByteTrack · Kalman · Zone Analysis<br>
    Health Score · Proximity Alert
    </div>""", unsafe_allow_html=True)


# =============================================================================
# VIDEO PROCESSING CORE
# =============================================================================

def process_field_video(video_path):
    """Full agriculture analysis pipeline for uploaded video."""
    cap      = cv2.VideoCapture(video_path)
    fps_src  = cap.get(cv2.CAP_PROP_FPS) or 25
    width    = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height   = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    tmp      = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    out_path = tmp.name; tmp.close()
    writer   = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*"mp4v"),
                               fps_src, (width, height))

    # ── Init all modules ──
    tracker   = CustomSortTracker(max_age=30, min_hits=2,
                                  iou_threshold=iou_thr,
                                  high_conf=conf_high, low_conf=conf_low)
    alert_eng = PestAlertEngine(threshold=pest_thresh)
    prox_det  = ProximityDetector(radius_px=prox_radius)
    zone_ana  = ZoneAnalyzer(width, height, grid_n=3)
    health    = FieldHealthScorer()
    telem     = AgriTelemetryLogger()

    frame_idx  = 0
    total_time = 0.0
    # Summary accumulators
    all_telemetry = []
    health_history = []

    progress = st.progress(0, text="Initialising VectraTrack Agriculture…")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break

        t0 = time.perf_counter()

        # 1. Detect (using low conf to catch occluded pests too)
        results = model.predict(frame, conf=conf_low, verbose=False)
        boxes   = results[0].boxes
        dets    = []
        if boxes is not None and len(boxes) > 0:
            for box in boxes:
                cid = int(box.cls[0])
                cat, _, _ = mapper.get(cid)
                if cat == "ignore": continue
                x1,y1,x2,y2 = map(float, box.xyxy[0])
                dets.append([x1,y1,x2,y2, float(box.conf[0]), cid])

        dets_np = np.array(dets) if dets else np.empty((0,6))

        # 2. Track
        tracks  = tracker.update(dets_np)

        # 3. Analytics
        pest_alert, pest_cnt, crop_cnt = alert_eng.check(tracks, frame_idx, mapper)
        prox_events = prox_det.check(tracks, frame_idx, mapper)
        pest_grid, crop_grid = zone_ana.update(tracks, mapper)
        score = health.update(crop_cnt, pest_cnt, len(prox_events))
        health_history.append(score)

        elapsed    = time.perf_counter() - t0
        total_time += elapsed
        frame_fps  = 1.0/elapsed if elapsed > 0 else 0

        # 4. Log
        telem.log_frame(frame_idx, tracks, pest_alert,
                        crop_cnt, pest_cnt, score, zone_ana, fps=frame_fps)
        telem.log_proximity(prox_events)
        if pest_alert:
            telem.log_alert(frame_idx, pest_cnt, score)

        for trk in tracks:
            cat, label, _ = mapper.get(trk.get("cls",-1))
            if cat != "ignore":
                all_telemetry.append({
                    "frame":      frame_idx,
                    "id":         trk["id"],
                    "agri_class": cat,
                    "label":      label,
                    "speed":      trk.get("speed",0.0),
                    "occluded":   int(trk.get("occluded",False)),
                    "alert":      int(pest_alert),
                })

        # 5. Draw
        frame = draw_agri_overlay(
            frame, tracks, mapper, pest_alert,
            show_trail=show_trail, trail_len=trail_len,
            show_future=show_future, show_zones=show_zones,
            zone_analyzer=zone_ana, pest_grid=pest_grid, crop_grid=crop_grid,
            proximity_events=prox_events, display_mode=display_mode,
            speed_clf=speed_clf,
        )

        # Health score HUD
        grade, _ = FieldHealthScorer.grade(score)
        cv2.putText(frame, f"Health:{score:.0f} {grade}",
                    (width-220, 20), cv2.FONT_HERSHEY_SIMPLEX,
                    0.48, (34,197,94) if score>=75 else (239,68,68), 1, cv2.LINE_AA)
        cv2.putText(frame, f"FPS:{frame_fps:.1f}",
                    (width-80, 40), cv2.FONT_HERSHEY_SIMPLEX,
                    0.42, (200,200,200), 1, cv2.LINE_AA)

        writer.write(frame)
        frame_idx += 1
        progress.progress(min(frame_idx/max(n_frames,1), 1.0),
                          text=f"Frame {frame_idx}/{n_frames}  |  "
                               f"Crops:{crop_cnt}  Pests:{pest_cnt}  "
                               f"Health:{score:.0f}")

    cap.release(); writer.release(); progress.empty()

    timing = {
        "frames":         frame_idx,
        "time_s":         round(total_time, 2),
        "avg_fps":        round(frame_idx/total_time, 1) if total_time>0 else 0,
        "unique_ids":     len(set(r["id"] for r in all_telemetry)),
        "total_alerts":   alert_eng.total_alerts,
        "prox_events":    len(prox_det.events),
        "final_health":   round(health.score, 1),
        "min_health":     round(min(health_history), 1) if health_history else 0,
        "recommendation": health.recommendation(),
        "hotspot_zone":   zone_ana.hotspot_zone(),
    }
    return out_path, all_telemetry, timing, telem, zone_ana, health, alert_eng, prox_det


# =============================================================================
# TAB 1 — LIVE MONITOR
# =============================================================================

class AgriLiveTracker:
    def __init__(self):
        self.tracker    = CustomSortTracker(max_age=20, min_hits=2,
                                            iou_threshold=0.3,
                                            high_conf=0.45, low_conf=0.1)
        self.alert_eng  = PestAlertEngine(threshold=pest_thresh)
        self.prox_det   = ProximityDetector(radius_px=prox_radius)
        self.health     = FieldHealthScorer()
        self.lock       = threading.Lock()
        self.stats      = {"fps":0.0,"crops":0,"pests":0,"score":100.0,"alert":False}

    def process(self, frame_bgr, frame_idx):
        t0 = time.perf_counter()
        results = model.predict(frame_bgr, conf=conf_low, verbose=False)
        boxes   = results[0].boxes
        dets = []
        if boxes is not None and len(boxes)>0:
            for box in boxes:
                cid = int(box.cls[0])
                cat,_,_ = mapper.get(cid)
                if cat=="ignore": continue
                x1,y1,x2,y2 = map(float, box.xyxy[0])
                dets.append([x1,y1,x2,y2,float(box.conf[0]),cid])
        dets_np = np.array(dets) if dets else np.empty((0,6))
        with self.lock:
            tracks = self.tracker.update(dets_np)
        pest_alert, pest_cnt, crop_cnt = self.alert_eng.check(tracks, frame_idx, mapper)
        prox_ev = self.prox_det.check(tracks, frame_idx, mapper)
        score   = self.health.update(crop_cnt, pest_cnt, len(prox_ev))
        out     = draw_agri_overlay(
            frame_bgr.copy(), tracks, mapper, pest_alert,
            show_trail=show_trail, trail_len=trail_len,
            show_future=show_future, show_zones=False,
            display_mode=display_mode, speed_clf=speed_clf,
            proximity_events=prox_ev,
        )
        fps = 1.0/(time.perf_counter()-t0+1e-6)
        cv2.putText(out, f"FPS:{fps:.1f} | H:{score:.0f}",
                    (8,40), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (34,197,94), 1, cv2.LINE_AA)
        if pest_alert:
            cv2.putText(out, "!! PEST ALERT !!", (out.shape[1]//2-90, out.shape[0]-15),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,255), 2, cv2.LINE_AA)
        with self.lock:
            self.stats = {"fps":round(fps,1),"crops":crop_cnt,"pests":pest_cnt,
                          "score":score,"alert":pest_alert}
        return out


def render_live_tab():
    st.markdown("## 🎥 LIVE FIELD MONITOR")
    st.markdown("<p style='color:#86efac;font-size:0.85rem;'>Real-time crop and pest detection from camera feed.</p>",
                unsafe_allow_html=True)

    if not WEBRTC_OK:
        st.error("Install streamlit-webrtc: `pip install streamlit-webrtc av`")
        return

    if "agri_live" not in st.session_state:
        st.session_state.agri_live = AgriLiveTracker()
        st.session_state.live_frame = 0
    lt = st.session_state.agri_live

    c_stream, c_stats = st.columns([3,1])
    with c_stream:
        RTC = RTCConfiguration({"iceServers":[{"urls":["stun:stun.l.google.com:19302"]}]})
        def cb(frame):
            img = frame.to_ndarray(format="bgr24")
            st.session_state.live_frame += 1
            out = lt.process(img, st.session_state.live_frame)
            return av.VideoFrame.from_ndarray(out, format="bgr24")

        webrtc_streamer(key="agri-live", mode=WebRtcMode.SENDRECV,
                        rtc_configuration=RTC,
                        video_frame_callback=cb,
                        media_stream_constraints={"video":{"width":640,"height":480},"audio":False},
                        async_processing=True)

    with c_stats:
        st.markdown("### 📡 LIVE STATS")
        s = lt.stats
        st.metric("🌱 Crops",   s.get("crops",0))
        st.metric("🐛 Pests",   s.get("pests",0))
        st.metric("⚡ FPS",     s.get("fps",0))
        grade, gcol = FieldHealthScorer.grade(s.get("score",100))
        st.markdown(f"<div style='text-align:center;font-size:1.5rem;color:{gcol};font-family:Orbitron,sans-serif;'>"
                    f"{s.get('score',100):.0f}<br><span style='font-size:0.7rem;'>{grade}</span></div>",
                    unsafe_allow_html=True)
        if s.get("alert"):
            st.markdown("<div class='alert-box'>🚨 PEST ALERT</div>",
                        unsafe_allow_html=True)
        st.markdown("---")
        st.caption("🌱 Green = Crop\n🐛 Amber = Pest\n🔴 Red = Alert")


# =============================================================================
# TAB 2 — FIELD VIDEO ANALYSIS
# =============================================================================

def render_analysis_tab():
    st.markdown("## 📹 FIELD VIDEO ANALYSIS")
    st.markdown("<p style='color:#86efac;font-size:0.85rem;'>Upload a field recording for complete crop & pest analysis.</p>",
                unsafe_allow_html=True)

    uploaded = st.file_uploader("Upload field video (MP4, AVI, MOV)…",
                                type=["mp4","avi","mov","mkv"],
                                label_visibility="collapsed")
    if uploaded is None:
        st.info("👆 Upload a farm video above to begin analysis.")
        return

    tfile = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    tfile.write(uploaded.read()); tfile.flush()
    video_path = tfile.name

    c1, c2 = st.columns([2,1])
    with c1: st.video(video_path)
    with c2:
        st.markdown("### ⚡ Config")
        st.info(
            f"**Confidence:** {conf_high} / {conf_low} (low)\n\n"
            f"**Pest Alert at:** {pest_thresh} pests\n\n"
            f"**Proximity Radius:** {prox_radius}px\n\n"
            f"**Zone Grid:** 3×3 ({'ON' if show_zones else 'OFF'})\n\n"
            f"**Display:** {display_mode.upper()}"
        )
        st.success("✅ ByteTrack 2-Stage + Kalman Filter\n\n"
                   "✅ Zone Invasion Mapping\n\n"
                   "✅ Proximity Alert\n\n"
                   "✅ Field Health Score")

    st.markdown("---")
    if st.button("▶ LAUNCH AGRICULTURE ANALYSIS", use_container_width=True):
        with st.spinner("Analysing field video with VectraTrack Agriculture…"):
            (out_path, telemetry, timing,
             telem_obj, zone_ana, health,
             alert_eng, prox_det) = process_field_video(video_path)

        # Store results in session for Dashboard tab
        st.session_state.agri_results = {
            "telemetry": telemetry, "timing": timing,
            "telem": telem_obj, "zone_ana": zone_ana,
            "health": health, "alert_eng": alert_eng, "prox_det": prox_det,
        }

        st.success("✅ Analysis complete!")

        # Output video
        cd, cv2_ = st.columns([1,2])
        with cd:
            with open(out_path,"rb") as f:
                st.download_button("⬇️ Download Annotated Video",
                                   f.read(),"vectratrack_agri.mp4","video/mp4",
                                   use_container_width=True)
        with cv2_:
            try: st.video(out_path)
            except: st.warning("Preview unavailable — download above.")

        # Quick summary metrics
        st.markdown("---")
        st.markdown("### ⚡ QUICK RESULTS")
        cols = st.columns(6)
        cols[0].metric("⏱ Avg FPS",         timing["avg_fps"])
        cols[1].metric("🎯 Unique Objects",  timing["unique_ids"])
        cols[2].metric("🚨 Pest Alerts",     timing["total_alerts"])
        cols[3].metric("🔔 Proximity Evts",  timing["prox_events"])
        cols[4].metric("💚 Final Health",    timing["final_health"])
        cols[5].metric("🔻 Min Health",      timing["min_health"])

        hs = timing["final_health"]
        _, hcol = FieldHealthScorer.grade(hs)
        st.markdown(f"""
        <div style='background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.2);
        border-radius:12px;padding:1rem;margin-top:1rem;'>
        <b style='color:#4ade80;font-size:1rem;'>📋 Recommendation</b><br>
        <span style='color:#d4f5d4;'>{timing["recommendation"]}</span>
        </div>""", unsafe_allow_html=True)

        # CSV Downloads
        st.markdown("---")
        st.markdown("### 🗂️ Export Data")
        d1,d2,d3 = st.columns(3)
        with d1:
            st.download_button("⬇️ Tracking CSV", telem_obj.get_tracks_csv(),
                               "agri_tracking.csv","text/csv",use_container_width=True)
        with d2:
            prox_csv = telem_obj.get_proximity_csv()
            if prox_csv:
                st.download_button("⬇️ Proximity Events CSV", prox_csv,
                                   "agri_proximity.csv","text/csv",use_container_width=True)
        with d3:
            alert_csv = telem_obj.get_alerts_csv()
            if alert_csv:
                st.download_button("⬇️ Pest Alerts CSV", alert_csv,
                                   "agri_alerts.csv","text/csv",use_container_width=True)

        st.info("👉 Open the **📊 Dashboard** tab to see full analytics!")


# =============================================================================
# TAB 3 — ANALYTICS DASHBOARD
# =============================================================================

def render_dashboard_tab():
    st.markdown("## 📊 AGRICULTURE ANALYTICS DASHBOARD")

    if "agri_results" not in st.session_state:
        st.info("Run a **Field Video Analysis** first (Tab 2) to populate this dashboard.")
        return

    r = st.session_state.agri_results
    df = pd.DataFrame(r["telemetry"])
    if df.empty:
        st.warning("No agriculture objects tracked."); return

    health  = r["health"]
    zone_ana = r["zone_ana"]
    prox_det = r["prox_det"]
    timing   = r["timing"]

    # ── Row 1: Key metrics ────────────────────────────────────────────────
    st.markdown("### 🌾 Session Overview")
    c1,c2,c3,c4,c5 = st.columns(5)
    crops_df = df[df["agri_class"]=="crop"]
    pests_df = df[df["agri_class"]=="pest"]
    c1.metric("🌱 Total Crop IDs",   df[df["agri_class"]=="crop"]["id"].nunique())
    c2.metric("🐛 Total Pest IDs",   df[df["agri_class"]=="pest"]["id"].nunique())
    c3.metric("🚨 Alert Frames",      timing["total_alerts"])
    c4.metric("🔔 Proximity Events",  timing["prox_events"])
    hs = timing["final_health"]
    grade, gcol = FieldHealthScorer.grade(hs)
    c5.markdown(f"""
    <div style='background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.22);
    border-radius:12px;padding:1rem;text-align:center;'>
    <div style='color:#86efac;font-size:0.75rem;'>🌿 FIELD HEALTH SCORE</div>
    <div style='color:{gcol};font-family:Orbitron,sans-serif;font-size:2rem;'>{hs:.0f}</div>
    <div style='color:{gcol};font-size:0.8rem;'>{grade}</div>
    </div>""", unsafe_allow_html=True)

    st.markdown("---")

    # ── Row 2: Count timeline + Class breakdown ────────────────────────────
    ca, cb = st.columns(2)
    with ca:
        st.markdown("### 📈 Crop & Pest Count Over Time")
        cot = df.groupby(["frame","agri_class"])["id"].count().reset_index()
        cot.columns = ["Frame","Class","Count"]
        crop_t = cot[cot["Class"]=="crop"].set_index("Frame")["Count"]
        pest_t = cot[cot["Class"]=="pest"].set_index("Frame")["Count"]
        combined = pd.DataFrame({"🌱 Crops": crop_t, "🐛 Pests": pest_t}).fillna(0)
        st.line_chart(combined)

    with cb:
        st.markdown("### 🔮 Species Breakdown")
        sp_df = df.groupby("label")["id"].nunique().reset_index()
        sp_df.columns = ["Species","Unique IDs"]
        sp_df = sp_df.sort_values("Unique IDs", ascending=False)
        st.bar_chart(sp_df.set_index("Species"))

    st.markdown("---")

    # ── Row 3: Health Score timeline + Zone map ───────────────────────────
    cc, cd_ = st.columns(2)
    with cc:
        st.markdown("### 💚 Field Health Score Timeline")
        if health.history:
            hdf = pd.DataFrame({"Frame":range(len(health.history)),
                                 "Health Score":health.history})
            st.line_chart(hdf.set_index("Frame"), color="#22c55e")
        else:
            st.info("No health history available.")

    with cd_:
        st.markdown("### 🗺️ Zone Invasion Heatmap")
        heat_png = zone_ana.get_invasion_heatmap_png()
        st.image(heat_png,
                 caption=f"Pest invasion density — 3×3 grid  |  "
                         f"Hotspot: Zone {zone_ana.hotspot_zone()}",
                 use_container_width=True)
        st.download_button("⬇️ Download Zone Map",
                           heat_png,"agri_zone_map.png","image/png",
                           use_container_width=True)

    st.markdown("---")

    # ── Row 4: Pest speed + Proximity events ─────────────────────────────
    ce, cf = st.columns(2)
    with ce:
        st.markdown("### 💨 Pest Behaviour Classification")
        if not pests_df.empty:
            pests_df2 = pests_df.copy()
            pests_df2["behaviour"] = pests_df2["speed"].apply(speed_clf.classify)
            beh = pests_df2["behaviour"].value_counts().reset_index()
            beh.columns = ["Behaviour","Count"]
            st.bar_chart(beh.set_index("Behaviour"), color="#f59e0b")
            st.caption("Foraging (<1.5 px/f) · Walking (1.5-5) · Flying (>5)")
        else:
            st.info("No pest tracks detected.")

    with cf:
        st.markdown("### 🔔 Proximity Alert Events")
        if prox_det.events:
            prox_df = pd.DataFrame(prox_det.events)
            st.dataframe(prox_df, use_container_width=True)
        else:
            st.info("No proximity events recorded.")

    st.markdown("---")

    # ── Recommendation ────────────────────────────────────────────────────
    st.markdown("### 📋 AUTO RECOMMENDATIONS")
    hz = zone_ana.hotspot_zone()
    hz_name = f"Zone {hz[0]*zone_ana.n+hz[1]+1}" if hz else "None"
    recs = [
        health.recommendation(),
        f"🗺️ Highest pest activity detected in **{hz_name}** — prioritise inspection there.",
    ]
    if pests_df["speed"].max() > 5 if not pests_df.empty else False:
        recs.append("💨 Fast-moving (Flying) pests detected — likely bird species. Consider netting.")
    if timing["prox_events"] > 0:
        recs.append(f"🔔 {timing['prox_events']} proximity events recorded — pests directly threatened crops.")

    for r_txt in recs:
        st.markdown(f"""
        <div style='background:rgba(34,197,94,0.06);border-left:3px solid #22c55e;
        border-radius:4px;padding:0.6rem 1rem;margin-bottom:0.5rem;color:#d4f5d4;'>
        {r_txt}</div>""", unsafe_allow_html=True)


# =============================================================================
# TAB 4 — PROJECT REPORT
# =============================================================================

def render_report_tab():
    st.markdown("## 📋 PROJECT REPORT")

    st.markdown("""
    <div style='background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.2);
    border-radius:16px;padding:2rem;'>
    <h3 style='color:#4ade80;font-family:Orbitron,sans-serif;'>
    VectraTrack: Real-time Multi-Object Tracking System<br>for Crop and Pest Monitoring
    </h3>
    <p style='color:#86efac;font-size:0.85rem;letter-spacing:1px;'>PRECISION AGRICULTURE · 7th SEMESTER PROJECT</p>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("---")

    t1,t2,t3 = st.tabs(["📐 Architecture","🧠 Algorithms","📊 Features"])

    with t1:
        st.markdown("""
```
Video Input (Camera / Uploaded Video)
         ↓
YOLOv8 nano — Object Detection (80 COCO classes)
         ↓
AgriClassMapper — Crop / Pest / Ignore filter
         ↓
CustomSortTracker — ByteTrack 2-Stage Association
  • Stage 1: High-conf dets ↔ All tracks  (strict IoU)
  • Stage 2: Low-conf dets  ↔ Unmatched   (relaxed IoU)
  • Kalman Filter — 7D state estimation
  • Hungarian Algorithm — optimal assignment
         ↓
Analytics Engine:
  • PestAlertEngine    — density threshold alerts
  • ProximityDetector  — pest enters crop radius → ⚠️
  • ZoneAnalyzer       — 3×3 grid invasion hotspot
  • PestSpeedClassifier— Foraging/Walking/Flying
  • FieldHealthScorer  — 0-100 composite metric
         ↓
Streamlit Dashboard:
  • Live dual-colour HUD (Green=Crop / Amber=Pest)
  • Live Monitor (WebRTC webcam)
  • Field Video Analysis + annotated output
  • Analytics Dashboard + Zone Map
  • 3 CSV downloads (tracking, proximity, alerts)
```
        """)

    with t2:
        st.markdown(r"""
**Kalman Filter State (7D):**
$$x = [c_x,\ c_y,\ s,\ r,\ \dot{c}_x,\ \dot{c}_y,\ \dot{s}]^T$$

**ByteTrack Two-Stage:**
| Stage | Detections | Tracks | Gate |
|---|---|---|---|
| 1 | conf ≥ 0.45 | All active | Strict IoU |
| 2 | 0.10–0.45 | Unmatched only | Relaxed IoU |

**Field Health Score:**
$$H_t = \alpha \cdot H_{raw} + (1-\alpha) \cdot H_{t-1}$$
$$H_{raw} = 100 - 4P + 1.5C - 8E \quad \in [0,100]$$
where $P$=pests, $C$=crops, $E$=proximity events, $\alpha=0.15$

**Proximity Detection:**
$$d = \sqrt{(x_P - x_C)^2 + (y_P - y_C)^2} < r_{threshold}$$
        """)

    with t3:
        col1, col2 = st.columns(2)
        with col1:
            st.markdown("""
**Core Features:**
- ✅ Real-time crop + pest dual tracking
- ✅ Unique ID per object (stable across frames)
- ✅ Class-wise counting (Crop / Pest / By species)
- ✅ Occlusion handling (ByteTrack 2-stage)
- ✅ Motion trail visualization (pests only)
- ✅ Future trajectory prediction (Kalman)
- ✅ Live camera support (WebRTC)
- ✅ Video upload + annotated output
            """)
        with col2:
            st.markdown("""
**Innovative Features:**
- 🔥 Field Health Score (0-100, real-time EMA)
- 🔥 3×3 Zone Invasion Map (hotspot detection)
- 🔥 Crop-Pest Proximity Alert (radius guard)
- 🔥 Pest Speed/Behaviour Classification
- 🔥 Auto Recommendations (zone + behaviour)
- 🔥 3 separate CSV exports
- 🔥 Zone invasion heatmap PNG
- 🔥 Dark agriculture green theme
            """)

    st.markdown("---")
    st.markdown("""
    <div style='text-align:center;background:rgba(34,197,94,0.06);
    border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:1.5rem;'>
    <p style='color:#4ade80;font-family:Orbitron,sans-serif;font-size:1rem;letter-spacing:2px;'>
    PROJECT PITCH</p>
    <p style='color:#d4f5d4;font-size:0.95rem;font-style:italic;'>
    "VectraTrack is a real-time browser-based multi-object tracking system that simultaneously 
    monitors crops and pests, providing counting, trajectory, and actionable insights 
    for precision agriculture."
    </p>
    <p style='color:#86efac;font-size:0.75rem;letter-spacing:2px;margin-top:1rem;'>
    STACK: YOLOv8 · ByteTrack · Kalman Filter · Streamlit · OpenCV · SciPy · NumPy
    </p>
    </div>
    """, unsafe_allow_html=True)


# =============================================================================
# MAIN
# =============================================================================

tab1, tab2, tab3, tab4 = st.tabs([
    "🎥  Live Monitor",
    "📹  Field Analysis",
    "📊  Dashboard",
    "📋  Project Report",
])

with tab1: render_live_tab()
with tab2: render_analysis_tab()
with tab3: render_dashboard_tab()
with tab4: render_report_tab()
