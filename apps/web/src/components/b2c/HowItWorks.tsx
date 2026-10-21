import { useTranslations } from 'next-intl';
import type { HowItWorksContent } from '@/types/homepage-sections';

export type { HowItWorksContent };

interface HowItWorksProps {
  content?: HowItWorksContent;
}

/** "01" -> "1"; anything that is not a plain number is shown as written. */
function stepNumber(raw: string | undefined, index: number): string {
  if (!raw) return String(index + 1);
  return /^\d+$/.test(raw.trim()) ? String(Number(raw.trim())) : raw;
}

export function HowItWorks({ content }: HowItWorksProps) {
  const t = useTranslations('how');
  const c = content || {};
  const label = c.label ?? t('label');
  const heading = c.heading ?? t('heading');
  const defaultSteps = [
    { title: t('chooseTitle'), description: t('chooseText') },
    { title: t('requestTitle'), description: t('requestText') },
    { title: t('driveTitle'), description: t('driveText') },
  ];
  const steps = (c.steps?.length ? c.steps : defaultSteps) as {
    number?: string;
    title: string;
    description: string;
    time?: string;
  }[];

  return (
    <section className="sec bg-white">
      <div className="wrap">
        <div className="sec-head">
          <p className="kick">{label}</p>
          <h2 className="h2">{heading}</h2>
          {c.description && <p className="lead">{c.description}</p>}
        </div>

        <ol className="grid grid-cols-3 gap-6 max-lg:grid-cols-1 max-md:gap-4">
          {steps.map((step, index) => (
            <li
              key={`${step.title}-${index}`}
              className="relative flex flex-col gap-3 rounded-18 border border-line bg-white p-7 max-md:flex-row max-md:items-start max-md:gap-4 max-md:p-5"
            >
              <div
                className="num flex h-11 w-11 flex-none items-center justify-center rounded-full bg-ink text-xl font-bold text-white"
                aria-hidden="true"
              >
                {stepNumber(step.number, index)}
              </div>
              <div className="flex flex-col gap-3 max-md:gap-1">
                <h3 className="h3">
                  <span className="sr-only">{t('step', { number: stepNumber(step.number, index) })}</span>
                  {step.title}
                </h3>
                <p className="mut">{step.description}</p>
                {step.time && (
                  <span className="mt-1 inline-flex w-fit rounded-full bg-ruby-tint px-3 py-1 text-[13px] font-semibold text-ruby-dark">
                    {step.time}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
