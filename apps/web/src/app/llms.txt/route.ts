import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { getAllVehicles, getCurrency, getSetting, getFaqItems, type LocationConfigData } from '@/lib/server-api';
import { SITE_URL, CATEGORY_SLUGS, CATEGORY_TYPES, categoryLabel, vehicleSlug, translateType } from '@/lib/seo';
import type { PricingContent } from '@/types/homepage-sections';

export const revalidate = 3600;

// llms.txt stays German on purpose (one machine-readable file for the whole site, German URLs),
// so everything here is fetched and translated in the default locale.
const LOCALE = 'de';

// The static public/llms.txt file this route replaces was deleted — Next
// would otherwise prefer the static file in public/ over this route handler.
export async function GET() {
  const [vehicles, currency, pricing, faqItems, location, tLabels, tCategory] = await Promise.all([
    getAllVehicles(LOCALE),
    getCurrency(),
    getSetting<PricingContent>('pricing', LOCALE),
    getFaqItems(LOCALE),
    getSetting<LocationConfigData>('location', LOCALE),
    getTranslations({ locale: LOCALE, namespace: 'labels' }),
    getTranslations({ locale: LOCALE, namespace: 'category' }),
  ]);

  const minPrice = vehicles.length > 0 ? Math.min(...vehicles.map((v) => v.basePricePerDay)) : null;
  const activeCategories = CATEGORY_TYPES.filter((type) => vehicles.some((v) => v.type === type));

  const lines: string[] = [];

  lines.push('# HoppDrive');
  lines.push('');
  lines.push(
    `> Günstige Kurz- und Langzeit-Autovermietung in der Schweiz.${minPrice ? ` Mietwagen ab ${currency} ${minPrice} pro Tag` : ''}, inklusive Vollkaskoversicherung.`
  );
  lines.push('');
  lines.push(
    'HoppDrive vermietet Fahrzeuge verschiedener Typen (Limousinen, SUVs, Kombis, Vans, Elektrofahrzeuge und weitere) schweizweit zur Kurz- und Langzeitmiete. Die Fahrzeugübergabe erfolgt am Unternehmensstandort in der Schweiz.'
  );
  lines.push('');

  // ─── Pricing — same CMS data PricingSection renders, so this can never
  // drift from what's shown on the homepage. ──────────────────────────
  lines.push('## Preise & Konditionen');
  lines.push('');
  if (pricing?.tiers?.length) {
    for (const tier of pricing.tiers) {
      const badge = tier.badge ? ` (${tier.badge})` : '';
      lines.push(`- ${tier.title}${badge}: ${tier.description}`);
    }
  } else {
    lines.push('- Automatischer Langzeitrabatt: günstiger werdender Tagespreis je nach Mietdauer');
  }
  lines.push('- Vollkasko-Versicherung bei jeder Anmietung inklusive, keine versteckten Zusatzkosten');
  lines.push('- Mietdauer flexibel: ab 1 Tag bis zu mehreren Monaten, jederzeit verlängerbar');
  lines.push('- Benötigte Dokumente: gültiger Führerschein und Identitätsausweis (Pass oder ID)');
  lines.push('');

  // ─── Fleet ────────────────────────────────────────────────────────
  lines.push('## Fahrzeuge');
  lines.push('');
  if (vehicles.length === 0) {
    lines.push('Aktuell sind keine Fahrzeuge im System hinterlegt.');
  } else {
    for (const v of vehicles) {
      const slug = vehicleSlug(v);
      lines.push(
        `- [${v.brand} ${v.model} (${v.year})](${SITE_URL}/fahrzeuge/${slug}): ${translateType(v.type, tLabels)}, ${v.specs.horsepower} PS, ${v.specs.seats} Sitze, ab ${currency} ${v.basePricePerDay}/Tag`
      );
    }
  }
  lines.push('');

  // ─── Categories ─────────────────────────────────────────────────
  if (activeCategories.length > 0) {
    lines.push('## Kategorien');
    lines.push('');
    for (const type of activeCategories) {
      lines.push(`- [${categoryLabel(type, tCategory)} mieten](${SITE_URL}/mieten/${CATEGORY_SLUGS[type]})`);
    }
    lines.push('');
  }

  // ─── Pages ──────────────────────────────────────────────────────
  lines.push('## Seiten');
  lines.push('');
  lines.push(`- [Startseite](${SITE_URL}/): Fahrzeugflotte, Preismodell, FAQ, Standort, Kontaktformular`);
  lines.push(`- [Fahrzeuge](${SITE_URL}/fahrzeuge): Alle Mietfahrzeuge mit Preisen, technischen Daten und Bildern`);
  lines.push(`- [Allgemeine Geschäftsbedingungen](${SITE_URL}/agb)`);
  lines.push(`- [Datenschutzerklärung](${SITE_URL}/privacy)`);
  lines.push(`- [Impressum](${SITE_URL}/impressum)`);
  lines.push('');

  // ─── FAQ ────────────────────────────────────────────────────────
  if (faqItems.length > 0) {
    lines.push('## Häufig gestellte Fragen');
    lines.push('');
    for (const item of faqItems) {
      lines.push(`### ${item.question}`);
      lines.push(item.answer);
      lines.push('');
    }
  }

  // ─── Contact ────────────────────────────────────────────────────
  lines.push('## Kontakt');
  lines.push('');
  lines.push('E-Mail: info@hoppdrive.ch');
  if (location?.address) {
    lines.push(`Standort: ${location.address}, Schweiz`);
  }
  lines.push(
    'Anfragen erfolgen unverbindlich über das Kontaktformular auf der Website; Antwort in der Regel innerhalb von 24 Stunden.'
  );

  return new NextResponse(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
