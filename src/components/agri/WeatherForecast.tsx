import { useState, useEffect } from 'react';
import { Cloud, Droplets, Wind, Thermometer, RefreshCw, AlertTriangle, MapPin } from 'lucide-react';
import { fetchWeatherForecast, getMockForecast, type DailyForecast } from '@/services/weatherForecast';
import { Button } from '@/components/ui/button';

interface Props {
  gps: { lat: number; lng: number } | null;
}

export function WeatherForecast({ gps }: Props) {
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!gps) throw new Error('No GPS');
      const data = await fetchWeatherForecast(gps.lat, gps.lng);
      setForecast(data);
      setUsingMock(false);
    } catch {
      setForecast(getMockForecast());
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [gps?.lat, gps?.lng]);

  const highRiskDays = forecast.filter(d => d.pestRisk === 'High' || d.pestRisk === 'Critical');

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="panel p-5 bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cloud className="h-5 w-5 text-sky-400" />
            7-Day Weather-Based Pest Risk Forecast
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {usingMock
              ? '⚠️ Demo data — using sample Chennai forecast (grant GPS for real data)'
              : `📍 Live data for ${gps?.lat.toFixed(3)}, ${gps?.lng.toFixed(3)}`}
          </p>
        </div>
        <Button onClick={load} disabled={loading} variant="outline" className="border-slate-700 text-slate-200">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* HIGH RISK ALERT */}
      {highRiskDays.length > 0 && (
        <div className="panel p-4 bg-red-950/30 border border-red-800/50 rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-300">🚨 Outbreak Risk Alert</p>
            <p className="text-xs text-slate-300 mt-1">
              High or Critical pest risk forecast on:{' '}
              <span className="text-red-300 font-semibold">
                {highRiskDays.map(d => d.dayLabel).join(', ')}
              </span>.
              Prepare preventative treatment now — spray neem oil or copper fungicide 48 hours before rainfall.
            </p>
          </div>
        </div>
      )}

      {/* 7-DAY FORECAST CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {loading
          ? Array(7).fill(null).map((_, i) => (
              <div key={i} className="panel p-4 bg-slate-900/60 border border-slate-800 animate-pulse h-48 rounded-xl" />
            ))
          : forecast.map((day) => (
              <div
                key={day.dayLabel}
                className="panel p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col gap-1.5 transition hover:border-sky-700/50"
              >
                <p className="text-xs font-bold text-white">{day.dayLabel}</p>

                {/* Temperature */}
                <div className="flex items-center gap-1 text-xs text-slate-300">
                  <Thermometer className="h-3 w-3 text-orange-400" />
                  <span>{day.tempMax}° / {day.tempMin}°C</span>
                </div>

                {/* Humidity */}
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Droplets className="h-3 w-3 text-sky-400" />
                  <span>{day.humidity}% RH</span>
                </div>

                {/* Rainfall */}
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Cloud className="h-3 w-3 text-slate-500" />
                  <span>{day.rainfall}mm rain</span>
                </div>

                {/* Wind */}
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Wind className="h-3 w-3 text-slate-500" />
                  <span>{day.windSpeed} km/h</span>
                </div>

                {/* Pest Risk Badge */}
                <div className="mt-auto pt-2 space-y-1">
                  <span
                    className="block w-full rounded-md px-2 py-1 text-center text-[11px] font-bold shadow"
                    style={{ backgroundColor: day.riskBg, color: day.riskColor, border: `1px solid ${day.riskColor}40` }}
                  >
                    🐛 {day.pestRisk}
                  </span>
                  <span
                    className="block w-full rounded-md px-2 py-1 text-center text-[10px] font-semibold"
                    style={{ backgroundColor: '#1e293b', color: day.diseaseRisk === 'High' ? '#f43f5e' : day.diseaseRisk === 'Moderate' ? '#d97706' : '#16a34a' }}
                  >
                    🍂 Disease: {day.diseaseRisk}
                  </span>
                </div>
              </div>
            ))}
      </div>

      {/* RISK REASONS TABLE */}
      {!loading && (
        <div className="panel p-5 bg-slate-900/80 border border-slate-800 rounded-xl">
          <h3 className="text-sm font-bold text-white mb-3">📋 Pest Risk Analysis — Day-by-Day Reasoning</h3>
          <div className="space-y-2">
            {forecast.map((day) => (
              <div key={day.dayLabel} className="flex flex-wrap items-start gap-3 text-xs p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="font-bold text-white w-16 shrink-0">{day.dayLabel}</span>
                <span className="px-2 py-0.5 rounded font-bold text-xs" style={{ backgroundColor: day.riskBg, color: day.riskColor }}>
                  {day.pestRisk}
                </span>
                <span className="text-slate-300 flex-1">{day.riskReasons.join(' · ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PREVENTATIVE SCHEDULE */}
      <div className="panel p-5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-emerald-400" />
          AI Preventative Treatment Schedule (Based on Forecast)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-950/60 rounded border border-slate-800">
            <p className="font-bold text-emerald-400 mb-1">Before Rainfall Days</p>
            <p className="text-slate-300">Spray Copper Oxychloride 2.5g/L as preventative fungicide 48hrs before expected rain.</p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded border border-slate-800">
            <p className="font-bold text-amber-400 mb-1">High Humidity Days</p>
            <p className="text-slate-300">Apply Neem Oil 2% spray early morning. Install yellow sticky traps in the field.</p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded border border-slate-800">
            <p className="font-bold text-sky-400 mb-1">Low-Risk Days</p>
            <p className="text-slate-300">Use for field scouting and monitoring. No intervention needed unless detection changes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
