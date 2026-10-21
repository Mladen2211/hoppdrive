/**
 * Error plumbing for the content pages (Homepage, Bewertungen, FAQ, Standorte, Einstellungen).
 */
import { errorText } from '@/lib/errors';

/**
 * Awaits an API promise and rethrows failures as a plain Error with the German user text.
 * Use it inside `confirm({ onConfirm })`, whose dialog shows `error.message` when the action fails:
 *
 *   await confirm({ title: '...', onConfirm: () => orUserError(api.deleteFaqItem(id)) });
 */
export async function orUserError<T>(promise: Promise<T>, fallback?: string): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    throw new Error(errorText(err, fallback));
  }
}
