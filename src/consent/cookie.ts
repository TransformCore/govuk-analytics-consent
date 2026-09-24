import { createInitialState } from './state.js'
import type { ConsentState } from './types.js'

export function serialiseConsent(state: ConsentState): string {
  return encodeURIComponent(JSON.stringify(state))
}

/** Never throws: any malformed or out-of-date cookie degrades to "no choice made". */
export function parseConsentCookie(
  value: string | null | undefined,
  expectedVersion: number
): ConsentState {
  const initial = createInitialState(expectedVersion)

  if (typeof value !== 'string' || value === '') {
    return initial
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(decodeURIComponent(value))
  } catch {
    return initial
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return initial
  }

  const candidate = parsed as Partial<ConsentState>

  if (candidate.version !== expectedVersion) {
    return initial
  }

  const analytics = candidate.analytics === true ? true : candidate.analytics === false ? false : null

  return {
    version: expectedVersion,
    analytics,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : initial.updatedAt
  }
}

export function parseCookieHeader(header: string | null | undefined): Record<string, string> {
  const cookies: Record<string, string> = {}

  if (typeof header !== 'string' || header === '') {
    return cookies
  }

  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=')

    if (separator < 1) {
      continue
    }

    const name = pair.slice(0, separator).trim()

    if (name !== '' && !(name in cookies)) {
      cookies[name] = pair.slice(separator + 1).trim()
    }
  }

  return cookies
}

export function readConsentFromHeader(
  header: string | null | undefined,
  cookieName: string,
  expectedVersion: number
): ConsentState {
  return parseConsentCookie(parseCookieHeader(header)[cookieName], expectedVersion)
}
