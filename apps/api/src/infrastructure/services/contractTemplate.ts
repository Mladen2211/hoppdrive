/**
 * Structured, editable-in-code rental contract terms.
 *
 * Placeholder content only — HoppDrive's legal team will supply the final
 * clause text to replace this. Kept as plain data (not a generic templating
 * engine) so the wording can be edited here without touching PdfService's
 * layout code, and so the same clauses can be reused verbatim in the
 * customer-facing contract preview (iPad signing flow).
 */

export interface ContractClause {
  id: string;
  heading: string;
  /** May contain `{{token}}` placeholders resolved via renderClause(). */
  body: string;
}

export const CONTRACT_CLAUSES: ContractClause[] = [
  {
    id: 'care',
    heading: 'Sorgfaltspflicht',
    body: 'Der Mieter verpflichtet sich, das Fahrzeug sorgfältig zu behandeln und in demselben Zustand zurückzugeben, wie es übernommen wurde.',
  },
  {
    id: 'accident',
    heading: 'Schäden und Unfälle',
    body: 'Bei Schäden, Unfällen oder Diebstahl ist {{companyName}} unverzüglich zu benachrichtigen. Bei Unfällen ist stets die Polizei beizuziehen.',
  },
  {
    id: 'driver',
    heading: 'Fahrberechtigung',
    body: 'Das Fahrzeug darf ausschliesslich vom Mieter oder einer im Vertrag namentlich genannten, bevollmächtigten Person gefahren werden.',
  },
  {
    id: 'deposit',
    heading: 'Kaution',
    body: 'Die vereinbarte Kaution wird nach Rückgabe und Überprüfung des Fahrzeugs auf Schäden, Vollständigkeit und Sauberkeit zurückerstattet.',
  },
  {
    id: 'insurance',
    heading: 'Versicherung und Haftung',
    body: 'Das Fahrzeug ist vollkaskoversichert. Der Mieter haftet im Schadensfall im Rahmen des vereinbarten Selbstbehalts sowie uneingeschränkt bei grober Fahrlässigkeit oder Vertragsverstoss.',
  },
  {
    id: 'fuel_mileage',
    heading: 'Kraftstoff und Kilometerstand',
    body: 'Das Fahrzeug ist mit demselben Kilometerstand und Tankfüllstand zurückzugeben, wie es übernommen wurde. Abweichungen werden dem Mieter in Rechnung gestellt.',
  },
  {
    id: 'cancellation',
    heading: 'Stornierung',
    body: 'Eine Stornierung ist bis 48 Stunden vor Mietbeginn kostenfrei möglich. Bei späterer Stornierung oder Nichtantritt kann eine Gebühr erhoben werden.',
  },
  {
    id: 'agb',
    heading: 'Allgemeine Geschäftsbedingungen',
    body: 'Es gelten ergänzend die Allgemeinen Geschäftsbedingungen (AGB) von {{companyName}}, welche diesem Vertrag als Anhang beigefügt sind und von beiden Parteien anerkannt werden.',
  },
  {
    id: 'jurisdiction',
    heading: 'Gerichtsstand',
    body: 'Gerichtsstand ist der Sitz der Vermieterin. Es gilt Schweizer Recht.',
  },
];

export function renderClause(body: string, data: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => data[key] ?? '');
}
