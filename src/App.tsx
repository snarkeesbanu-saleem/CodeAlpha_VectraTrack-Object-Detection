import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TrackerConfig, Track, SystemEvent, ChartDataPoint } from './types';
import { SORTTracker } from './utils/tracker';
import { getAgriInfo, computeHealthScore, getHealthGrade, CROP_CLASS_LIST, PEST_CLASS_LIST, IGNORED_CLASS_LIST } from './agriMapper';
import CameraTracker from './components/CameraTracker';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Leaf, Bug, Activity, Heart, AlertTriangle, ChevronDown, ChevronUp, Download, Map, FileText, MapPin } from 'lucide-react';

// Zone data type
interface ZoneData {
  crops: number;
  pests: number;
}

interface AgriChartPoint {
  time: string;
  crops: number;
  pests: number;
  health: number;
}

const translations = {
  en: {
    title: 'VectraTrack Agriculture',
    subtitle: 'Crop & Pest Monitoring System',
    liveMonitor: '🎥 Live Field Monitor',
    eventLog: '📋 Event Log',
    noEvents: '🌿 No pest density events yet.',
    fieldHealth: '💚 Field Health Score',
    pestAlert: 'Pest Alert Settings',
    threshold: 'Pest Alert Threshold',
    classMap: '🗺️ Class Mapping',
    treatment: '💊 Treatment Recommendations',
    healthy: 'Field is healthy. Continue routine monitoring.',
    moderate: 'Moderate pest pressure. Consider targeted intervention.',
    critical: 'CRITICAL: High pest density. Immediate action required!',
    exportBtn: 'Export Analytics',
    reportBtn: '📄 Download Report',
    liveCrops: 'LIVE CROPS',
    livePests: 'LIVE PESTS',
    activeTracks: 'ACTIVE TRACKS',
    fieldHealthLabel: 'FIELD HEALTH',
    severity: 'Pest Severity',
    noneDetected: '⚠️ No crops or pests detected in frame'
  },
  ta: {
    title: 'வெக்ட்ரா ட்ராக் விவசாயம்',
    subtitle: 'பயிர் & பூச்சி கண்காணிப்பு',
    liveMonitor: '🎥 நேரடி வயல் கண்காணிப்பு',
    eventLog: '📋 நிகழ்வு பதிவு',
    noEvents: '🌿 இதுவரை பூச்சி நிகழ்வுகள் இல்லை.',
    fieldHealth: '💚 வயல் ஆரோக்கிய மதிப்பெண்',
    pestAlert: 'பூச்சி எச்சரிக்கை அமைப்புகள்',
    threshold: 'பூச்சி எச்சரிக்கை வரம்பு',
    classMap: '🗺️ வகுப்பு வரைபடம்',
    treatment: '💊 சிகிச்சை பரிந்துரைகள்',
    healthy: 'வயல் ஆரோக்கியமாக உள்ளது. வழக்கமான கண்காணிப்பைத் தொடரவும்.',
    moderate: 'மிதமான பூச்சி அழுத்தம். குறிப்பிட்ட தலையீட்டை கவனியுங்கள்.',
    critical: 'அவசரம்: அதிக பூச்சி அடர்த்தி. உடனடி நடவடிக்கை தேவை!',
    exportBtn: 'பகுப்பாய்வை ஏற்றுமதி செய்',
    reportBtn: '📄 அறிக்கை பதிவிறக்கு',
    liveCrops: 'நேரடி பயிர்கள்',
    livePests: 'நேரடி பூச்சிகள்',
    activeTracks: 'செயலில் உள்ள பாதைகள்',
    fieldHealthLabel: 'வயல் ஆரோக்கியம்',
    severity: 'பூச்சி தீவிரம்',
    noneDetected: '⚠️ பயிர்கள் அல்லது பூச்சிகள் கண்டறியப்படவில்லை'
  }
};

export default function App() {
  const [lang, setLang] = useState<'en' | 'ta'>('en');
  const t = translations[lang];

  const trackerInstance = useMemo(() => new SORTTracker(), []);

  // Config 
  const [config, setConfig] = useState<TrackerConfig>({
    iouThreshold: 0.35,
    confidenceThreshold: 0.55, // Increased to 0.55
    maxMissedFrames: 25,
    historyLength: 35,
    drawTrails: true,
    blurBackground: false,
    minTrackAge: 1,
    colorTheme: 'cyan',
    filterClasses: [], 
  });

  const [inputMode, setInputMode] = useState<'webcam' | 'video' | 'simulator'>('simulator');
  const [simulatorObjectsCount] = useState(6);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [fps, setFps] = useState(30);
  const [latencyMs, setLatencyMs] = useState(0);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  const [pestAlertThreshold, setPestAlertThreshold] = useState(5);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [agriChartData, setAgriChartData] = useState<AgriChartPoint[]>([]);
  const [zoneData, setZoneData] = useState<ZoneData[]>(Array(9).fill({ crops: 0, pests: 0 }));
  const [healthScore, setHealthScore] = useState(100);
  const [totalCropIds, setTotalCropIds] = useState(0);
  const [totalPestIds, setTotalPestIds] = useState(0);
  const [alertActive, setAlertActive] = useState(false);
  const [displayMode, setDisplayMode] = useState<'all' | 'crop' | 'pest'>('all');

  const [gpsLocation, setGpsLocation] = useState<{lat: number; lng: number; accuracy: number} | null>(null);

  const [detectionHistory, setDetectionHistory] = useState<any[]>(() => {
    return JSON.parse(localStorage.getItem('vectratrack_history') || '[]');
  });

  const lastUpdateRef = useRef(performance.now());
  const seenCropIds = useRef(new Set<number>());
  const seenPestIds = useRef(new Set<number>());

  const addEvent = (ev: Omit<SystemEvent, 'id' | 'timestamp'>) => {
    setEvents(prev => [...prev.slice(-99), {
      ...ev,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString()
    }]);
  };

  useEffect(() => {
    addEvent({ type: 'info', message: 'VectraTrack Agriculture v4.0 initialised. COCO-SSD model loading...' });
    addEvent({ type: 'info', message: 'Agriculture class mapper loaded.' });
  }, []);

  const getSeverity = (count: number) => {
    if (count >= 8) return { level: 'High', color: '#dc2626', bg: '#fee2e2', icon: '🔴' };
    if (count >= 4) return { level: 'Medium', color: '#d97706', bg: '#fef3c7', icon: '🟡' };
    if (count > 0) return { level: 'Low', color: '#16a34a', bg: '#dcfce7', icon: '🟢' };
    return { level: 'None', color: '#64748b', bg: '#f1f5f9', icon: '⚪' };
  };

  const saveDetectionSnapshot = (cropCount: number, pestCount: number, severity: string) => {
    const today = new Date().toISOString().split('T')[0];
    const key = 'vectratrack_history';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = existing.findIndex((e: any) => e.date === today);
    const entry = { date: today, crops: cropCount, pests: pestCount, severity, health: healthScore };
    if (idx >= 0) existing[idx] = entry;
    else existing.push(entry);
    const sorted = existing.sort((a: any, b: any) => a.date.localeCompare(b.date)).slice(-7);
    localStorage.setItem(key, JSON.stringify(sorted));
    setDetectionHistory(sorted);
    return sorted;
  };

  // Every 30 seconds snapshot
  useEffect(() => {
    const interval = setInterval(() => {
      const cCount = tracks.filter(t => getAgriInfo(t.class).category === 'crop').length;
      const pCount = tracks.filter(t => getAgriInfo(t.class).category === 'pest').length;
      saveDetectionSnapshot(cCount, pCount, getSeverity(pCount).level);
    }, 30000);
    return () => clearInterval(interval);
  }, [tracks, healthScore]);

  const handleUpdateTracks = (newTracks: Track[], latency: number) => {
    // Min bounding box size filter
    const validTracks = newTracks.filter(t => t.bbox[2] >= 30 && t.bbox[3] >= 30);
    setTracks(validTracks);
    setLatencyMs(latency);

    const now = performance.now();
    const delta = now - lastUpdateRef.current;
    lastUpdateRef.current = now;
    setFps(prev => prev * 0.9 + (delta > 0 ? 1000/delta : 30) * 0.1);

    let cropCount = 0, pestCount = 0;
    const newZoneData: ZoneData[] = Array(9).fill(null).map(() => ({ crops: 0, pests: 0 }));

    validTracks.forEach(track => {
      const info = getAgriInfo(track.class);
      if (info.category === 'crop') {
        cropCount++;
        const [tx, ty, tw, th] = track.bbox;
        const cx = tx + tw/2; const cy = ty + th/2;
        const col = Math.min(Math.floor(cx / 640 * 3), 2);
        const row = Math.min(Math.floor(cy / 480 * 3), 2);
        const zoneIdx = row * 3 + col;
        newZoneData[zoneIdx] = { ...newZoneData[zoneIdx], crops: newZoneData[zoneIdx].crops + 1 };
        if (!seenCropIds.current.has(track.id)) {
          seenCropIds.current.add(track.id);
          setTotalCropIds(seenCropIds.current.size);
          addEvent({ type: 'success', message: `🌱 Crop detected: ${info.emoji} ${info.label} [ID #${track.id}]` });
        }
      } else if (info.category === 'pest') {
        pestCount++;
        const [tx, ty, tw, th] = track.bbox;
        const cx = tx + tw/2; const cy = ty + th/2;
        const col = Math.min(Math.floor(cx / 640 * 3), 2);
        const row = Math.min(Math.floor(cy / 480 * 3), 2);
        const zoneIdx = row * 3 + col;
        newZoneData[zoneIdx] = { ...newZoneData[zoneIdx], pests: newZoneData[zoneIdx].pests + 1 };
        if (!seenPestIds.current.has(track.id)) {
          seenPestIds.current.add(track.id);
          setTotalPestIds(seenPestIds.current.size);
          addEvent({ type: 'warning', message: `🐛 Pest detected: ${info.emoji} ${info.label} [ID #${track.id}]` });
        }
      }
    });

    setZoneData(newZoneData);
    const score = computeHealthScore(cropCount, pestCount);
    setHealthScore(Math.round(score));

    const isAlert = pestCount >= pestAlertThreshold;
    setAlertActive(isAlert);
    if (isAlert) {
      addEvent({ type: 'alert', message: `🚨 PEST ALERT: ${pestCount} pests in frame — threshold ${pestAlertThreshold} exceeded!` });
      // Browser notification
      if ('Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
        if (Notification.permission === 'granted') {
          new Notification('🚨 VectraTrack Pest Alert!', {
            body: `${pestCount} pests detected. Threshold: ${pestAlertThreshold}. Check your field immediately!`,
            icon: '/favicon.ico'
          });
        }
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const cropCount = tracks.filter(t => getAgriInfo(t.class).category === 'crop').length;
      const pestCount = tracks.filter(t => getAgriInfo(t.class).category === 'pest').length;
      const now = new Date();
      const timeLabel = `${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
      setAgriChartData(prev => [
        ...prev.slice(-25),
        { time: timeLabel, crops: cropCount, pests: pestCount, health: healthScore }
      ]);
    }, 2000);
    return () => clearInterval(interval);
  }, [tracks, healthScore]);

  const effectiveConfig = {
    ...config,
    filterClasses: displayMode === 'all'
      ? []
      : displayMode === 'crop'
        ? [...PEST_CLASS_LIST, ...IGNORED_CLASS_LIST]
        : [...CROP_CLASS_LIST, ...IGNORED_CLASS_LIST]
  };

  const cropCount = tracks.filter(t => getAgriInfo(t.class).category === 'crop').length;
  const pestCount = tracks.filter(t => getAgriInfo(t.class).category === 'pest').length;
  const { grade, color: gradeColor } = getHealthGrade(healthScore);

  const pestBehaviourData = [
    { name: '🐌 Foraging', value: 40, color: '#dc2626' },
    { name: '🚶 Walking', value: 35, color: '#d97706' },
    { name: '💨 Flying', value: 25, color: '#3b82f6' },
  ];

  const handleExport = () => {
    const data = {
      timestamp: new Date().toISOString(),
      totalCropIds,
      totalPestIds,
      healthScore,
      events: events.map(e => ({ time: e.timestamp, type: e.type, msg: e.message })),
      zoneData,
    };
    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    a.download = `VectraTrack_Agri_${Date.now()}.json`;
    a.click();
    addEvent({ type: 'success', message: '📊 Field analytics exported as JSON.' });
  };

  const handleCaptureGPS = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
          addEvent({ type: 'success', message: `📍 GPS captured: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)} (±${pos.coords.accuracy.toFixed(0)}m)` });
        },
        () => addEvent({ type: 'warning', message: '📍 GPS unavailable or permission denied.' })
      );
    }
  };

  const handlePDFReport = () => {
    const severity = getSeverity(pestCount);
    const gpsString = gpsLocation ? `📍 GPS: ${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lng.toFixed(4)} (±${gpsLocation.accuracy.toFixed(0)}m)` : '';
    const reportHtml = \`
      <!DOCTYPE html><html><head>
      <title>VectraTrack Field Report - \${new Date().toLocaleDateString()}</title>
      <style>
        body { font-family: Inter, Arial, sans-serif; margin: 40px; color: #1e293b; }
        h1 { color: #16a34a; } h2 { color: #475569; font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
        .stat { display: inline-block; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 20px; margin: 6px; text-align: center; }
        .stat-num { font-size: 28px; font-weight: bold; } .stat-label { font-size: 11px; color: #64748b; }
        .severity { display: inline-block; padding: 4px 12px; border-radius: 999px; font-weight: 600; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
        th { background: #f1f5f9; padding: 8px; text-align: left; } td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
        .recommendation { background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px; border-radius: 4px; margin-top: 8px; }
        @media print { button { display: none; } }
      </style></head><body>
      <button onclick="window.print()" style="float:right;background:#16a34a;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;">🖨️ Print / Save PDF</button>
      <h1>🌾 VectraTrack Agriculture Field Report</h1>
      <p style="color:#64748b">Generated: \${new Date().toLocaleString()} | Location: Field Monitor \${gpsString}</p>
      <h2>📊 Current Detection Summary</h2>
      <div>
        <div class="stat"><div class="stat-num" style="color:#16a34a">\${cropCount}</div><div class="stat-label">Live Crops</div></div>
        <div class="stat"><div class="stat-num" style="color:#d97706">\${pestCount}</div><div class="stat-label">Live Pests</div></div>
        <div class="stat"><div class="stat-num" style="color:#3b82f6">\${tracks.length}</div><div class="stat-label">Active Tracks</div></div>
        <div class="stat"><div class="stat-num" style="color:#16a34a">\${healthScore}</div><div class="stat-label">Health Score</div></div>
      </div>
      <p><strong>Pest Severity:</strong> <span class="severity" style="background:\${severity.bg};color:\${severity.color}">\${severity.icon} \${severity.level}</span></p>
      <h2>🌿 Field Health Assessment</h2>
      <p>\${healthScore >= 75 ? '✅ Field is healthy. Continue routine monitoring and preventive measures.' : healthScore >= 45 ? '⚠️ Moderate pest pressure detected. Consider targeted pest intervention.' : '🚨 CRITICAL: High pest density. Immediate inspection and treatment required!'}</p>
      <div class="recommendation">
        <strong>💡 Recommendation:</strong><br/>
        \${pestCount === 0 ? 'No pests currently detected. Maintain current practices.' : pestCount <= 3 ? 'Low pest pressure. Monitor daily. Consider biological pest control.' : pestCount <= 7 ? 'Medium pest pressure. Apply targeted pesticides to affected zones. Check Zone Map.' : 'High pest pressure. Immediate chemical treatment recommended. Contact agricultural expert.'}
      </div>
      <h2>📋 Recent Event Log</h2>
      <table><tr><th>Time</th><th>Type</th><th>Event</th></tr>
      \${events.slice(-20).reverse().map(e => \`<tr><td>\${e.timestamp.split('T')[1]?.slice(0,8)}</td><td>\${e.type}</td><td>\${e.message}</td></tr>\`).join('')}
      </table>
      <h2>📅 7-Day History</h2>
      <table><tr><th>Date</th><th>Crops</th><th>Pests</th><th>Severity</th><th>Health</th></tr>
      \${detectionHistory.map((h: any) => \`<tr><td>\${h.date}</td><td>\${h.crops}</td><td>\${h.pests}</td><td>\${h.severity}</td><td>\${h.health}</td></tr>\`).join('')}
      </table>
      <p style="margin-top:40px;color:#94a3b8;font-size:11px">VectraTrack Agriculture v1.0 — Precision Agriculture AI © \${new Date().getFullYear()}</p>
      </body></html>
    \`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(reportHtml); win.document.close(); }
    addEvent({ type: 'success', message: '📄 PDF report opened in new tab. Use Ctrl+P to save as PDF.' });
  };

  const getFieldBotAdvice = () => {
    if (pestCount === 0 && cropCount === 0) return { icon: '🤖', advice: 'No detections yet. Point the camera at your field or use the simulator to test.', type: 'info' };
    if (pestCount >= 8) return { icon: '🚨', advice: \`CRITICAL ALERT: \${pestCount} pests detected! Apply broad-spectrum pesticide immediately. Isolate affected zones. Contact your agricultural officer.\`, type: 'danger' };
    if (pestCount >= 4) return { icon: '⚠️', advice: \`Moderate pest pressure (\${pestCount} pests). Recommend: Apply targeted biological pesticide. Monitor zones \${zoneData.map((z,i) => z.pests > 0 ? i+1 : null).filter(Boolean).join(', ')} closely.\`, type: 'warning' };
    if (pestCount > 0) return { icon: '👁️', advice: \`Low pest activity (\${pestCount} pest\${pestCount > 1 ? 's' : ''}). Recommend: Continue monitoring. Consider neem oil or trapping. Check again in 2 hours.\`, type: 'caution' };
    if (cropCount > 5) return { icon: '🌱', advice: \`Excellent! \${cropCount} crops detected with no pests. Field health is \${healthScore}%. Continue current practices. Next check recommended in 4 hours.\`, type: 'good' };
    return { icon: '🌿', advice: \`\${cropCount} crops visible. Field looks clear. Health score: \${healthScore}%. Routine monitoring recommended.\`, type: 'good' };
  };
  const botAdvice = getFieldBotAdvice();
  const botColors = {
    info: { bg: '#f8fafc', border: '#e2e8f0', text: '#475569' },
    danger: { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' },
    warning: { bg: '#fef3c7', border: '#fde68a', text: '#92400e' },
    caution: { bg: '#fffbeb', border: '#fed7aa', text: '#9a3412' },
    good: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  };
  const bc = botColors[botAdvice.type as keyof typeof botColors];
  const severityBadge = getSeverity(pestCount);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center shadow-md">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-800">{t.title}</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-green-100 text-green-700 rounded-full border border-green-200">ML v4.0</span>
              </div>
              <p className="text-[10px] text-slate-400">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(l => l === 'en' ? 'ta' : 'en')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            >
              {lang === 'en' ? '🇮🇳 தமிழ்' : '🇬🇧 English'}
            </button>
            <button
              onClick={handleCaptureGPS}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" /> GPS
            </button>
            <button
              onClick={handlePDFReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
            >
              <FileText className="w-3.5 h-3.5" />
              {t.reportBtn}
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              {t.exportBtn}
            </button>
          </div>
        </div>
      </header>

      {alertActive && (
        <div className="bg-red-600 text-white text-sm font-semibold text-center py-2.5 alert-pulse">
          🚨 PEST ALERT! {pestCount} pests detected — threshold of {pestAlertThreshold} exceeded.
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-100 p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">🌾 {t.title}</h2>
              <p className="text-slate-500 text-sm mt-1 max-w-2xl">{t.subtitle}</p>
            </div>
            {gpsLocation && (
              <div className="inline-flex items-center gap-1.5 text-xs bg-white border border-green-200 text-green-700 px-3 py-1.5 rounded-full">
                📍 {gpsLocation.lat.toFixed(4)}, {gpsLocation.lng.toFixed(4)} (±{gpsLocation.accuracy.toFixed(0)}m)
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="agri-card p-4">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <Leaf className="w-4 h-4" />
                <span className="text-xs font-semibold text-slate-500">{t.liveCrops}</span>
              </div>
              <div className="text-3xl font-bold text-green-600">{cropCount}</div>
            </div>
            <div className="agri-card p-4">
              <div className="flex items-center gap-2 text-amber-600 mb-1">
                <Bug className="w-4 h-4" />
                <span className="text-xs font-semibold text-slate-500">{t.livePests}</span>
              </div>
              <div className="text-3xl font-bold text-amber-600">{pestCount}</div>
            </div>
            <div className="agri-card p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Activity className="w-4 h-4" />
                <span className="text-xs font-semibold text-slate-500">{t.activeTracks}</span>
              </div>
              <div className="text-3xl font-bold text-blue-600">{tracks.length}</div>
            </div>
            <div className="agri-card p-4">
              <div className="flex items-center gap-2 mb-1" style={{ color: gradeColor }}>
                <Heart className="w-4 h-4" />
                <span className="text-xs font-semibold text-slate-500">{t.fieldHealthLabel}</span>
              </div>
              <div className="text-3xl font-bold" style={{ color: gradeColor }}>{healthScore}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="agri-card overflow-hidden relative">
              <div className="px-4 pt-4 pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    {t.liveMonitor}
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="flex rounded-lg overflow-hidden border border-slate-200">
                      {(['all', 'crop', 'pest'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setDisplayMode(mode)}
                          className={`px-3 py-1 text-xs font-medium transition-colors ${
                            displayMode === mode
                              ? 'bg-green-600 text-white'
                              : 'bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {mode === 'all' ? '🌱+🐛 All' : mode === 'crop' ? '🌱 Crops' : '🐛 Pests'}
                        </button>
                      ))}
                    </div>
                    <select
                      value={inputMode}
                      onChange={e => setInputMode(e.target.value as any)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600"
                    >
                      <option value="simulator">🎮 Simulator</option>
                      <option value="webcam">📷 Webcam</option>
                      <option value="video">🎬 Demo Video</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="p-0 relative">
                {cropCount === 0 && pestCount === 0 && tracks.length > 0 && (
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-amber-100 border border-amber-300 text-amber-800 px-3 py-1 rounded-full text-xs font-bold shadow">
                    {t.noneDetected}
                  </div>
                )}
                <CameraTracker
                  config={effectiveConfig}
                  onUpdateTracks={handleUpdateTracks}
                  inputMode={inputMode}
                  selectedVideo="https://assets.mixkit.co/videos/preview/mixkit-pedestrians-walking-on-a-crosswalk-from-above-41858-large.mp4"
                  simulatorObjectsCount={simulatorObjectsCount}
                  onAddEvent={ev => addEvent(ev)}
                  selectedTrack={selectedTrack}
                  onSelectTrack={setSelectedTrack}
                  tracker={trackerInstance}
                  onModelLoadedStateChange={setIsModelLoaded}
                />
              </div>
            </div>

            <div className="agri-card h-[200px] overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <h3 className="font-semibold text-slate-700 text-sm">{t.eventLog}</h3>
                <button onClick={() => setEvents([])} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded">Clear</button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <p className="text-sm">{t.noEvents}</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-1">
                    {[...events].reverse().map(ev => (
                      <div key={ev.id} className="flex items-start gap-2 text-xs py-1 border-b border-slate-50">
                        <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                          ev.type === 'alert' ? 'bg-red-500' :
                          ev.type === 'warning' ? 'bg-amber-500' :
                          ev.type === 'success' ? 'bg-green-500' : 'bg-blue-400'
                        }`} />
                        <span className="text-slate-600 flex-1">{ev.message}</span>
                        <span className="text-slate-300 flex-shrink-0">{ev.timestamp.split('T')[1]?.slice(0,8)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="agri-card p-4">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">{t.fieldHealth}</h3>
              <div className="text-center mb-3">
                <div className="text-5xl font-bold mb-1" style={{ color: gradeColor }}>{healthScore}</div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 mb-3">
                <div className="h-2.5 rounded-full transition-all duration-700" style={{ width: \`\${healthScore}%\`, backgroundColor: gradeColor }} />
              </div>
              <p className="text-xs text-slate-400 text-center">
                {healthScore >= 75 ? t.healthy : healthScore >= 45 ? t.moderate : t.critical}
              </p>
            </div>

            <div className="agri-card p-4 flex items-center justify-between" style={{ backgroundColor: severityBadge.bg }}>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: severityBadge.color }}>{t.severity}: {severityBadge.level}</h3>
                <p className="text-xs mt-1" style={{ color: severityBadge.color, opacity: 0.8 }}>{pestCount} {t.livePests}</p>
              </div>
              <div className="text-3xl">{severityBadge.icon}</div>
            </div>

            <div className="agri-card p-4">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">{t.treatment}</h3>
              <div className="space-y-2 text-xs">
                {pestCount === 0 ? (
                  <div className="flex items-start gap-2 text-green-700 bg-green-50 p-2 rounded-lg">
                    <span>✅</span><span>No treatment needed. Field is clear.</span>
                  </div>
                ) : pestCount <= 3 ? (
                  <>
                    <div className="flex items-start gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg">
                      <span>🌿</span><span>Apply Neem Oil spray (5ml/L water)</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg">
                      <span>🪤</span><span>Set sticky traps near pest zones</span>
                    </div>
                  </>
                ) : pestCount <= 7 ? (
                  <>
                    <div className="flex items-start gap-2 text-amber-700 bg-amber-50 p-2 rounded-lg">
                      <span>⚗️</span><span>Apply Pyrethrin-based pesticide</span>
                    </div>
                    <div className="flex items-start gap-2 text-amber-700 bg-amber-50 p-2 rounded-lg">
                      <span>🚁</span><span>Consider drone spraying for coverage</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-2 text-red-700 bg-red-50 p-2 rounded-lg">
                      <span>🚨</span><span>Emergency: Contact agricultural expert</span>
                    </div>
                    <div className="flex items-start gap-2 text-red-700 bg-red-50 p-2 rounded-lg">
                      <span>☠️</span><span>Apply broad-spectrum insecticide immediately</span>
                    </div>
                    <div className="flex items-start gap-2 text-red-700 bg-red-50 p-2 rounded-lg">
                      <span>🔒</span><span>Quarantine affected zones from crop spread</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="agri-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="font-semibold text-slate-700 text-sm">{t.pestAlert}</h3>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>{t.threshold}</span>
                  <span className="font-semibold text-slate-700">{pestAlertThreshold}</span>
                </div>
                <input type="range" min={1} max={20} value={pestAlertThreshold} onChange={e => setPestAlertThreshold(Number(e.target.value))} className="w-full" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="agri-card p-4">
            <h3 className="font-semibold text-slate-700 text-sm mb-3">📈 Crop & Pest Over Time</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={agriChartData}>
                <XAxis dataKey="time" tick={{ fontSize: 9 }} interval={4} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Line type="monotone" dataKey="crops" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pests" stroke="#d97706" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="agri-card p-4">
            <h3 className="font-semibold text-slate-700 text-sm mb-3">💚 Health Score Timeline</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={agriChartData}>
                <XAxis dataKey="time" tick={{ fontSize: 9 }} interval={4} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="health" fill="#22c55e" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="agri-card p-4">
            <h3 className="font-semibold text-slate-700 text-sm mb-3">💨 Pest Behaviour</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pestBehaviourData} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                  {pestBehaviourData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 7-Day History Chart */}
        <div className="agri-card p-4">
          <h3 className="font-semibold text-slate-700 text-sm mb-3">📅 7-Day Pest Count History</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={detectionHistory}>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="crops" fill="#16a34a" radius={[3,3,0,0]} name="Crops" stackId="a" />
              <Bar dataKey="pests" fill="#d97706" radius={[3,3,0,0]} name="Pests" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="agri-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <Map className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-slate-700">Zone Invasion Map (3×3 Grid)</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {zoneData.map((zone, i) => {
              const hasPest = zone.pests > 0;
              const hasCrop = zone.crops > 0;
              return (
                <div key={i} className={\`rounded-lg border-2 p-3 text-center transition-all \${hasPest ? 'border-red-300 bg-red-50' : hasCrop ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-slate-50'}\`}>
                  <div className="text-xs font-bold text-slate-500 mb-1">Zone {i+1}</div>
                  <div className="flex justify-center gap-2 text-xs">
                    <span className="text-green-600 font-semibold">🌱 {zone.crops}</span>
                    <span className="text-amber-600 font-semibold">🐛 {zone.pests}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FieldBot advice card */}
        <div className="agri-card p-4" style={{ background: bc.bg, borderColor: bc.border }}>
          <div className="flex items-start gap-3">
            <div className="text-3xl flex-shrink-0">{botAdvice.icon}</div>
            <div>
              <h3 className="font-semibold text-sm mb-1" style={{ color: bc.text }}>🤖 FieldBot — AI Field Advisor</h3>
              <p className="text-sm leading-relaxed" style={{ color: bc.text }}>{botAdvice.advice}</p>
              <div className="flex gap-2 mt-2 text-xs" style={{ color: bc.text, opacity: 0.7 }}>
                <span>Updated: {new Date().toLocaleTimeString()}</span>
                <span>·</span>
                <span>Health: {healthScore}/100</span>
                <span>·</span>
                <span>Severity: {severityBadge.level}</span>
              </div>
            </div>
          </div>
        </div>

      </main>

      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>VectraTrack Agriculture v1.0 · Precision Agriculture AI</span>
        </div>
      </footer>
    </div>
  );
}
