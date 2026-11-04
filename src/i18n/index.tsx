// FILE: src/i18n/index.tsx
// Provider de idioma (D19): inglés por defecto, preferencia recordada en
// localStorage, sin rutas por idioma. El switcher «ENG / ESPA» vive en Header.
// Implementado con useSyncExternalStore: el servidor renderiza 'en' y el
// navegador adopta la preferencia guardada sin mismatch de hidratación.

'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { dictionaries, type Dict, type Lang } from './dictionaries';

const STORAGE_KEY = 'pl-language';

// ---- Mini-store sobre localStorage (sistema externo a React) ----

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Lang {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'es' ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

function getServerSnapshot(): Lang {
  return 'en';
}

// ---- Contexto ----

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  dict: Dict;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLang = useCallback((l: Lang) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* sin localStorage: solo cambia en esta vista */
    }
    listeners.forEach((notify) => notify());
  }, []);

  // Sincroniza el atributo lang del documento (sistema externo, no estado React)
  useEffect(() => {
    document.documentElement.lang = lang === 'es' ? 'es' : 'en';
  }, [lang]);

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, setLang, dict: dictionaries[lang] }),
    [lang, setLang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage debe usarse dentro de LanguageProvider');
  return ctx;
}
