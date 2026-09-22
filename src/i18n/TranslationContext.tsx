import { createContext, useContext, useState, type ReactNode } from 'react';
import { translations, type Lang } from './translations';

interface TranslationContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof translations['en']) => string;
}

const TranslationContext = createContext<TranslationContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
});

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');
  const t = (key: keyof typeof translations['en']): string =>
    translations[lang][key] ?? translations['en'][key] ?? key;
  return (
    <TranslationContext.Provider value={{ lang, setLang, t }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  return useContext(TranslationContext);
}
