import { formatDuration } from '../shared/duration.js'
import { defaultMessages } from './messages.js'
import type { ConsentMessages, CookieDefinition } from './types.js'

export interface DefaultCookieContext {
  cookieName: string
  cookieMaxAge: number
  gtmContainerId: string | null
  messages?: Partial<ConsentMessages>
}

/** Sensible defaults so services get an accurate cookies-page table with zero extra config. */
export function defaultCookieDefinitions({
  cookieName,
  cookieMaxAge,
  gtmContainerId,
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

  if (gtmContainerId !== null) {
    cookies.push(
      {
        name: '_ga',
        categoryId: 'analytics',
        purpose: resolvedMessages.gaCookiePurpose,
        expiry: '2 years',
        provider: 'Google Analytics'
      },
      {
        name: `_ga_<id>`,
        categoryId: 'analytics',
        purpose: resolvedMessages.gaSessionCookiePurpose,
        expiry: '2 years',
        provider: 'Google Analytics'
      }
    )
  }

  return cookies
}
