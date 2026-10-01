import type { ConsentTag, TagOptions } from './types.js'

const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/

export interface GoogleAnalyticsTagOptions extends TagOptions {
  /** Defaults to `process.env.GA_MEASUREMENT_ID`; without one, the cookies page shows `_ga_<id>`. */
  measurementId?: string
}

export function googleAnalytics(options: GoogleAnalyticsTagOptions = {}): ConsentTag {
  const measurementId = (options.measurementId ?? process.env.GA_MEASUREMENT_ID)?.trim()
  const categoryId = options.categoryId ?? 'analytics'

  if (measurementId !== undefined && measurementId !== '' && !GA_MEASUREMENT_ID_PATTERN.test(measurementId)) {
    throw new Error(
      `Invalid GA measurement ID "${measurementId}". Expected the form G- followed by uppercase letters or digits.`
    )
  }

  return {
    id: 'google-analytics',
    description: (messages) => messages.gaTagDescription,
    gtmTypes: options.gtmTypes ?? ['googtag', 'gaawc', 'gaawe'],
    cookies: (messages) => [
      {
        name: '_ga',
        categoryId,
        purpose: messages.gaCookiePurpose,
        expiry: messages.gaCookieExpiry,
        provider: messages.gaCookieProvider,
        removeOnReject: 'host-and-parents'
      },
      {
        name: measurementId === undefined || measurementId === ''
          ? '_ga_<id>'
          : `_ga_${measurementId.slice(2)}`,
        categoryId,
        purpose: messages.gaSessionCookiePurpose,
        expiry: messages.gaCookieExpiry,
        provider: messages.gaCookieProvider,
        match: '_ga_*',
        removeOnReject: 'host-and-parents'
      }
    ],
    csp: {
      'connect-src': [
        'https://*.google-analytics.com',
        'https://*.analytics.google.com',
        'https://www.google.com'
      ],
      'img-src': ['https://*.google-analytics.com']
    }
  }
}
