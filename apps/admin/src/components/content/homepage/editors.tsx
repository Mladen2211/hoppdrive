'use client';

/**
 * Content editors of the 9 homepage sections. The content keys are exactly the ones the B2C site reads
 * (apps/web/src/types/homepage-sections.ts); every field of the previous editors is kept.
 */
import { Info } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { Alert, Field, Input } from '@/components/ui';
import { ArrayObjectEditor, ArrayStringEditor, TextField } from './fields';
import { useTranslations } from 'next-intl';

export type SectionContent = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface EditorProps {
  content: SectionContent;
  onChange: (content: SectionContent) => void;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const list = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

function useSetter({ content, onChange }: EditorProps) {
  return (key: string, value: unknown) => onChange({ ...content, [key]: value });
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="sm mut">{children}</p>;
}

/** Label / heading / description: the three texts almost every section starts with. */
function IntroFields({ content, onChange }: EditorProps) {
  const t = useTranslations();
  const set = useSetter({ content, onChange });
  return (
    <>
      <TextField label={t('content.label')} value={str(content.label)} onChange={(v) => set('label', v)} hint={t('content.kleinerTextUeberDer')} />
      <TextField label={t('content.ueberschrift')} value={str(content.heading)} onChange={(v) => set('heading', v)} />
      <TextField label={t('common.beschreibung')} value={str(content.description)} onChange={(v) => set('description', v)} multiline />
    </>
  );
}

function HeroEditor({ content, onChange }: EditorProps) {
  const t = useTranslations();
  const set = useSetter({ content, onChange });
  const image = str(content.backgroundImageUrl).trim();
  return (
    <>
      <TextField label={t('content.badgeText')} value={str(content.badgeText)} onChange={(v) => set('badgeText', v)} hint={t('content.kleinerTextUeberDem')} />
      <div className="grid grid-cols-1 gap-[18px] min-[1500px]:grid-cols-2">
        <TextField label={t('common.titel')} value={str(content.heading)} onChange={(v) => set('heading', v)} max={60} />
        <TextField
          label={t('content.hervorgehobenerText')}
          value={str(content.headingHighlight)}
          onChange={(v) => set('headingHighlight', v)}
          hint={t('content.erscheintInRotHinter')}
        />
      </div>
      <TextField
        label={t('content.untertitel')}
        value={str(content.description)}
        onChange={(v) => set('description', v)}
        multiline
        max={160}
      />
      <TextField label={t('content.textDesHauptknopfs')} value={str(content.ctaPrimaryText)} onChange={(v) => set('ctaPrimaryText', v)} />
      <TextField
        label={t('content.zielDesHauptknopfs')}
        value={str(content.ctaPrimaryLink)}
        onChange={(v) => set('ctaPrimaryLink', v)}
        placeholder={t('content.fleet')}
        hint={t('content.zumBeispielFleetContact')}
      />
      <TextField label={t('content.textDesZweitenKnopfs')} value={str(content.ctaSecondaryText)} onChange={(v) => set('ctaSecondaryText', v)} />
      <TextField
        label={t('content.zielDesZweitenKnopfs')}
        value={str(content.ctaSecondaryLink)}
        onChange={(v) => set('ctaSecondaryLink', v)}
        placeholder={t('content.contactForm')}
      />

      <div className="flex flex-col gap-1.5">
        <Field label={t('content.hintergrundbildURL')} hint={t('content.jPGOderPNGMindestens')}>
          <Input
            value={str(content.backgroundImageUrl)}
            onChange={(e) => set('backgroundImageUrl', e.target.value)}
            placeholder={t('content.https')}
            inputMode="url"
          />
        </Field>
        {image && (
          <div className="flex h-20 w-[132px] items-center justify-center overflow-hidden rounded-10 bg-tile">
            {/* eslint-disable-next-line @next/next/no-img-element -- editor-supplied URL of any host; a plain preview is enough */}
            <img src={image} alt={t('content.vorschauDesHintergrundbilds')} className="h-full w-full object-cover" />
          </div>
        )}
      </div>

      <ArrayStringEditor
        label={t('content.vertrauenssignale')}
        items={list<string>(content.trustItems)}
        onChange={(v) => set('trustItems', v)}
        itemName={t('content.vertrauenssignal')}
      />
    </>
  );
}

function WhyHoppDriveEditor({ content, onChange }: EditorProps) {
  const tt = useTranslations();
  const t = useTranslations();
  const set = useSetter({ content, onChange });
  return (
    <>
      <IntroFields content={content} onChange={onChange} />
      <ArrayObjectEditor
        label={t('content.wertversprechen')}
        itemName={t('content.karte')}
        addLabel={t('content.karteHinzufuegen')}
        items={list<Record<string, string>>(content.items)}
        fields={[
          { key: 'title', label: tt('content.titel') },
          { key: 'description', label: tt('content.beschreibung'), multiline: true },
        ]}
        onChange={(v) => set('items', v)}
      />
    </>
  );
}

function HowItWorksEditor({ content, onChange }: EditorProps) {
  const tt = useTranslations();
  const t = useTranslations();
  const set = useSetter({ content, onChange });
  return (
    <>
      <IntroFields content={content} onChange={onChange} />
      <ArrayObjectEditor
        label={t('common.schritte')}
        itemName={t('content.schritt')}
        addLabel={t('content.schrittHinzufuegen')}
        items={list<Record<string, string>>(content.steps)}
        fields={[
          { key: 'number', label: tt('content.nummer'), hint: tt('content.zumBeispiel01') },
          { key: 'title', label: tt('content.titel') },
          { key: 'description', label: tt('content.beschreibung'), multiline: true },
          { key: 'time', label: tt('content.zeitBadge'), hint: tt('content.zumBeispiel2Minuten') },
        ]}
        onChange={(v) => set('steps', v)}
      />
    </>
  );
}

function FleetEditor({ content, onChange }: EditorProps) {
  const t = useTranslations();
  return (
    <>
      <IntroFields content={content} onChange={onChange} />
      <Hint>{t('content.dieFahrzeugeSelbstVerwalten')}</Hint>
    </>
  );
}

function PricingEditor({ content, onChange }: EditorProps) {
  const tt = useTranslations();
  const t = useTranslations();
  const set = useSetter({ content, onChange });
  return (
    <>
      <IntroFields content={content} onChange={onChange} />
      <ArrayObjectEditor
        label={t('content.preisstufen')}
        itemName={t('content.stufe')}
        addLabel={t('content.stufeHinzufuegen')}
        items={list<Record<string, string>>(content.tiers)}
        fields={[
          { key: 'number', label: tt('content.nummer') },
          { key: 'title', label: tt('content.titel') },
          { key: 'description', label: tt('content.beschreibung'), multiline: true },
          { key: 'badge', label: tt('content.badge'), hint: tt('content.leerLassenFuerKein') },
        ]}
        onChange={(v) => set('tiers', v)}
      />
      <ArrayStringEditor
        label={t('content.inklusiveLeistungen')}
        items={list<string>(content.includedItems)}
        onChange={(v) => set('includedItems', v)}
        itemName={t('content.leistung')}
        addLabel={t('content.leistungHinzufuegen')}
      />
      <Hint>{t('content.dieTatsaechlichenRabattstufenS')}</Hint>
    </>
  );
}

function SocialProofEditor({ content, onChange }: EditorProps) {
  const t = useTranslations();
  return (
    <>
      <IntroFields content={content} onChange={onChange} />
      <Hint>{t('content.dieBewertungenSelbstVerwalten')}</Hint>
    </>
  );
}

function FaqEditor({ content, onChange }: EditorProps) {
  const t = useTranslations();
  return (
    <>
      <IntroFields content={content} onChange={onChange} />
      <Hint>{t('content.dieFragenSelbstVerwalten')}</Hint>
    </>
  );
}

function ContactEditor({ content, onChange }: EditorProps) {
  const t = useTranslations();
  const set = useSetter({ content, onChange });
  return (
    <>
      <IntroFields content={content} onChange={onChange} />
      <TextField label={t('content.textDesKnopfs')} value={str(content.ctaText)} onChange={(v) => set('ctaText', v)} />
      <TextField label={t('content.hinweisUnterDemKnopf')} value={str(content.trustLine)} onChange={(v) => set('trustLine', v)} />
    </>
  );
}

function MapEditor({ content, onChange }: EditorProps) {
  const t = useTranslations();
  const set = useSetter({ content, onChange });
  return (
    <>
      <TextField label={t('content.ueberschrift')} value={str(content.heading)} onChange={(v) => set('heading', v)} />
      <Hint>{t('content.adresseTelefonUndOeffnungszeit')}</Hint>
    </>
  );
}

export const SECTION_EDITORS: Record<string, ComponentType<EditorProps>> = {
  hero: HeroEditor,
  why_hoppdrive: WhyHoppDriveEditor,
  how_it_works: HowItWorksEditor,
  fleet: FleetEditor,
  pricing: PricingEditor,
  social_proof: SocialProofEditor,
  faq: FaqEditor,
  contact: ContactEditor,
  map: MapEditor,
};

export function PublishNote() {
  const t = useTranslations();
  return (
    <Alert tone="info" icon={<Info size={20} />}>
      {t.rich('content.publishNote', { b: (chunks) => <b>{chunks}</b> })}
    </Alert>
  );
}
