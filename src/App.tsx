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
import { MapPin, Mic, MicOff, Plus, ChevronDown, Check, Loader2, Info } from "lucide-react";

export default function App() {
  const state = useTracking();
  const { lang, setLang, t } = useTranslation();
  const { fields, activeField, setActiveField, addField } = useField();

  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>({ lat: 10.7870, lng: 79.1378 }); // Thanjavur delta default
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'success' | 'manual'>('idle');
  const [activeTab, setActiveTab] = useState('live');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showFieldMenu, setShowFieldMenu] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState('');

  // ── Click-outside refs to close dropdowns ──────────────────────────────────
  const langRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
      if (fieldRef.current && !fieldRef.current.contains(e.target as Node)) {
        setShowFieldMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

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
      `${reason}\nEnter field coordinates (lat, lng) or city:\nExample: 10.78, 79.13 (Thanjavur) or 11.01, 76.95 (Coimbatore)`,
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
      setVoiceFeedback(`✓ "${transcript}" → ${tab.toUpperCase()}`);
    } else {
      setVoiceFeedback(`🎤 "${transcript}" (Try saying 'Dashboard', 'Weather', or 'Live')`);
    }
    setTimeout(() => setVoiceFeedback(''), 4500);
  }, []);

  const { isListening, error: voiceError, toggle: toggleVoice } = useVoiceCommand(lang, onVoiceCommand);

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

  return (
    <main className="min-h-screen text-slate-100 selection:bg-emerald-500 selection:text-black bg-[#09140c]">

      {/* ── HERO BANNER (Notice: overflow-visible so dropdowns float over canvas) ── */}
      <header className="relative border-b border-border bg-[#06140b] z-30">
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
                <span className="px-2 py-0.5 text-[10px] bg-emerald-900/60 text-emerald-400 border border-emerald-800/60 rounded font-bold">
                  PWA Ready
                </span>
              </div>
              <h1 className="text-xl font-black sm:text-2xl tracking-tight text-white">
                {t('appTitle')}
              </h1>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground leading-relaxed">
                {t('appSubtitle')}
              </p>
            </div>

            {/* ── TOP ACTION CONTROLS ────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2 mt-1">

              {/* 🌾 1. FIELD SELECTOR DROPDOWN */}
              <div ref={fieldRef} className="relative">
                <button
                  type="button"
                  onClick={() => { setShowFieldMenu(v => !v); setShowLangMenu(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 hover:text-white hover:bg-emerald-900/80 transition font-medium shadow-md"
                >
                  <span>🌾</span>
                  <span className="max-w-[130px] truncate">{activeField?.name ?? 'Select Field'}</span>
                  <ChevronDown className="h-3 w-3 opacity-70 ml-0.5" />
                </button>

                {showFieldMenu && (
                  <div className="absolute right-0 sm:left-0 top-full mt-2 z-50 w-64 rounded-xl border border-slate-700 bg-slate-950/95 backdrop-blur-md shadow-2xl p-1.5 flex flex-col gap-1">
                    <div className="px-3 py-1.5 border-b border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Registered Fields</span>
                      <span className="text-[10px] text-emerald-400 font-mono">{fields.length} Active</span>
                    </div>

                    <div className="max-h-52 overflow-y-auto space-y-0.5 py-1">
                      {fields.map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => { setActiveField(f); setShowFieldMenu(false); }}
                          className={`w-full text-left px-3 py-2 text-xs rounded-lg transition flex items-center justify-between ${
                            activeField?.id === f.id
                              ? 'bg-emerald-950/60 text-emerald-300 font-bold border border-emerald-800/60'
                              : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                          }`}
                        >
                          <div>
                            <p className="font-semibold">{f.name}</p>
                            <p className="text-[10px] text-slate-400 font-normal">🌱 {f.cropType} · {f.location}</p>
                          </div>
                          {activeField?.id === f.id && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                        </button>
                      ))}
                    </div>

                    <div className="border-t border-slate-800 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const name = prompt('Enter new field name (e.g., North Paddy Plot):');
                          if (name?.trim()) {
                            const crop = prompt('Primary crop type (e.g., Paddy, Tomato, Cotton):') ?? 'Paddy / Rice';
                            const loc = prompt('Location (e.g., Thanjavur, TN):') ?? 'Tamil Nadu';
                            addField(name.trim(), crop.trim(), loc.trim());
                          }
                          setShowFieldMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs rounded-lg text-emerald-400 hover:bg-emerald-950/50 hover:text-emerald-300 transition flex items-center gap-1.5 font-medium"
                      >
                        <Plus className="h-3.5 w-3.5" /> {t('addField')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 🇬🇧 2. LANGUAGE SELECTOR DROPDOWN */}
              <div ref={langRef} className="relative">
                <button
                  type="button"
                  onClick={() => { setShowLangMenu(v => !v); setShowFieldMenu(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slate-900/90 border border-slate-700 text-slate-200 hover:text-white hover:border-slate-500 transition font-medium shadow-md"
                >
                  <span>{LANG_META[lang].flag}</span>
                  <span>{LANG_META[lang].label}</span>
                  <ChevronDown className="h-3 w-3 opacity-70 ml-0.5" />
                </button>

                {showLangMenu && (
                  <div className="absolute right-0 sm:left-0 top-full mt-2 z-50 w-44 rounded-xl border border-slate-700 bg-slate-950/95 backdrop-blur-md shadow-2xl p-1.5 flex flex-col gap-1">
                    <div className="px-2.5 py-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                      Choose Language
                    </div>
                    {(Object.keys(LANG_META) as Lang[]).map(l => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => { setLang(l); setShowLangMenu(false); }}
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg transition flex items-center justify-between ${
                          lang === l
                            ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-800/60'
                            : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{LANG_META[l].flag}</span>
                          <span>{LANG_META[l].label}</span>
                        </span>
                        {lang === l && <Check className="h-3.5 w-3.5 text-emerald-400" />}
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
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition font-medium shadow-md ${
                  gpsStatus === 'locating'
                    ? 'bg-sky-950/80 border-sky-600 text-sky-300'
                    : gpsStatus === 'success'
                    ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                    : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:text-emerald-400 hover:border-slate-500'
                }`}
              >
                {gpsStatus === 'locating' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                ) : (
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>
                  {gpsStatus === 'locating'
                    ? 'Locating…'
                    : gpsLocation
                    ? `${gpsLocation.lat.toFixed(2)}°, ${gpsLocation.lng.toFixed(2)}°`
                    : 'Get GPS'}
                </span>
              </button>

              {/* 🎙️ 4. VOICE COMMAND BUTTON */}
              <button
                type="button"
                onClick={toggleVoice}
                title={
                  voiceError ||
                  (isListening
                    ? 'Listening… Speak your command now'
                    : `Voice Commands: Say 'Dashboard', 'Weather', 'Live', 'Treatment' (${LANG_META[lang].label})`)
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition font-medium shadow-md ${
                  isListening
                    ? 'bg-red-950/90 border-red-600 text-red-300 animate-pulse ring-2 ring-red-500/40'
                    : voiceError
                    ? 'bg-slate-900/60 border-slate-800 text-slate-500'
                    : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:text-emerald-400 hover:border-slate-500'
                }`}
              >
                {isListening ? (
                  <MicOff className="w-3.5 h-3.5 text-red-400 animate-bounce" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{isListening ? 'Listening…' : 'Voice'}</span>
              </button>
            </div>
          </div>

          {/* VOICE FEEDBACK OR ACTIVE STATUS TOAST */}
          {(voiceFeedback || isListening) && (
            <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-xs text-emerald-300 shadow-lg">
              <Mic className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
              <span>{isListening ? `${t('voiceReady')} (${LANG_META[lang].label})` : voiceFeedback}</span>
            </div>
          )}
        </div>
      </header>

      {/* ── MAIN APPLICATION CONTENT ────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>

          {/* TAB BAR — Scrollable on mobile screens */}
          <div className="overflow-x-auto pb-1 mb-5 scrollbar-thin">
            <TabsList className="inline-flex flex-nowrap gap-0.5 bg-panel border border-border p-1.5 rounded-xl min-w-max">
              {TABS.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value} className="text-xs px-3 py-1.5 whitespace-nowrap">
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
