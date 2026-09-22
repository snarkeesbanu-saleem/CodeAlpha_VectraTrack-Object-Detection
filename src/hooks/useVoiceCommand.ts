import { useState, useCallback, useRef } from 'react';
import type { Lang } from '@/i18n/translations';

type VoiceCallback = (transcript: string, tab: string | null) => void;

const TAB_COMMANDS: { patterns: string[]; tab: string }[] = [
  {
    patterns: [
      'live monitor', 'camera', 'webcam', 'live feed', 'live',
      'நேரடி', 'கேமரா', 'நேரடி கண்காணிப்பு',
      'लाइव', 'कैमरा', 'मॉनिटर',
      'లైవ్', 'కెమెరా',
      'ಲೈವ್', 'ಕ್ಯಾಮೆರಾ',
    ],
    tab: 'live',
  },
  {
    patterns: [
      'field video', 'video',
      'வீடியோ', 'வயல் வீடியோ',
      'वीडियो',
      'వీడియో',
      'ವೀಡಿಯೊ',
    ],
    tab: 'video',
  },
  {
    patterns: [
      'image analysis', 'image', 'photo', 'scan photo', 'scan',
      'படம்', 'புகைப்படம்', 'ஸ்கேன்',
      'फोटो', 'छवि', 'स्कैन',
      'ఫోటో', 'స్కాన్',
      'ಫೋಟೋ', 'ಸ್ಕ್ಯಾನ್',
    ],
    tab: 'image',
  },
  {
    patterns: [
      'before after', 'comparison', 'compare',
      'ஒப்பீடு', 'முன் பின்',
      'तुलना', 'पहले बाद',
      'పోలిక',
      'ಹೋಲಿಕೆ',
    ],
    tab: 'compare',
  },
  {
    patterns: [
      'weather', 'forecast', 'rain', 'climate',
      'வானிலை', 'மழை',
      'मौसम', 'बारिश',
      'వాతావరణం',
      'ಹವಾಮಾನ',
    ],
    tab: 'weather',
  },
  {
    patterns: [
      'dashboard', 'analytics', 'charts', 'check my field',
      'டாஷ்போர்டு', 'என் வயல்', 'வயல் நிலவரம்',
      'डैशबोर्ड', 'खेत',
      'డాష్‌బోర్డ్',
      'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    ],
    tab: 'dashboard',
  },
  {
    patterns: [
      'fieldbot', 'assistant', 'chat', 'treatment advice', 'give treatment', 'bot', 'help',
      'உதவி', 'சிகிச்சை', 'மருந்து', 'சாட்',
      'सहायक', 'उपचार', 'दवा',
      'సహాయం', 'చికిత్స',
      'ಸಹಾಯ', 'ಚಿಕಿತ್ಸೆ',
    ],
    tab: 'assistant',
  },
  {
    patterns: [
      'profile', 'history', 'my profile', 'my fields',
      'சுயவிவரம்', 'வரலாறு', 'என் சுயவிவரம்',
      'प्रोफ़ाइल', 'इतिहास',
      'ప్రొఫైల్', 'చరిత్ర',
      'ಪ್ರೊಫೈಲ್', 'ಇತಿಹಾಸ',
    ],
    tab: 'profile',
  },
  {
    patterns: [
      'admin', 'administration',
      'நிர்வாகி',
      'व्यवस्थापक',
      'నిర్వాహకుడు',
      'ನಿರ್ವಾಹಕ',
    ],
    tab: 'admin',
  },
  {
    patterns: [
      'report', 'export', 'download',
      'அறிக்கை', 'பதிவிறக்கம்',
      'रिपोर्ट',
      'నివేదిక',
      'ವರದಿ',
    ],
    tab: 'report',
  },
];

const LANG_BCP47: Record<Lang, string> = {
  en: 'en-US',
  ta: 'ta-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  kn: 'kn-IN',
};

function detectTabFromTranscript(text: string): string | null {
  const lower = text.toLowerCase().trim();
  for (const cmd of TAB_COMMANDS) {
    for (const pattern of cmd.patterns) {
      if (lower.includes(pattern.toLowerCase())) {
        return cmd.tab;
      }
    }
  }
  return null;
}

export function useVoiceCommand(lang: Lang, onCommand: VoiceCallback) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice recognition is not supported in this browser. Please use Google Chrome.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = LANG_BCP47[lang] || 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const best = Array.from(event.results[0] || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((r: any) => r.transcript)
          .join(' ');
        setTranscript(best);
        const tab = detectTabFromTranscript(best);
        onCommand(best, tab);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          setError(`Voice: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => setIsListening(false);

      recognition.start();
    } catch (err) {
      setError('Unable to start microphone.');
      setIsListening(false);
    }
  }, [lang, onCommand]);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  return { isListening, transcript, error, toggle };
}
