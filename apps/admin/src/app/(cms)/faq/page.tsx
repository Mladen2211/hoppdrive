'use client';

import { ChevronDown, CircleHelp, Plus, Trash2 } from 'lucide-react';
import type { AppLocale, FaqTranslation, TranslatableLocale, Translations } from '@hoppdrive/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Input,
  Panel,
  Select,
  SkeletonRows,
  Switch,
  Textarea,
  cn,
  useConfirm,
  useToast,
} from '@/components/ui';
import { ContentHeader } from '@/components/content/ContentHeader';
import { LanguageNote, LanguageTabs } from '@/components/content/LanguageTabs';
import { TranslatedField } from '@/components/content/TranslatedField';
import { MoveButtons, SortGrip, useSortableList } from '@/components/content/useSortableList';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useCan } from '@/hooks/usePermission';
import { api } from '@/lib/api';
import { orUserError } from '@/lib/content-errors';
import { assignSortOrders, moveItem } from '@/lib/content-homepage';
import { errorText } from '@/lib/errors';
import { TRANSLATABLE_LOCALES, cleanTranslations, stateOf, type TranslationState } from '@/lib/translations';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
  translations?: Translations<FaqTranslation> | null;
}

const CATEGORY_OPTIONS = [
  { value: 'general', get label() { return tr('faq.allgemein'); } },
  { value: 'pricing', get label() { return tr('faq.preise'); } },
  { value: 'insurance', get label() { return tr('faq.versicherung'); } },
  { value: 'rental', get label() { return tr('faq.mietbedingungen'); } },
  { value: 'documents', get label() { return tr('faq.dokumente'); } },
  { value: 'pickup', get label() { return tr('faq.abholung'); } },
];

const categoryLabel = (value: string) => CATEGORY_OPTIONS.find((c) => c.value === value)?.label || value;

const NEW_ID = 'new';

interface Draft {
  question: string;
  answer: string;
  category: string;
  isActive: boolean;
  translations: Translations<FaqTranslation>;
}

const draftOf = (item: FaqItem): Draft => ({
  question: item.question,
  answer: item.answer,
  category: item.category || 'general',
  isActive: item.isActive,
  translations: item.translations ?? {},
});

const sameTranslations = (a: Translations<FaqTranslation> | null | undefined, b: Translations<FaqTranslation> | null | undefined) =>
  JSON.stringify(cleanTranslations(a) ?? null) === JSON.stringify(cleanTranslations(b) ?? null);

const isDirty = (draft: Draft, item: FaqItem | null) =>
  item
    ? draft.question !== item.question ||
      draft.answer !== item.answer ||
      draft.category !== (item.category || 'general') ||
      !sameTranslations(draft.translations, item.translations)
    : draft.question.trim() !== '' || draft.answer.trim() !== '' || cleanTranslations(draft.translations) !== null;

export default function FaqPage() {
  const t = useTranslations();
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canEdit = useCan('content', 'edit');

  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<{ question?: string; answer?: string }>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lang, setLang] = useState<AppLocale>('de');

  // What the server has (refreshed by loads and successful saves, never by local drags).
  const savedOrders = useRef<Map<string, number>>(new Map());

  const sorted = useMemo(() => [...items].sort((a, b) => a.sortOrder - b.sortOrder), [items]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data: FaqItem[] = await api.getFaqItems();
      savedOrders.current = new Map(data.map((i) => [i.id, i.sortOrder]));
      setItems(data);
    } catch (err) {
      setLoadError(errorText(err, tr('faq.dieFragenKonntenNicht')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  // ── Reordering: optimistic, then persist the sortOrder of every row whose number changed ──
  const persistTimer = useRef<ReturnType<typeof setTimeout>>();
  const persistChain = useRef<Promise<void>>(Promise.resolve());

  const flushOrder = useCallback(() => {
    persistChain.current = persistChain.current.then(async () => {
      const current = [...itemsRef.current].sort((a, b) => a.sortOrder - b.sortOrder);
      const changed = current.filter((i) => savedOrders.current.get(i.id) !== i.sortOrder);
      if (changed.length === 0) return;
      try {
        for (const item of changed) {
          await api.updateFaqItem(item.id, { sortOrder: item.sortOrder });
          savedOrders.current.set(item.id, item.sortOrder);
        }
        toast.success(tr('faq.reihenfolgeGespeichert'));
      } catch (err) {
        toast.error(tr('faq.reihenfolgeNichtGespeichert'), errorText(err));
        await load(); // show what the server really has
      }
    });
  }, [load, toast]);

  // Leaving the page with a pending drag: save it now instead of dropping it.
  const flushRef = useRef(flushOrder);
  flushRef.current = flushOrder;
  useEffect(
    () => () => {
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
        flushRef.current();
      }
    },
    [],
  );

  const reorder = useCallback(
    (from: number, to: number) => {
      const order = moveItem(
        [...itemsRef.current].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.id),
        from,
        to,
      );
      const numbers = assignSortOrders(order, itemsRef.current);
      setItems((prev) => prev.map((i) => ({ ...i, sortOrder: numbers[i.id] ?? i.sortOrder })));
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        persistTimer.current = undefined;
        flushOrder();
      }, 700);
    },
    [flushOrder],
  );

  const sort = useSortableList({
    ids: sorted.map((i) => i.id),
    onMove: reorder,
    labelOf: (id) => sorted.find((i) => i.id === id)?.question ?? t('faq.frage'),
  });

  // ── Editing ────────────────────────────────────────────────
  async function openRow(id: string, item: FaqItem | null) {
    if (openId === id) {
      await closeEditor();
      return;
    }
    if (openId && draft && isDirty(draft, items.find((i) => i.id === openId) ?? null)) {
      const ok = await confirm({
        title: tr('common.aenderungenVerwerfen'),
        description: tr('faq.dieGeoeffneteFrageHat'),
        confirmLabel: tr('common.verwerfen'),
        cancelLabel: tr('common.weiterBearbeiten'),
      });
      if (!ok) return;
    }
    setOpenId(id);
    setDraft(item ? draftOf(item) : { question: '', answer: '', category: 'general', isActive: true, translations: {} });
    setLang('de');
    setErrors({});
    setFormError(null);
  }

  async function closeEditor(force = false) {
    if (!force && openId && draft && isDirty(draft, items.find((i) => i.id === openId) ?? null)) {
      const ok = await confirm({
        title: tr('common.aenderungenVerwerfen'),
        description: tr('faq.ihreAenderungenAnDieser'),
        confirmLabel: tr('common.verwerfen'),
        cancelLabel: tr('common.weiterBearbeiten'),
      });
      if (!ok) return;
    }
    setOpenId(null);
    setDraft(null);
    setErrors({});
    setFormError(null);
  }

  async function handleSave() {
    if (!draft || !openId) return;
    const next: typeof errors = {};
    if (!draft.question.trim()) next.question = tr('faq.bitteGebenSieDie');
    if (!draft.answer.trim()) next.answer = tr('faq.bitteGebenSieDie2');
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setLang('de'); // German is required: show the empty field
      return;
    }

    setSaving(true);
    setFormError(null);
    const translations = cleanTranslations(draft.translations) as Translations<FaqTranslation> | null;
    try {
      if (openId === NEW_ID) {
        const nextOrder = items.reduce((max, i) => Math.max(max, i.sortOrder ?? 0), 0) + 1;
        const created = await api.createFaqItem({
          question: draft.question.trim(),
          answer: draft.answer.trim(),
          category: draft.category,
          isActive: draft.isActive,
          sortOrder: nextOrder,
          ...(translations ? { translations } : {}),
        });
        savedOrders.current.set(created.id, created.sortOrder);
        setItems((prev) => [...prev, created]);
        toast.success(tr('faq.frageHinzugefuegt'));
      } else {
        const updated = await api.updateFaqItem(openId, {
          question: draft.question.trim(),
          answer: draft.answer.trim(),
          category: draft.category,
          translations,
        });
        setItems((prev) => prev.map((i) => (i.id === openId ? { ...i, ...updated, translations, sortOrder: i.sortOrder } : i)));
        toast.success(tr('faq.frageGespeichert'));
      }
      await closeEditor(true);
    } catch (err) {
      setFormError(errorText(err, tr('faq.dieFrageKonnteNicht')));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: FaqItem) {
    const ok = await confirm({
      title: tr('faq.frageLoeschen'),
      description: tr('faq.verschwindetVonDerWebsite', { question: item.question }),
      confirmLabel: tr('faq.frageLoeschen2'),
      icon: <Trash2 size={20} />,
      onConfirm: () => orUserError(api.deleteFaqItem(item.id), tr('faq.dieFrageKonnteNicht2')),
    });
    if (!ok) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    savedOrders.current.delete(item.id);
    if (openId === item.id) await closeEditor(true);
    toast.success(tr('faq.frageGeloescht'));
  }

  async function toggleActive(item: FaqItem, next: boolean) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isActive: next } : i)));
    try {
      await api.updateFaqItem(item.id, { isActive: next });
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isActive: item.isActive } : i)));
      toast.error(tr('common.sichtbarkeitNichtGeaendert'), errorText(err));
    }
  }

  const addButton = canEdit ? (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void openRow(NEW_ID, null)}
      disabled={openId === NEW_ID}
      iconLeft={<Plus size={18} aria-hidden="true" />}
    >
      {t('faq.frageHinzufuegen')}
    </Button>
  ) : null;

  function renderEditor(item: FaqItem | null) {
    if (!draft) return null;
    const isNew = item === null;
    const states: Partial<Record<AppLocale, TranslationState>> = {};
    for (const locale of TRANSLATABLE_LOCALES) {
      const entry = draft.translations[locale];
      states[locale] = stateOf([
        { base: draft.question, value: entry?.question },
        { base: draft.answer, value: entry?.answer },
      ]);
    }
    const setTranslation = (locale: TranslatableLocale, patch: Partial<FaqTranslation>) =>
      setDraft({ ...draft, translations: { ...draft.translations, [locale]: { ...draft.translations[locale], ...patch } } });
    const blob = lang === 'de' ? undefined : draft.translations[lang as TranslatableLocale];
    return (
      <div className="flex flex-col gap-3 px-3.5 pb-4 pt-1 md:pl-[52px]">
        {formError && <Alert tone="err">{formError}</Alert>}
        <LanguageTabs value={lang} onChange={setLang} states={states} idPrefix={`faq-lang-${item?.id ?? NEW_ID}`} />
        <LanguageNote locale={lang} className="-mt-1" />
        {lang === 'de' ? (
          <>
            <Field label={t('faq.frage')} error={errors.question} required>
              <Input
                value={draft.question}
                onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                data-autofocus
              />
            </Field>
            <Field label={t('faq.antwort')} error={errors.answer} required>
              <Textarea rows={4} value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} />
            </Field>
            <Field label={t('faq.kategorie')}>
              <Select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : (
          <>
            <TranslatedField
              locale={lang}
              label={t('faq.frage')}
              base={draft.question}
              value={blob?.question}
              onChange={(v) => setTranslation(lang as TranslatableLocale, { question: v })}
            />
            <TranslatedField
              locale={lang}
              label={t('faq.antwort')}
              base={draft.answer}
              value={blob?.answer}
              multiline
              rows={4}
              onChange={(v) => setTranslation(lang as TranslatableLocale, { answer: v })}
            />
          </>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" loading={saving} onClick={() => void handleSave()}>
            {t('common.speichern')}
          </Button>
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => void closeEditor()}>
            {t('common.abbrechen')}
          </Button>
          {!isNew && canEdit && (
            <MoveButtons
              label={item.question}
              canUp={sorted.findIndex((i) => i.id === item.id) > 0}
              canDown={sorted.findIndex((i) => i.id === item.id) < sorted.length - 1}
              onUp={() => sort.move(item.id, -1)}
              onDown={() => sort.move(item.id, 1)}
              className="ml-auto"
            />
          )}
          {!isNew && (
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => void handleDelete(item)}
              iconLeft={<Trash2 size={16} aria-hidden="true" />}
              className="border-edge-err text-err"
            >
              {t('common.loeschen')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const rowHeader = (item: FaqItem | null) => {
    const id = item?.id ?? NEW_ID;
    const open = openId === id;
    const question = item ? item.question : draft?.question.trim() || t('faq.neueFrage');
    const active = item ? item.isActive : draft?.isActive ?? true;
    const panelId = `faq-editor-${id}`;
    return (
      <div className="flex min-h-[56px] items-center gap-2 px-3 py-1.5">
        {item && canEdit ? (
          <SortGrip label={question} {...sort.getHandleProps(id)} />
        ) : (
          <span className="w-8 flex-none" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={() => void openRow(id, item)}
          aria-expanded={open}
          aria-controls={panelId}
          className={cn('flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-lg text-left', !active && 'text-graphite')}
        >
          <span className="min-w-0 flex-1">
            <b className="block font-semibold leading-snug">{question}</b>
            {item && <span className="sm mut block truncate">{categoryLabel(item.category)}</span>}
          </span>
          <ChevronDown size={20} aria-hidden="true" className={cn('flex-none text-graphite transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
        </button>
        <Switch
          checked={active}
          disabled={!canEdit}
          onChange={(next) => (item ? void toggleActive(item, next) : setDraft((d) => (d ? { ...d, isActive: next } : d)))}
          aria-label={`${question}: ${active ? t('faq.aufDerWebsiteSichtbar') : 'ausgeblendet'}`}
        />
      </div>
    );
  };

  const rowClass = (open: boolean, dragging: boolean, drop?: string) =>
    cn(
      'relative rounded-12 border-[1.5px] bg-card',
      open ? 'border-ruby' : 'border-line',
      dragging && 'opacity-50',
      drop === 'before' && 'before:absolute before:-top-[6px] before:left-0 before:right-0 before:h-1 before:rounded-sm before:bg-ruby',
      drop === 'after' && 'after:absolute after:-bottom-[6px] after:left-0 after:right-0 after:h-1 after:rounded-sm after:bg-ruby',
    );

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <ContentHeader active="faq" ownCount={loading || loadError ? null : items.length} />

      {loadError && (
        <Alert
          tone="err"
          title={t('faq.fragenKonntenNichtGeladen')}
          action={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              {t('common.erneutVersuchen')}
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      <Panel aria-labelledby="faq-h" className="max-w-[960px]">
        <div className="panel-h">
          <div className="min-w-0">
            <h2 className="h2" id="faq-h">
              {t('faq.haeufigeFragen')}
            </h2>
            {canEdit && <p className="sm mut mt-0.5">{t('faq.perGriffZiehenOder')}</p>}
          </div>
          {addButton}
        </div>

        {loading ? (
          <div className="p-4">
            <SkeletonRows rows={5} avatar={false} />
          </div>
        ) : sorted.length === 0 && openId !== NEW_ID && !loadError ? (
          <EmptyState
            icon={<CircleHelp size={32} />}
            title={t('faq.nochKeineFragen')}
            text={t('faq.haeufigeFragenErscheinenAuf')}
            actions={addButton}
          />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-3.5 md:p-3.5">
            {openId === NEW_ID && (
              <li className={rowClass(true, false)} id={`faq-editor-${NEW_ID}`}>
                {rowHeader(null)}
                {renderEditor(null)}
              </li>
            )}
            {sorted.map((item) => {
              const open = openId === item.id;
              const rowProps = sort.getRowProps(item.id);
              return (
                <li
                  key={item.id}
                  className={rowClass(open, sort.dragId === item.id, rowProps['data-drop'])}
                  {...rowProps}
                >
                  {rowHeader(item)}
                  {open && (
                    <div id={`faq-editor-${item.id}`}>{renderEditor(item)}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="sr-only" aria-live="polite">
          {sort.announcement}
        </p>
      </Panel>
    </div>
  );
}
