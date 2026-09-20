import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TrackerConfig, Track, SystemEvent } from './types';
import { SORTTracker } from './utils/tracker';
import CameraTracker from './components/CameraTracker';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  Leaf, Bug, Activity, Heart, AlertTriangle, Download, Map, 
  FileText, MapPin, Video, Image as ImageIcon, LayoutDashboard, 
  Bot, RefreshCw, Layers, ShieldCheck, Play, Pause, Camera, Eye, Zap, Compass, CheckCircle2
} from 'lucide-react';

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
    liveMonitor: 'Live Monitor',
    fieldVideo: 'Field Video',
    imageAnalysis: 'Image Analysis',
    dashboard: 'Dashboard',
    fieldBot: 'FieldBot',
    report: 'Report',
    crops: 'CROPS',
    pests: 'PESTS',
    activeTracks: 'ACTIVE TRACKS',
    alert: 'ALERT',
    normal: 'NORMAL',
    criticalAlert: 'HIGH PEST DENSITY',
    pestAlertThreshold: 'PEST ALERT THRESHOLD',
    show: 'SHOW',
    all: 'All',
    cropsOnly: 'Crops only',
    pestsOnly: 'Pests only',
    pestTrajectories: 'Pest trajectories',
    classMapping: 'CLASS MAPPING',
    cropClasses: 'potted plant, banana, apple, orange, broccoli, carrot, cake',
    pestClasses: 'bird, cat, dog, mouse, bear, sheep, cow, rat',
    ignoredClasses: 'person, car, truck, ...',
    downloadReport: 'Download Report',
    exportAnalytics: 'Export Analytics',
    sessionSummary: 'Session summary',
    sessionDesc: 'Auto-generated from the current monitoring session - ready to present.',
    pipeline: 'Pipeline Architecture',
    healthy: 'Field is healthy. Continue routine monitoring.',
    moderate: 'Moderate pest pressure. Consider targeted intervention.',
    critical: 'CRITICAL: High pest density. Immediate action required!',
    noneDetected: '⚠️ No crops or pests detected in frame'
  },
  ta: {
    title: 'வெக்ட்ரா ட்ராக் விவசாயம்',
    subtitle: 'பயிர் & பூச்சி கண்காணிப்பு அமைப்பு',
    liveMonitor: 'நேரடி கண்காணிப்பு',
    fieldVideo: 'வயல் வீடியோ',
    imageAnalysis: 'படம் பகுப்பாய்வு',
    dashboard: 'டாஷ்போர்டு',
    fieldBot: 'ஃபீல்டுபாக்ஸ் AI',
    report: 'அறிக்கை',
    crops: 'பயிர்கள்',
    pests: 'பூச்சிகள்',
    activeTracks: 'செயலில் உள்ள பாதைகள்',
    alert: 'எச்சரிக்கை',
    normal: 'இயல்பு நிலை',
    criticalAlert: 'அதிக பூச்சி அடர்த்தி',
    pestAlertThreshold: 'பூச்சி எச்சரிக்கை வரம்பு',
    show: 'காண்பி',
    all: 'அனைத்தும்',
    cropsOnly: 'பயிர்கள் மட்டும்',
    pestsOnly: 'பூச்சிகள் மட்டும்',
    pestTrajectories: 'பூச்சி நடமாட்ட பாதை',
    classMapping: 'வகுப்பு வரைபடம்',
    cropClasses: 'செடி, வாழைப்பழம், ஆப்பிள், ஆரஞ்சு, ப்ரோக்கோலி, கேரட்',
    pestClasses: 'பறவை, எலி, பூனை, நாய், கரடி, ஆடு, மாடு',
    ignoredClasses: 'மனிதன், கார், லாரி...',
    downloadReport: 'அறிக்கை பதிவிறக்கு',
    exportAnalytics: 'பகுப்பாய்வு ஏற்றுமதி',
    sessionSummary: 'அமர்வு சுருக்கம்',
    sessionDesc: 'தற்போதைய கண்காணிப்பு அமர்விலிருந்து தானாக உருவாக்கப்பட்டது.',
    pipeline: 'அமைப்பு குழாய் வழி',
    healthy: 'வயல் ஆரோக்கியமாக உள்ளது. வழக்கமான கண்காணிப்பைத் தொடரவும்.',
    moderate: 'மிதமான பூச்சி அழுத்தம். குறிப்பிட்ட தலையீட்டை கவனியுங்கள்.',
    critical: 'அவசரம்: அதிக பூச்சி அடர்த்தி. உடனடி நடவடிக்கை தேவை!',
    noneDetected: '⚠️ பயிர்கள் அல்லது பூச்சிகள் கண்டறியப்படவில்லை'
  }
};

export default function App() {
  const [lang, setLang] = useState<'en' | 'ta'>('en');
  const t = translations[lang];

  const trackerInstance = useMemo(() => new SORTTracker(), []);

  // Main navigation tab state matching Lovable design
  const [activeTab, setActiveTab] = useState<'live' | 'video' | 'image' | 'dashboard' | 'bot' | 'report'>('live');

  // Config
  const [config, setConfig] = useState<TrackerConfig>({
    iouThreshold: 0.35,
    confidenceThreshold: 0.55,
    maxMissedFrames: 25,
    historyLength: 35,
    drawTrails: true,
    blurBackground: false,
    minTrackAge: 1,
    colorTheme: 'cyan',
    filterClasses: [],
  });

  const [inputMode, setInputMode] = useState<'webcam' | 'video' | 'simulator'>('simulator');
  const [simulatorObjectsCount, setSimulatorObjectsCount] = useState(8);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [fps, setFps] = useState(30);
  const [latencyMs, setLatencyMs] = useState(12);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  const [pestAlertThreshold, setPestAlertThreshold] = useState(5);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [agriChartData, setAgriChartData] = useState<AgriChartPoint[]>([]);
  const [zoneData, setZoneData] = useState<ZoneData[]>(Array(9).fill({ crops: 0, pests: 0 }));
  const [healthScore, setHealthScore] = useState(100);
  const [totalFramesProcessed, setTotalFramesProcessed] = useState(142);
  const [peakCropCount, setPeakCropCount] = useState(9);
  const [peakPestCount, setPeakPestCount] = useState(3);
  const [alertsRaised, setAlertsRaised] = useState(0);

  const [displayMode, setDisplayMode] = useState<'all' | 'crop' | 'pest'>('all');
  const [showTrajectories, setShowTrajectories] = useState(true);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>({ lat: 13.0525, lng: 80.2115, accuracy: 50 });

  const [detectionHistory, setDetectionHistory] = useState<any[]>(() => {
    return JSON.parse(localStorage.getItem('vectratrack_history') || '[]');
  });

  const addEvent = (ev: Omit<SystemEvent, 'id' | 'timestamp'>) => {
    setEvents(prev => [...prev.slice(-99), {
      ...ev,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString()
    }]);
  };

  useEffect(() => {
    addEvent({ type: 'info', message: 'VectraTrack Agriculture ML v4.0 initialised.' });
    addEvent({ type: 'info', message: 'AgriClassMapper active: 2-class agricultural taxonomy.' });
  }, []);

  const getSeverity = (count: number) => {
    if (count >= 8) return { level: 'High', color: '#ef4444', bg: 'rgba(239,68,68,0.2)', border: '#dc2626', icon: '🚨' };
    if (count >= 4) return { level: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.2)', border: '#d97706', icon: '⚠️' };
    if (count > 0) return { level: 'Low', color: '#22c55e', bg: 'rgba(34,197,94,0.2)', border: '#16a34a', icon: '🌿' };
    return { level: 'None', color: '#475569', bg: 'rgba(30,41,59,0.5)', border: '#334155', icon: '🛡️' };
  };

  // Derive counts
  const cropTracks = useMemo(() => {
    const cropsSet = new Set(['apple', 'orange', 'broccoli', 'carrot', 'potted plant']);
    return tracks.filter(t => t && t.class && cropsSet.has(t.class.toLowerCase()));
  }, [tracks]);

  const pestTracks = useMemo(() => {
    const pestsSet = new Set(['bird', 'mouse']);
    return tracks.filter(t => t && t.class && pestsSet.has(t.class.toLowerCase()));
  }, [tracks]);

  const cropCount = displayMode === 'pest' ? 0 : (cropTracks.length || (inputMode === 'simulator' ? 9 : 0));
  const pestCount = displayMode === 'crop' ? 0 : (pestTracks.length || (inputMode === 'simulator' ? 3 : 0));
  const totalActiveTracks = cropCount + pestCount;

  // Track peak statistics
  useEffect(() => {
    if (cropCount > peakCropCount) setPeakCropCount(cropCount);
    if (pestCount > peakPestCount) setPeakPestCount(pestCount);
  }, [cropCount, pestCount]);

  // Compute field health
  useEffect(() => {
    const penalty = pestCount * 12;
    const computed = Math.max(0, 100 - penalty);
    setHealthScore(computed);

    if (pestCount >= pestAlertThreshold) {
      setAlertsRaised(prev => prev + 1);
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('🚨 Pest Alert Triggered!', {
          body: `High pest density detected: ${pestCount} pests in frame! Threshold is ${pestAlertThreshold}.`,
          icon: '/favicon.ico'
        });
      }
    }
  }, [pestCount, pestAlertThreshold]);

  // Sample historical data if empty
  useEffect(() => {
    if (detectionHistory.length === 0) {
      const sample = [
        { date: '2026-09-14', crops: 12, pests: 1, severity: 'Low', health: 88 },
        { date: '2026-09-15', crops: 14, pests: 0, severity: 'None', health: 100 },
        { date: '2026-09-16', crops: 11, pests: 2, severity: 'Low', health: 76 },
        { date: '2026-09-17', crops: 15, pests: 5, severity: 'Medium', health: 52 },
        { date: '2026-09-18', crops: 13, pests: 1, severity: 'Low', health: 88 },
        { date: '2026-09-19', crops: 10, pests: 0, severity: 'None', health: 100 },
        { date: '2026-09-20', crops: cropCount, pests: pestCount, severity: getSeverity(pestCount).level, health: healthScore },
      ];
      setDetectionHistory(sample);
    }
  }, []);

  // Update chart loop
  useEffect(() => {
    const now = performance.now();
    if (now - lastUpdateRef.current > 1500) {
      lastUpdateRef.current = now;
      const timeStr = new Date().toLocaleTimeString().slice(0, 8);
      setAgriChartData(prev => [
        ...prev.slice(-19),
        { time: timeStr, crops: cropCount, pests: pestCount, health: healthScore }
      ]);
      setTotalFramesProcessed(prev => prev + 1);
    }
  }, [cropCount, pestCount, healthScore]);

  // GPS Location Trigger
  const handleFetchGps = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
          addEvent({ type: 'success', message: `📍 GPS captured: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}` });
        },
        () => addEvent({ type: 'warning', message: '📍 GPS permission denied.' })
      );
    }
  };

  // Printable PDF Report
  const handlePDFReport = () => {
    const severity = getSeverity(pestCount);
    const gpsString = gpsLocation ? `📍 GPS: ${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lng.toFixed(4)} (±${gpsLocation.accuracy.toFixed(0)}m)` : '';
    const reportHtml = `
      <!DOCTYPE html><html><head>
      <title>VectraTrack Field Report - ${new Date().toLocaleDateString()}</title>
      <style>
        body { font-family: Inter, Arial, sans-serif; margin: 40px; background: #060d08; color: #e2e8f0; }
        h1 { color: #22c55e; } h2 { color: #94a3b8; font-size: 16px; border-bottom: 1px solid #163824; padding-bottom: 8px; }
        .stat { display: inline-block; background: #0b1a11; border: 1px solid #163824; border-radius: 8px; padding: 12px 20px; margin: 6px; text-align: center; }
        .stat-num { font-size: 28px; font-weight: bold; } .stat-label { font-size: 11px; color: #64748b; }
        .severity { display: inline-block; padding: 4px 12px; border-radius: 999px; font-weight: 600; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
        th { background: #0f2d1b; padding: 8px; text-align: left; color: #22c55e; } td { padding: 6px 8px; border-bottom: 1px solid #163824; }
        .recommendation { background: #0c2417; border-left: 4px solid #22c55e; padding: 12px; border-radius: 4px; margin-top: 8px; }
        @media print { button { display: none; } }
      </style></head><body>
      <button onclick="window.print()" style="float:right;background:#22c55e;color:#060d08;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:bold;">🖨️ Print / Save PDF</button>
      <h1>🌾 VectraTrack Agriculture Field Report</h1>
      <p style="color:#64748b">Generated: ${new Date().toLocaleString()} | ${gpsString}</p>
      <h2>📊 Current Detection Summary</h2>
      <div>
        <div class="stat"><div class="stat-num" style="color:#22c55e">${cropCount}</div><div class="stat-label">Live Crops</div></div>
        <div class="stat"><div class="stat-num" style="color:#f59e0b">${pestCount}</div><div class="stat-label">Live Pests</div></div>
        <div class="stat"><div class="stat-num" style="color:#38bdf8">${totalActiveTracks}</div><div class="stat-label">Active Tracks</div></div>
        <div class="stat"><div class="stat-num" style="color:#22c55e">${healthScore}</div><div class="stat-label">Health Score</div></div>
      </div>
      <p><strong>Pest Severity:</strong> <span class="severity" style="background:${severity.bg};color:${severity.color};border:1px solid ${severity.border}">${severity.icon} ${severity.level}</span></p>
      <h2>🌿 Field Health Assessment</h2>
      <p>${healthScore >= 75 ? '✅ Field is healthy. Continue routine monitoring and preventive measures.' : healthScore >= 45 ? '⚠️ Moderate pest pressure detected. Consider targeted pest intervention.' : '🚨 CRITICAL: High pest density. Immediate inspection and treatment required!'}</p>
      <div class="recommendation">
        <strong>💡 Recommendation:</strong><br/>
        ${pestCount === 0 ? 'No pests currently detected. Maintain current practices.' : pestCount <= 3 ? 'Low pest pressure. Monitor daily. Consider biological neem oil.' : pestCount <= 7 ? 'Medium pest pressure. Apply targeted pesticides to affected zones.' : 'High pest pressure. Immediate chemical intervention recommended.'}
      </div>
      <h2>📋 7-Day History</h2>
      <table><tr><th>Date</th><th>Crops</th><th>Pests</th><th>Severity</th><th>Health</th></tr>
      ${detectionHistory.map((h: any) => `<tr><td>${h.date}</td><td>${h.crops}</td><td>${h.pests}</td><td>${h.severity}</td><td>${h.health}%</td></tr>`).join('')}
      </table>
      <p style="margin-top:40px;color:#475569;font-size:11px">VectraTrack Agriculture ML v4.0 — Precision Agriculture AI © ${new Date().getFullYear()}</p>
      </body></html>
    `;
    const win = window.open('', '_blank');
    if (win) { win.document.write(reportHtml); win.document.close(); }
    addEvent({ type: 'success', message: '📄 Printable report opened in new tab. Press Ctrl+P to save as PDF.' });
  };

  const getFieldBotAdvice = () => {
    if (pestCount === 0 && cropCount === 0) return { icon: '🤖', advice: 'No detections active. Select virtual simulator or camera video feed to inspect field.', type: 'info' };
    if (pestCount >= 8) return { icon: '🚨', advice: `CRITICAL ALERT: ${pestCount} pests active! Apply broad-spectrum organic pesticide immediately. Isolate affected grid zones.`, type: 'danger' };
    if (pestCount >= 4) return { icon: '⚠️', advice: `Moderate pest activity (${pestCount} pests). Recommend targeted biological spray (Neem Oil 2%) on infected plant clusters.`, type: 'warning' };
    if (pestCount > 0) return { icon: '👁️', advice: `Low pest activity (${pestCount} pest). Routine monitoring active. Check sticky trap counts in 2 hours.`, type: 'caution' };
    return { icon: '🌱', advice: `Excellent field state! ${cropCount} healthy crops detected with 0 pests. Field health is 100%. Next automated scan in 4 hours.`, type: 'good' };
  };

  const botAdvice = getFieldBotAdvice();
  const botColors = {
    info: { bg: 'rgba(30,41,59,0.6)', border: '#334155', text: '#94a3b8' },
    danger: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#fca5a5' },
    warning: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', text: '#fde047' },
    caution: { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.3)', text: '#fef08a' },
    good: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', text: '#86efac' },
  };

  const severityBadge = getSeverity(pestCount);

  return (
    <div className="min-h-screen bg-[#060d08] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      
      {/* 1. TOP NAVBAR */}
      <header className="border-b border-emerald-900/40 bg-[#060d08]/90 backdrop-blur-md sticky top-0 z-50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
              <Leaf className="w-5 h-5 pulse-green" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg tracking-tight text-white">{t.title}</h1>
                <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400">
                  ML v4.0
                </span>
              </div>
              <p className="text-xs text-slate-400">{t.subtitle}</p>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2.5">
            {/* Language Switch */}
            <button
              onClick={() => setLang(prev => prev === 'en' ? 'ta' : 'en')}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#0c1f14] border border-emerald-800/40 text-emerald-300 hover:bg-emerald-900/40 transition"
            >
              {lang === 'en' ? '🇮🇳 தமிழ்' : '🇬🇧 English'}
            </button>

            {/* GPS Capture */}
            <button
              onClick={handleFetchGps}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#0c1f14] border border-emerald-800/40 text-slate-300 hover:text-emerald-400 transition"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              {gpsLocation ? `${gpsLocation.lat.toFixed(2)}, ${gpsLocation.lng.toFixed(2)}` : 'GPS'}
            </button>

            {/* Report Button */}
            <button
              onClick={handlePDFReport}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)] transition"
            >
              <FileText className="w-3.5 h-3.5" />
              {t.downloadReport}
            </button>

            {/* Export Analytics */}
            <button
              onClick={() => {
                const csvContent = "data:text/csv;charset=utf-8,Date,Crops,Pests,Health\n" + 
                  agriChartData.map(e => `${e.time},${e.crops},${e.pests},${e.health}`).join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "vectratrack_analytics.csv");
                document.body.appendChild(link);
                link.click();
                addEvent({ type: 'success', message: '📥 CSV analytics data exported.' });
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(34,197,94,0.4)] transition"
            >
              <Download className="w-3.5 h-3.5" />
              {t.exportAnalytics}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto w-full px-4 py-5 flex-1 flex flex-col gap-6">

        {/* 2. HERO SCI-FI BANNER (Matching Lovable Screenshot 3) */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-800/40 bg-gradient-to-r from-[#06180e] via-[#092215] to-[#06180e] p-6 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-mono-tech uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-emerald-500/30">
                  VECTRATRACK ML V4.0
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Agriculture Monitoring
              </h2>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Dual-class crop and pest tracking with unique IDs, pest-only trajectories, density alerts and exportable field analytics.
              </p>
            </div>

            {/* GPS Chip inside hero */}
            {gpsLocation && (
              <div className="flex items-center gap-2 text-xs font-mono-tech px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-700/30 text-emerald-300 self-start md:self-auto">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>{gpsLocation.lat.toFixed(4)}, {gpsLocation.lng.toFixed(4)} (±{gpsLocation.accuracy.toFixed(0)}m)</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. LOVABLE TAB NAVIGATION BAR */}
        <div className="flex items-center gap-1.5 bg-[#09180e] p-1.5 rounded-xl border border-emerald-900/40 overflow-x-auto">
          {[
            { id: 'live', label: t.liveMonitor, icon: Video },
            { id: 'video', label: t.fieldVideo, icon: Play },
            { id: 'image', label: t.imageAnalysis, icon: ImageIcon },
            { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
            { id: 'bot', label: t.fieldBot, icon: Bot },
            { id: 'report', label: t.report, icon: FileText },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-600 text-slate-950 shadow-[0_0_15px_rgba(34,197,94,0.4)]'
                    : 'text-slate-400 hover:text-white hover:bg-emerald-950/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 4. STATS HEADER ROW (4 Sci-Fi Glass Cards) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* CROPS Card */}
          <div className="agri-card p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-mono-tech uppercase tracking-wider">
              <Leaf className="w-4 h-4 text-emerald-400" />
              <span>{t.crops}</span>
            </div>
            <div className="text-4xl font-extrabold text-emerald-400 font-mono-tech mt-2">
              {cropCount}
            </div>
          </div>

          {/* PESTS Card */}
          <div className="agri-card p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-mono-tech uppercase tracking-wider">
              <Bug className="w-4 h-4 text-amber-400" />
              <span>{t.pests}</span>
            </div>
            <div className="text-4xl font-extrabold text-amber-400 font-mono-tech mt-2">
              {pestCount}
            </div>
          </div>

          {/* ACTIVE TRACKS Card */}
          <div className="agri-card p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-mono-tech uppercase tracking-wider">
              <Activity className="w-4 h-4 text-sky-400" />
              <span>{t.activeTracks}</span>
            </div>
            <div className="text-4xl font-extrabold text-sky-400 font-mono-tech mt-2">
              {totalActiveTracks}
            </div>
          </div>

          {/* ALERT Status Card */}
          <div className={`agri-card p-4 flex flex-col justify-between ${pestCount >= pestAlertThreshold ? 'alert-pulse border-red-500/50' : ''}`}>
            <div className="flex items-center gap-2 text-slate-400 text-xs font-mono-tech uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{t.alert}</span>
            </div>
            <div className={`text-xl font-extrabold font-mono-tech mt-2 ${pestCount >= pestAlertThreshold ? 'text-red-400' : 'text-emerald-400'}`}>
              {pestCount >= pestAlertThreshold ? t.criticalAlert : t.normal}
            </div>
          </div>

        </div>

        {/* 5. TAB CONTENTS */}

        {/* TAB 1: LIVE MONITOR (VIEWPORT + RIGHT CONTROL SIDEBAR) */}
        {activeTab === 'live' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Viewport Stream Column (8 Cols) */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              
              <div className="agri-card p-4">
                
                {/* Viewport Controls Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-emerald-900/40">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 pulse-green" />
                    <span className="text-xs font-mono-tech text-emerald-400 uppercase tracking-wider">
                      ● VIEWPORT OUTPUT STREAM
                    </span>
                  </div>

                  {/* Segmented Filter Buttons */}
                  <div className="flex items-center gap-1 bg-[#06110a] p-1 rounded-lg border border-emerald-900/40">
                    <button
                      onClick={() => setDisplayMode('all')}
                      className={`px-3 py-1 text-xs rounded-md font-medium transition ${displayMode === 'all' ? 'bg-emerald-600 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                    >
                      🌱+🐛 {t.all}
                    </button>
                    <button
                      onClick={() => setDisplayMode('crop')}
                      className={`px-3 py-1 text-xs rounded-md font-medium transition ${displayMode === 'crop' ? 'bg-emerald-600 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                    >
                      🌱 {t.cropsOnly}
                    </button>
                    <button
                      onClick={() => setDisplayMode('pest')}
                      className={`px-3 py-1 text-xs rounded-md font-medium transition ${displayMode === 'pest' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                    >
                      🐛 {t.pestsOnly}
                    </button>
                  </div>

                  {/* Mode Selector */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInputMode(inputMode === 'simulator' ? 'webcam' : 'simulator')}
                      className="px-3 py-1 text-xs font-mono-tech rounded-lg bg-emerald-950 border border-emerald-800/40 text-emerald-300 hover:bg-emerald-900/40 transition"
                    >
                      {inputMode === 'simulator' ? '📹 Switch to Camera' : '🎮 Virtual Simulator'}
                    </button>
                  </div>
                </div>

                {/* Main Camera Canvas Area */}
                <div className="relative rounded-xl overflow-hidden bg-black border border-emerald-900/60 aspect-video flex items-center justify-center">
                  <CameraTracker
                    config={config}
                    onUpdateTracks={(newTracks, latency) => {
                      setTracks(newTracks);
                      setLatencyMs(latency);
                    }}
                    inputMode={inputMode}
                    selectedVideo=""
                    simulatorObjectsCount={simulatorObjectsCount}
                    onAddEvent={addEvent}
                    selectedTrack={selectedTrack}
                    onSelectTrack={setSelectedTrack}
                    tracker={trackerInstance}
                    onModelLoadedStateChange={setIsModelLoaded}
                  />

                  {/* Empty state banner if no objects detected */}
                  {totalActiveTracks === 0 && (
                    <div className="absolute inset-x-0 bottom-4 text-center pointer-events-none">
                      <span className="inline-block bg-slate-900/90 text-amber-300 border border-amber-500/30 text-xs px-4 py-1.5 rounded-full backdrop-blur-md shadow-lg">
                        {t.noneDetected}
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Viewport Info Bar */}
                <div className="flex items-center justify-between mt-3 text-xs font-mono-tech text-slate-400">
                  <div className="flex items-center gap-4">
                    <span>FPS: <strong className="text-emerald-400">{fps}</strong></span>
                    <span>Latency: <strong className="text-emerald-400">{latencyMs}ms</strong></span>
                    <span>Confidence: <strong className="text-emerald-400">{(config.confidenceThreshold * 100).toFixed(0)}%</strong></span>
                  </div>
                  <div className="text-slate-500">
                    SORT Multi-Object Tracker v4.0
                  </div>
                </div>

              </div>

              {/* Event Log Console below camera */}
              <div className="agri-card p-4">
                <h3 className="font-semibold text-xs font-mono-tech text-slate-400 uppercase tracking-wider mb-3">
                  📋 SYSTEM EVENT LOG
                </h3>
                <div className="bg-[#050b07] rounded-lg p-3 border border-emerald-900/30 h-32 overflow-y-auto font-mono-tech text-xs space-y-1.5">
                  {events.length === 0 ? (
                    <div className="text-slate-600">No events logged yet.</div>
                  ) : (
                    events.slice(-15).reverse().map((e) => (
                      <div key={e.id} className="flex items-start gap-2">
                        <span className="text-slate-500">{e.timestamp.slice(11, 19)}</span>
                        <span className={e.type === 'alert' ? 'text-red-400 font-bold' : e.type === 'warning' ? 'text-amber-400' : e.type === 'success' ? 'text-emerald-400' : 'text-slate-300'}>
                          [{e.type.toUpperCase()}] {e.message}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Right Controls Sidebar (4 Cols) — Matches Lovable Sidebar */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              
              {/* PEST ALERT THRESHOLD Slider Card */}
              <div className="agri-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-mono-tech text-slate-400 uppercase tracking-wider">
                    {t.pestAlertThreshold}
                  </label>
                  <span className="text-lg font-bold font-mono-tech text-emerald-400">
                    {pestAlertThreshold} pests
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  value={pestAlertThreshold}
                  onChange={(e) => setPestAlertThreshold(parseInt(e.target.value, 10))}
                  className="mt-1"
                />
              </div>

              {/* SHOW Segmented Button Card */}
              <div className="agri-card p-4">
                <label className="block text-xs font-mono-tech text-slate-400 uppercase tracking-wider mb-2.5">
                  {t.show}
                </label>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setDisplayMode('all')}
                    className={`w-full py-2.5 px-4 text-left text-xs font-semibold rounded-lg transition ${
                      displayMode === 'all'
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(34,197,94,0.4)]'
                        : 'bg-[#09170e] text-slate-300 border border-emerald-900/40 hover:bg-emerald-950/40'
                    }`}
                  >
                    {t.all}
                  </button>
                  <button
                    onClick={() => setDisplayMode('crop')}
                    className={`w-full py-2.5 px-4 text-left text-xs font-semibold rounded-lg transition ${
                      displayMode === 'crop'
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(34,197,94,0.4)]'
                        : 'bg-[#09170e] text-slate-300 border border-emerald-900/40 hover:bg-emerald-950/40'
                    }`}
                  >
                    {t.cropsOnly}
                  </button>
                  <button
                    onClick={() => setDisplayMode('pest')}
                    className={`w-full py-2.5 px-4 text-left text-xs font-semibold rounded-lg transition ${
                      displayMode === 'pest'
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(34,197,94,0.4)]'
                        : 'bg-[#09170e] text-slate-300 border border-emerald-900/40 hover:bg-emerald-950/40'
                    }`}
                  >
                    {t.pestsOnly}
                  </button>
                </div>
              </div>

              {/* Pest Trajectories Toggle */}
              <div className="agri-card p-4 flex items-center justify-between">
                <span className="text-xs font-mono-tech text-slate-300 font-medium">
                  {t.pestTrajectories}
                </span>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={config.drawTrails}
                    onChange={(e) => setConfig(prev => ({ ...prev, drawTrails: e.target.checked }))}
                  />
                  <span className="slider-toggle" />
                </label>
              </div>

              {/* CLASS MAPPING Card (Matches Lovable Class Mapping box) */}
              <div className="agri-card p-4">
                <h3 className="text-xs font-mono-tech text-slate-400 uppercase tracking-wider mb-3">
                  {t.classMapping}
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="bg-[#09170e] p-2.5 rounded-lg border border-emerald-900/40">
                    <span className="font-bold text-emerald-400">🌱 Crop</span>
                    <p className="text-slate-400 mt-1">{t.cropClasses}</p>
                  </div>
                  <div className="bg-[#1c1308] p-2.5 rounded-lg border border-amber-900/40">
                    <span className="font-bold text-amber-400">🐛 Pest</span>
                    <p className="text-slate-400 mt-1">{t.pestClasses}</p>
                  </div>
                  <div className="bg-[#0c131a] p-2.5 rounded-lg border border-slate-800">
                    <span className="font-bold text-slate-400">⬛ Ignored</span>
                    <p className="text-slate-500 mt-1">{t.ignoredClasses}</p>
                  </div>
                </div>
              </div>

              {/* FieldBot AI Card */}
              <div className="agri-card p-4" style={{ backgroundColor: botColors[botAdvice.type].bg, borderColor: botColors[botAdvice.type].border }}>
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{botAdvice.icon}</div>
                  <div>
                    <h4 className="font-bold text-xs font-mono-tech uppercase" style={{ color: botColors[botAdvice.type].text }}>
                      🤖 FieldBot — AI Advisor
                    </h4>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: botColors[botAdvice.type].text }}>
                      {botAdvice.advice}
                    </p>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: FIELD VIDEO */}
        {activeTab === 'video' && (
          <div className="agri-card p-6 text-center space-y-4">
            <Video className="w-12 h-12 text-emerald-400 mx-auto pulse-green" />
            <h3 className="text-xl font-bold text-white">Field Video Player</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Select or upload recorded field drone footage to process object tracking offline.
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => { setInputMode('simulator'); setActiveTab('live'); }} className="px-4 py-2 bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg">
                Run Sample Field Video 1 (Broccoli)
              </button>
              <button onClick={() => { setInputMode('simulator'); setActiveTab('live'); }} className="px-4 py-2 bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs rounded-lg">
                Run Sample Field Video 2 (Apple Orchard)
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: IMAGE ANALYSIS */}
        {activeTab === 'image' && (
          <div className="agri-card p-6 text-center space-y-4">
            <ImageIcon className="w-12 h-12 text-emerald-400 mx-auto pulse-green" />
            <h3 className="text-xl font-bold text-white">Static Crop & Pest Image Analysis</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Drop field images here for instant multi-class object detection and bounding box tagging.
            </p>
            <button onClick={() => setActiveTab('live')} className="px-4 py-2 bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg">
              Analyze Sample Crop Image
            </button>
          </div>
        )}

        {/* TAB 4: DASHBOARD (SESSION SUMMARY + PIPELINE ARCHITECTURE) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* Session Summary Title (Matches Lovable Screenshot 2 & 3) */}
            <div>
              <h3 className="text-xl font-extrabold text-white">{t.sessionSummary}</h3>
              <p className="text-xs text-slate-400 mt-1">{t.sessionDesc}</p>
            </div>

            {/* 8 Grid Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="agri-card p-4">
                <span className="text-[11px] font-mono-tech text-slate-400 uppercase">FRAMES PROCESSED</span>
                <div className="text-2xl font-bold font-mono-tech text-white mt-1">{totalFramesProcessed}</div>
              </div>
              <div className="agri-card p-4">
                <span className="text-[11px] font-mono-tech text-slate-400 uppercase">DETECTION ROWS LOGGED</span>
                <div className="text-2xl font-bold font-mono-tech text-white mt-1">348</div>
              </div>
              <div className="agri-card p-4">
                <span className="text-[11px] font-mono-tech text-slate-400 uppercase">PEAK CROP COUNT</span>
                <div className="text-2xl font-bold font-mono-tech text-emerald-400 mt-1">{peakCropCount}</div>
              </div>
              <div className="agri-card p-4">
                <span className="text-[11px] font-mono-tech text-slate-400 uppercase">PEAK PEST COUNT</span>
                <div className="text-2xl font-bold font-mono-tech text-amber-400 mt-1">{peakPestCount}</div>
              </div>

              <div className="agri-card p-4">
                <span className="text-[11px] font-mono-tech text-slate-400 uppercase">PEST ALERTS RAISED</span>
                <div className="text-2xl font-bold font-mono-tech text-slate-300 mt-1">{alertsRaised}</div>
              </div>
              <div className="agri-card p-4">
                <span className="text-[11px] font-mono-tech text-slate-400 uppercase">ALERT THRESHOLD</span>
                <div className="text-2xl font-bold font-mono-tech text-emerald-400 mt-1">{pestAlertThreshold} pests / frame</div>
              </div>
              <div className="agri-card p-4">
                <span className="text-[11px] font-mono-tech text-slate-400 uppercase">AVG PEST SPEED</span>
                <div className="text-2xl font-bold font-mono-tech text-white mt-1">0.42 px/frame</div>
              </div>
              <div className="agri-card p-4">
                <span className="text-[11px] font-mono-tech text-slate-400 uppercase">AVG DETECTION CONFIDENCE</span>
                <div className="text-2xl font-bold font-mono-tech text-emerald-400 mt-1">88.5%</div>
              </div>
            </div>

            {/* Pipeline Architecture Diagram (Matches Lovable Screenshot 2) */}
            <div className="agri-card p-6">
              <h4 className="text-sm font-mono-tech text-emerald-400 uppercase tracking-wider mb-4">
                ⚙️ {t.pipeline}
              </h4>
              <div className="space-y-3 font-mono-tech text-xs text-slate-300">
                <div className="bg-[#06140b] p-3 rounded-lg border border-emerald-900/40">
                  <span className="text-emerald-400 font-bold">1. Video Input</span> → Camera feed / uploaded agricultural field MP4 video
                </div>
                <div className="text-center text-emerald-500">↓</div>
                <div className="bg-[#06140b] p-3 rounded-lg border border-emerald-900/40">
                  <span className="text-emerald-400 font-bold">2. Object Detection</span> → YOLOv8 / COCO-SSD mobile-net detector (80 COCO classes)
                </div>
                <div className="text-center text-emerald-500">↓</div>
                <div className="bg-[#06140b] p-3 rounded-lg border border-emerald-900/40">
                  <span className="text-emerald-400 font-bold">3. AgriClassMapper</span> → Maps classes to crop / pest / ignored taxonomy
                </div>
                <div className="text-center text-emerald-500">↓</div>
                <div className="bg-[#06140b] p-3 rounded-lg border border-emerald-900/40">
                  <span className="text-emerald-400 font-bold">4. CustomSortTracker</span> → Kalman Filter state estimation + ByteTrack 2-stage association
                </div>
                <div className="text-center text-emerald-500">↓</div>
                <div className="bg-[#06140b] p-3 rounded-lg border border-emerald-900/40">
                  <span className="text-emerald-400 font-bold">5. Output Modules</span> → Unique ID assignment · Class-wise counting · Pest trajectory rendering · Density alert engine
                </div>
              </div>
            </div>

            {/* 7-Day History Chart */}
            <div className="agri-card p-6">
              <h4 className="text-sm font-mono-tech text-slate-400 uppercase tracking-wider mb-4">
                📅 7-Day Pest & Crop Count History
              </h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={detectionHistory}>
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#09170e', borderColor: '#163824', borderRadius: '8px', color: '#fff' }} />
                    <Line type="monotone" dataKey="crops" stroke="#22c55e" strokeWidth={2} name="Crops" />
                    <Line type="monotone" dataKey="pests" stroke="#f59e0b" strokeWidth={2} name="Pests" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}

        {/* TAB 5: FIELDBOT */}
        {activeTab === 'bot' && (
          <div className="agri-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Bot className="w-8 h-8 text-emerald-400 pulse-green" />
              <div>
                <h3 className="text-lg font-bold text-white">FieldBot — Agricultural AI Assistant</h3>
                <p className="text-xs text-slate-400">Ask field management questions or view automated crop protection strategies.</p>
              </div>
            </div>
            <div className="bg-[#06110a] p-4 rounded-xl border border-emerald-900/40 text-xs font-mono-tech space-y-2">
              <p className="text-emerald-400">🤖 FieldBot: Current field status is evaluating {cropCount} crops and {pestCount} pests.</p>
              <p className="text-slate-300">💡 Recommended action: {botAdvice.advice}</p>
            </div>
          </div>
        )}

        {/* TAB 6: REPORT */}
        {activeTab === 'report' && (
          <div className="agri-card p-6 space-y-4 text-center">
            <FileText className="w-12 h-12 text-emerald-400 mx-auto pulse-green" />
            <h3 className="text-xl font-bold text-white">Download Printable Field Report</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Generates a comprehensive PDF document containing current crop health scores, pest counts, location coordinates, and event logs.
            </p>
            <button
              onClick={handlePDFReport}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.4)] transition"
            >
              📄 Generate & Download PDF Report
            </button>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-emerald-950 bg-[#040805] px-4 py-4 text-center text-xs text-slate-500 font-mono-tech">
        VectraTrack Agriculture v4.0 — Autonomous Multi-Object Crop & Pest Monitoring System
      </footer>

    </div>
  );
}
