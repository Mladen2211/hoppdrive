import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Download } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LegalLayout } from '@/components/b2c/LegalLayout';
import { isLocale } from '@/i18n/routing';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'legal.agb' });
  return buildMetadata({
    locale,
    title: t('metaTitle'),
    description: t('metaDescription'),
    pathname: '/agb',
  });
}

export default async function AGBPage({ params: { locale } }: { params: { locale: string } }) {
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal.agb' });

  // The PDF itself is the German, legally binding version in every language.
  return (
    <LegalLayout current="agb" title={t('title')} width="wide">
      <p className="-mt-3 text-graphite">
        {t('intro')}
      </p>

      {/* Download link */}
      <div>
        <a href="/agb.pdf" download className="btn btn-p no-underline">
          <Download size={18} aria-hidden="true" />
          {t('download')}
        </a>
      </div>

      {/* Embedded PDF viewer */}
      <div className="w-full overflow-hidden rounded-xl border border-line">
        <iframe
          src="/agb.pdf"
          title={t('iframeTitle')}
          className="w-full"
          style={{ height: '80vh' }}
        />
      </div>
    </LegalLayout>
  );
}
