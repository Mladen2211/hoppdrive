import type { AdminLocale, AdminRole, AdminTheme } from '@hoppdrive/shared';
import type { Admin } from '../../../domain';

/** Admin shape returned by login, accept-invite and token reset (and stored by the admin UI). */
export interface AdminSessionDto {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  mustResetPassword: boolean;
  role: AdminRole;
  locale: AdminLocale;
  theme: AdminTheme;
}

export interface AuthSessionResult {
  accessToken: string;
  refreshToken: string;
  admin: AdminSessionDto;
}

export function toAdminSessionDto(admin: Admin): AdminSessionDto {
  return {
    id: admin.id,
    email: admin.email.value,
    name: admin.name,
    firstName: admin.firstName,
    lastName: admin.lastName,
    phone: admin.phone,
    mustResetPassword: admin.mustResetPassword,
    role: admin.role,
    locale: admin.locale,
    theme: admin.theme,
  };
}
