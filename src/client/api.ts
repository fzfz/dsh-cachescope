import { errors, type ErrorCode } from '../errors.ts'
import type { TextKey } from './locales.ts'
export class QueryError extends Error {
  constructor(readonly key: TextKey) { super(key) }
}
export async function query<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) {
    const body = await response.json() as { error?: { code?: string } }
    const code = body.error?.code
    if (code && Object.hasOwn(errors, code)) throw new QueryError(errors[code as ErrorCode].key)
    throw new QueryError('fetchFailed')
  }
  return response.json() as Promise<T>
}
