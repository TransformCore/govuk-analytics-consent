/**
 * Accepts only same-origin relative paths. Anything else (absolute URLs,
 * protocol-relative `//host`, backslash variants, `javascript:`) is rejected so a
 * caller-supplied value can never become an open redirect or a dangerous link.
 */
export function safeInternalPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()

  if (!trimmed.startsWith('/')) {
    return fallback
  }

  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return fallback
  }

  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    return fallback
  }

  return trimmed
}

export function normaliseRoutePrefix(value: string): string {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, '')

  if (withoutTrailingSlash === '' || withoutTrailingSlash.startsWith('//')) {
    throw new Error(`Invalid routePrefix: "${value}"`)
  }

  return withoutTrailingSlash
}

/** Reads a single query parameter from a path+query string, e.g. `/start?a=1`. */
export function readQueryParam(path: string, key: string): string | null {
  const queryIndex = path.indexOf('?')

  if (queryIndex === -1) {
    return null
  }

  return new URLSearchParams(path.slice(queryIndex)).get(key)
}

/** Appends a query parameter to an already-validated same-origin path. */
export function appendQueryParam(path: string, key: string, value: string): string {
  const hashIndex = path.indexOf('#')
  const withoutHash = hashIndex === -1 ? path : path.slice(0, hashIndex)
  const suffix = hashIndex === -1 ? '' : path.slice(hashIndex)
  const separator = withoutHash.includes('?') ? '&' : '?'

  return `${withoutHash}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}${suffix}`
}
