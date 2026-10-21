'use client';

import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function RetryButton() {
  const t = useTranslations();
  return (
    <button type="button" className="btn btn-p mt-2" onClick={() => window.location.reload()}>
      <RefreshCw size={18} aria-hidden="true" />
      {t('common.erneutVersuchen')}
    </button>
  );
}
