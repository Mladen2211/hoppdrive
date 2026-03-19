-- CreateTable
CREATE TABLE "homepage_sections" (
    "id" TEXT NOT NULL,
    "section_key" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "homepage_sections_section_key_key" ON "homepage_sections"("section_key");

-- Seed default sections
INSERT INTO "homepage_sections" ("id", "section_key", "is_active", "sort_order", "content", "created_at", "updated_at") VALUES
(gen_random_uuid(), 'hero', true, 0, '{
  "badgeText": "Ab CHF 59 / Tag — Günstige Autovermietung Schweiz",
  "heading": "Günstig unterwegs,",
  "headingHighlight": "flexibel gemietet.",
  "description": "Zuverlässige Fahrzeuge wie Škoda Superb, VW Passat & mehr – ab CHF 59 pro Tag. Je länger Sie mieten, desto mehr sparen Sie. Vollkasko inklusive.",
  "ctaPrimaryText": "Flotte entdecken",
  "ctaPrimaryLink": "#fleet",
  "ctaSecondaryText": "Verfügbarkeit prüfen",
  "ctaSecondaryLink": "#contact-form",
  "backgroundImageUrl": "https://images.unsplash.com/photo-1449965408869-ebd3fee7710d?auto=format&fit=crop&q=80&w=2000",
  "trustItems": ["Vollkasko inklusive", "Bis 40% Langzeitrabatt", "Top-gepflegte Fahrzeuge", "Keine versteckten Kosten"]
}', NOW(), NOW()),
(gen_random_uuid(), 'why_hoppdrive', true, 1, '{
  "label": "Warum HoppDrive",
  "heading": "Günstig, flexibel & zuverlässig",
  "description": "Wir machen Autovermietung einfach und erschwinglich – mit transparenten Preisen und persönlichem Service.",
  "items": [
    {"title": "Unschlagbare Preise", "description": "Starten Sie ab CHF 59/Tag – bis zu 40% Rabatt bei Langzeitmiete. Transparente Preise ohne versteckte Gebühren."},
    {"title": "Vollkasko inklusive", "description": "Premium-Versicherungsschutz ist bei jeder Anmietung dabei. Keine Zusatzkosten, keine Überraschungen."},
    {"title": "Bestens gewartet", "description": "Jedes Fahrzeug wird vor jeder Übergabe professionell geprüft und gereinigt. Immer zuverlässig."},
    {"title": "Persönlicher Service", "description": "Individuelle Beratung und flexible Laufzeiten. Wir passen uns Ihren Bedürfnissen an."}
  ]
}', NOW(), NOW()),
(gen_random_uuid(), 'how_it_works', true, 3, '{
  "label": "So einfach gehts",
  "heading": "In 3 Schritten zum Mietwagen",
  "description": "Keine komplizierten Prozesse. Kein Papierkram. Einfach anfragen und losfahren.",
  "steps": [
    {"number": "01", "title": "Fahrzeug wählen", "description": "Durchstöbern Sie unsere Flotte und finden Sie das passende Auto für Ihre Bedürfnisse.", "time": "2 Minuten"},
    {"number": "02", "title": "Unverbindlich anfragen", "description": "Senden Sie uns eine kostenlose Anfrage mit Ihren Wunschdaten – wir antworten schnellstmöglich.", "time": "Kostenlos"},
    {"number": "03", "title": "Losfahren", "description": "Vertrag unterschreiben, Schlüssel erhalten, und schon sind Sie günstig und flexibel unterwegs.", "time": "Sofort startklar"}
  ]
}', NOW(), NOW()),
(gen_random_uuid(), 'fleet', true, 2, '{
  "label": "Unsere Flotte",
  "heading": "Günstige Mietwagen für jeden Anlass",
  "description": "Zuverlässige Kombis, Limousinen & SUVs von Škoda, VW, Toyota und mehr. Wählen Sie Ihr Fahrzeug und profitieren Sie von bis zu 40% Langzeitrabatt."
}', NOW(), NOW()),
(gen_random_uuid(), 'pricing', true, 4, '{
  "label": "Preismodell",
  "heading": "So funktioniert unsere Preisgestaltung",
  "description": "Je länger Sie mieten, desto günstiger wird es. Alle Preise inklusive Vollkasko.",
  "tiers": [
    {"number": "01", "title": "Tag 1 – 7", "description": "Standard-Tagestarif für kurzfristige Bedürfnisse."},
    {"number": "02", "title": "Tag 8 – 30", "description": "Automatisch 20% Rabatt auf den Tagestarif bei verlängerter Miete.", "badge": "20% RABATT"},
    {"number": "03", "title": "Ab 31 Tagen", "description": "Maximaler 40% Rabatt. Bestes Preis-Leistungs-Verhältnis für echte Langzeitmobilität.", "badge": "40% RABATT"}
  ],
  "includedItems": ["Vollkasko-Versicherung", "Wartung & Service", "Pannenhilfe 24/7", "Transparente Verträge"]
}', NOW(), NOW()),
(gen_random_uuid(), 'social_proof', true, 5, '{
  "label": "Kundenstimmen",
  "heading": "Was unsere Kunden sagen",
  "description": "Hunderte zufriedene Mieter vertrauen HoppDrive für günstige und flexible Mobilität."
}', NOW(), NOW()),
(gen_random_uuid(), 'faq', true, 6, '{
  "label": "Häufige Fragen",
  "heading": "Alles was Sie wissen müssen",
  "description": "Finden Sie schnell Antworten auf die häufigsten Fragen rund um unsere Mietwagen."
}', NOW(), NOW()),
(gen_random_uuid(), 'contact', true, 7, '{
  "label": "Kostenlos & unverbindlich",
  "heading": "Jetzt Ihr Wunschfahrzeug anfragen",
  "description": "Füllen Sie das Formular aus – wir melden uns innerhalb von 24 Stunden mit einem individuellen Angebot.",
  "ctaText": "Kostenloses Angebot erhalten",
  "trustLine": "✓ Unverbindlich · ✓ Antwort in 24h · ✓ Vollkasko inklusive"
}', NOW(), NOW()),
(gen_random_uuid(), 'map', true, 8, '{
  "heading": "Hier finden Sie uns"
}', NOW(), NOW());
