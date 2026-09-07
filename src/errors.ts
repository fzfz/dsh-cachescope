export const errors = {
  FORBIDDEN: { status: 403, key: 'errorForbidden', message: 'Open CacheScope from the sidebar of the DSH Desktop instance serving this request.' },
  METHOD_NOT_ALLOWED: { status: 405, key: 'errorMethod', message: 'CacheScope only accepts GET and HEAD queries.' },
  INVALID_ATTEMPT: { status: 400, key: 'errorAttempt', message: 'The requested call identifier is invalid.' },
  ATTEMPT_NOT_FOUND: { status: 404, key: 'errorExpired', message: 'This call is no longer retained. Select another call.' },
} as const
export type ErrorCode = keyof typeof errors
