import type { ConsentTag, TagOptions } from './types.js'

const HOTJAR_SITE_ID_PATTERN = /^\d+$/

export interface HotjarTagOptions extends TagOptions {
  /** Defaults to `process.env.HOTJAR_SITE_ID`; without one, the cookies page shows `<id>` placeholders. */
  siteId?: string | number
}

export function hotjar(options: HotjarTagOptions = {}): ConsentTag {
  const siteId = String(options.siteId ?? process.env.HOTJAR_SITE_ID ?? '').trim()
  const categoryId = options.categoryId ?? 'analytics'

  if (siteId !== '' && !HOTJAR_SITE_ID_PATTERN.test(siteId)) {
    throw new Error(`Invalid Hotjar site ID "${siteId}". Expected digits only.`)
  }

  const suffix = siteId === '' ? '<id>' : siteId

  return {
    id: 'hotjar',
    description: (messages) => messages.tags.hotjar.description,
    gtmTypes: options.gtmTypes ?? ['hjtc'],
    cookies: (messages) => [
      {
        name: `_hjSessionUser_${suffix}`,
        categoryId,
        purpose: messages.tags.hotjar.cookies.sessionUser.purpose,
        expiry: messages.tags.hotjar.cookies.sessionUser.expiry,
        provider: messages.tags.hotjar.provider,
        match: '_hjSessionUser_*',
        removeOnReject: 'host-and-parents'
      },
      {
        name: `_hjSession_${suffix}`,
        categoryId,
        purpose: messages.tags.hotjar.cookies.session.purpose,
        expiry: messages.tags.hotjar.cookies.session.expiry,
        provider: messages.tags.hotjar.provider,
        match: '_hjSession_*',
        removeOnReject: 'host-and-parents'
      },
      {
        name: '_hj*',
        categoryId,
        purpose: messages.tags.hotjar.cookies.other.purpose,
        expiry: messages.tags.hotjar.cookies.other.expiry,
        provider: messages.tags.hotjar.provider,
        match: '_hj*',
        removeOnReject: 'host-and-parents'
      }
    ],
    // Hotjar also recommends style-src 'unsafe-inline'; add it yourself only if its UI needs it.
    csp: {
      'script-src': ['https://*.hotjar.com'],
      'connect-src': ['https://*.hotjar.com', 'https://*.hotjar.io', 'wss://*.hotjar.com'],
      'img-src': ['https://*.hotjar.com'],
      'font-src': ['https://*.hotjar.com'],
      'style-src': ['https://*.hotjar.com']
    }
  }
}
