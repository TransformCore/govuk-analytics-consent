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
        purpose: messages.tags['microsoft-clarity'].cookies.user.purpose,
        expiry: messages.tags['microsoft-clarity'].cookies.user.expiry,
        provider: messages.tags['microsoft-clarity'].provider,
        removeOnReject: 'host-and-parents'
      },
      {
        name: '_clsk',
        categoryId,
        purpose: messages.tags['microsoft-clarity'].cookies.session.purpose,
        expiry: messages.tags['microsoft-clarity'].cookies.session.expiry,
        provider: messages.tags['microsoft-clarity'].provider,
        removeOnReject: 'host-and-parents'
      },
      // Set on Microsoft's domains, so the service cannot remove them.
      {
        name: 'CLID',
        categoryId,
        purpose: messages.tags['microsoft-clarity'].cookies.clid.purpose,
        expiry: messages.tags['microsoft-clarity'].cookies.user.expiry,
        provider: messages.tags['microsoft-clarity'].provider,
        removeOnReject: 'never'
      },
      {
        name: 'MUID',
        categoryId,
        purpose: messages.tags['microsoft-clarity'].cookies.muid.purpose,
        expiry: messages.tags['microsoft-clarity'].cookies.user.expiry,
        provider: messages.tags['microsoft-clarity'].provider,
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
