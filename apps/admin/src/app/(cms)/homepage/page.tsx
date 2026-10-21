'use client';

/**
 * Homepage editor (Content-Desktop board): Abschnitte | Editor | Vorschau.
 *
 * Content edits and the order stay in a local DRAFT until "Veröffentlichen" (PUT per changed section:
 * content and/or sortOrder). Visibility switches are the exception and stay INSTANT, exactly as before
 * (PATCH .../toggle), which the list says next to the switches.
 */
import { Home } from 'lucide-react';
import type { AppLocale, TranslatableLocale } from '@hoppdrive/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  EmptyState,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  StatusPill,
  Switch,
  Tabs,
  cn,
  useConfirm,
  useToast,
} from '@/components/ui';
import { LanguageNote, LanguageTabs } from '@/components/content/LanguageTabs';
import { HomepagePreview, type PreviewDevice } from '@/components/content/homepage/HomepagePreview';
import { PublishNote, SECTION_EDITORS } from '@/components/content/homepage/editors';
import { TranslationEditor } from '@/components/content/homepage/TranslationEditor';
import { MoveButtons, SortGrip, useSortableList } from '@/components/content/useSortableList';
import { useContentCounts } from '@/components/content/useContentCounts';
import { useUnsavedGuard } from '@/components/content/useUnsavedGuard';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useCan } from '@/hooks/usePermission';
import { api } from '@/lib/api';
import {
  assignSortOrders,
  contentEquals,
  moveItem,
  sectionEditorTitle,
  sectionLabel,
  sectionSummary,
  type HomepageSection,
} from '@/lib/content-homepage';
import { sectionTranslationState } from '@/lib/content-translations';
import { errorText } from '@/lib/errors';
import { LOCALE_NAMES } from '@/i18n/config';
import {
  CONTENT_LOCALES,
  TRANSLATABLE_LOCALES,
  cleanTranslations,
  mergeLocaleValue,
  type Json,
  type TranslationState,
} from '@/lib/translations';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

type Content = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type SectionTranslations = Partial<Record<TranslatableLocale, Json>>;

const DEVICE_TABS: { id: PreviewDevice; label: string }[] = [
  { id: 'desktop', get label() { return tr('homepage.desktop'); } },
  { id: 'tablet', get label() { return tr('homepage.tablet'); } },
  { id: 'mobile', get label() { return tr('homepage.mobil'); } },
];

export default function HomepageSectionsPage() {
  const t = useTranslations();
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const canEdit = useCan('content', 'edit');
  const related = useContentCounts();

  const [server, setServer] = useState<HomepageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState<Record<string, Content>>({});
  const [draftTranslations, setDraftTranslations] = useState<Record<string, SectionTranslations>>({});
  const [lang, setLang] = useState<AppLocale>('de');
  const [previewLang, setPreviewLang] = useState<AppLocale>('de');
  const [order, setOrder] = useState<string[] | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [publishing, setPublishing] = useState(false);
  const editorRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    try {
      const data: HomepageSection[] = await api.getHomepageSections();
      setServer([...data].sort((a, b) => a.sortOrder - b.sortOrder));
      setLoadError(null);
    } catch (err) {
      setLoadError(errorText(err, tr('homepage.dieAbschnitteKonntenNicht')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  // ── Draft model ──────────────────────────────────────────────
  const serverOrder = useMemo(() => server.map((s) => s.sectionKey), [server]);
  const byKey = useMemo(() => new Map(server.map((s) => [s.sectionKey, s])), [server]);

  const displayOrder = useMemo(() => {
    if (!order) return serverOrder;
    // Keep only keys that still exist and append new ones (e.g. a section added by a migration).
    const known = order.filter((k) => byKey.has(k));
    return [...known, ...serverOrder.filter((k) => !known.includes(k))];
  }, [order, serverOrder, byKey]);

  const contentChanged = useCallback(
    (key: string) => key in draftContent && !contentEquals(draftContent[key], byKey.get(key)?.content),
    [draftContent, byKey],
  );
  const translationsChanged = useCallback(
    (key: string) =>
      key in draftTranslations &&
      !contentEquals(cleanTranslations(draftTranslations[key]) ?? {}, cleanTranslations(byKey.get(key)?.translations) ?? {}),
    [draftTranslations, byKey],
  );
  const sectionChanged = useCallback((key: string) => contentChanged(key) || translationsChanged(key), [contentChanged, translationsChanged]);
  const orderChanged = order !== null && displayOrder.join('|') !== serverOrder.join('|');
  const changedKeys = serverOrder.filter(sectionChanged);
  const changeCount = changedKeys.length + (orderChanged ? 1 : 0);
  const dirty = changeCount > 0;

  useUnsavedGuard(dirty);

  const contentOf = (key: string): Content => draftContent[key] ?? byKey.get(key)?.content ?? {};
  const translationsOf = (key: string): SectionTranslations => draftTranslations[key] ?? byKey.get(key)?.translations ?? {};
  const activeKey = selectedKey && byKey.has(selectedKey) ? selectedKey : displayOrder[0] ?? null;
  const activeSection = activeKey ? byKey.get(activeKey) : undefined;

  function editContent(key: string, next: Content) {
    setDraftContent((current) => {
      const copy = { ...current };
      if (contentEquals(next, byKey.get(key)?.content)) delete copy[key];
      else copy[key] = next;
      return copy;
    });
  }

  function editTranslation(key: string, locale: TranslatableLocale, blob: Json) {
    setDraftTranslations((current) => {
      const copy = { ...current };
      const next: SectionTranslations = { ...(copy[key] ?? byKey.get(key)?.translations ?? {}), [locale]: blob };
      if (contentEquals(cleanTranslations(next) ?? {}, cleanTranslations(byKey.get(key)?.translations) ?? {})) delete copy[key];
      else copy[key] = next;
      return copy;
    });
  }

  function changeLang(next: AppLocale) {
    setLang(next);
    setPreviewLang(next);
  }

  const reorder = useCallback(
    (from: number, to: number) => setOrder((current) => moveItem(current ?? serverOrder, from, to)),
    [serverOrder],
  );

  const sort = useSortableList({
    ids: displayOrder,
    onMove: reorder,
    labelOf: sectionLabel,
  });

  function selectSection(key: string) {
    setSelectedKey(key);
    // Stacked layout (below lg): bring the editor into view.
    if (window.matchMedia('(max-width: 1023px)').matches) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => {
        editorRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        editorRef.current?.focus({ preventScroll: true });
      });
    }
  }

  // ── Actions ──────────────────────────────────────────────────
  async function handleToggle(key: string) {
    const section = byKey.get(key);
    if (!section) return;
    const next = !section.isActive;
    setServer((s) => s.map((x) => (x.sectionKey === key ? { ...x, isActive: next } : x)));
    try {
      await api.toggleHomepageSection(key);
      toast.success(next ? tr('homepage.istSichtbar', { sectionLabel: sectionLabel(key) }) : tr('homepage.istAusgeblendet', { sectionLabel: sectionLabel(key) }), tr('homepage.dieSichtbarkeitWirktSofort'));
    } catch (err) {
      setServer((s) => s.map((x) => (x.sectionKey === key ? { ...x, isActive: section.isActive } : x)));
      toast.error(tr('common.sichtbarkeitNichtGeaendert'), errorText(err));
    }
  }

  async function handlePublish() {
    if (!dirty || publishing) return;
    setPublishing(true);
    const sortMap = orderChanged ? assignSortOrders(displayOrder, server) : null;
    const failed: string[] = [];
    const applied = new Map<string, { content?: Content; sortOrder?: number; translations?: SectionTranslations | null }>();

    for (const section of server) {
      const key = section.sectionKey;
      const payload: { content?: Content; sortOrder?: number; translations?: Record<string, unknown> | null } = {};
      if (contentChanged(key)) payload.content = draftContent[key];
      if (translationsChanged(key)) payload.translations = cleanTranslations(draftTranslations[key]);
      if (sortMap && sortMap[key] !== section.sortOrder) payload.sortOrder = sortMap[key];
      if (Object.keys(payload).length === 0) continue;
      try {
        await api.updateHomepageSection(key, payload);
        applied.set(key, { ...payload, translations: payload.translations as SectionTranslations | null | undefined });
      } catch (err) {
        failed.push(`${sectionLabel(key)}: ${errorText(err)}`);
      }
    }

    // Reflect what the server accepted, then re-sync in the background.
    if (applied.size > 0) {
      setServer((current) =>
        current
          .map((s) => {
            const patch = applied.get(s.sectionKey);
            return patch
              ? {
                  ...s,
                  ...(patch.content ? { content: patch.content } : {}),
                  ...(patch.translations !== undefined ? { translations: patch.translations } : {}),
                  ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
                }
              : s;
          })
          .sort((a, b) => a.sortOrder - b.sortOrder),
      );
    }

    if (failed.length === 0) {
      setDraftContent({});
      setDraftTranslations({});
      setOrder(null);
      toast.success(tr('homepage.veroeffentlicht'), tr('homepage.jetztAufDerWebsite', { size: applied.size }));
    } else {
      // Keep the draft: what already went through no longer counts as a change, the rest stays editable.
      setDraftContent((current) => {
        const copy = { ...current };
        for (const key of applied.keys()) delete copy[key];
        return copy;
      });
      setDraftTranslations((current) => {
        const copy = { ...current };
        for (const key of applied.keys()) delete copy[key];
        return copy;
      });
      toast.error(
        tr('homepage.vonAbschnittenNichtVeroeffentl', { length: failed.length, value: failed.length + applied.size }),
        failed.slice(0, 2).join(' · '),
        { duration: 10000 },
      );
    }
    setPublishing(false);
    void load();
  }

  async function handleDiscard() {
    const ok = await confirm({
      title: tr('common.aenderungenVerwerfen'),
      description: tr('homepage.gehenVerlorenDieVeroeffentlich', { changeCount }),
      confirmLabel: tr('homepage.aenderungenVerwerfen'),
    });
    if (!ok) return;
    setDraftContent({});
    setDraftTranslations({});
    setOrder(null);
    toast.info(tr('homepage.aenderungenVerworfen'));
  }

  // ── Render ───────────────────────────────────────────────────
  const draftPill = dirty ? (
    <StatusPill tone="amber" label={t('homepage.entwurf', { changeCount })} />
  ) : null;

  const actions = canEdit ? (
    <>
      {draftPill}
      <Button variant="ghost" disabled={!dirty || publishing} onClick={() => void handleDiscard()}>
        {t('homepage.aenderungenVerwerfen')}
      </Button>
      <Button disabled={!dirty} loading={publishing} onClick={() => void handlePublish()}>
        {t('homepage.veroeffentlichen')}
      </Button>
    </>
  ) : null;

  const Editor = activeKey ? SECTION_EDITORS[activeKey] : undefined;
  const languageStates: Partial<Record<AppLocale, TranslationState>> = {};
  if (activeKey) {
    for (const locale of TRANSLATABLE_LOCALES) {
      languageStates[locale] = sectionTranslationState(activeKey, contentOf(activeKey), translationsOf(activeKey)[locale]);
    }
  }
  const previewBlob = activeKey && previewLang !== 'de' ? translationsOf(activeKey)[previewLang as TranslatableLocale] : undefined;
  const previewContent: Content = activeKey
    ? previewBlob
      ? (mergeLocaleValue(contentOf(activeKey), previewBlob) as Content)
      : contentOf(activeKey)
    : {};

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="max-md:hidden">
        <PageHeader
          title={t('homepage.homepage')}
          subtitle={t('homepage.abschnitteOrdnenTexteBearbeite')}
          actions={actions}
        />
      </div>
      <h1 className="sr-only md:hidden">{t('homepage.homepage')}</h1>
      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 md:hidden [&>button]:flex-1">
          {draftPill && <div className="w-full">{draftPill}</div>}
          <Button variant="ghost" disabled={!dirty || publishing} onClick={() => void handleDiscard()}>
            {t('common.verwerfen')}
          </Button>
          <Button disabled={!dirty} loading={publishing} onClick={() => void handlePublish()}>
            {t('homepage.veroeffentlichen')}
          </Button>
        </div>
      )}

      {!canEdit && !loading && (
        <Alert tone="info">{t('homepage.mitIhrerRolleKoennen')}</Alert>
      )}

      {loadError && (
        <Alert
          tone="err"
          title={t('homepage.abschnitteKonntenNichtGeladen')}
          action={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              {t('common.erneutVersuchen')}
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      {loading ? (
        <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_420px]" aria-busy="true">
          <span className="sr-only" role="status">
            {t('homepage.abschnitteWerdenGeladen')}
          </span>
          <Skeleton className="h-[560px]" rounded={16} />
          <Skeleton className="h-[560px]" rounded={16} />
          <Skeleton className="h-[360px] max-xl:hidden" rounded={16} />
        </div>
      ) : server.length === 0 && !loadError ? (
        <Panel>
          <EmptyState
            icon={<Home size={32} />}
            title={t('homepage.keineAbschnitteGefunden')}
            text={t('homepage.bitteStellenSieSicher')}
          />
        </Panel>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_420px]">
          {/* ── Abschnitte ── */}
          <section className="panel" aria-labelledby="sections-h">
            <div className="panel-h">
              <h2 className="h2" id="sections-h">
                {t('homepage.abschnitte')}
              </h2>
              {canEdit && <span className="sm mut">{t('homepage.perGriffZiehen')}</span>}
            </div>
            <ul className="m-0 flex list-none flex-col gap-2 p-3.5">
              {displayOrder.map((key) => {
                const section = byKey.get(key)!;
                const current = key === activeKey;
                const label = sectionLabel(key);
                const rowProps = sort.getRowProps(key);
                const drop = rowProps['data-drop'];
                return (
                  <li
                    key={key}
                    className={cn(
                      'relative flex min-h-[60px] items-center gap-1.5 rounded-12 border-[1.5px] bg-card px-2 py-1.5',
                      current ? 'border-ruby bg-ruby-tint' : 'border-line',
                      !section.isActive && 'text-graphite',
                      sort.dragId === key && 'opacity-50',
                      drop === 'before' && 'before:absolute before:-top-[6px] before:left-0 before:right-0 before:h-1 before:rounded-sm before:bg-ruby',
                      drop === 'after' && 'after:absolute after:-bottom-[6px] after:left-0 after:right-0 after:h-1 after:rounded-sm after:bg-ruby',
                    )}
                    {...rowProps}
                  >
                    {canEdit && <SortGrip label={label} {...sort.getHandleProps(key)} />}
                    <button
                      type="button"
                      onClick={() => selectSection(key)}
                      aria-current={current ? 'true' : undefined}
                      className="flex min-h-[44px] min-w-0 flex-1 flex-col justify-center rounded-lg px-1 text-left leading-tight"
                    >
                      <b className="flex items-center gap-1.5 font-semibold">
                        <span className="truncate">{label}</span>
                        {sectionChanged(key) && (
                          <span className="h-2 w-2 flex-none rounded-full bg-warn" title={t('homepage.geaendertNochNichtVeroeffentli')}>
                            <span className="sr-only">{t('homepage.geaendert')}</span>
                          </span>
                        )}
                      </b>
                      <span className="sm mut truncate">{sectionSummary({ sectionKey: key, content: contentOf(key) }, related)}</span>
                    </button>
                    <Switch
                      checked={section.isActive}
                      disabled={!canEdit}
                      onChange={() => void handleToggle(key)}
                      aria-label={t('homepage.wirktSofortOhneVeroeffentliche', { label, value: section.isActive ? 'sichtbar' : 'ausgeblendet' })}
                    />
                  </li>
                );
              })}
            </ul>
            <p className="sm mut px-4 pb-4">{t('homepage.derSchalterWirktSofort')}</p>
            <p className="sr-only" aria-live="polite">
              {sort.announcement}
            </p>
          </section>

          {/* ── Editor ── */}
          <section className="panel" aria-labelledby="editor-h">
            <div className="panel-h">
              <h2 className="h2 outline-none" id="editor-h" ref={editorRef} tabIndex={-1}>
                {activeKey ? sectionEditorTitle(activeKey) : t('homepage.abschnittBearbeiten')}
              </h2>
              {activeSection && activeKey && (
                <span className="flex items-center gap-2">
                  <StatusPill tone={activeSection.isActive ? 'green' : 'gray'} label={activeSection.isActive ? t('common.sichtbar') : t('common.ausgeblendet')} />
                  {canEdit && (
                    <MoveButtons
                      label={sectionLabel(activeKey)}
                      canUp={displayOrder.indexOf(activeKey) > 0}
                      canDown={displayOrder.indexOf(activeKey) < displayOrder.length - 1}
                      onUp={() => sort.move(activeKey, -1)}
                      onDown={() => sort.move(activeKey, 1)}
                      className="-mr-2"
                    />
                  )}
                </span>
              )}
            </div>
            <div className="panel-b flex flex-col gap-[18px]">
              {activeKey && (
                <div className="flex flex-col gap-2">
                  <LanguageTabs value={lang} onChange={changeLang} states={languageStates} idPrefix="hp-lang" />
                  <LanguageNote locale={lang} />
                </div>
              )}
              {Editor && activeKey ? (
                lang === 'de' ? (
                  <fieldset disabled={!canEdit} className="m-0 flex min-w-0 flex-col gap-[18px] border-0 p-0">
                    <Editor key={activeKey} content={contentOf(activeKey)} onChange={(next) => editContent(activeKey, next)} />
                  </fieldset>
                ) : (
                  <fieldset disabled={!canEdit} className="m-0 flex min-w-0 flex-col gap-[18px] border-0 p-0">
                    <TranslationEditor
                      key={`${activeKey}-${lang}`}
                      sectionKey={activeKey}
                      locale={lang}
                      base={contentOf(activeKey)}
                      blob={(translationsOf(activeKey)[lang as TranslatableLocale] ?? {}) as Json}
                      onChange={(blob) => editTranslation(activeKey, lang as TranslatableLocale, blob)}
                    />
                  </fieldset>
                )
              ) : (
                <p className="mut">{t('homepage.waehlenSieLinksEinen')}</p>
              )}
              <PublishNote />
            </div>
          </section>

          {/* ── Vorschau ── */}
          <section aria-labelledby="preview-h" className="flex min-w-0 flex-col gap-3 lg:max-xl:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <h2 className="h2" id="preview-h">
                {t('homepage.vorschau')}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label={t('homepage.vorschauSprache')}
                  value={previewLang}
                  onChange={(e) => setPreviewLang(e.target.value as AppLocale)}
                  className="!h-10 !w-auto text-sm font-semibold"
                >
                  {CONTENT_LOCALES.map((code) => (
                    <option key={code} value={code} lang={code}>
                      {LOCALE_NAMES[code]}
                    </option>
                  ))}
                </Select>
                <Tabs
                  aria-label={t('homepage.geraet')}
                  tabs={DEVICE_TABS}
                  value={device}
                  onChange={(id) => setDevice(id as PreviewDevice)}
                />
              </div>
            </div>
            <HomepagePreview
              sectionKey={activeKey}
              content={previewContent}
              device={device}
              hidden={activeSection ? !activeSection.isActive : false}
            />
            <p className="hint">{t('homepage.dieVorschauZeigtDen')}</p>
          </section>
        </div>
      )}
    </div>
  );
}
