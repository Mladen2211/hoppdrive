// ─── Password rules ──────────────────────────────────────────────
//
// Shared by the API (reset, profile change, accept-invite, token reset) and the
// admin UI (rule checklist + strength meter), so both always agree.
// "Different from the current password" cannot be checked client-side without
// the hash; the API checks it with bcrypt and answers 422 with the same label.

export const PASSWORD_MIN_LENGTH = 12;

export type PasswordRuleId = 'length' | 'case' | 'digit' | 'different';

export interface PasswordRuleResult {
  id: PasswordRuleId;
  label: string;
  passed: boolean;
}

export const PASSWORD_RULE_LABELS: Record<PasswordRuleId, string> = {
  length: `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`,
  case: 'Gross- und Kleinbuchstaben',
  digit: 'Mindestens eine Zahl',
  different: 'Nicht identisch mit dem alten Passwort',
};

export interface PasswordEvaluation {
  valid: boolean;
  rules: PasswordRuleResult[];
  /** Labels of the rules that failed (ready to show as field errors). */
  errors: string[];
}

/**
 * Evaluate a password against the rules.
 * @param current Optional current/old password (plaintext). When given, the
 *                "different" rule is included and fails if the new one is identical.
 */
export function evaluatePassword(password: string, current?: string | null): PasswordEvaluation {
  const pw = typeof password === 'string' ? password : '';
  const rules: PasswordRuleResult[] = [
    { id: 'length', label: PASSWORD_RULE_LABELS.length, passed: pw.length >= PASSWORD_MIN_LENGTH },
    { id: 'case', label: PASSWORD_RULE_LABELS.case, passed: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { id: 'digit', label: PASSWORD_RULE_LABELS.digit, passed: /[0-9]/.test(pw) },
  ];
  if (current !== undefined && current !== null && current !== '') {
    rules.push({
      id: 'different',
      label: PASSWORD_RULE_LABELS.different,
      passed: pw.length > 0 && pw !== current,
    });
  }
  const errors = rules.filter((r) => !r.passed).map((r) => r.label);
  return { valid: errors.length === 0, rules, errors };
}

/** Convenience: true when the password satisfies every static rule. */
export function isValidPassword(password: string, current?: string | null): boolean {
  return evaluatePassword(password, current).valid;
}

export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrength {
  /** 0 = empty, 1..4 = number of filled segments in the 4-segment meter. */
  score: PasswordStrengthScore;
  label: 'Zu kurz' | 'Schwach' | 'Mittel' | 'Gut' | 'Sehr gut';
  hint: string;
}

/**
 * Simple heuristic for the 4-segment strength meter.
 * Not a security control (the rules above are); it only guides the user.
 */
export function passwordStrength(password: string): PasswordStrength {
  const pw = typeof password === 'string' ? password : '';
  if (pw.length === 0) return { score: 0, label: 'Zu kurz', hint: '' };

  const meetsRules = evaluatePassword(pw).valid;
  const classes =
    Number(/[a-z]/.test(pw)) +
    Number(/[A-Z]/.test(pw)) +
    Number(/[0-9]/.test(pw)) +
    Number(/[^A-Za-z0-9]/.test(pw));

  if (!meetsRules) {
    return {
      score: 1,
      label: pw.length < PASSWORD_MIN_LENGTH ? 'Zu kurz' : 'Schwach',
      hint: 'Bitte erfüllen Sie alle Regeln.',
    };
  }
  if (pw.length >= 20 && classes >= 3) {
    return { score: 4, label: 'Sehr gut', hint: 'Sehr sicher.' };
  }
  if (pw.length >= 16 || classes >= 4) {
    return { score: 3, label: 'Gut', hint: 'Gut. Eine längere Wortfolge ist noch sicherer.' };
  }
  return { score: 2, label: 'Mittel', hint: 'Mittel. Eine längere Wortfolge ist sicherer.' };
}
