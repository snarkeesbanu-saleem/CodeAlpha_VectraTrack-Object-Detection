import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Layers, Activity, TrendingDown, Award, Globe2 } from 'lucide-react';
import { useField } from '@/contexts/FieldContext';

const tooltipStyle = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  fontFamily: 'monospace',
  fontSize: 11,
} as const;

export function AdminView() {
  const { fields, sessions } = useField();

  // Aggregate stats across all fields
  const totalSessions = sessions.length;
  const totalCrops = sessions.reduce((s, r) => s + r.crops, 0);
  const totalPests = sessions.reduce((s, r) => s + r.pests, 0);
  const totalDiseases = sessions.reduce((s, r) => s + r.diseases, 0);
  const avgHealth = sessions.length
    ? Math.round(sessions.reduce((s, r) => s + r.healthScore, 0) / sessions.length)
    : 100;
  const alertSessions = sessions.filter(s =>
    s.severity === '🟠 High Severity' || s.severity === '🔴 Critical Outbreak'
  ).length;

  // Impact analytics: before vs after proxy using first half vs second half of sessions
  const half = Math.floor(sessions.length / 2);
  const firstHalf = sessions.slice(half);   // older
  const secondHalf = sessions.slice(0, half); // newer
  const avgPestsBefore = firstHalf.length ? Math.round(firstHalf.reduce((s, r) => s + r.pests, 0) / firstHalf.length) : 0;
  const avgPestsAfter = secondHalf.length ? Math.round(secondHalf.reduce((s, r) => s + r.pests, 0) / secondHalf.length) : 0;
  const pestReductionPct = avgPestsBefore > 0
    ? Math.max(0, Math.round(((avgPestsBefore - avgPestsAfter) / avgPestsBefore) * 100))
    : 0;

  // Per-field breakdown
  const fieldBreakdown = fields.map(f => {
    const fSessions = sessions.filter(s => s.fieldId === f.id);
    return {
      name: f.name.length > 14 ? f.name.slice(0, 12) + '…' : f.name,
      sessions: fSessions.length,
      pests: fSessions.reduce((s, r) => s + r.pests, 0),
      crops: fSessions.reduce((s, r) => s + r.crops, 0),
    };
  });

  // Severity distribution
  const severityDist = [
    { name: 'Low', count: sessions.filter(s => s.severity.includes('Low')).length, color: '#16a34a' },
    { name: 'Medium', count: sessions.filter(s => s.severity.includes('Medium')).length, color: '#d97706' },
    { name: 'High', count: sessions.filter(s => s.severity.includes('High')).length, color: '#ea580c' },
    { name: 'Critical', count: sessions.filter(s => s.severity.includes('Critical')).length, color: '#dc2626' },
  ];

  // Health trend from sessions (last 20)
  const healthTrend = sessions.slice(0, 20).reverse().map((s, i) => ({
    session: `S${i + 1}`,
    health: s.healthScore,
    pests: s.pests,
  }));

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="panel p-5 bg-slate-900/80 border border-slate-800">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-emerald-400" />
          Admin Overview — Multi-Farm Monitoring Dashboard
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Aggregated analytics across all {fields.length} registered field{fields.length !== 1 ? 's' : ''}.
        </p>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { icon: Layers, label: 'Total Fields', value: fields.length, color: 'text-emerald-400' },
          { icon: Activity, label: 'Total Sessions', value: totalSessions, color: 'text-white' },
          { icon: Users, label: 'Crops Detected', value: totalCrops, color: 'text-emerald-400' },
          { icon: TrendingDown, label: 'Pests Detected', value: totalPests, color: 'text-amber-400' },
          { icon: Award, label: 'Avg Field Health', value: `${avgHealth}%`, color: avgHealth >= 75 ? 'text-emerald-400' : 'text-amber-400' },
          { icon: Activity, label: 'Alert Sessions', value: alertSessions, color: 'text-red-400' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="panel p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={`h-3.5 w-3.5 ${color}`} />
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{label}</p>
            </div>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* IMPACT ANALYTICS */}
      <div className="panel p-5 bg-emerald-950/20 border border-emerald-800/40 rounded-xl">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Award className="h-4 w-4 text-emerald-400" />
          🎯 Impact Analytics — System Performance vs Baseline
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800 text-center">
            <p className="text-[11px] text-slate-400 uppercase tracking-wider">Pest Reduction</p>
            <p className="text-3xl font-black text-emerald-400 mt-1">-{pestReductionPct}%</p>
            <p className="text-[10px] text-slate-400 mt-1">Early vs recent sessions</p>
          </div>
          <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800 text-center">
            <p className="text-[11px] text-slate-400 uppercase tracking-wider">Avg Health Gain</p>
            <p className="text-3xl font-black text-emerald-400 mt-1">+{Math.max(0, avgHealth - 65)}%</p>
            <p className="text-[10px] text-slate-400 mt-1">vs 65% baseline</p>
          </div>
          <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800 text-center">
            <p className="text-[11px] text-slate-400 uppercase tracking-wider">Diseases Found</p>
            <p className="text-3xl font-black text-rose-400 mt-1">{totalDiseases}</p>
            <p className="text-[10px] text-slate-400 mt-1">Leaf blight / spot / rust</p>
          </div>
          <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800 text-center">
            <p className="text-[11px] text-slate-400 uppercase tracking-wider">Outbreak Alerts</p>
            <p className="text-3xl font-black text-amber-400 mt-1">{alertSessions}</p>
            <p className="text-[10px] text-slate-400 mt-1">High + Critical sessions</p>
          </div>
        </div>
      </div>

      {/* CHARTS GRID */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Field-by-field pest breakdown */}
        <div className="panel p-5 bg-slate-900/80 border border-slate-800 rounded-xl">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
            Pest Detection by Field
          </h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fieldBreakdown} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={10} />
                <YAxis type="category" dataKey="name" width={90} stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#1e293b' }} />
                <Bar dataKey="crops" name="Crops" fill="#22c55e" radius={[0, 3, 3, 0]} />
                <Bar dataKey="pests" name="Pests" fill="#f59e0b" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Health trend */}
        <div className="panel p-5 bg-slate-900/80 border border-slate-800 rounded-xl">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
            Field Health Score Trend
          </h3>
          <div className="h-52">
            {healthTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={healthTrend}>
                  <CartesianGrid stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="session" stroke="#64748b" fontSize={10} />
                  <YAxis domain={[0, 100]} stroke="#64748b" fontSize={10} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="health" name="Health %" stroke="#22c55e" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="pests" name="Pests" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-500 italic">
                Log some detection sessions to see health trend here.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SEVERITY DISTRIBUTION */}
      <div className="panel p-5 bg-slate-900/80 border border-slate-800 rounded-xl">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
          Outbreak Severity Distribution
        </h3>
        <div className="flex gap-4">
          {severityDist.map(s => (
            <div key={s.name} className="flex-1 text-center">
              <div
                className="h-2 rounded-full mb-2"
                style={{ backgroundColor: s.color, width: `${Math.min(100, (s.count / (totalSessions || 1)) * 100)}%`, minWidth: '8px' }}
              />
              <p className="text-xs font-bold" style={{ color: s.color }}>{s.name}</p>
              <p className="text-lg font-black text-white">{s.count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
