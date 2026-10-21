import type { TranslatableLocale } from '@hoppdrive/shared';
import { tr } from '@/i18n/active';
/**
 * Homepage editor model: section labels, summaries and draft comparison.
 *
 * The 9 section keys are fixed by the B2C site (apps/web/src/types/homepage-sections.ts); the CMS only
 * edits their content JSON, their order (sortOrder) and their visibility (isActive).
 */

export interface HomepageSection {
  id: string;
  sectionKey: string;
  isActive: boolean;
  sortOrder: number;
  content: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** { en: <same shape as content>, fr: ... }; German lives in `content`. */
  translations?: Partial<Record<TranslatableLocale, Record<string, unknown>>> | null;
}

export interface SectionMeta {
  /** Name in the "Abschnitte" list. */
  label: string;
  /** Heading of the editor: "Kopfbereich bearbeiten". */
  editorTitle: string;
  /** Summary used when the content gives nothing countable. */
  fallbackSummary: string;
}

export const SECTION_META: Record<string, SectionMeta> = {
  hero: { get label() { return tr('contentHomepage.kopfbereich'); }, get editorTitle() { return tr('contentHomepage.kopfbereichBearbeiten'); }, get fallbackSummary() { return tr('contentHomepage.titelKnoepfeBild'); } },
  why_hoppdrive: { get label() { return tr('contentHomepage.warumHoppDrive'); }, get editorTitle() { return tr('contentHomepage.warumHoppDriveBearbeiten'); }, get fallbackSummary() { return tr('contentHomepage.wertversprechen'); } },
  how_it_works: { get label() { return tr('contentHomepage.soFunktioniertEs'); }, get editorTitle() { return tr('contentHomepage.soFunktioniertEsBearbeiten'); }, get fallbackSummary() { return tr('common.schritte'); } },
  fleet: { get label() { return tr('common.flotte'); }, get editorTitle() { return tr('contentHomepage.flotteBearbeiten'); }, get fallbackSummary() { return tr('contentHomepage.fahrzeugeKategorien'); } },
  pricing: { get label() { return tr('contentHomepage.preisstaffel'); }, get editorTitle() { return tr('contentHomepage.preisstaffelBearbeiten'); }, get fallbackSummary() { return tr('contentHomepage.staffelUndLeistungen'); } },
  social_proof: { get label() { return tr('common.bewertungen'); }, get editorTitle() { return tr('contentHomepage.bewertungenBearbeiten'); }, get fallbackSummary() { return tr('contentHomepage.kundenstimmen'); } },
  faq: { get label() { return tr('contentHomepage.haeufigeFragen'); }, get editorTitle() { return tr('contentHomepage.haeufigeFragenBearbeiten'); }, get fallbackSummary() { return tr('contentHomepage.fragenUndAntworten'); } },
  contact: { get label() { return tr('contentHomepage.anfrageformular'); }, get editorTitle() { return tr('contentHomepage.anfrageformularBearbeiten'); }, get fallbackSummary() { return tr('contentHomepage.pflichtfelderHinweis'); } },
  map: { get label() { return tr('common.standorte'); }, get editorTitle() { return tr('contentHomepage.standorteBearbeiten'); }, get fallbackSummary() { return tr('contentHomepage.karteUndAdresse'); } },
};

export function sectionLabel(key: string): string {
  return SECTION_META[key]?.label ?? key;
}

export function sectionEditorTitle(key: string): string {
  return SECTION_META[key]?.editorTitle ?? tr('content.editSection', { name: key });
}

/** Counts of the content managed on other pages (Bewertungen, FAQ, Standorte); null = unknown. */
export interface RelatedCounts {
  testimonials: number | null;
  faq: number | null;
  locations: number | null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const arrayLength = (value: unknown): number => (Array.isArray(value) ? value.length : 0);

/** One-line summary under the section name: "3 Schritte", "4 Karten", "8 Einträge". */
export function sectionSummary(section: Pick<HomepageSection, 'sectionKey' | 'content'>, related?: RelatedCounts): string {
  const content = section.content || {};
  switch (section.sectionKey) {
    case 'why_hoppdrive': {
      const n = arrayLength(content.items);
      return n > 0 ? plural(n, tr('contentHomepage.karte'), tr('contentHomepage.karten')) : SECTION_META.why_hoppdrive.fallbackSummary;
    }
    case 'how_it_works': {
      const n = arrayLength(content.steps);
      return n > 0 ? plural(n, tr('contentHomepage.schritt'), tr('common.schritte')) : SECTION_META.how_it_works.fallbackSummary;
    }
    case 'pricing': {
      const n = arrayLength(content.tiers);
      return n > 0 ? tr('contentHomepage.inklusive', { plural: plural(n, tr('contentHomepage.stufe'), tr('contentHomepage.stufen')), arrayLength: arrayLength(content.includedItems) }) : SECTION_META.pricing.fallbackSummary;
    }
    case 'social_proof':
      return related?.testimonials != null ? plural(related.testimonials, tr('contentHomepage.bewertung'), tr('common.bewertungen')) : SECTION_META.social_proof.fallbackSummary;
    case 'faq':
      return related?.faq != null ? plural(related.faq, tr('contentHomepage.eintrag'), tr('contentHomepage.eintraege')) : SECTION_META.faq.fallbackSummary;
    case 'map':
      return related?.locations != null ? plural(related.locations, tr('contentHomepage.standort'), tr('common.standorte')) : SECTION_META.map.fallbackSummary;
    default:
      return SECTION_META[section.sectionKey]?.fallbackSummary ?? '';
  }
}

/** JSON with sorted keys, so two contents compare equal regardless of key order. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function contentEquals(a: unknown, b: unknown): boolean {
  return stableStringify(a ?? {}) === stableStringify(b ?? {});
}

/** Slots (sortOrder values) of the sections in their saved order; reordering reuses these numbers. */
export function slotsOf(sections: { sortOrder: number }[]): number[] {
  return sections.map((s) => s.sortOrder).sort((a, b) => a - b);
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Counter text "28 von 60 Zeichen" and whether the soft limit is exceeded. */
export function countText(length: number, max: number): string {
  return tr('contentHomepage.vonZeichen', { length, max });
}

/**
 * New sortOrder per section key for a draft order (array of keys). The numbers already in use are
 * reused slot by slot, so untouched sections keep their value; if the saved numbers are not unique
 * (several sections share one), the order is normalised to 1..n.
 */
export function assignSortOrders(order: string[], saved: { sortOrder: number }[]): Record<string, number> {
  let slots = slotsOf(saved);
  if (new Set(slots).size !== slots.length || slots.length !== order.length) {
    slots = order.map((_, index) => index + 1);
  }
  const result: Record<string, number> = {};
  order.forEach((key, index) => {
    result[key] = slots[index];
  });
  return result;
}
