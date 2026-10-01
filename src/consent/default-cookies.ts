import { formatDuration } from '../shared/duration.js'
import { defaultMessages } from './messages.js'
import type { ConsentMessages, CookieDefinition } from './types.js'

export interface DefaultCookieContext {
  cookieName: string
  cookieMaxAge: number
  messages?: Partial<ConsentMessages>
}

/** Sensible defaults so services get an accurate cookies-page table with zero extra config. */
export function defaultCookieDefinitions({
  cookieName,
  cookieMaxAge,
  messages
}: DefaultCookieContext): CookieDefinition[] {
  const resolvedMessages = messages ?? defaultMessages.en
  const cookies: CookieDefinition[] = [
    {
      name: cookieName,
      categoryId: 'essential',
      purpose: resolvedMessages.cookies?.consent.purpose ?? defaultMessages.en.cookies.consent.purpose,
      expiry: formatDuration(cookieMaxAge)
    }
  ]

  return cookies
}
