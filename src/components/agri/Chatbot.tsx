import { useMemo, useRef, useState, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Send, Loader2, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TrackingState } from "./useTracking";

const SUGGESTIONS = [
  "Summarise this monitoring session",
  "Is my pest pressure dangerous right now?",
  "What should I do about the pest alerts?",
  "How do I read the invasion heatmap?",
];

export function Chatbot({ state }: { state: TrackingState }) {
  const contextRef = useRef("");
  contextRef.current = [
    `Frame: ${state.frame}`,
    `Live crops: ${state.counts.crops}, live pests: ${state.counts.pests}`,
    `Alert threshold: ${state.threshold} pests, alert active: ${state.counts.alert}`,
    `Peak pests this session: ${state.totals.maxPests}, alerts raised: ${state.totals.alerts}`,
    `Detection rows logged: ${state.rowsRef.current.length}`,
    `Recent events: ${state.logs.slice(0, 3).map((l) => l.message).join(" | ") || "none"}`,
  ].join("\n");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { messages, context: contextRef.current },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat({ transport });
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <div className="panel flex h-[540px] flex-col p-5">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Sprout className="text-crop h-5 w-5" />
        <div>
          <p className="font-display text-sm">FieldBot</p>
          <p className="text-xs text-muted-foreground">Agronomy assistant · sees your live session</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto py-4 text-sm">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-muted-foreground">
              Ask about pest pressure, crop counts, alerts or how to use the dashboard.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-crop hover:text-crop"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const text = m.parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { text: string }).text)
            .join("");
          if (!text) return null;
          return (
            <div key={m.id} className={cn(m.role === "user" && "flex justify-end")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap",
                  m.role === "user"
                    ? "rounded-2xl bg-primary px-4 py-2 text-primary-foreground"
                    : "text-foreground",
                )}
              >
                {text}
              </div>
            </div>
          );
        })}

        {busy && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
          </p>
        )}
        {error && <p className="text-alert text-xs">FieldBot is unavailable right now.</p>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-border pt-3"
      >
        <textarea
          value={input}
          rows={2}
          placeholder="Ask FieldBot about your field…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-crop"
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
