/**
 * Driver / renter details of a booking (for the contract and requests from the authorities):
 * Telefon, Adresse, Geburtsdatum, Führerausweis. The form keeps everything as strings; the API takes
 * `null` / '' to clear a field on update and ignores empty values on create.
 */
import type { DriverDetails } from '@hoppdrive/shared';
import { toInputDate } from '@/lib/format';
import { tr } from '@/i18n/active';

export interface DriverForm {
  phone: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  /** YYYY-MM-DD */
  birthDate: string;
  licenseNumber: string;
  licenseCountry: string;
}

export type DriverField = keyof DriverForm;
export type DriverErrors = Partial<Record<DriverField, string>>;

export const DEFAULT_DRIVER_COUNTRY = 'CH';

export const emptyDriver = (): DriverForm => ({
  phone: '',
  street: '',
  zip: '',
  city: '',
  country: DEFAULT_DRIVER_COUNTRY,
  birthDate: '',
  licenseNumber: '',
  licenseCountry: '',
});

export function driverFromBooking(b: DriverDetails | null | undefined): DriverForm {
  return {
    phone: b?.customerPhone ?? '',
    street: b?.driverStreet ?? '',
    zip: b?.driverZip ?? '',
    city: b?.driverCity ?? '',
    country: b?.driverCountry ?? '',
    birthDate: b?.driverBirthDate ?? '',
    licenseNumber: b?.driverLicenseNumber ?? '',
    licenseCountry: b?.driverLicenseCountry ?? '',
  };
}

/** Any detail filled in (the default country alone does not count). */
export function hasDriverData(form: DriverForm): boolean {
  return Object.entries(form).some(([key, value]) => String(value).trim() !== '' && !(key === 'country' && value === DEFAULT_DRIVER_COUNTRY));
}

/** Create: only filled fields (an unset country defaults to CH on the form already). */
export function driverCreatePayload(form: DriverForm): DriverDetails {
  const pick = (value: string) => (value.trim() ? value.trim() : undefined);
  return {
    customerPhone: pick(form.phone),
    driverStreet: pick(form.street),
    driverZip: pick(form.zip),
    driverCity: pick(form.city),
    driverCountry: pick(form.country),
    driverBirthDate: pick(form.birthDate),
    driverLicenseNumber: pick(form.licenseNumber),
    driverLicenseCountry: pick(form.licenseCountry),
  };
}

/** Update: every field is sent, '' becomes null (= clear). */
export function driverUpdatePayload(form: DriverForm): DriverDetails {
  const val = (value: string) => (value.trim() ? value.trim() : null);
  return {
    customerPhone: val(form.phone),
    driverStreet: val(form.street),
    driverZip: val(form.zip),
    driverCity: val(form.city),
    driverCountry: val(form.country),
    driverBirthDate: val(form.birthDate),
    driverLicenseNumber: val(form.licenseNumber),
    driverLicenseCountry: val(form.licenseCountry),
  };
}

export function driverEquals(a: DriverForm, b: DriverForm): boolean {
  return (Object.keys(a) as DriverField[]).every((key) => a[key].trim() === b[key].trim());
}

/** Field messages for the driver block. */
export function validateDriver(form: DriverForm): DriverErrors {
  const errors: DriverErrors = {};
  if (form.birthDate) {
    const year = Number(form.birthDate.slice(0, 4));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate) || Number.isNaN(Date.parse(form.birthDate))) errors.birthDate = tr('driver.birthDateInvalid');
    else if (year < 1900 || form.birthDate > toInputDate(new Date())) errors.birthDate = tr('driver.birthDateRange');
  }
  const limits: [DriverField, number][] = [
    ['phone', 40],
    ['street', 120],
    ['zip', 20],
    ['city', 80],
    ['country', 60],
    ['licenseNumber', 40],
    ['licenseCountry', 60],
  ];
  for (const [field, max] of limits) {
    if (form[field].trim().length > max) errors[field] = tr('driver.tooLong', { max });
  }
  return errors;
}

/** Maps the 422 `details` keys of the booking endpoints to the driver form fields. */
export function driverErrorsFromApi(details: Record<string, string[]> | undefined): DriverErrors {
  const out: DriverErrors = {};
  if (!details) return out;
  const map: Record<string, DriverField> = {
    customerPhone: 'phone',
    driverStreet: 'street',
    driverZip: 'zip',
    driverCity: 'city',
    driverCountry: 'country',
    driverBirthDate: 'birthDate',
    driverLicenseNumber: 'licenseNumber',
    driverLicenseCountry: 'licenseCountry',
  };
  for (const key of Object.keys(details)) {
    const field = map[key];
    if (field) out[field] = field === 'birthDate' ? tr('driver.birthDateInvalid') : tr('driver.checkField');
  }
  return out;
}

/** One line of the address: "Musterstrasse 1, 8000 Zürich, CH". */
export function driverAddressLine(b: DriverDetails | null | undefined): string {
  if (!b) return '';
  const city = [b.driverZip, b.driverCity].filter(Boolean).join(' ');
  return [b.driverStreet, city, b.driverCountry].filter((part) => part && String(part).trim()).join(', ');
}
