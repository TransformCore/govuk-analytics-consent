import { formatDuration } from '../shared/duration.js'
import { defaultMessages } from './messages.js'
import type { ConsentMessages, CookieDefinition, CookieDefinitionFactory } from './types.js'

export interface DefaultCookieContext {
  cookieName: string
  cookieMaxAge: number
  messages?: Partial<ConsentMessages>
}

const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/

export function gaCookies(gaMeasurementId?: string): CookieDefinitionFactory {
  const measurementId = (gaMeasurementId ?? process.env.GA_MEASUREMENT_ID)?.trim()

  if (measurementId !== undefined && measurementId !== '' && !GA_MEASUREMENT_ID_PATTERN.test(measurementId)) {
    throw new Error(
      `Invalid GA measurement ID "${measurementId}". Expected the form G- followed by uppercase letters or digits.`
    )
  }

  return (messages) => [
    {
      name: '_ga',
      categoryId: 'analytics',
      purpose: messages.gaCookiePurpose,
      expiry: messages.gaCookieExpiry,
      provider: messages.gaCookieProvider,
      removeOnReject: 'host-and-parents'
    },
    {
      name: measurementId === undefined || measurementId === ''
        ? '_ga_<id>'
        : `_ga_${measurementId.slice(2)}`,
      categoryId: 'analytics',
      purpose: messages.gaSessionCookiePurpose,
      expiry: messages.gaCookieExpiry,
      provider: messages.gaCookieProvider,
      match: '_ga_*',
      removeOnReject: 'host-and-parents'
    }
  ]
}

/** Sensible defaults so services get an accurate cookies-page table with zero extra config. */
export function defaultCookieDefinitions({
  cookieName,
  cookieMaxAge,
  messages
}: DefaultCookieContext): CookieDefinition[] {
  const resolvedMessages = { ...defaultMessages, ...messages }
  const cookies: CookieDefinition[] = [
    {
      name: cookieName,
      categoryId: 'essential',
      purpose: resolvedMessages.defaultCookiePurpose,
      expiry: formatDuration(cookieMaxAge)
    }
  ]

  return cookies
}
