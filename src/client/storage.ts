import { parseConsentCookie, serialiseConsent } from '../consent/cookie.js'
import { createInitialState, withAnalytics } from '../consent/state.js'
import type { ConsentState } from '../consent/types.js'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export function readConsent(cookieName: string, version: number): ConsentState {
  const match = document.cookie
    .split(';')
    .map((pair) => pair.trim())
    .find((pair) => pair.startsWith(`${cookieName}=`))

  if (match === undefined) {
    return createInitialState(version)
  }

  return parseConsentCookie(match.slice(cookieName.length + 1), version)
}

export function writeConsent(cookieName: string, version: number, analytics: boolean): ConsentState {
  const state = withAnalytics(createInitialState(version), analytics)

  const parts = [
    `${cookieName}=${serialiseConsent(state)}`,
    'path=/',
    `max-age=${ONE_YEAR_SECONDS}`,
    'samesite=Lax'
  ]

  if (window.location.protocol === 'https:') {
    parts.push('secure')
  }

  document.cookie = parts.join('; ')

  return state
}
