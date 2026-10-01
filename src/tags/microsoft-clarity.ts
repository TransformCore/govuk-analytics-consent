import type { ConsentTag, TagOptions } from './types.js'

export type MicrosoftClarityTagOptions = TagOptions

export function microsoftClarity(options: MicrosoftClarityTagOptions = {}): ConsentTag {
  const categoryId = options.categoryId ?? 'analytics'

  return {
    id: 'microsoft-clarity',
    // Clarity has no built-in GTM tag type; its gallery template ID is container-specific.
    gtmTypes: options.gtmTypes ?? [],
    cookies: (messages) => [
      {
        name: '_clck',
        categoryId,
        purpose: messages.clarityUserCookiePurpose,
        expiry: messages.clarityUserCookieExpiry,
        provider: messages.clarityCookieProvider,
        removeOnReject: 'host-and-parents'
      },
      {
        name: '_clsk',
        categoryId,
        purpose: messages.claritySessionCookiePurpose,
        expiry: messages.claritySessionCookieExpiry,
        provider: messages.clarityCookieProvider,
        removeOnReject: 'host-and-parents'
      },
      // Set on Microsoft's domains, so the service cannot remove them.
      {
        name: 'CLID',
        categoryId,
        purpose: messages.clarityClidCookiePurpose,
        expiry: messages.clarityUserCookieExpiry,
        provider: messages.clarityCookieProvider,
        removeOnReject: 'never'
      },
      {
        name: 'MUID',
        categoryId,
        purpose: messages.clarityMuidCookiePurpose,
        expiry: messages.clarityUserCookieExpiry,
        provider: messages.clarityCookieProvider,
        removeOnReject: 'never'
      }
    ],
    csp: {
      'script-src': ['https://www.clarity.ms', 'https://*.clarity.ms'],
      'connect-src': ['https://*.clarity.ms'],
      'img-src': ['https://*.clarity.ms', 'https://c.bing.com']
    }
  }
}
