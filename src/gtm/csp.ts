export interface GoogleAnalyticsCspDirectives {
  readonly 'script-src': readonly string[]
  readonly 'connect-src': readonly string[]
  readonly 'img-src': readonly string[]
  readonly 'frame-src': readonly string[]
}

/** Additional CSP sources required by this package's GTM and Google Analytics integration. */
export const googleAnalyticsCspDirectives: GoogleAnalyticsCspDirectives = Object.freeze({
  'script-src': Object.freeze(['https://www.googletagmanager.com']),
  'connect-src': Object.freeze([
    'https://www.googletagmanager.com',
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://www.google.com'
  ]),
  'img-src': Object.freeze([
    'https://www.googletagmanager.com',
    'https://*.google-analytics.com'
  ]),
  'frame-src': Object.freeze(['https://www.googletagmanager.com'])
})