import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { useTracking } from "./components/agri/useTracking";
import { MonitorView } from "./components/agri/MonitorView";
import { Sidebar } from "./components/agri/Sidebar";
import { Dashboard } from "./components/agri/Dashboard";
import { Report } from "./components/agri/Report";
import { ImageAnalysis } from "./components/agri/ImageAnalysis";
import { ComparisonView } from "./components/agri/ComparisonView";
import { Chatbot } from "./components/agri/Chatbot";
import { WeatherForecast } from "./components/agri/WeatherForecast";
import { ProfileView } from "./components/agri/ProfileView";
import { AdminView } from "./components/agri/AdminView";
import { useTranslation } from "./i18n/TranslationContext";
import { useField } from "./contexts/FieldContext";
import { useVoiceCommand } from "./hooks/useVoiceCommand";
import { LANG_META, type Lang } from "./i18n/translations";
import heroImg from "./assets/field-hero.jpg";
import { MapPin, Mic, MicOff, Plus, ChevronDown, Check, Loader2, Volume2, X } from "lucide-react";

export default function App() {
  const state = useTracking();
  const { lang, setLang, t } = useTranslation();
  const { fields, activeField, setActiveField, addField } = useField();

  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>({ lat: 10.7870, lng: 79.1378 });
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'success' | 'manual'>('idle');
  const [activeTab, setActiveTab] = useState('live');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showFieldMenu, setShowFieldMenu] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState('');

  const fieldRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  const handleFetchGps = () => {
    if (!('geolocation' in navigator)) {
      promptManualGps('Geolocation not supported by browser.');
      return;
    }
    setGpsStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus('success');
        setTimeout(() => setGpsStatus('idle'), 3500);
      },
      (err) => {
        console.warn('GPS access:', err.message);
        promptManualGps('GPS permission denied or unavailable.');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const promptManualGps = (reason: string) => {
    setGpsStatus('manual');
    const input = prompt(
      `${reason}\nEnter field coordinates (lat, lng):\nExample: 10.78, 79.13 (Thanjavur) or 11.01, 76.95 (Coimbatore)`,
      gpsLocation ? `${gpsLocation.lat.toFixed(2)}, ${gpsLocation.lng.toFixed(2)}` : '10.78, 79.13'
    );
    if (input) {
      const parts = input.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]!) && !isNaN(parts[1]!)) {
        setGpsLocation({ lat: parts[0]!, lng: parts[1]! });
        setGpsStatus('success');
      }
    }
    setTimeout(() => setGpsStatus('idle'), 2500);
  };

  const onVoiceCommand = useCallback((transcript: string, tab: string | null) => {
    if (tab) {
      setActiveTab(tab);
      setVoiceFeedback(`✓ Matched: "${transcript}" → ${tab.toUpperCase()}`);
    } else {
      setVoiceFeedback(`🎤 Heard: "${transcript}"`);
    }
    setTimeout(() => setVoiceFeedback(''), 5000);
  }, []);

  const { isListening, error: voiceError, toggle: toggleVoice } = useVoiceCommand(lang, onVoiceCommand);

  const handleVoiceButtonClick = () => {
    setShowVoiceModal(true);
    if (!isListening) {
      toggleVoice();
    }
  };

  const TABS = [
    { value: 'live',      label: t('liveMonitor') },
    { value: 'video',     label: t('fieldVideo') },
    { value: 'image',     label: t('imageAnalysis') },
    { value: 'compare',   label: t('beforeAfter') },
    { value: 'weather',   label: t('weather') },
    { value: 'dashboard', label: t('dashboard') },
    { value: 'assistant', label: t('fieldbot') },
    { value: 'profile',   label: t('profile') },
    { value: 'admin',     label: t('admin') },
    { value: 'report',    label: t('report') },
  ];

  const VOICE_COMMAND_EXAMPLES: { text: string; tab: string }[] =
    lang === 'ta'
      ? [
          { text: 'நேரடி கண்காணிப்பு (Live)', tab: 'live' },
          { text: 'படம் ஆய்வு (Image Analysis)', tab: 'image' },
          { text: 'வானிலை முன்னறிவிப்பு (Weather)', tab: 'weather' },
          { text: 'டாஷ்போர்டு (Dashboard)', tab: 'dashboard' },
          { text: 'சிகிச்சை திட்டம் (Treatment)', tab: 'assistant' },
        ]
      : [
          { text: 'Live Monitor', tab: 'live' },
          { text: 'Image Analysis', tab: 'image' },
          { text: 'Weather Forecast', tab: 'weather' },
          { text: 'Dashboard', tab: 'dashboard' },
          { text: 'Treatment Advice', tab: 'assistant' },
        ];

  return (
    <main className="min-h-screen text-slate-100 selection:bg-emerald-500 selection:text-black bg-[#09140c] relative">

      {/* ── BACKDROP DIMMER FOR OPEN MENUS ───────────────────────────────────── */}
      {(showFieldMenu || showLangMenu) && (
        <div
          className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-[2px] transition-opacity animate-in fade-in"
          onClick={() => { setShowFieldMenu(false); setShowLangMenu(false); }}
        />
      )}

      {/* ── HERO BANNER & NAVIGATION BAR ────────────────────────────────────── */}
      <header className="relative border-b border-emerald-900/50 bg-[#06140b] z-[9995]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img
            src={heroImg}
            alt="Crop field at dawn"
            className="h-full w-full object-cover opacity-25"
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs tracking-[0.35em] text-emerald-400 uppercase font-mono font-bold">
                  VectraTrack ML v5.0 AI Precision
                </span>
                <span className="px-2 py-0.5 text-[10px] bg-emerald-900/80 text-emerald-300 border border-emerald-700/80 rounded font-bold">
                  PWA Ready
                </span>
              </div>
              <h1 className="text-xl font-black sm:text-2xl tracking-tight text-white drop-shadow-md">
                {t('appTitle')}
              </h1>
              <p className="mt-1 max-w-2xl text-xs text-slate-300 leading-relaxed drop-shadow">
                {t('appSubtitle')}
              </p>
            </div>

            {/* ── TOP ACTION BUTTONS ─────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2 mt-1">

              {/* 🌾 1. FIELD SELECTOR DROPDOWN */}
              <div ref={fieldRef} className="relative z-[9999]">
                <button
                  type="button"
                  onClick={() => { setShowFieldMenu(v => !v); setShowLangMenu(false); }}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs rounded-lg bg-[#0d2217] border-2 border-emerald-500/80 text-emerald-200 hover:text-white hover:bg-emerald-900/90 transition font-bold shadow-[0_4px_20px_rgba(0,0,0,0.5)] cursor-pointer"
                >
                  <span className="text-base">🌾</span>
                  <span className="max-w-[140px] truncate">{activeField?.name ?? 'Main Farm Field'}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-emerald-400" />
                </button>

                {showFieldMenu && (
                  <div className="absolute left-0 sm:right-auto top-full mt-2.5 z-[10000] w-72 rounded-xl border-2 border-emerald-500 bg-[#0c1f15] shadow-[0_16px_50px_rgba(0,0,0,0.95)] p-2 flex flex-col gap-1 animate-in fade-in zoom-in-95">
                    <div className="px-3 py-2 border-b border-emerald-900/70 flex items-center justify-between">
                      <span className="text-[11px] text-emerald-300 uppercase tracking-wider font-extrabold">Registered Farm Fields</span>
                      <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded-full font-mono border border-emerald-800">
                        {fields.length} Active
                      </span>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1 py-1">
                      {fields.map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => { setActiveField(f); setShowFieldMenu(false); }}
                          className={`w-full text-left px-3 py-2.5 text-xs rounded-lg transition flex items-center justify-between cursor-pointer ${
                            activeField?.id === f.id
                              ? 'bg-emerald-800/80 text-white font-bold border border-emerald-400'
                              : 'text-slate-200 hover:bg-emerald-950/80 hover:text-emerald-200 border border-transparent'
                          }`}
                        >
                          <div>
                            <p className="font-bold text-white text-xs">{f.name}</p>
                            <p className="text-[11px] text-emerald-400 font-medium">🌱 {f.cropType} · {f.location}</p>
                          </div>
                          {activeField?.id === f.id && <Check className="h-4 w-4 text-emerald-300 shrink-0 font-bold" />}
                        </button>
                      ))}
                    </div>

                    <div className="border-t border-emerald-900/70 pt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const name = prompt('Enter new field name (e.g., South Paddy Plot):');
                          if (name?.trim()) {
                            const crop = prompt('Primary crop type (e.g., Paddy, Tomato, Cotton):') ?? 'Paddy / Rice';
                            const loc = prompt('Location (e.g., Thanjavur, TN):') ?? 'Tamil Nadu';
                            addField(name.trim(), crop.trim(), loc.trim());
                          }
                          setShowFieldMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs rounded-lg bg-emerald-950/90 text-emerald-300 hover:bg-emerald-900 hover:text-white transition flex items-center gap-2 font-bold border border-emerald-700/60 cursor-pointer"
                      >
                        <Plus className="h-4 w-4 text-emerald-400" /> {t('addField')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 🇬🇧 2. LANGUAGE SELECTOR DROPDOWN */}
              <div ref={langRef} className="relative z-[9999]">
                <button
                  type="button"
                  onClick={() => { setShowLangMenu(v => !v); setShowFieldMenu(false); }}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs rounded-lg bg-[#0d2217] border-2 border-emerald-500/80 text-emerald-200 hover:text-white hover:bg-emerald-900/90 transition font-bold shadow-[0_4px_20px_rgba(0,0,0,0.5)] cursor-pointer"
                >
                  <span className="text-base">{LANG_META[lang].flag}</span>
                  <span>{LANG_META[lang].label}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-emerald-400" />
                </button>

                {showLangMenu && (
                  <div className="absolute left-0 sm:right-auto top-full mt-2.5 z-[10000] w-52 rounded-xl border-2 border-emerald-500 bg-[#0c1f15] shadow-[0_16px_50px_rgba(0,0,0,0.95)] p-2 flex flex-col gap-1 animate-in fade-in zoom-in-95">
                    <div className="px-3 py-1.5 text-[11px] text-emerald-300 font-extrabold uppercase tracking-wider border-b border-emerald-900/70">
                      Select Language
                    </div>
                    {(Object.keys(LANG_META) as Lang[]).map(l => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => { setLang(l); setShowLangMenu(false); }}
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg transition flex items-center justify-between cursor-pointer ${
                          lang === l
                            ? 'bg-emerald-800/80 text-white font-bold border border-emerald-400'
                            : 'text-slate-200 hover:bg-emerald-950/80 hover:text-emerald-200 border border-transparent'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 text-xs">
                          <span className="text-base">{LANG_META[l].flag}</span>
                          <span className="font-bold">{LANG_META[l].label}</span>
                        </span>
                        {lang === l && <Check className="h-4 w-4 text-emerald-300 font-bold" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 📍 3. GPS LOCATION BUTTON */}
              <button
                type="button"
                onClick={handleFetchGps}
                title="Click to detect GPS location or enter custom coordinates"
                className={`flex items-center gap-2 px-3.5 py-2 text-xs rounded-lg border-2 transition font-bold shadow-[0_4px_20px_rgba(0,0,0,0.5)] cursor-pointer ${
                  gpsStatus === 'locating'
                    ? 'bg-sky-950 border-sky-400 text-sky-200 animate-pulse'
                    : gpsStatus === 'success'
                    ? 'bg-emerald-900 border-emerald-400 text-emerald-200'
                    : 'bg-[#0d2217] border-emerald-500/80 text-emerald-200 hover:text-white hover:bg-emerald-900/90'
                }`}
              >
                {gpsStatus === 'locating' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                ) : (
                  <MapPin className="w-4 h-4 text-emerald-400" />
                )}
                <span>
                  {gpsStatus === 'locating'
                    ? 'Detecting GPS…'
                    : gpsLocation
                    ? `${gpsLocation.lat.toFixed(2)}°, ${gpsLocation.lng.toFixed(2)}°`
                    : 'Get GPS'}
                </span>
              </button>

              {/* 🎙️ 4. VOICE COMMAND BUTTON */}
              <button
                type="button"
                onClick={handleVoiceButtonClick}
                title="Click to speak agricultural commands"
                className={`flex items-center gap-2 px-3.5 py-2 text-xs rounded-lg border-2 transition font-bold shadow-[0_4px_20px_rgba(0,0,0,0.5)] cursor-pointer ${
                  isListening
                    ? 'bg-red-950 border-red-500 text-red-200 animate-pulse ring-4 ring-red-500/40'
                    : 'bg-[#0d2217] border-emerald-500/80 text-emerald-200 hover:text-white hover:bg-emerald-900/90'
                }`}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4 text-red-400 animate-bounce" />
                ) : (
                  <Mic className="w-4 h-4 text-emerald-400" />
                )}
                <span>{isListening ? 'Listening…' : 'Speak / Voice'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── VOICE ASSISTANT MODAL (High-Contrast, Interactive) ─────────────────── */}
      {showVoiceModal && (
        <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border-2 border-emerald-500 bg-[#0a1b12] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-900/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${isListening ? 'bg-red-950 border border-red-600' : 'bg-emerald-950 border border-emerald-600'}`}>
                  <Mic className={`h-5 w-5 ${isListening ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">AI Voice Assistant</h3>
                  <p className="text-[11px] text-emerald-400">{LANG_META[lang].flag} Language: {LANG_META[lang].label}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVoiceModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Listening status indicator */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-900/50 text-center space-y-2">
              <p className="text-xs font-semibold text-emerald-300">
                {isListening ? '🎙️ Listening... Speak your field command now' : 'Mic is idle. Click below to start speaking:'}
              </p>
              {voiceFeedback && (
                <p className="text-sm font-bold text-white bg-emerald-950/90 py-2 px-3 rounded-lg border border-emerald-700">
                  {voiceFeedback}
                </p>
              )}
              {voiceError && (
                <p className="text-xs text-amber-400">
                  ⚠️ {voiceError} (Ensure microphone permissions are allowed)
                </p>
              )}
            </div>

            {/* Suggested commands you can speak or tap */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Speak or Tap Any Command:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {VOICE_COMMAND_EXAMPLES.map((cmd) => (
                  <button
                    key={cmd.tab}
                    type="button"
                    onClick={() => {
                      setActiveTab(cmd.tab);
                      setShowVoiceModal(false);
                    }}
                    className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 hover:bg-emerald-900 text-left text-xs text-emerald-200 font-semibold transition flex items-center justify-between"
                  >
                    <span>{cmd.text}</span>
                    <span className="text-[10px] text-emerald-400">➔</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-emerald-900/60">
              <button
                type="button"
                onClick={toggleVoice}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  isListening
                    ? 'bg-red-900 hover:bg-red-800 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {isListening ? 'Stop Listening' : 'Start Microphone'}
              </button>
              <button
                type="button"
                onClick={() => setShowVoiceModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN APPLICATION CONTENT ────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 py-6 relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab}>

          {/* TAB BAR — Scrollable on mobile screens */}
          <div className="overflow-x-auto pb-1 mb-5 scrollbar-thin">
            <TabsList className="inline-flex flex-nowrap gap-0.5 bg-panel border border-border p-1.5 rounded-xl min-w-max">
              {TABS.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value} className="text-xs px-3 py-1.5 whitespace-nowrap font-medium">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_280px] items-start">
            <div>
              <TabsContent value="live">
                <MonitorView state={state} mode="camera" />
              </TabsContent>
              <TabsContent value="video">
                <MonitorView state={state} mode="video" />
              </TabsContent>
              <TabsContent value="image">
                <ImageAnalysis threshold={state.threshold} />
              </TabsContent>
              <TabsContent value="compare">
                <ComparisonView />
              </TabsContent>
              <TabsContent value="weather">
                <WeatherForecast gps={gpsLocation} />
              </TabsContent>
              <TabsContent value="dashboard">
                <Dashboard state={state} />
              </TabsContent>
              <TabsContent value="assistant">
                <Chatbot state={state} />
              </TabsContent>
              <TabsContent value="profile">
                <ProfileView />
              </TabsContent>
              <TabsContent value="admin">
                <AdminView />
              </TabsContent>
              <TabsContent value="report">
                <Report state={state} />
              </TabsContent>
            </div>

            {/* Always-visible right telemetry sidebar */}
            <Sidebar state={state} />
          </div>
        </Tabs>
      </div>

    </main>
  );
}
