import { getLocale } from 'next-intl/server';
import { NavbarClient } from '@/components/layout/NavbarClient';
import { getCompany, getPrimaryLocation } from '@/lib/server-api';
import { resolveContactInfo } from '@/lib/site';

/**
 * Site header. A server component so it can hand the contact data (e-mail,
 * phone from the `company` setting / active location) to the interactive
 * client part; fetches are cached (revalidate 120 s) and de-duplicated.
 */
export async function Navbar() {
  const locale = await getLocale();
  const [company, location] = await Promise.all([getCompany(locale), getPrimaryLocation()]);
  const contact = resolveContactInfo({ company, location });
  return <NavbarClient email={contact.email} phone={contact.phone} />;
}
