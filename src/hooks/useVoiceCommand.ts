import { useState, useCallback, useRef } from 'react';

type VoiceCallback = (transcript: string, tab: string | null) => void;

const TAB_COMMANDS: { patterns: string[]; tab: string; tamilPatterns?: string[] }[] = [
  { patterns: ['live monitor', 'camera', 'webcam', 'live feed'], tab: 'live', tamilPatterns: ['நேரடி', 'கேமரா'] },
  { patterns: ['field video', 'video'], tab: 'video', tamilPatterns: ['வீடியோ'] },
  { patterns: ['image analysis', 'image', 'photo', 'scan photo'], tab: 'image', tamilPatterns: ['படம்', 'புகைப்படம்'] },
  { patterns: ['before after', 'comparison', 'compare'], tab: 'compare', tamilPatterns: ['ஒப்பீடு', 'முன் பின்'] },
  { patterns: ['dashboard', 'analytics', 'charts'], tab: 'dashboard', tamilPatterns: ['டாஷ்போர்டு'] },
  { patterns: ['fieldbot', 'assistant', 'chat', 'treatment advice', 'give treatment'], tab: 'assistant', tamilPatterns: ['உதவி', 'சிகிச்சை'] },
  { patterns: ['report', 'export', 'download'], tab: 'report', tamilPatterns: ['அறிக்கை'] },
  { patterns: ['profile', 'history', 'my profile'], tab: 'profile', tamilPatterns: ['சுயவிவரம்', 'வரலாறு'] },
  { patterns: ['weather', 'forecast', 'rain', 'climate'], tab: 'weather', tamilPatterns: ['வானிலை'] },
  { patterns: ['admin', 'administration'], tab: 'admin', tamilPatterns: ['நிர்வாகி'] },
  { patterns: ['check my field', 'என் வயல்', 'வயல் நிலவரம்'], tab: 'dashboard' },
];

function detectTabFromTranscript(text: string): string | null {
  const lower = text.toLowerCase();
  for (const cmd of TAB_COMMANDS) {
    const allPatterns = [...cmd.patterns, ...(cmd.tamilPatterns ?? [])];
    if (allPatterns.some(p => lower.includes(p.toLowerCase()))) {
      return cmd.tab;
    }
  }
  return null;
}

export function useVoiceCommand(onCommand: VoiceCallback) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice recognition not supported in this browser. Use Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ta-IN'; // Tamil + English fallback
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const best = Array.from(event.results[0] ?? [])
        .map(r => r.transcript)
        .join(' ');
      setTranscript(best);
      const tab = detectTabFromTranscript(best);
      onCommand(best, tab);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setError(`Voice error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  }, [onCommand]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  return { isListening, transcript, error, toggle };
}
