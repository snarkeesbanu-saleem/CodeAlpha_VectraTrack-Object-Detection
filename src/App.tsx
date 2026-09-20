import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TrackerConfig, Track, SystemEvent, ChartDataPoint } from './types';
import { SORTTracker } from './utils/tracker';
import { getAgriInfo, computeHealthScore, getHealthGrade, CROP_CLASS_LIST, PEST_CLASS_LIST, IGNORED_CLASS_LIST } from './agriMapper';
import CameraTracker from './components/CameraTracker';
import LogConsole from './components/LogConsole';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Leaf, Bug, Activity, Heart, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Download, Map } from 'lucide-react';

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

export default function App() {
  const trackerInstance = useMemo(() => new SORTTracker(), []);

  // Config (reuse existing TrackerConfig type)
  const [config, setConfig] = useState<TrackerConfig>({
    iouThreshold: 0.35,
    confidenceThreshold: 0.45,
    maxMissedFrames: 25,
    historyLength: 35,
    drawTrails: true,
    blurBackground: false,
    minTrackAge: 1,
    colorTheme: 'cyan',
    filterClasses: [], // we handle agri filtering in the parent
  });

  // Feed mode
  const [inputMode, setInputMode] = useState<'webcam' | 'video' | 'simulator'>('simulator');
  const [simulatorObjectsCount] = useState(6);

  // Core track state
  const [tracks, setTracks] = useState<Track[]>([]);
  const [fps, setFps] = useState(30);
  const [latencyMs, setLatencyMs] = useState(0);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  // Agriculture-specific state
  const [pestAlertThreshold, setPestAlertThreshold] = useState(5);
  const [proximityAlert, setProximityAlert] = useState(true);
  const [proximityRadius] = useState(80);
  const [showClassMapping, setShowClassMapping] = useState(false);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [agriChartData, setAgriChartData] = useState<AgriChartPoint[]>([]);
  const [zoneData, setZoneData] = useState<ZoneData[]>(Array(9).fill({ crops: 0, pests: 0 }));
  const [healthScore, setHealthScore] = useState(100);
  const [totalCropIds, setTotalCropIds] = useState(0);
  const [totalPestIds, setTotalPestIds] = useState(0);
  const [alertActive, setAlertActive] = useState(false);
  const [displayMode, setDisplayMode] = useState<'all' | 'crop' | 'pest'>('all');

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

  // Seed initial events
  useEffect(() => {
    addEvent({ type: 'info', message: 'VectraTrack Agriculture v4.0 initialised. COCO-SSD model loading...' });
    addEvent({ type: 'info', message: 'Agriculture class mapper loaded: 7 crop classes, 7 pest classes.' });
  }, []);

  // Process incoming tracks from CameraTracker
  const handleUpdateTracks = (newTracks: Track[], latency: number) => {
    // Apply display mode filter but track all
    setTracks(newTracks);
    setLatencyMs(latency);

    const now = performance.now();
    const delta = now - lastUpdateRef.current;
    lastUpdateRef.current = now;
    setFps(prev => prev * 0.9 + (delta > 0 ? 1000/delta : 30) * 0.1);

    // Count agriculture categories
    let cropCount = 0, pestCount = 0;
    const newZoneData: ZoneData[] = Array(9).fill(null).map(() => ({ crops: 0, pests: 0 }));

    newTracks.forEach(track => {
      const info = getAgriInfo(track.class);
      if (info.category === 'crop') {
        cropCount++;
        // Zone assignment
        const [tx, ty, tw, th] = track.bbox;
        const cx = tx + tw/2; const cy = ty + th/2;
        const col = Math.min(Math.floor(cx / 640 * 3), 2);
        const row = Math.min(Math.floor(cy / 480 * 3), 2);
        const zoneIdx = row * 3 + col;
        newZoneData[zoneIdx] = { ...newZoneData[zoneIdx], crops: newZoneData[zoneIdx].crops + 1 };
        // Track unique IDs
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

    // Pest density alert
    const isAlert = pestCount >= pestAlertThreshold;
    setAlertActive(isAlert);
    if (isAlert) {
      addEvent({ type: 'alert', message: `🚨 PEST ALERT: ${pestCount} pests in frame — threshold ${pestAlertThreshold} exceeded!` });
    }
  };

  // Chart data (every 2s)
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

  // Override config filterClasses based on display mode
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

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      
      {/* ── NAVBAR ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center shadow-md">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-800">VectraTrack Agriculture</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-green-100 text-green-700 rounded-full border border-green-200">ML v4.0</span>
              </div>
              <p className="text-[10px] text-slate-400">Crop &amp; Pest Monitoring System</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <span className="w-2 h-2 rounded-full bg-green-500 pulse-green"></span>
              <span className="text-xs font-medium">Live</span>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Export Analytics
            </button>
          </div>
        </div>
      </header>

      {/* ── PEST ALERT BANNER ── */}
      {alertActive && (
        <div className="bg-red-600 text-white text-sm font-semibold text-center py-2.5 alert-pulse">
          🚨 PEST ALERT! {pestCount} pests detected — threshold of {pestAlertThreshold} exceeded. Immediate inspection recommended.
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        
        {/* ── HERO ── */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-100 p-6">
          <h2 className="text-2xl font-bold text-slate-800">🌾 Agriculture Monitoring</h2>
          <p className="text-slate-500 text-sm mt-1 max-w-2xl">
            Dual-class crop and pest tracking with unique IDs, pest-only trajectories, density alerts and exportable field analytics.
          </p>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="agri-card p-4">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <Leaf className="w-4 h-4" />
                <span className="text-xs font-semibold text-slate-500">LIVE CROPS</span>
              </div>
              <div className="text-3xl font-bold text-green-600">{cropCount}</div>
              <div className="text-xs text-slate-400 mt-0.5">{totalCropIds} total IDs seen</div>
            </div>
            <div className="agri-card p-4">
              <div className="flex items-center gap-2 text-amber-600 mb-1">
                <Bug className="w-4 h-4" />
                <span className="text-xs font-semibold text-slate-500">LIVE PESTS</span>
              </div>
              <div className="text-3xl font-bold text-amber-600">{pestCount}</div>
              <div className="text-xs text-slate-400 mt-0.5">{totalPestIds} total IDs seen</div>
            </div>
            <div className="agri-card p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Activity className="w-4 h-4" />
                <span className="text-xs font-semibold text-slate-500">ACTIVE TRACKS</span>
              </div>
              <div className="text-3xl font-bold text-blue-600">{tracks.length}</div>
              <div className="text-xs text-slate-400 mt-0.5">{fps.toFixed(0)} FPS · {latencyMs}ms</div>
            </div>
            <div className="agri-card p-4">
              <div className="flex items-center gap-2 mb-1" style={{ color: gradeColor }}>
                <Heart className="w-4 h-4" />
                <span className="text-xs font-semibold text-slate-500">FIELD HEALTH</span>
              </div>
              <div className="text-3xl font-bold" style={{ color: gradeColor }}>{healthScore}</div>
              <div className="text-xs mt-0.5" style={{ color: gradeColor }}>{grade}</div>
            </div>
          </div>
        </div>

        {/* ── MAIN GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: Camera + Log */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            
            {/* Camera card */}
            <div className="agri-card overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    🎥 Live Field Monitor
                    {isModelLoaded && (
                      <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200 font-semibold">COCO-SSD Active</span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2">
                    {/* Display mode filter */}
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
                    {/* Input mode */}
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
              <div className="p-0">
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

            {/* Event log */}
            <div className="agri-card h-[200px] overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <h3 className="font-semibold text-slate-700 text-sm">📋 Event Log</h3>
                <button
                  onClick={() => setEvents([])}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <span className="text-2xl mb-1">🌿</span>
                    <p className="text-sm">No pest density events yet.</p>
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

          {/* RIGHT SIDEBAR */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            
            {/* Field Health */}
            <div className="agri-card p-4">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">💚 Field Health Score</h3>
              <div className="text-center mb-3">
                <div className="text-5xl font-bold mb-1" style={{ color: gradeColor }}>{healthScore}</div>
                <div className="text-sm font-medium" style={{ color: gradeColor }}>{grade}</div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 mb-3">
                <div
                  className="h-2.5 rounded-full transition-all duration-700"
                  style={{ width: `${healthScore}%`, backgroundColor: gradeColor }}
                />
              </div>
              <p className="text-xs text-slate-400 text-center">
                {healthScore >= 75 ? 'Field is healthy. Continue routine monitoring.' :
                 healthScore >= 45 ? 'Moderate pest pressure. Consider targeted intervention.' :
                 'CRITICAL: High pest density. Immediate action required!'}
              </p>
            </div>

            {/* Pest Alert Settings */}
            <div className="agri-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="font-semibold text-slate-700 text-sm">Pest Alert Settings</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>Pest Alert Threshold</span>
                    <span className="font-semibold text-slate-700">{pestAlertThreshold} pests</span>
                  </div>
                  <input
                    type="range" min={1} max={20} value={pestAlertThreshold}
                    onChange={e => setPestAlertThreshold(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-slate-300 mt-0.5">
                    <span>1</span><span>20</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-slate-100">
                  <div>
                    <div className="text-xs font-medium text-slate-600">Proximity Alert</div>
                    <div className="text-[10px] text-slate-400">Radius: {proximityRadius}px</div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={proximityAlert} onChange={e => setProximityAlert(e.target.checked)} />
                    <span className="slider-toggle" />
                  </label>
                </div>
              </div>
            </div>

            {/* Class Mapping */}
            <div className="agri-card p-4">
              <button
                onClick={() => setShowClassMapping(!showClassMapping)}
                className="flex items-center justify-between w-full"
              >
                <h3 className="font-semibold text-slate-700 text-sm">🗺️ Class Mapping</h3>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400">Show</span>
                  {showClassMapping ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>
              {showClassMapping && (
                <div className="mt-3 space-y-2.5">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-base">🌱</span>
                      <span className="text-xs font-semibold text-green-700">Crop classes</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {CROP_CLASS_LIST.map(cls => (
                        <span key={cls} className="crop-badge">{cls}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-base">🐛</span>
                      <span className="text-xs font-semibold text-amber-700">Pest classes</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {PEST_CLASS_LIST.map(cls => (
                        <span key={cls} className="pest-badge">{cls}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-base">⬛</span>
                      <span className="text-xs font-semibold text-slate-500">Ignored</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {['person', 'car', 'truck', 'bicycle', 'laptop', 'chair', '…'].map(cls => (
                        <span key={cls} className="ignore-badge">{cls}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {!showClassMapping && (
                <p className="text-xs text-slate-400 mt-1.5">
                  🌱 {CROP_CLASS_LIST.length} crop classes · 🐛 {PEST_CLASS_LIST.length} pest classes
                </p>
              )}
            </div>

            {/* Confidence slider */}
            <div className="agri-card p-4">
              <h3 className="font-semibold text-slate-700 text-sm mb-3">⚙️ Detection Settings</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>Confidence Threshold</span>
                    <span className="font-semibold text-slate-700">{config.confidenceThreshold.toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min={0.1} max={0.9} step={0.05}
                    value={config.confidenceThreshold}
                    onChange={e => setConfig(prev => ({ ...prev, confidenceThreshold: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center justify-between py-2 border-t border-slate-100">
                  <span className="text-xs text-slate-600">Pest Trails</span>
                  <label className="toggle">
                    <input type="checkbox" checked={config.drawTrails}
                      onChange={e => setConfig(prev => ({ ...prev, drawTrails: e.target.checked }))} />
                    <span className="slider-toggle" />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── ANALYTICS ROW ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Crop/Pest timeline */}
          <div className="agri-card p-4">
            <h3 className="font-semibold text-slate-700 text-sm mb-3">📈 Crop & Pest Over Time</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={agriChartData}>
                <XAxis dataKey="time" tick={{ fontSize: 9 }} interval={4} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Line type="monotone" dataKey="crops" stroke="#16a34a" strokeWidth={2} dot={false} name="Crops" />
                <Line type="monotone" dataKey="pests" stroke="#d97706" strokeWidth={2} dot={false} name="Pests" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-3 mt-1 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-600 inline-block"></span> Crops</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-600 inline-block"></span> Pests</span>
            </div>
          </div>

          {/* Health timeline */}
          <div className="agri-card p-4">
            <h3 className="font-semibold text-slate-700 text-sm mb-3">💚 Health Score Timeline</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={agriChartData}>
                <XAxis dataKey="time" tick={{ fontSize: 9 }} interval={4} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="health" fill="#22c55e" radius={[3,3,0,0]} name="Health Score" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pest behaviour pie */}
          <div className="agri-card p-4">
            <h3 className="font-semibold text-slate-700 text-sm mb-3">💨 Pest Behaviour</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pestBehaviourData} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                  {pestBehaviourData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 mt-1">
              {pestBehaviourData.map(b => (
                <div key={b.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }}></span>
                    {b.name}
                  </span>
                  <span className="font-semibold text-slate-600">{b.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── ZONE MAP ── */}
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
                <div
                  key={i}
                  className={`rounded-lg border-2 p-3 text-center transition-all ${
                    hasPest
                      ? 'border-red-300 bg-red-50'
                      : hasCrop
                        ? 'border-green-300 bg-green-50'
                        : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-500 mb-1">Zone {i+1}</div>
                  <div className="flex justify-center gap-2 text-xs">
                    <span className="text-green-600 font-semibold">🌱 {zone.crops}</span>
                    <span className="text-amber-600 font-semibold">🐛 {zone.pests}</span>
                  </div>
                  {hasPest && <div className="text-[10px] text-red-500 mt-0.5 font-semibold">⚠️ Alert</div>}
                </div>
              );
            })}
          </div>
        </div>

      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>VectraTrack Agriculture v1.0 · Precision Agriculture AI</span>
          <span>Built with YOLOv8 (COCO-SSD) · ByteTrack · Streamlit · React</span>
          <a href="https://github.com/snarkeesbanu-saleem/CodeAlpha_VectraTrack-Object-Detection" className="text-green-600 hover:underline">
            GitHub Repository ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
