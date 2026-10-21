/**
 * Which texts of the homepage sections can be translated. Links, numbers and image URLs are language
 * independent and stay in the German content only. `labelKey` is an existing message key (the same label
 * the German editor uses), so no extra texts are needed.
 *
 * The translations of a section are a blob with the SAME shape as its German content: arrays follow the
 * German order (the website merges them by index), so a translated list can neither grow nor shrink.
 */
import type { TranslatableLocale } from '@hoppdrive/shared';
import { getAt, isFilled, stateOf, type Json, type TranslationState } from './translations';

export interface TextDef {
  key: string;
  labelKey: string;
  multiline?: boolean;
}

export interface ObjectListDef {
  key: string;
  labelKey: string;
  itemNameKey: string;
  fields: TextDef[];
}

export interface StringListDef {
  key: string;
  labelKey: string;
  itemNameKey: string;
}

export interface SectionSchema {
  fields: TextDef[];
  objectLists?: ObjectListDef[];
  stringLists?: StringListDef[];
}

const INTRO: TextDef[] = [
  { key: 'label', labelKey: 'content.label' },
  { key: 'heading', labelKey: 'content.ueberschrift' },
  { key: 'description', labelKey: 'common.beschreibung', multiline: true },
];

export const SECTION_TRANSLATABLE: Record<string, SectionSchema> = {
  hero: {
    fields: [
      { key: 'badgeText', labelKey: 'content.badgeText' },
      { key: 'heading', labelKey: 'common.titel' },
      { key: 'headingHighlight', labelKey: 'content.hervorgehobenerText' },
      { key: 'description', labelKey: 'content.untertitel', multiline: true },
      { key: 'ctaPrimaryText', labelKey: 'content.textDesHauptknopfs' },
      { key: 'ctaSecondaryText', labelKey: 'content.textDesZweitenKnopfs' },
    ],
    stringLists: [{ key: 'trustItems', labelKey: 'content.vertrauenssignale', itemNameKey: 'content.vertrauenssignal' }],
  },
  why_hoppdrive: {
    fields: INTRO,
    objectLists: [
      {
        key: 'items',
        labelKey: 'content.wertversprechen',
        itemNameKey: 'content.karte',
        fields: [
          { key: 'title', labelKey: 'content.titel' },
          { key: 'description', labelKey: 'content.beschreibung', multiline: true },
        ],
      },
    ],
  },
  how_it_works: {
    fields: INTRO,
    objectLists: [
      {
        key: 'steps',
        labelKey: 'common.schritte',
        itemNameKey: 'content.schritt',
        fields: [
          { key: 'title', labelKey: 'content.titel' },
          { key: 'description', labelKey: 'content.beschreibung', multiline: true },
          { key: 'time', labelKey: 'content.zeitBadge' },
        ],
      },
    ],
  },
  fleet: { fields: INTRO },
  pricing: {
    fields: INTRO,
    objectLists: [
      {
        key: 'tiers',
        labelKey: 'content.preisstufen',
        itemNameKey: 'content.stufe',
        fields: [
          { key: 'title', labelKey: 'content.titel' },
          { key: 'description', labelKey: 'content.beschreibung', multiline: true },
          { key: 'badge', labelKey: 'content.badge' },
        ],
      },
    ],
    stringLists: [{ key: 'includedItems', labelKey: 'content.inklusiveLeistungen', itemNameKey: 'content.leistung' }],
  },
  social_proof: { fields: INTRO },
  faq: { fields: INTRO },
  contact: {
    fields: [...INTRO, { key: 'ctaText', labelKey: 'content.textDesKnopfs' }, { key: 'trustLine', labelKey: 'content.hinweisUnterDemKnopf' }],
  },
  map: { fields: [{ key: 'heading', labelKey: 'content.ueberschrift' }] },
};

const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Every German text of a section with its translated counterpart (for the state of a language). */
export function sectionPairs(sectionKey: string, base: Json, blob: Json | undefined): { base: unknown; value: unknown }[] {
  const schema = SECTION_TRANSLATABLE[sectionKey];
  if (!schema) return [];
  const pairs: { base: unknown; value: unknown }[] = [];
  for (const f of schema.fields) pairs.push({ base: base[f.key], value: blob?.[f.key] });
  for (const list of schema.stringLists ?? []) {
    asList(base[list.key]).forEach((text, i) => pairs.push({ base: text, value: getAt(blob, [list.key, i]) }));
  }
  for (const list of schema.objectLists ?? []) {
    asList(base[list.key]).forEach((item, i) => {
      for (const f of list.fields) pairs.push({ base: getAt(item, [f.key]), value: getAt(blob, [list.key, i, f.key]) });
    });
  }
  return pairs;
}

export function sectionTranslationState(sectionKey: string, base: Json, blob: Json | undefined): TranslationState {
  return stateOf(sectionPairs(sectionKey, base, blob));
}

/** True when the blob holds at least one filled text. */
export function hasTranslation(blob: unknown): boolean {
  if (typeof blob === 'string') return isFilled(blob);
  if (Array.isArray(blob)) return blob.some(hasTranslation);
  if (blob && typeof blob === 'object') return Object.values(blob as Json).some(hasTranslation);
  return false;
}

export type SectionTranslations = Partial<Record<TranslatableLocale, Json>>;
