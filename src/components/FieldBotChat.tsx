import React, { useState } from 'react';
import { Bot, Send, Sparkles, User } from 'lucide-react';

interface FieldBotChatProps {
  cropCount: number;
  pestCount: number;
  healthScore: number;
}

interface Message {
  sender: 'bot' | 'user';
  text: string;
}

export default function FieldBotChat({ cropCount, pestCount, healthScore }: FieldBotChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: `Hello! I am FieldBot, your AI Agricultural Protection Specialist. Currently observing ${cropCount} crops and ${pestCount} pests in your field layout. How can I assist you with pest management today?`
    }
  ]);
  const [input, setInput] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input;
    const newMessages: Message[] = [...messages, { sender: 'user', text: userText }];
    setMessages(newMessages);
    setInput('');

    // Generate response based on user question & current field stats
    setTimeout(() => {
      let botResponse = '';
      const query = userText.toLowerCase();

      if (query.includes('pest') || query.includes('insect') || query.includes('mouse') || query.includes('bird')) {
        botResponse = pestCount > 0
          ? `Detected ${pestCount} pests in field. Recommend applying Neem Oil (2% concentration) or installing yellow sticky traps around high density zones.`
          : `Zero pests currently detected! Maintain routine field inspection every 4 hours.`;
      } else if (query.includes('health') || query.includes('score') || query.includes('condition')) {
        botResponse = `Field Health Score is ${healthScore}%. ${healthScore >= 75 ? 'Field condition is optimal.' : 'Targeted intervention recommended.'}`;
      } else if (query.includes('pesticide') || query.includes('spray') || query.includes('treatment')) {
        botResponse = `For organic crop protection: 1. Neem Seed Kernel Extract (5%) 2. Pyrethrin aerosol spray for emergency pest spikes 3. Introduce natural ladybug predators.`;
      } else if (query.includes('crop') || query.includes('broccoli') || query.includes('carrot') || query.includes('apple')) {
        botResponse = `Currently tracking ${cropCount} active crop targets. Ensure soil moisture remains between 60-70% for healthy growth.`;
      } else {
        botResponse = `FieldBot Analysis: Field has ${cropCount} crops, ${pestCount} pests, and a health score of ${healthScore}%. Always isolate infected crop zones early to prevent crop loss.`;
      }

      setMessages(prev => [...prev, { sender: 'bot', text: botResponse }]);
    }, 600);
  };

  return (
    <div className="agri-card p-6 space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-emerald-900/40">
        <Bot className="w-8 h-8 text-emerald-400 pulse-green" />
        <div>
          <h3 className="text-base font-bold text-white">FieldBot — Interactive AI Agronomist</h3>
          <p className="text-xs text-slate-400">Ask field safety, pesticide application, or pest prevention questions.</p>
        </div>
      </div>

      {/* Messages Container */}
      <div className="bg-[#050c07] rounded-xl p-4 border border-emerald-900/40 h-80 overflow-y-auto space-y-3 font-mono-tech text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.sender === 'bot' && (
              <div className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                🤖
              </div>
            )}
            <div
              className={`max-w-md p-3 rounded-xl leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-emerald-600 text-slate-950 font-semibold'
                  : 'bg-[#0b1a11] text-slate-200 border border-emerald-800/40'
              }`}
            >
              {m.text}
            </div>
            {m.sender === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold shrink-0">
                👤
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Chat Input Form */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask FieldBot e.g. 'What pesticide to apply?' or 'How is field health?'..."
          className="flex-1 bg-[#09170e] border border-emerald-900/60 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono-tech"
        />
        <button
          type="submit"
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.4)] transition flex items-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
          Send
        </button>
      </form>
    </div>
  );
}
