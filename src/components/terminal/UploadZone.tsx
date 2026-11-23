// FILE: src/components/terminal/UploadZone.tsx
// Zona de subida: drag & drop + selector. Los archivos se parsean en el
// navegador (sección 2 del brief); nada viaja al servidor hasta «Guardar».

'use client';

import { useRef, useState } from 'react';
import { Upload, FileJson } from 'lucide-react';
import { useLanguage } from '@/i18n';

interface UploadZoneProps {
  onFiles: (files: File[]) => void;
  busy: boolean;
  hasFiles: boolean;
}

export function UploadZone({ onFiles, busy, hasFiles }: UploadZoneProps) {
  const { dict } = useLanguage();
  const t = dict.terminal;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const extract = (list: FileList | null): File[] =>
    list ? Array.from(list).filter((f) => f.size > 0) : [];

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t.dropTitle}
      onClick={() => !busy && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !busy) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (busy) return;
        const files = extract(e.dataTransfer?.files ?? null);
        if (files.length > 0) onFiles(files);
      }}
      className={`flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-accent-gold)] ${
        dragging
          ? 'border-[var(--pl-accent-gold)] bg-[var(--pl-accent-gold-soft)]'
          : 'border-[var(--pl-border-strong)] bg-[var(--pl-surface-sunken)] hover:border-[var(--pl-accent)]'
      } ${busy ? 'pointer-events-none opacity-60' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = extract(e.target.files);
          if (files.length > 0) onFiles(files);
          e.target.value = ''; // permite re-elegir el mismo archivo
        }}
      />
      <div className="flex items-center gap-2 text-sm text-[var(--pl-text-secondary)]">
        {hasFiles ? <FileJson className="size-4 text-[var(--pl-accent-gold)]" aria-hidden /> : <Upload className="size-4 text-[var(--pl-accent-gold)]" aria-hidden />}
        <span className="text-[var(--pl-text-primary)]">{hasFiles ? t.addMore : t.dropTitle}</span>
        <span className="rounded border border-[var(--pl-border)] bg-[var(--pl-surface)] px-2 py-1 text-xs text-[var(--pl-text-secondary)]">
          {t.browse}
        </span>
      </div>
      <p className="max-w-xl text-xs text-[var(--pl-text-muted)]">{t.dropHint}</p>
    </div>
  );
}
