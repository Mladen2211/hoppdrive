/**
 * Error codes of the contract / inspection endpoints, including the ones that arrive inside a Blob:
 * routes that return a PDF are requested with responseType 'blob', so the JSON error body of a failure
 * (e.g. 422 company_signature_missing) is a Blob that has to be read before it can be inspected.
 */
import { ApiError } from '@/lib/api';

/** The API error code of a failed request ('company_signature_missing', 'no_recipient' ...), if there is one. */
export async function apiErrorCode(err: unknown): Promise<string | undefined> {
  if (!(err instanceof ApiError)) return undefined;
  if (err.code) return err.code;
  const data = err.data as unknown;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const body = JSON.parse(await data.text()) as { code?: string };
      return body.code;
    } catch {
      return undefined;
    }
  }
  return (data as { code?: string } | undefined)?.code;
}

/** The finalize / draft endpoints refuse to run while the company signer has no stored signature. */
export async function isCompanySignatureMissing(err: unknown): Promise<boolean> {
  return (await apiErrorCode(err)) === 'company_signature_missing';
}
