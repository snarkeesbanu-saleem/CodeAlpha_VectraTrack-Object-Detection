import { useState } from 'react';
import { Trash2, Plus, History, Leaf, AlertTriangle, TrendingDown, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useField, type Field } from '@/contexts/FieldContext';

export function ProfileView() {
  const { fields, activeField, setActiveField, addField, deleteField, sessions, clearHistory } = useField();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCrop, setNewCrop] = useState('');
  const [newLocation, setNewLocation] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    addField(newName.trim(), newCrop.trim() || 'General', newLocation.trim() || 'Unknown');
    setNewName(''); setNewCrop(''); setNewLocation('');
    setShowAddForm(false);
  };

  const fieldSessions = sessions.filter(s => s.fieldId === activeField?.id);
  const totalPests = fieldSessions.reduce((s, r) => s + r.pests, 0);
  const totalCrops = fieldSessions.reduce((s, r) => s + r.crops, 0);
  const avgHealth = fieldSessions.length
    ? Math.round(fieldSessions.reduce((s, r) => s + r.healthScore, 0) / fieldSessions.length)
    : 100;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="panel p-5 bg-slate-900/80 border border-slate-800">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Leaf className="h-5 w-5 text-emerald-400" />
          Farmer Profile & Detection History
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Local-only secure storage — your data never leaves your device.
        </p>
      </div>

      {/* FIELD MANAGEMENT */}
      <div className="panel p-5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">🌾 My Fields</h3>
          <Button
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Field
          </Button>
        </div>

        {/* ADD FIELD FORM */}
        {showAddForm && (
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-lg space-y-3">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">New Field Details</p>
            <input
              type="text"
              placeholder="Field Name (e.g. North Paddy Plot)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              placeholder="Primary Crop (e.g. Broccoli, Paddy, Tomato)"
              value={newCrop}
              onChange={e => setNewCrop(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              placeholder="Location (e.g. Coimbatore, TN)"
              value={newLocation}
              onChange={e => setNewLocation(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-emerald-500"
            />
            <div className="flex gap-2">
              <Button onClick={handleAdd} size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-xs">
                <Plus className="h-3 w-3 mr-1" /> Add Field
              </Button>
              <Button onClick={() => setShowAddForm(false)} size="sm" variant="outline" className="border-slate-700 text-xs">
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        )}

        {/* FIELD LIST */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {fields.map((f: Field) => (
            <div
              key={f.id}
              onClick={() => setActiveField(f)}
              className={`cursor-pointer p-3.5 rounded-xl border transition ${
                activeField?.id === f.id
                  ? 'border-emerald-500 bg-emerald-950/30'
                  : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-white">{f.name}</p>
                  <p className="text-xs text-emerald-400 mt-0.5">🌱 {f.cropType}</p>
                  <p className="text-xs text-slate-400">📍 {f.location}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Added {new Date(f.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {f.id !== 'default' && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteField(f.id); }}
                    className="text-slate-600 hover:text-red-400 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {activeField?.id === f.id && (
                <span className="mt-2 inline-block text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">
                  ✓ Active
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* FIELD STATS */}
      {activeField && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Sessions Logged', value: fieldSessions.length, color: 'text-white' },
            { label: 'Total Crops Detected', value: totalCrops, color: 'text-emerald-400' },
            { label: 'Total Pests Detected', value: totalPests, color: 'text-amber-400' },
            { label: 'Avg Field Health', value: `${avgHealth}%`, color: avgHealth >= 75 ? 'text-emerald-400' : avgHealth >= 45 ? 'text-amber-400' : 'text-red-400' },
          ].map(stat => (
            <div key={stat.label} className="panel p-4 bg-slate-900/60 border border-slate-800">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">{stat.label}</p>
              <p className={`text-2xl font-black mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* DETECTION HISTORY TIMELINE */}
      <div className="panel p-5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="h-4 w-4 text-emerald-400" />
            Detection Session History — {activeField?.name ?? 'All Fields'}
          </h3>
          {sessions.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={clearHistory}
              className="border-red-800 text-red-400 hover:bg-red-950 text-xs"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear History
            </Button>
          )}
        </div>

        {fieldSessions.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs italic">
            <Clock className="h-8 w-8 mx-auto mb-2 text-slate-700" />
            <p>No detection sessions recorded yet for this field.</p>
            <p className="mt-1">Run the Live Monitor or Image Analysis to start logging sessions.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {fieldSessions.slice(0, 50).map(s => (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-3 w-3 text-slate-500 shrink-0" />
                    <span className="text-slate-400 font-mono">
                      {new Date(s.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-emerald-400">🌱 {s.crops} Crops</span>
                    <span className="text-amber-400">🐛 {s.pests} Pests</span>
                    <span className="text-rose-400">🍂 {s.diseases} Diseases</span>
                    {s.gps && (
                      <span className="text-slate-400">📍 {s.gps.lat.toFixed(2)}, {s.gps.lng.toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-bold text-white">{s.severity}</span>
                  <span className="text-slate-400">Health: {s.healthScore}%</span>
                  {s.treatmentApplied && (
                    <span className="text-emerald-300 text-[10px]">✓ {s.treatmentApplied}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
