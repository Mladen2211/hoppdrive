import { fmtDateTime } from '../../format';
import { build, detailBox, p, signOff, type RenderedEmail, type TemplateContext } from './layout';

export interface TestEmailData {
  sentBy?: string | null;
  provider: string;
}

/** Test mail from the admin e-mail settings. */
export function testEmail(data: TestEmailData, ctx: TemplateContext): RenderedEmail {
  const body = [
    p('Dies ist eine Test-E-Mail aus dem HoppDrive Verwaltungsbereich. Wenn Sie diese Nachricht lesen, funktioniert der E-Mail-Versand.'),
    detailBox([
      ['Versanddienst', data.provider],
      ['Gesendet von', data.sentBy],
      ['Zeitpunkt', fmtDateTime(new Date())],
    ]),
    signOff(),
  ].join('\n');
  return build(ctx, 'Test-E-Mail – HoppDrive', { preheader: 'Der E-Mail-Versand funktioniert.', body });
}
