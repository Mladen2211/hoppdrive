/**
 * Company contact data for the public site, resolved from the admin-managed
 * sources:
 *  - `GET /locations/public` (first active location: address, phone, e-mail, opening hours)
 *  - the `company` setting ({ name, phone, inquiryEmail })
 *  - the existing `location` setting (address string + map coordinates)
 * Rows without data are `null` so the UI can hide them. Client-safe (no server imports).
 */

export const DEFAULT_CONTACT_EMAIL = 'info@hoppdrive.ch';

export interface CompanySetting {
  name?: string;
  phone?: string;
  inquiryEmail?: string;
}

export interface PublicLocation {
  id: string;
  name: string;
  address: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  openingHours: string | null;
}

export interface LocationSetting {
  visible?: boolean;
  title?: string;
  address?: string;
  lat?: number;
  lng?: number;
  zoom?: number;
}

export interface ContactInfo {
  /** "Bahnhofstrasse 1, 8001 Zürich" */
  address: string | null;
  /** Destination for the "Route planen" link. */
  routeAddress: string | null;
  /** Free text, may contain line breaks. */
  hours: string | null;
  email: string;
  phone: string | null;
}

const clean = (value: string | null | undefined): string | null => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text : null;
};

export function resolveContactInfo(input: {
  company?: CompanySetting | null;
  location?: PublicLocation | null;
  locationSetting?: LocationSetting | null;
}): ContactInfo {
  const { company, location, locationSetting } = input;

  const zipCity = [clean(location?.zip), clean(location?.city)].filter(Boolean).join(' ');
  const composed = [clean(location?.address), zipCity || null].filter(Boolean).join(', ') || null;
  const settingAddress = clean(locationSetting?.address);

  return {
    address: composed ?? settingAddress,
    routeAddress: settingAddress ?? composed,
    hours: clean(location?.openingHours),
    email: clean(location?.email) ?? DEFAULT_CONTACT_EMAIL,
    phone: clean(location?.phone) ?? clean(company?.phone),
  };
}

/** `tel:` link target: keeps digits and a leading plus. */
export function phoneHref(phone: string): string {
  const compact = phone.replace(/[^\d+]/g, '');
  return `tel:${compact}`;
}
