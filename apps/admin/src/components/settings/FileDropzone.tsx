'use client';

/**
 * File upload area: drag and drop plus a real "Datei auswählen" button (keyboard and touch friendly).
 * Files are checked against `accept` (mime types or ".ext") and `maxMb` before `onFile` is called, so
 * the caller only ever sees acceptable files.
 *
 *   <FileDropzone accept="application/pdf,.pdf" maxMb={10} title="PDF hierher ziehen" onFile={upload} />
 */
import { FileUp } from 'lucide-react';
import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button, cn } from '@/components/ui';

export function matchesAccept(file: File, accept: string): boolean {
  const rules = accept
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);
  if (rules.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith('.')) return name.endsWith(rule);
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

export interface FileDropzoneProps {
  accept: string;
  maxMb: number;
  onFile: (file: File) => void;
  title: ReactNode;
  hint?: ReactNode;
  buttonLabel?: string;
  /** Text for "wrong type"; defaults to a generic message. */
  wrongTypeText?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Error from the caller (e.g. the server refused the file). */
  error?: string | null;
  compact?: boolean;
  className?: string;
}

export function FileDropzone({
  accept,
  maxMb,
  onFile,
  title,
  hint,
  buttonLabel,
  wrongTypeText,
  disabled,
  loading,
  error,
  compact,
  className,
}: FileDropzoneProps) {
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const hintId = useId();
  const blocked = Boolean(disabled || loading);

  function handle(file: File | undefined | null) {
    if (!file || blocked) return;
    if (!matchesAccept(file, accept)) {
      setLocalError(wrongTypeText ?? t('documents.dropzone.wrongType'));
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setLocalError(t('documents.dropzone.tooLarge', { max: maxMb }));
      return;
    }
    setLocalError(null);
    onFile(file);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setActive(false);
    handle(event.dataTransfer.files?.[0]);
  }

  const shownError = localError ?? error ?? null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        role="group"
        aria-label={typeof title === 'string' ? title : undefined}
        aria-describedby={hint ? hintId : undefined}
        onDragOver={(event) => {
          event.preventDefault();
          if (!blocked) setActive(true);
        }}
        onDragLeave={() => setActive(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors',
          compact ? 'px-4 py-4' : 'px-4 py-6',
          active ? 'border-ruby bg-ruby-tint' : 'border-line bg-row',
          blocked && 'opacity-70',
        )}
      >
        <FileUp size={compact ? 22 : 28} aria-hidden="true" className="text-graphite" />
        <p className="font-semibold">{title}</p>
        {hint && (
          <p id={hintId} className="sm mut max-w-[520px]">
            {hint}
          </p>
        )}
        <Button variant="outline" size="sm" loading={loading} disabled={disabled} onClick={() => inputRef.current?.click()}>
          {buttonLabel ?? t('documents.dropzone.choose')}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          disabled={blocked}
          onChange={(event) => {
            handle(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
      {shownError && (
        <p className="errm" role="alert">
          {shownError}
        </p>
      )}
    </div>
  );
}
