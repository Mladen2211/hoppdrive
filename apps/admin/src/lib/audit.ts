/**
 * Turns an activity-log entry (GET /audit-logs) into a sentence for the dashboard, in the active
 * language (messages audit.*):
 *
 *   describeAudit(entry) -> { actor: 'Mladen R.', text: 'hat Anfrage von Laura Meier in Buchung umgewandelt' }
 *
 * Rendered as `<b>{actor}</b> {text}`. Returns null for entries that must stay hidden
 * (`sign_contract_persisted` is a technical duplicate of `sign_contract`).
 * `details` is the parsed JSON the API stores: customerName, vehicle, invoiceNumber,
 * changes[{field, from, to}], sectionKey, targetEmail, role, status, key ...
 *
 * Optional parts of a sentence are ICU `select`s on a value that is the text or 'none'.
 */
import { isAdminRole, type AuditLogEntryDto } from '@hoppdrive/shared';
import { tr } from '@/i18n/active';

export interface AuditSentence {
  actor: string;
  text: string;
}

type Details = Record<string, unknown>;

function detailsOf(entry: AuditLogEntryDto): Details {
  const raw = entry.details;
  if (raw && typeof raw === 'object') return raw as Details;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Details;
    } catch {
      /* plain text: no structured details */
    }
  }
  return {};
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Message audit.<key>; undefined values become 'none' for the `select` parts. */
function a(key: string, values: Record<string, string | number | undefined> = {}): string {
  const filled: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(values)) filled[name] = value ?? 'none';
  return tr(`audit.${key}`, filled);
}

/** "Mladen R." (first name + last initial), as on the design boards. */
export function actorName(admin: AuditLogEntryDto['admin'] | null | undefined): string {
  if (!admin) return tr('audit.unknown');
  const first = admin.firstName?.trim();
  const last = admin.lastName?.trim();
  if (first && last) return `${first} ${last.charAt(0).toUpperCase()}.`;
  if (first) return first;
  return admin.name?.trim() || admin.email || tr('audit.unknown');
}

const FIELD_KEYS = new Set([
  'brand', 'model', 'type', 'year', 'basePricePerDay', 'description', 'isAvailable',
  'horsepower', 'transmission', 'seats', 'fuelType', 'range',
]);
const SETTING_KEYS = new Set([
  'pricing', 'features', 'location', 'seo', 'invoice_settings', 'company', 'notifications', 'maintenance_mode', 'currency', 'contract',
]);
const DRIVER_FIELDS = new Set([
  'customerPhone', 'driverStreet', 'driverZip', 'driverCity', 'driverCountry', 'driverBirthDate', 'driverLicenseNumber', 'driverLicenseCountry',
]);
const SECTION_KEYS = new Set(['hero', 'why_hoppdrive', 'how_it_works', 'fleet', 'pricing', 'social_proof', 'faq', 'contact', 'map']);
const CONTACT_STATUSES = new Set(['pending', 'reviewed', 'responded', 'converted', 'denied', 'archived']);

function vehicleUpdate(details: Details): string {
  const vehicle = str(details.vehicle);
  const changes = Array.isArray(details.changes) ? (details.changes as { field?: string }[]) : [];
  const fields = changes.map((c) => c.field).filter((f): f is string => typeof f === 'string');
  if (fields.length === 1 && fields[0] === 'basePricePerDay') return a('vehicle.priceChanged', { vehicle });
  if (fields.length === 1 && FIELD_KEYS.has(fields[0])) {
    return a('vehicle.fieldChanged', { vehicle, field: tr(`audit.fields.${fields[0]}`) });
  }
  if (fields.length > 1) {
    const names = fields.filter((f) => FIELD_KEYS.has(f)).map((f) => tr(`audit.fieldNames.${f}`));
    const list = names.slice(0, 3).join(', ') + (names.length > 3 ? tr('audit.andOthers') : '');
    return vehicle ? a('vehicle.editedFields', { vehicle, list }) : a('vehicle.edited', { vehicle });
  }
  return a('vehicle.edited', { vehicle });
}

function sentence(entry: AuditLogEntryDto, d: Details): string {
  const { resource, action } = entry;
  const vehicle = str(d.vehicle);
  const customer = str(d.customerName);

  switch (resource) {
    case 'contact-request': {
      if (action === 'approve') return a('contact.approve', { customer });
      if (action === 'deny') return a('contact.deny', { customer });
      if (action === 'update-status') {
        const status = str(d.status) ?? '';
        return CONTACT_STATUSES.has(status) ? a(`contact.status.${status}`, { customer }) : a('contact.update', { customer });
      }
      break;
    }
    case 'booking': {
      if (action === 'create') return a('booking.create', { customer, vehicle });
      if (action === 'sign_contract') return a('booking.sign', { customer });
      if (action === 'send_contract_package') return a('booking.contractPackage', { customer });
      if (action === 'update') {
        const fields = Array.isArray(d.fields) ? (d.fields as unknown[]).filter((f): f is string => typeof f === 'string') : [];
        if (fields.includes('startDate') || fields.includes('endDate')) return a('booking.times', { customer });
        if (fields.some((f) => DRIVER_FIELDS.has(f))) return a('booking.driverData', { customer });
        return a('booking.update', { customer });
      }
      if (action === 'update-status') {
        const status = str(d.status);
        if (status === 'active') return a('booking.pickedUp', { customer });
        if (status === 'completed') return a('booking.returned', { customer });
        if (status === 'cancelled') return a('booking.cancelled', { customer });
        return a('booking.update', { customer });
      }
      break;
    }
    case 'invoice': {
      const number = str(d.invoiceNumber);
      if (action === 'create') {
        const kind = str(d.type);
        if (kind === 'DAMAGE' || kind === 'FINE' || kind === 'OTHER') return a('invoice.createKind', { number, kind: tr(`audit.invoiceKinds.${kind}`) });
        return a('invoice.create', { number });
      }
      if (action === 'update-status') return a('invoice.updateStatus', { number, customer });
      if (action === 'reissue') {
        const parent = str(d.parentInvoiceNumber);
        const sent = d.emailed === true || d.sendEmail === true;
        return a(sent ? 'invoice.reminderSent' : 'invoice.reminderCreated', { parent });
      }
      break;
    }
    case 'vehicle': {
      if (action === 'create') return a('vehicle.create', { vehicle });
      if (action === 'update') return vehicleUpdate(d);
      if (action === 'delete') return a('vehicle.delete', { vehicle });
      if (action === 'upload-image') return a('vehicle.uploadImage', { vehicle });
      if (action === 'delete-image') return a('vehicle.deleteImage', { vehicle });
      if (action === 'set-primary-image') return a('vehicle.setPrimaryImage', { vehicle });
      if (action === 'reorder-images') return a('vehicle.reorderImages', { vehicle });
      break;
    }
    case 'maintenance': {
      if (action === 'create') return a('maintenance.create', { vehicle });
      if (action === 'delete') return a('maintenance.delete', { vehicle });
      break;
    }
    case 'pricing-rule': {
      if (action === 'create' || action === 'update' || action === 'delete') return a(`pricingRule.${action}`);
      break;
    }
    case 'location': {
      const name = str(d.name) ?? str(d.location);
      if (action === 'create' || action === 'update' || action === 'delete') return a(`location.${action}`, { name });
      break;
    }
    case 'faq': {
      if (action === 'create' || action === 'update' || action === 'delete') return a(`faq.${action}`);
      break;
    }
    case 'testimonial': {
      if (action === 'create' || action === 'update' || action === 'delete') return a(`testimonial.${action}`);
      break;
    }
    case 'homepage-section': {
      const key = str(d.sectionKey);
      const label = key ? (SECTION_KEYS.has(key) ? tr(`audit.sections.${key}`) : key) : undefined;
      if (action === 'toggle') return a('homepage.toggle', { label });
      if (action === 'update') return a('homepage.update', { label });
      break;
    }
    case 'setting': {
      const key = str(d.key);
      const label = key ? (SETTING_KEYS.has(key) ? tr(`audit.settingNames.${key}`) : key) : undefined;
      if (key === 'maintenance_mode' && typeof d.enabled === 'boolean') {
        return a(d.enabled ? 'setting.maintenanceOn' : 'setting.maintenanceOff');
      }
      if (key === 'currency') return a('setting.currency', { currency: str(d.currency) });
      if (d.translationsChanged === true) return a('setting.translations', { label });
      return a('setting.changed', { label });
    }
    case 'email': {
      const to = str(d.to);
      if (action === 'resend') return a('email.resend', { to });
      if (action === 'test') return a('email.test', { to });
      break;
    }
    case 'discount-code': {
      const code = str(d.code);
      if (action === 'create') return a('discount.create', { code });
      if (action === 'delete') return a('discount.delete', { code });
      if (action === 'update') {
        if (typeof d.active === 'boolean') return a(d.active ? 'discount.activate' : 'discount.deactivate', { code });
        return a('discount.update', { code });
      }
      break;
    }
    case 'marketing-campaign': {
      if (action === 'create') {
        const subject = str(d.subject);
        const count = typeof d.recipientCount === 'number' ? d.recipientCount : undefined;
        return count === undefined ? a('campaign.create', { subject }) : tr('audit.campaign.createCount', { subject: subject ?? 'none', count });
      }
      break;
    }
    case 'vehicle-damage': {
      const keys: Record<string, string> = {
        create: 'create',
        update: 'update',
        repair: 'repair',
        delete: 'delete',
        'upload-photo': 'uploadPhoto',
        'delete-photo': 'deletePhoto',
      };
      if (keys[action]) return a(`damage.${keys[action]}`, { vehicle });
      break;
    }
    case 'inspection': {
      if (action === 'create') return a(str(d.inspectionType) === 'RETURN' ? 'inspection.return' : 'inspection.pickup', { customer, vehicle });
      break;
    }
    case 'fee': {
      const fee = str(d.fee);
      if (action === 'create' || action === 'update' || action === 'delete') return a(`fee.${action}`, { fee });
      break;
    }
    case 'contract-template': {
      const template = str(d.template) ?? str(d.newName);
      if (action === 'upload' || action === 'activate' || action === 'deactivate' || action === 'rename' || action === 'delete') {
        return a(`template.${action}`, { template });
      }
      break;
    }
    case 'legal-document': {
      if (action === 'upload-agb') return a('legal.uploadAgb');
      if (action === 'reset-agb') return a('legal.resetAgb');
      break;
    }
    case 'fine': {
      const fine = str(d.fine);
      const keys: Record<string, string> = {
        create: 'create',
        update: 'update',
        delete: 'delete',
        assign: 'assign',
        'driver-export': 'driverExport',
        notify: 'notify',
        invoice: 'invoice',
        'upload-document': 'uploadDocument',
        'delete-document': 'deleteDocument',
      };
      if (keys[action]) return a(`fine.${keys[action]}`, { fine, customer });
      break;
    }
    case 'admin': {
      const email = str(d.targetEmail) ?? str(d.email);
      const role = isAdminRole(d.role) ? tr(`roles.${d.role}`) : str(d.role);
      if (action === 'invite') return a('admin.invite', { email, role });
      if (action === 'change_role') return a('admin.changeRole', { email, role });
      if (action === 'delete') return a('admin.delete', { email });
      break;
    }
    case 'auth': {
      if (
        action === 'login' || action === 'account_locked' || action === 'reset_password' ||
        action === 'reset_password_via_token' || action === 'accept_invite' || action === 'update_profile' ||
        action === 'update_signature' || action === 'update_preferences'
      ) {
        return a(`auth.${action}`);
      }
      break;
    }
    default:
      break;
  }
  return a('fallback');
}

/** The sentence for one entry, or null when the entry must not be shown. */
export function describeAudit(entry: AuditLogEntryDto): AuditSentence | null {
  if (entry.action === 'sign_contract_persisted') return null;
  return { actor: actorName(entry.admin), text: sentence(entry, detailsOf(entry)) };
}
