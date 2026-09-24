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
