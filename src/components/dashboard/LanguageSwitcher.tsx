// FILE: src/components/dashboard/LanguageSwitcher.tsx
// Switcher bilingüe «ENG / ESPA» (D19). La preferencia queda recordada en el
// navegador (localStorage, ver src/i18n/index.tsx).

'use client';

import { useLanguage } from '@/i18n';

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  return (
    <div
      role="group"
      aria-label="Language / Idioma"
      className="inline-flex items-center rounded-full border border-[var(--pl-border)] bg-[var(--pl-surface)] p-0.5"
    >
      {(['en', 'es'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide transition-colors min-h-[28px] ${
            lang === l
              ? 'bg-[var(--pl-accent)] text-white'
              : 'text-[var(--pl-text-secondary)] hover:text-[var(--pl-text-primary)]'
          }`}
        >
          {l === 'en' ? 'ENG' : 'ESPA'}
        </button>
      ))}
    </div>
  );
}
