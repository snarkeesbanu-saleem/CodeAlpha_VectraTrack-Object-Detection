import React, { useState, useCallback, useRef } from 'react';
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
import { MapPin, Mic, MicOff, ChevronDown, Plus } from "lucide-react";

export default function App() {
  const state = useTracking();
  const { lang, setLang, t } = useTranslation();
  const { fields, activeField, setActiveField, addField } = useField();
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>({ lat: 13.0525, lng: 80.2115 });
  const [activeTab, setActiveTab] = useState('live');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showFieldMenu, setShowFieldMenu] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState('');

  const handleFetchGps = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.warn('GPS permission denied')
      );
    }
  };

  const onVoiceCommand = useCallback((transcript: string, tab: string | null) => {
    setVoiceFeedback(`"${transcript}"`);
    if (tab) setActiveTab(tab);
    setTimeout(() => setVoiceFeedback(''), 3500);
  }, []);

  const { isListening, error: voiceError, toggle: toggleVoice } = useVoiceCommand(onVoiceCommand);

  const TABS = [
    { value: 'live', label: t('liveMonitor') },
    { value: 'video', label: t('fieldVideo') },
    { value: 'image', label: t('imageAnalysis') },
    { value: 'compare', label: t('beforeAfter') },
    { value: 'weather', label: t('weather') },
    { value: 'dashboard', label: t('dashboard') },
    { value: 'assistant', label: t('fieldbot') },
    { value: 'profile', label: t('profile') },
    { value: 'admin', label: t('admin') },
    { value: 'report', label: t('report') },
  ];

  return (
    <main className="min-h-screen text-slate-100 selection:bg-emerald-500 selection:text-black bg-[#09140c]">

      {/* TOP HEADER & HERO BANNER */}
      <header className="relative overflow-hidden border-b border-border bg-[#06140b]">
        <img
          src={heroImg}
          alt="Crop field at dawn"
          width={1600}
          height={912}
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs tracking-[0.35em] text-emerald-400 uppercase font-mono font-bold">
                  VectraTrack ML v5.0 AI Precision
                </span>
                <span className="px-2 py-0.5 text-[10px] bg-emerald-900/60 text-emerald-400 border border-emerald-800/60 rounded font-bold">PWA</span>
              </div>
              <h1 className="text-2xl font-black sm:text-3xl tracking-tight text-white">
                {t('appTitle')}
              </h1>
              <p className="mt-1.5 max-w-2xl text-xs text-muted-foreground leading-relaxed">
                {t('appSubtitle')}
              </p>
            </div>

            {/* ACTION PILLS ROW */}
            <div className="flex flex-wrap items-center gap-2">

              {/* ACTIVE FIELD SELECTOR */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowFieldMenu(v => !v); setShowLangMenu(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 hover:text-white transition"
                >
                  🌾 {activeField?.name ?? 'Select Field'}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showFieldMenu && (
                  <div className="absolute right-0 top-9 z-50 w-52 rounded-xl border border-slate-800 bg-slate-950 shadow-xl py-1">
                    {fields.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => { setActiveField(f); setShowFieldMenu(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-900 transition ${activeField?.id === f.id ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}
                      >
                        {activeField?.id === f.id ? '✓ ' : ''}{f.name}
                      </button>
                    ))}
                    <div className="border-t border-slate-800 mt-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const name = prompt('Enter new field name:');
                          if (name) { addField(name, 'Mixed', 'Unknown'); setShowFieldMenu(false); }
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-emerald-400 hover:bg-slate-900 transition flex items-center gap-1.5"
                      >
                        <Plus className="h-3 w-3" /> {t('addField')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* LANGUAGE SELECTOR */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowLangMenu(v => !v); setShowFieldMenu(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-panel border border-border text-emerald-400 hover:bg-emerald-950/60 transition"
                >
                  {LANG_META[lang].flag} {LANG_META[lang].label}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showLangMenu && (
                  <div className="absolute right-0 top-9 z-50 w-40 rounded-xl border border-slate-800 bg-slate-950 shadow-xl py-1">
                    {(Object.keys(LANG_META) as Lang[]).map(l => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => { setLang(l); setShowLangMenu(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-900 transition ${lang === l ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}
                      >
                        {LANG_META[l].flag} {LANG_META[l].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* GPS */}
              <button
                type="button"
                onClick={handleFetchGps}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-panel border border-border text-slate-300 hover:text-emerald-400 transition"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                {gpsLocation ? `${gpsLocation.lat.toFixed(2)}, ${gpsLocation.lng.toFixed(2)}` : 'GPS'}
              </button>

              {/* VOICE COMMAND */}
              <button
                type="button"
                onClick={toggleVoice}
                title={voiceError ?? (isListening ? 'Listening — speak now' : 'Voice Commands (Tamil + English)')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition ${
                  isListening
                    ? 'bg-red-900/60 border-red-700 text-red-300 animate-pulse'
                    : voiceError
                    ? 'bg-slate-900 border-slate-700 text-slate-500'
                    : 'bg-panel border-border text-slate-300 hover:text-emerald-400'
                }`}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                {isListening ? 'Listening…' : '🎙️'}
              </button>
            </div>
          </div>

          {/* VOICE FEEDBACK TOAST */}
          {(voiceFeedback || isListening) && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/40 text-xs text-emerald-300">
              <Mic className="h-3.5 w-3.5 animate-pulse" />
              {isListening ? `${t('voiceReady')}` : voiceFeedback}
            </div>
          )}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap bg-panel border border-border p-1.5 rounded-xl gap-0.5">
            {TABS.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs px-2.5 py-1.5">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

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

            {/* ALWAYS-VISIBLE RIGHT SIDEBAR */}
            <Sidebar state={state} />
          </div>
        </Tabs>
      </div>

    </main>
  );
}
