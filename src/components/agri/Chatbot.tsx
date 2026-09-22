import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sprout, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TrackingState } from "./useTracking";
import { calculateSeverity, calculateYieldRisk, getRemediesForDetections } from "@/agriMapper";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "Summarise live monitoring session",
  "Is my pest pressure dangerous right now?",
  "What treatment should I apply for pests?",
  "பூச்சி தாக்குதலுக்கு என்ன மருந்து தெளிக்க வேண்டும்?",
];

export function Chatbot({ state }: { state: TrackingState }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "🌾 Hello! I am FieldBot, your AI Agronomist. I have access to your live crop & pest telemetry. How can I assist your field operations today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const generateResponse = (prompt: string): string => {
    const p = prompt.toLowerCase();
    const crops = state.counts.crops;
    const pests = state.counts.pests;
    const alert = state.counts.alert;
    const severity = calculateSeverity(pests, 1, crops);
    const yieldRisk = calculateYieldRisk(pests, 1, crops);
    const remedies = getRemediesForDetections(
      state.visibleTracks.map((t) => ({ cocoClass: t.cocoClass, category: t.category }))
    );

    if (p.includes("தமிழ்") || p.includes("மருந்து") || p.includes("பூச்சி")) {
      return `🌾 **வயல் அறிக்கை (Field Summary)**:\n` +
        `• பயிர்கள் எண்ணிக்கை: ${crops} | பூச்சிகள்: ${pests}\n` +
        `• பாதிப்பு நிலை: ${severity.badge}\n` +
        `• மகசூல் இழப்பு அபாயம்: ${yieldRisk.riskCategory}\n\n` +
        `💊 **பரிந்துரைக்கப்படும் நடவடிக்கை**:\n` +
        `${remedies[0]?.remedyTa || "வேப்பெண்ணெய் (2%) + சோப்பு நீர் கரைசலை தெளிக்கவும்."}\n` +
        `அளவு: ${remedies[0]?.dosage || "15 ml per litre"}`;
    }

    if (p.includes("dangerous") || p.includes("pressure") || p.includes("alert")) {
      return `⚠️ **Pest Pressure Assessment**:\n` +
        `• Outbreak Status: **${severity.badge}** (${pests} live pests detected)\n` +
        `• Pest Density: ${severity.pestDensity} pests per crop unit\n` +
        `• Threshold Alert: ${alert ? "🚨 ALERT ACTIVE — Threshold Exceeded!" : "🟢 Normal Operational Range"}\n\n` +
        `**Recommendation**: ${remedies[0]?.remedyEn}`;
    }

    if (p.includes("treatment") || p.includes("remedy") || p.includes("apply") || p.includes("pesticide")) {
      return `💊 **AI Agronomic Treatment Plan**:\n` +
        `1. Target: ${remedies[0]?.target || "Pests & Leaf Spot"}\n` +
        `2. Protocol Type: ${remedies[0]?.type || "Organic"}\n` +
        `3. English: ${remedies[0]?.remedyEn}\n` +
        `4. தமிழ்: ${remedies[0]?.remedyTa}\n` +
        `5. Recommended Dosage: ${remedies[0]?.dosage}`;
    }

    return `📊 **Live Telemetry Summary**:\n` +
      `• Frame Count: #${state.frame}\n` +
      `• Active Crops: ${crops} | Active Pests: ${pests}\n` +
      `• Outbreak Severity: ${severity.badge}\n` +
      `• Yield Loss Estimate: ${yieldRisk.riskCategory} (${yieldRisk.riskScore}%)\n` +
      `• Action: ${remedies[0]?.remedyEn}`;
  };

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);

    setTimeout(() => {
      const replyText = generateResponse(text);
      const botMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", text: replyText };
      setMessages((prev) => [...prev, botMsg]);
      setBusy(false);
    }, 450);
  };

  return (
    <div className="panel flex h-[580px] flex-col p-5 bg-slate-900/90 border border-slate-800 rounded-xl">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <Sprout className="text-emerald-400 h-5 w-5" />
        <div>
          <p className="font-bold text-sm text-white flex items-center gap-2">
            FieldBot AI Agronomist <span className="px-2 py-0.5 text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">v4.5 Smart AI</span>
          </p>
          <p className="text-xs text-slate-400">Context-aware · Tamil 🇮🇳 & English 🇬🇧 agronomy expert</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto py-4 text-xs font-sans">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && (
              <div className="h-7 w-7 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 shrink-0">
                <Bot className="h-4 w-4" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-xl p-3.5 leading-relaxed shadow",
                m.role === "user"
                  ? "bg-emerald-600 text-white rounded-br-none"
                  : "bg-slate-950 border border-slate-800 text-slate-100 rounded-bl-none font-mono"
              )}
            >
              {m.text}
            </div>
          </div>
        ))}

        {busy && (
          <p className="flex items-center gap-2 text-slate-400 text-xs italic">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" /> Analyzing live field metrics…
          </p>
        )}
        <div ref={endRef} />
      </div>

      {/* SUGGESTION PILLS */}
      <div className="py-2 flex flex-wrap gap-1.5 border-t border-slate-800/80">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => send(s)}
            className="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-emerald-500 hover:text-emerald-400"
          >
            {s}
          </button>
        ))}
      </div>

      {/* INPUT FORM */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 pt-2 border-t border-slate-800"
      >
        <textarea
          value={input}
          rows={2}
          placeholder="Ask FieldBot about pests, diseases, treatments, or தமிழ் பரிந்துரைகள்..."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} className="bg-emerald-600 hover:bg-emerald-500">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
