/**
 * ProgressSteps: booking progress (Vertrag -> Signiert -> Rechnung -> Bezahlt).
 * Rendered as an ordered list; the current step has aria-current="step" and every
 * step carries a visually hidden state word, so state is never colour-only.
 *
 *   <ProgressSteps steps={[
 *     { label: 'Vertrag', state: 'done' }, { label: 'Signiert', state: 'done' },
 *     { label: 'Rechnung', state: 'now' }, { label: 'Bezahlt', state: 'todo' },
 *   ]} />
 *   <ProgressSteps compact steps={...} />   // inside table rows (12 px labels, short connectors)
 *
 * Props: steps ({ label, state: 'done' | 'now' | 'todo' }[]), compact, aria-label
 * (default "Fortschritt"), className.
 */
import { Check } from 'lucide-react';
import { Fragment } from 'react';
import { cn } from './cn';
import { useTranslations } from 'next-intl';

export type StepState = 'done' | 'now' | 'todo';

export interface ProgressStep {
  label: string;
  state: StepState;
}

export interface ProgressStepsProps {
  steps: ProgressStep[];
  compact?: boolean;
  'aria-label'?: string;
  className?: string;
}

const STATE_KEY: Record<StepState, string> = {
  done: 'ui.stepDone',
  now: 'ui.stepNow',
  todo: 'ui.stepTodo',
};

export function ProgressSteps({ steps, compact = false, className, ...rest }: ProgressStepsProps) {
  const t = useTranslations();
  return (
    <ol
      className={cn('prog flex-wrap gap-y-1.5', compact && 'prog-compact', className)}
      aria-label={rest['aria-label'] ?? t('ui.fortschritt')}
    >
      {steps.map((step, index) => (
        <Fragment key={step.label}>
          {index > 0 && (
            <li
              aria-hidden="true"
              className="prog-line"
              data-state={steps[index - 1].state === 'done' ? 'done' : undefined}
            />
          )}
          <li className="prog-step" data-state={step.state} aria-current={step.state === 'now' ? 'step' : undefined}>
            <span className="prog-dot" aria-hidden="true">
              {step.state === 'done' && <Check size={compact ? 10 : 12} strokeWidth={3.5} />}
            </span>
            <span>{step.label}</span>
            <span className="sr-only">({t(STATE_KEY[step.state])})</span>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
