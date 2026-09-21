import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { useTracking } from "./components/agri/useTracking";
import { MonitorView } from "./components/agri/MonitorView";
import { Sidebar } from "./components/agri/Sidebar";
import { Dashboard } from "./components/agri/Dashboard";
import { Report } from "./components/agri/Report";
import { ImageAnalysis } from "./components/agri/ImageAnalysis";
import { Chatbot } from "./components/agri/Chatbot";
import heroImg from "./assets/field-hero.jpg";
import { Leaf, FileText, Download, MapPin } from "lucide-react";

export default function App() {
  const state = useTracking();
  const [lang, setLang] = useState<'en' | 'ta'>('en');
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>({ lat: 13.0525, lng: 80.2115 });

  const handleFetchGps = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.warn('GPS permission denied')
      );
    }
  };

  return (
    <main className="min-h-screen text-slate-100 selection:bg-emerald-500 selection:text-black">
      
      {/* TOP HEADER & HERO BANNER (Matches Exact Lovable Source) */}
      <header className="relative overflow-hidden border-b border-border bg-[#06140b]">
        <img
          src={heroImg}
          alt="Crop field at dawn"
          width={1600}
          height={912}
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="relative mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs tracking-[0.35em] text-crop uppercase font-mono-tech font-bold">
                  VectraTrack ML v4.0
                </span>
              </div>
              <h1 className="text-3xl font-black sm:text-4xl tracking-tight text-white">
                Agriculture Monitoring
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground leading-relaxed">
                Dual-class crop and pest tracking with unique IDs, pest-only trajectories, density alerts and exportable field analytics.
              </p>
            </div>

            {/* Quick Action Pills */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLang(prev => prev === 'en' ? 'ta' : 'en')}
                className="px-3 py-1.5 text-xs font-mono-tech rounded-lg bg-panel border border-border text-emerald-400 hover:bg-emerald-950/60 transition"
              >
                {lang === 'en' ? '🇮🇳 தமிழ்' : '🇬🇧 English'}
              </button>
              
              <button
                type="button"
                onClick={handleFetchGps}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-tech rounded-lg bg-panel border border-border text-slate-300 hover:text-emerald-400 transition"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                {gpsLocation ? `${gpsLocation.lat.toFixed(2)}, ${gpsLocation.lng.toFixed(2)}` : 'GPS'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER WITH ALWAYS-VISIBLE SIDEBAR (lg:grid-cols-[1fr_280px]) */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Tabs defaultValue="live">
          <TabsList className="mb-6 flex-wrap bg-panel border border-border p-1.5 rounded-xl">
            <TabsTrigger value="live">🎥 Live Monitor</TabsTrigger>
            <TabsTrigger value="video">📹 Field Video</TabsTrigger>
            <TabsTrigger value="image">🖼️ Image Analysis</TabsTrigger>
            <TabsTrigger value="dashboard">📊 Dashboard</TabsTrigger>
            <TabsTrigger value="assistant">💬 FieldBot</TabsTrigger>
            <TabsTrigger value="report">📖 Report</TabsTrigger>
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
              <TabsContent value="dashboard">
                <Dashboard state={state} />
              </TabsContent>
              <TabsContent value="assistant">
                <Chatbot state={state} />
              </TabsContent>
              <TabsContent value="report">
                <Report state={state} />
              </TabsContent>
            </div>

            {/* SIDEBAR ALWAYS VISIBLE ON THE RIGHT AS IN LOVABLE SOURCE */}
            <Sidebar state={state} />
          </div>
        </Tabs>
      </div>

    </main>
  );
}
