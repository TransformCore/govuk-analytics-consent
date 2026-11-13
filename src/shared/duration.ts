const MINUTE = 60
const HOUR = MINUTE * 60
const DAY = HOUR * 24
const MONTH = DAY * 30
const YEAR = DAY * 365

import type { CookieExpiry, CookieExpiryUnit } from '../consent/types.js'

const UNITS: Array<[number, CookieExpiryUnit]> = [
  [YEAR, 'year'],
  [MONTH, 'month'],
  [DAY, 'day'],
  [HOUR, 'hour'],
  [MINUTE, 'minute']
]

const EXPIRY_UNITS: readonly string[] = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year']

export function formatCookieExpiry(expiry: CookieExpiry, language: string, session: string): string {
  if (typeof expiry !== 'object' || expiry === null || Array.isArray(expiry)) {
    throw new Error(`Invalid cookie expiry: ${JSON.stringify(expiry)}`)
  }
  if (expiry.value === 'session') {
    if ('unit' in expiry) throw new Error(`Invalid cookie expiry: ${JSON.stringify(expiry)}`)
    return session
  }
  if (!Number.isSafeInteger(expiry.value) || expiry.value <= 0 || !EXPIRY_UNITS.includes(expiry.unit)) {
    throw new Error(`Invalid cookie expiry: ${JSON.stringify(expiry)}`)
  }
  return new Intl.NumberFormat(language.split('-')[0], {
    style: 'unit', unit: expiry.unit, unitDisplay: 'long', useGrouping: false
  }).format(expiry.value)
}

/** Renders a cookie max-age as a human-readable expiry, e.g. `31536000` -> "1 year". */
export function formatDuration(seconds: number, language = 'en', session = 'Session'): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return session
  }

  for (const [unitSeconds, label] of UNITS) {
    if (seconds >= unitSeconds) {
      const count = Math.round(seconds / unitSeconds)

      return formatCookieExpiry({ value: count, unit: label }, language, session)
    }
  }

  const count = Math.round(seconds)

  if (count === 0) {
    return new Intl.NumberFormat(language.split('-')[0], {
      style: 'unit', unit: 'second', unitDisplay: 'long', useGrouping: false
    }).format(count)
  }
  return formatCookieExpiry({ value: count, unit: 'second' }, language, session)
}
