// FILE: src/components/terminal/ParseLog.tsx
// Log de sesión estilo terminal: líneas monoespaciadas con nivel por color de
// la paleta (D18). Solo crece; el autor puede leer todo el proceso.

'use client';

import { useEffect, useRef } from 'react';
import { useLanguage } from '@/i18n';
import { LOG_KIND_CLASS, type LogLine } from './types';

export function ParseLog({ lines }: { lines: LogLine[] }) {
  const { dict } = useLanguage();
  const t = dict.terminal;
  const boxRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al final, como una consola real
  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [lines.length]);

  return (
    <section
      aria-label={t.logTitle}
      className="overflow-hidden rounded-lg border border-[var(--pl-border)] bg-[var(--pl-surface-sunken)]"
    >
      <header className="flex items-center justify-between border-b border-[var(--pl-border)] bg-[var(--pl-surface)] px-3 py-2">
        <span className="text-xs uppercase tracking-wider text-[var(--pl-text-muted)]">{t.logTitle}</span>
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-[var(--pl-success)]" />
          <span className="size-2 rounded-full bg-[var(--pl-warning)]" />
          <span className="size-2 rounded-full bg-[var(--pl-danger)]" />
        </span>
      </header>
      <div
        ref={boxRef}
        className="scrollbar-thin h-56 overflow-y-auto px-3 py-2 text-xs leading-relaxed"
      >
        {lines.map((line, i) => (
          <div key={i} className={`whitespace-pre-wrap break-all ${LOG_KIND_CLASS[line.kind]}`}>
            {line.kind === 'cmd' ? `$ ${line.text}` : line.text}
          </div>
        ))}
        {lines.length === 0 ? (
          <div className={LOG_KIND_CLASS.dim}>{dict.terminal.logIdle}</div>
        ) : null}
        <div className="text-[var(--pl-text-muted)]" aria-hidden>
          <span className="animate-pulse">▌</span>
        </div>
      </div>
    </section>
  );
}
