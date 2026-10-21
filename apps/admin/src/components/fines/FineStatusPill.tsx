'use client';

import type { FineStatus } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { StatusPill } from '@/components/ui';
import { FINE_STATUS_TONE } from '@/lib/fine-model';

export function FineStatusPill({ status }: { status: FineStatus }) {
  const t = useTranslations();
  return <StatusPill tone={FINE_STATUS_TONE[status]} label={t(`fines.status.${status}`)} />;
}
