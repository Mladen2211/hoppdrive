'use client';

/**
 * The AGB PDF inside the signing page. The API answers with a framing policy (frame-ancestors 'self') that
 * blocks an <iframe> pointing at the API origin, so the PDF is fetched and shown through a blob URL of this
 * origin. If that fails the plain link still opens it in a new tab.
 */
import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button, Skeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:97/api';
const AGB_URL = `${API_URL}/legal/agb`;

export function AgbFrame({ title }: { title: string }) {
  const t = useTranslations();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    fetch(AGB_URL)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return (
    <>
      {src ? (
        <iframe src={src} className="block h-[60vh] w-full" title={title} />
      ) : failed ? (
        <p className="px-5 py-8 text-center text-graphite">{t('sign.agbFailed')}</p>
      ) : (
        <Skeleton className="h-[60vh] w-full" rounded={0} />
      )}
      <div className="flex justify-end border-t border-line-soft px-4 py-3">
        <Button variant="ghost" size="sm" href={AGB_URL} target="_blank" rel="noopener noreferrer" iconLeft={<ExternalLink size={16} aria-hidden="true" />}>
          {t('sign.agbOpen')}
        </Button>
      </div>
    </>
  );
}
