'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';

interface FaqItemData {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const FALLBACK_FAQ: FaqItemData[] = [
  {
    id: '1',
    question: 'Was kostet die Miete bei HoppDrive?',
    answer: 'Unsere Mietwagen starten ab CHF 59 pro Tag. Bei längerer Mietdauer profitieren Sie von automatischen Rabatten: 20% ab 8 Tagen und bis zu 40% ab 31 Tagen.',
    category: 'pricing',
  },
  {
    id: '2',
    question: 'Ist eine Versicherung inklusive?',
    answer: 'Ja, bei jeder Anmietung ist eine Vollkasko-Versicherung inklusive. Es gibt keine versteckten Zusatzkosten für den Versicherungsschutz.',
    category: 'insurance',
  },
  {
    id: '3',
    question: 'Wie lange kann ich ein Fahrzeug mieten?',
    answer: 'Sie können unsere Fahrzeuge ab 1 Tag bis zu mehreren Monaten mieten. Je länger die Mietdauer, desto günstiger der Tagespreis – ideal für Langzeitmiete.',
    category: 'rental',
  },
  {
    id: '4',
    question: 'Welche Dokumente brauche ich?',
    answer: 'Sie benötigen einen gültigen Führerschein und einen Identitätsausweis (Pass oder ID). Bei der Übergabe wird ein Mietvertrag vor Ort unterschrieben.',
    category: 'documents',
  },
  {
    id: '5',
    question: 'Kann ich die Mietdauer verlängern?',
    answer: 'Ja, eine Verlängerung ist jederzeit möglich – einfach Kontakt aufnehmen. Der Preis passt sich automatisch an die neue Gesamtdauer an.',
    category: 'rental',
  },
  {
    id: '6',
    question: 'Wo kann ich das Fahrzeug abholen?',
    answer: 'Die Fahrzeugübergabe findet an unserem Standort statt. Die genaue Adresse und Wegbeschreibung erhalten Sie nach der Buchungsbestätigung.',
    category: 'pickup',
  },
];

function AccordionItem({ item, isOpen, onToggle }: { item: FaqItemData; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-neutral-200 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 px-1 text-left group"
        aria-expanded={isOpen}
      >
        <span className="text-base font-semibold text-neutral-900 group-hover:text-brand-600 transition-colors pr-4">
          {item.question}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-neutral-400 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-96 pb-5' : 'max-h-0'
        }`}
      >
        <p className="text-neutral-600 text-sm leading-relaxed px-1">{item.answer}</p>
      </div>
    </div>
  );
}

export function FaqSection() {
  const [faqItems, setFaqItems] = useState<FaqItemData[]>(FALLBACK_FAQ);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  useEffect(() => {
    api
      .getFaq()
      .then((data) => {
        if (data && data.length > 0) setFaqItems(data);
      })
      .catch(() => {});
  }, []);

  return (
    <section id="faq" className="py-20 bg-neutral-50 border-y border-neutral-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-brand-600 font-semibold text-sm uppercase tracking-wider">
            Häufige Fragen
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
            Alles was Sie wissen müssen
          </h2>
          <p className="text-neutral-500 max-w-2xl mx-auto text-lg">
            Finden Sie schnell Antworten auf die häufigsten Fragen rund um unsere Mietwagen.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 px-6 md:px-8">
          {faqItems.map((item, idx) => (
            <AccordionItem
              key={item.id}
              item={item}
              isOpen={openIndex === idx}
              onToggle={() => setOpenIndex(openIndex === idx ? null : idx)}
            />
          ))}
        </div>

        <div className="text-center mt-8">
          <p className="text-neutral-500 text-sm">
            Noch Fragen?{' '}
            <a href="#contact-form" className="text-brand-600 font-semibold hover:underline">
              Kontaktieren Sie uns direkt
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
