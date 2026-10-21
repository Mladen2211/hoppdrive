'use client';

import { Pencil, Plus, Star, Trash2 } from 'lucide-react';
import type { AppLocale, TestimonialTranslation, TranslatableLocale, Translations } from '@hoppdrive/shared';
import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Cell2,
  EmptyState,
  Field,
  IconButton,
  Input,
  MobileCard,
  Modal,
  Panel,
  Select,
  SkeletonRows,
  SkeletonTableRows,
  Switch,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Textarea,
  Tr,
  useConfirm,
  useToast,
} from '@/components/ui';
import { ContentHeader } from '@/components/content/ContentHeader';
import { LanguageNote, LanguageTabs } from '@/components/content/LanguageTabs';
import { Stars } from '@/components/content/Stars';
import { TranslatedField } from '@/components/content/TranslatedField';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useCan } from '@/hooks/usePermission';
import { api } from '@/lib/api';
import { orUserError } from '@/lib/content-errors';
import { errorText } from '@/lib/errors';
import { TRANSLATABLE_LOCALES, cleanTranslations, stateOf, type TranslationState } from '@/lib/translations';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

interface Testimonial {
  id: string;
  name: string;
  location: string | null;
  text: string;
  rating: number;
  avatarUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  translations?: Translations<TestimonialTranslation> | null;
}

interface FormState {
  name: string;
  location: string;
  text: string;
  rating: string;
  sortOrder: string;
  isActive: boolean;
  avatarUrl: string;
  translations: Translations<TestimonialTranslation>;
}

const emptyForm = (nextOrder: number): FormState => ({
  name: '',
  location: '',
  text: '',
  rating: '5',
  sortOrder: String(nextOrder),
  isActive: true,
  avatarUrl: '',
  translations: {},
});

const toForm = (item: Testimonial): FormState => ({
  name: item.name,
  location: item.location ?? '',
  text: item.text,
  rating: String(item.rating ?? 5),
  sortOrder: String(item.sortOrder ?? 0),
  isActive: item.isActive,
  avatarUrl: item.avatarUrl ?? '',
  translations: item.translations ?? {},
});

export default function TestimonialsPage() {
  const t = useTranslations();
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canEdit = useCan('content', 'edit');

  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ editing: Testimonial | null } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setItems(await api.getTestimonials());
    } catch (err) {
      setLoadError(errorText(err, tr('testimonials.dieBewertungenKonntenNicht')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  // A sorted copy: never sort state in place (and never during render of the source array).
  const sorted = useMemo(() => [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), [items]);
  const nextOrder = items.reduce((max, i) => Math.max(max, i.sortOrder ?? 0), 0) + 1;

  async function handleDelete(item: Testimonial) {
    const ok = await confirm({
      title: tr('testimonials.bewertungVonLoeschen', { name: item.name }),
      description: tr('testimonials.dieBewertungVerschwindetVon'),
      confirmLabel: tr('testimonials.bewertungLoeschen'),
      icon: <Trash2 size={20} />,
      onConfirm: () => orUserError(api.deleteTestimonial(item.id), tr('testimonials.dieBewertungKonnteNicht')),
    });
    if (!ok) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    toast.success(tr('testimonials.bewertungGeloescht'));
  }

  async function toggleActive(item: Testimonial, next: boolean) {
    // Optimistic: flip first, roll back when the request fails.
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isActive: next } : i)));
    try {
      const updated = await api.updateTestimonial(item.id, { isActive: next });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...updated } : i)));
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isActive: item.isActive } : i)));
      toast.error(tr('common.sichtbarkeitNichtGeaendert'), errorText(err));
    }
  }

  const rowSwitch = (item: Testimonial) => (
    <Switch
      checked={item.isActive}
      disabled={!canEdit}
      onChange={(next) => void toggleActive(item, next)}
      aria-label={t('testimonials.bewertungVon', { name: item.name, value: item.isActive ? 'ausblenden' : t('testimonials.aufDerWebsiteAnzeigen') })}
    />
  );

  const addButton = canEdit ? (
    <Button size="sm" onClick={() => setModal({ editing: null })} iconLeft={<Plus size={18} aria-hidden="true" />}>
      {t('testimonials.bewertungHinzufuegen')}
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <ContentHeader active="testimonials" ownCount={loading || loadError ? null : items.length} />

      {loadError && (
        <Alert
          tone="err"
          title={t('testimonials.bewertungenKonntenNichtGeladen')}
          action={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              {t('common.erneutVersuchen')}
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      <Panel aria-labelledby="reviews-h" className="overflow-hidden">
        <div className="panel-h">
          <h2 className="h2" id="reviews-h">
            {t('common.bewertungen')}
          </h2>
          {addButton}
        </div>

        {loading ? (
          <>
            <div className="max-md:hidden">
              <Table aria-label={t('testimonials.bewertungenWerdenGeladen')}>
                <TBody>
                  <SkeletonTableRows rows={4} columns={4} />
                </TBody>
              </Table>
            </div>
            <div className="p-4 md:hidden">
              <SkeletonRows rows={3} avatar={false} />
            </div>
          </>
        ) : sorted.length === 0 && !loadError ? (
          <EmptyState
            icon={<Star size={32} />}
            title={t('testimonials.nochKeineBewertungen')}
            text={t('testimonials.kundenstimmenErscheinenAufDer')}
            actions={addButton}
          />
        ) : (
          <>
            <div className="max-md:hidden">
              <Table aria-label={t('common.bewertungen')}>
                <THead>
                  <Tr>
                    <Th>{t('common.name')}</Th>
                    <Th>{t('testimonials.sterne')}</Th>
                    <Th>{t('testimonials.text')}</Th>
                    <Th>{t('testimonials.aufWebsite')}</Th>
                    <Th align="right">
                      <span className="sr-only">{t('common.aktionen')}</span>
                    </Th>
                  </Tr>
                </THead>
                <TBody>
                  {sorted.map((item) => (
                    <Tr key={item.id}>
                      <Td className={item.isActive ? undefined : 'text-graphite'}>
                        <Cell2 primary={item.name} secondary={item.location || undefined} />
                      </Td>
                      <Td>
                        <Stars rating={item.rating} />
                      </Td>
                      <Td className="max-w-[520px]">
                        <span className={`line-clamp-2 ${item.isActive ? '' : 'text-graphite'}`}>{item.text}</span>
                      </Td>
                      <Td>{rowSwitch(item)}</Td>
                      <Td>
                        {canEdit && (
                          <div className="acts">
                            <IconButton className="pr" aria-label={t('testimonials.bewertungVonBearbeiten', { name: item.name })} onClick={() => setModal({ editing: item })}>
                              <Pencil size={20} aria-hidden="true" />
                            </IconButton>
                            <IconButton aria-label={t('testimonials.bewertungVonLoeschen2', { name: item.name })} onClick={() => void handleDelete(item)}>
                              <Trash2 size={20} aria-hidden="true" />
                            </IconButton>
                          </div>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 p-4 md:hidden">
              {sorted.map((item) => (
                <MobileCard
                  key={item.id}
                  title={item.name}
                  subtitle={item.location || undefined}
                  status={<Stars rating={item.rating} />}
                  actions={
                    <>
                      <div className="mr-auto flex items-center gap-2">
                        {rowSwitch(item)}
                        <span className="sm mut">{t('testimonials.aufWebsite')}</span>
                      </div>
                      {canEdit && (
                        <>
                          <IconButton aria-label={t('testimonials.bewertungVonBearbeiten', { name: item.name })} onClick={() => setModal({ editing: item })}>
                            <Pencil size={20} aria-hidden="true" />
                          </IconButton>
                          <IconButton aria-label={t('testimonials.bewertungVonLoeschen2', { name: item.name })} onClick={() => void handleDelete(item)}>
                            <Trash2 size={20} aria-hidden="true" />
                          </IconButton>
                        </>
                      )}
                    </>
                  }
                >
                  <p className={`line-clamp-4 ${item.isActive ? '' : 'text-graphite'}`}>{item.text}</p>
                </MobileCard>
              ))}
            </div>
          </>
        )}
      </Panel>

      {modal && (
        <TestimonialModal
          editing={modal.editing}
          nextOrder={nextOrder}
          onClose={() => setModal(null)}
          onSaved={(saved, wasNew) => {
            setItems((prev) => (wasNew ? [...prev, saved] : prev.map((i) => (i.id === saved.id ? { ...i, ...saved } : i))));
            setModal(null);
            toast.success(wasNew ? tr('testimonials.bewertungHinzugefuegt') : tr('testimonials.bewertungGespeichert'));
          }}
        />
      )}
    </div>
  );
}

function TestimonialModal({
  editing,
  nextOrder,
  onClose,
  onSaved,
}: {
  editing: Testimonial | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: (saved: Testimonial, wasNew: boolean) => void;
}) {
  const t = useTranslations();
  const formId = useId();
  const [form, setForm] = useState<FormState>(() => (editing ? toForm(editing) : emptyForm(nextOrder)));
  const [errors, setErrors] = useState<{ name?: string; text?: string }>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<AppLocale>('de');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setTranslation = (locale: TranslatableLocale, patch: Partial<TestimonialTranslation>) =>
    setForm((f) => ({ ...f, translations: { ...f.translations, [locale]: { ...f.translations[locale], ...patch } } }));

  const states: Partial<Record<AppLocale, TranslationState>> = {};
  for (const locale of TRANSLATABLE_LOCALES) {
    const entry = form.translations[locale];
    states[locale] = stateOf([
      { base: form.text, value: entry?.text },
      { base: form.location, value: entry?.location },
    ]);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = tr('testimonials.bitteGebenSieEinen');
    if (!form.text.trim()) next.text = tr('testimonials.bitteGebenSieDen');
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setLang('de'); // German is required: show the empty field
      return;
    }

    setSaving(true);
    setError(null);
    const rating = parseInt(form.rating, 10) || 5;
    const sortOrder = parseInt(form.sortOrder, 10) || 0;
    const translations = cleanTranslations(form.translations) as Translations<TestimonialTranslation> | null;
    try {
      if (editing) {
        const saved = await api.updateTestimonial(editing.id, {
          name: form.name.trim(),
          location: form.location.trim() || null,
          text: form.text.trim(),
          rating,
          avatarUrl: form.avatarUrl.trim() || null,
          isActive: form.isActive,
          sortOrder,
          translations,
        });
        onSaved(saved, false);
      } else {
        const saved = await api.createTestimonial({
          name: form.name.trim(),
          location: form.location.trim() || undefined,
          text: form.text.trim(),
          rating,
          avatarUrl: form.avatarUrl.trim() || undefined,
          isActive: form.isActive,
          sortOrder,
          ...(translations ? { translations } : {}),
        });
        onSaved(saved, true);
      }
    } catch (err) {
      setError(errorText(err, tr('testimonials.dieBewertungKonnteNicht2')));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="md"
      title={editing ? t('testimonials.bewertungBearbeiten') : t('testimonials.bewertungHinzufuegen')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('common.abbrechen')}
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            {t('common.speichern')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error && <Alert tone="err">{error}</Alert>}
        <div className="flex flex-col gap-2">
          <LanguageTabs value={lang} onChange={setLang} states={states} idPrefix="tm-lang" />
          <LanguageNote locale={lang} />
        </div>
        {lang === 'de' ? (
          <>
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <Field label={t('common.name')} error={errors.name} required>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} data-autofocus />
              </Field>
              <Field label={t('testimonials.ort')}>
                <Input value={form.location} onChange={(e) => set('location', e.target.value)} />
              </Field>
            </div>
            <Field label={t('testimonials.bewertungstext')} error={errors.text} required>
              <Textarea rows={4} value={form.text} onChange={(e) => set('text', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <Field label={t('testimonials.sterne')}>
                <Select value={form.rating} onChange={(e) => set('rating', e.target.value)}>
                  {[5, 4, 3, 2, 1].map((r) => (
                    <option key={r} value={r}>
                      {r} {t('testimonials.sternN', { count: r })}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('testimonials.reihenfolge')} hint={t('testimonials.kleinereZahlenErscheinenZuerst')}>
                <Input type="number" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
              </Field>
            </div>
            <Field label={t('testimonials.avatarURLOptional')}>
              <Input value={form.avatarUrl} onChange={(e) => set('avatarUrl', e.target.value)} placeholder={t('testimonials.https')} inputMode="url" />
            </Field>
            <Switch
              checked={form.isActive}
              onChange={(v) => set('isActive', v)}
              label={t('common.aktiv')}
              description={t('testimonials.aktiveBewertungenErscheinenAuf')}
            />
          </>
        ) : (
          <>
            <TranslatedField
              locale={lang}
              label={t('testimonials.bewertungstext')}
              base={form.text}
              value={form.translations[lang as TranslatableLocale]?.text}
              multiline
              rows={4}
              onChange={(v) => setTranslation(lang as TranslatableLocale, { text: v })}
            />
            <TranslatedField
              locale={lang}
              label={t('testimonials.ort')}
              base={form.location}
              value={form.translations[lang as TranslatableLocale]?.location}
              onChange={(v) => setTranslation(lang as TranslatableLocale, { location: v })}
            />
          </>
        )}
      </form>
    </Modal>
  );
}
