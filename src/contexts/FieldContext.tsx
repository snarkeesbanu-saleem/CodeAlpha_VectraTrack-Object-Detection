import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { openDB, type IDBPDatabase } from 'idb';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface Field {
  id: string;
  name: string;
  cropType: string;
  location: string;
  createdAt: string;
}

export interface DetectionSession {
  id: string;
  fieldId: string;
  timestamp: string;
  crops: number;
  pests: number;
  diseases: number;
  severity: string;
  yieldRisk: string;
  healthScore: number;
  treatmentApplied: string;
  gps: { lat: number; lng: number } | null;
}

interface FieldContextValue {
  fields: Field[];
  activeField: Field | null;
  setActiveField: (f: Field) => void;
  addField: (name: string, cropType: string, location: string) => void;
  deleteField: (id: string) => void;
  sessions: DetectionSession[];
  logSession: (s: Omit<DetectionSession, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
}

// ── IndexedDB setup ────────────────────────────────────────────────────────────
const DB_NAME = 'vectratrack-db';
const DB_VERSION = 1;

async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('fields')) {
        const fs = db.createObjectStore('fields', { keyPath: 'id' });
        fs.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('sessions')) {
        const ss = db.createObjectStore('sessions', { keyPath: 'id' });
        ss.createIndex('fieldId', 'fieldId');
        ss.createIndex('timestamp', 'timestamp');
      }
    },
  });
}

// ── Context ────────────────────────────────────────────────────────────────────
const FieldContext = createContext<FieldContextValue>({
  fields: [],
  activeField: null,
  setActiveField: () => {},
  addField: () => {},
  deleteField: () => {},
  sessions: [],
  logSession: () => {},
  clearHistory: () => {},
});

export function FieldProvider({ children }: { children: ReactNode }) {
  const [fields, setFields] = useState<Field[]>([]);
  const [activeField, setActiveField] = useState<Field | null>(null);
  const [sessions, setSessions] = useState<DetectionSession[]>([]);

  // Load from IndexedDB on mount
  useEffect(() => {
    (async () => {
      const db = await getDb();
      const f = await db.getAll('fields') as Field[];
      const s = await db.getAll('sessions') as DetectionSession[];
      if (f.length === 0) {
        // seed a default field
        const defaultField: Field = {
          id: 'default',
          name: 'Main Farm Field',
          cropType: 'Broccoli / Paddy',
          location: 'Chennai, TN',
          createdAt: new Date().toISOString(),
        };
        await db.put('fields', defaultField);
        setFields([defaultField]);
        setActiveField(defaultField);
      } else {
        setFields(f);
        setActiveField(f[0]!);
      }
      setSessions(s.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    })();
  }, []);

  const addField = useCallback(async (name: string, cropType: string, location: string) => {
    const db = await getDb();
    const newField: Field = {
      id: `field-${Date.now()}`,
      name,
      cropType,
      location,
      createdAt: new Date().toISOString(),
    };
    await db.put('fields', newField);
    setFields(prev => [...prev, newField]);
    setActiveField(newField);
  }, []);

  const deleteField = useCallback(async (id: string) => {
    if (id === 'default') return; // protect default
    const db = await getDb();
    await db.delete('fields', id);
    setFields(prev => {
      const next = prev.filter(f => f.id !== id);
      setActiveField(next[0] ?? null);
      return next;
    });
  }, []);

  const logSession = useCallback(async (s: Omit<DetectionSession, 'id' | 'timestamp'>) => {
    const db = await getDb();
    const session: DetectionSession = {
      ...s,
      id: `session-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    await db.put('sessions', session);
    setSessions(prev => [session, ...prev].slice(0, 500)); // keep last 500
  }, []);

  const clearHistory = useCallback(async () => {
    const db = await getDb();
    await db.clear('sessions');
    setSessions([]);
  }, []);

  return (
    <FieldContext.Provider value={{ fields, activeField, setActiveField, addField, deleteField, sessions, logSession, clearHistory }}>
      {children}
    </FieldContext.Provider>
  );
}

export function useField() {
  return useContext(FieldContext);
}
