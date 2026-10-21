'use client';

/**
 * "Vorschau" of a contract template: filled with a real booking (picked from the most recent ones)
 * or with sample data, flattened, AGB attached. The PDF opens in a new tab.
 */
import { Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ContractTemplateDto } from '@hoppdrive/shared';
import { useTranslations } from 'next-intl';
import { Alert, Button, Field, Modal, Select, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { fetchBookings } from '@/lib/bookings';
import { openPdfInTab } from '@/lib/doc-pdf';
import { errorText } from '@/lib/errors';
import { fmtDate } from '@/lib/format';
import { tr } from '@/i18n/active';

interface BookingOption {
  id: string;
  label: string;
}

export function TemplatePreviewModal({ template, onClose }: { template: ContractTemplateDto | null; onClose: () => void }) {
  const t = useTranslations();
  const [options, setOptions] = useState<BookingOption[] | null>(null);
  const [bookingId, setBookingId] = useState('');
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = template?.id;

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setBookingId('');
    setError(null);
    setOptions(null);
    fetchBookings(100)
      .then((res) => {
        if (!alive) return;
        const rows = (res.items as { id: string; customerName: string; startDate: string; vehicle?: { brand?: string; model?: string } | null }[])
          .slice()
          .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
          .slice(0, 40)
          .map((b) => ({
            id: b.id,
            label: `${b.customerName} · ${b.vehicle?.brand ? `${b.vehicle.brand} ${b.vehicle.model ?? ''}`.trim() : '–'} · ${fmtDate(b.startDate)}`,
          }));
        setOptions(rows);
      })
      .catch(() => {
        if (alive) setOptions([]);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  function open() {
    if (!template) return;
    setOpening(true);
    setError(null);
    void openPdfInTab(() => api.previewContractTemplate(template.id, bookingId || undefined), `${template.name}-${tr('documents.preview.fileSuffix')}.pdf`)
      .catch((err) => setError(errorText(err, tr('documents.preview.failed'))))
      .finally(() => setOpening(false));
  }

  return (
    <Modal
      open={Boolean(template)}
      onClose={onClose}
      title={t('documents.preview.title')}
      description={template ? t('documents.preview.text', { name: template.name }) : undefined}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('documents.close')}
          </Button>
          <Button loading={opening} iconLeft={<Eye size={18} aria-hidden="true" />} onClick={open}>
            {t('documents.preview.open')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert tone="err">{error}</Alert>}
        {options === null ? (
          <Skeleton className="h-11 w-full" rounded={10} />
        ) : (
          <Field label={t('documents.preview.booking')} hint={t('documents.preview.bookingHint')}>
            <Select value={bookingId} onChange={(e) => setBookingId(e.target.value)} data-autofocus>
              <option value="">{t('documents.preview.sample')}</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <p className="sm mut">{t('documents.preview.note')}</p>
      </div>
    </Modal>
  );
}
