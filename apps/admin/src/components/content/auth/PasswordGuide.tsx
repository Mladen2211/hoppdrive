'use client';

/**
 * Live feedback for a new password: 4-segment strength meter + label and the rule checklist
 * (rules and labels come from @hoppdrive/shared, the same module the API validates with).
 *
 *   <PasswordGuide password={pw} />                       // reset / invite: "different" is server-side only
 *   <PasswordGuide password={pw} current={currentPw} />   // profile: the old password is known, check it here
 *   <PasswordGuide password={pw} differentRejected />     // API answered 422 "identical to the old password"
 *
 * The rule "Nicht identisch mit dem alten Passwort" can only be verified by the server when the
 * old password is not typed in (forced reset, reset link). It is shown as a neutral item and turns
 * red when the server rejects the password for that reason.
 */
import { Check, X } from 'lucide-react';
import {
  PASSWORD_MIN_LENGTH,
  evaluatePassword,
  passwordStrength,
  type PasswordRuleId,
} from '@hoppdrive/shared';
import { cn } from '@/components/ui';
import { useTranslations } from 'next-intl';
import { tr } from '@/i18n/active';

type RuleState = 'ok' | 'open' | 'bad' | 'neutral';

const STATE_WORD: Record<RuleState, string> = {
  get ok() { return tr('content.erfuellt'); },
  get open() { return tr('content.nochOffen'); },
  get bad() { return tr('content.nichtErfuellt'); },
  get neutral() { return tr('content.wirdBeimSpeichernGeprueft'); },
};

const SEGMENT_TONE = ['', 'bg-err', 'bg-warn', 'bg-ok', 'bg-ok'] as const;

function meterCopy(score: number, sharedLabel: string): { label: string; text: string } {
  switch (score) {
    case 1:
      return { label: sharedLabel === 'Zu kurz' ? tr('content.zuKurz') : tr('content.schwach'), text: tr('content.bitteErfuellenSieAlle') };
    case 2:
      return { label: tr('content.mittel'), text: tr('content.eineLaengereWortfolgeIst') };
    case 3:
      return { label: tr('content.gut'), text: tr('content.eineLaengereWortfolgeIst2') };
    case 4:
      return { label: tr('content.stark'), text: tr('content.sehrSicher') };
    default:
      return { label: '', text: tr('content.waehlenSieEinPasswort') };
  }
}

/** Localized text of a password rule (the shared package only carries the German labels). */
export function ruleLabel(id: PasswordRuleId): string {
  return id === 'length' ? tr('password.rules.length', { min: PASSWORD_MIN_LENGTH }) : tr(`password.rules.${id}`);
}

export interface PasswordGuideProps {
  password: string;
  /** Old password when it is known (profile page); enables the client-side "different" check. */
  current?: string | null;
  /** The API rejected the password as identical to the old one. */
  differentRejected?: boolean;
  /** New accounts (invite) have no old password: leave the "different" rule out. */
  hideDifferent?: boolean;
  className?: string;
}

export function PasswordGuide({ password, current, differentRejected = false, hideDifferent = false, className }: PasswordGuideProps) {
  const t = useTranslations();
  const evaluation = evaluatePassword(password, current);
  const strength = passwordStrength(password);
  const copy = meterCopy(strength.score, strength.label);
  const typed = password.length > 0;

  const rules: { id: PasswordRuleId; label: string; state: RuleState }[] = (['length', 'case', 'digit'] as const).map((id) => {
    const passed = evaluation.rules.find((r) => r.id === id)?.passed ?? false;
    return { id, label: ruleLabel(id), state: passed ? 'ok' : 'open' };
  });

  const differentRule = evaluation.rules.find((r) => r.id === 'different');
  if (!hideDifferent) {
    rules.push({
      id: 'different',
      label: ruleLabel('different'),
      state: differentRejected ? 'bad' : differentRule ? (differentRule.passed ? 'ok' : 'bad') : 'neutral',
    });
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div>
        <div
          className="grid grid-cols-4 gap-1"
          role="img"
          aria-label={typed && copy.label ? t('content.passwortstaerke', { label: copy.label }) : t('content.passwortstaerkeNochKeinPasswor')}
        >
          {[1, 2, 3, 4].map((segment) => (
            <span
              key={segment}
              className={cn('h-1.5 rounded-[3px] bg-line', typed && segment <= strength.score && SEGMENT_TONE[strength.score])}
            />
          ))}
        </div>
        <p className="sm mt-1.5" aria-live="polite">
          {typed && copy.label ? <b>{copy.label}. </b> : null}
          {copy.text}
        </p>
      </div>

      <ul className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label={t('content.anforderungenAnDasPasswort')}>
        {rules.map((rule) => (
          <li key={rule.id} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className={cn(
                'inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-2 text-on-fill',
                rule.state === 'ok' && 'border-ok bg-ok',
                rule.state === 'bad' && 'border-err bg-err',
                (rule.state === 'open' || rule.state === 'neutral') && 'border-line',
              )}
            >
              {rule.state === 'ok' && <Check size={11} strokeWidth={3.5} />}
              {rule.state === 'bad' && <X size={11} strokeWidth={3.5} />}
            </span>
            <span className={cn(rule.state === 'bad' && 'font-medium text-err')}>{rule.label}</span>
            <span className="sr-only">({STATE_WORD[rule.state]})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
