/**
 * Accepts only same-origin relative paths. Anything else (absolute URLs,
 * protocol-relative `//host`, backslash variants, encoded path separators,
 * or control characters) is rejected so a caller-supplied value can never
 * become an open redirect or a dangerous link.
 */
export function safeInternalPath(
  value: unknown,
  fallback = '/',
): string {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return fallback
  }

  let decoded: string

  try {
    decoded = decodeURIComponent(trimmed)
  } catch {
    return fallback
  }

  if (/%[0-9a-f]{2}/i.test(decoded)) {
    return fallback
  }

  if (!decoded.startsWith('/')) {
    return fallback
  }

  if (
    decoded.startsWith('//') ||
    decoded.startsWith('/\\') ||
    decoded.includes('\\')
  ) {
    return fallback
  }

  if (/[\x00-\x1f\x7f]/.test(decoded)) {
    return fallback
  }

  const url = new URL(decoded, 'https://internal.local')

  return url.pathname + url.search + url.hash
}

export function normaliseRoutePrefix(value: string): string {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  let withoutTrailingSlash = withLeadingSlash

  while (withoutTrailingSlash.length > 0 && withoutTrailingSlash.endsWith('/')) {
    withoutTrailingSlash = withoutTrailingSlash.slice(0, -1)
  }

  if (
    withoutTrailingSlash === '' ||
    withoutTrailingSlash.startsWith('//') ||
    withoutTrailingSlash.includes('\\')
  ) {
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
