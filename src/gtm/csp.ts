export interface GoogleAnalyticsCspDirectives {
  readonly 'script-src': readonly string[]
  readonly 'connect-src': readonly string[]
  readonly 'img-src': readonly string[]
  readonly 'frame-src': readonly string[]
}

export interface BlankieCspOptions {
  readonly scriptSrc?: readonly string[]
  readonly connectSrc?: readonly string[]
  readonly imgSrc?: readonly string[]
  readonly frameSrc?: readonly string[]
}

export type HelmetCspSource = string | ((...args: any[]) => string)

export interface HelmetCspDirectives {
  readonly scriptSrc?: readonly HelmetCspSource[]
  readonly connectSrc?: readonly HelmetCspSource[]
  readonly imgSrc?: readonly HelmetCspSource[]
  readonly frameSrc?: readonly HelmetCspSource[]
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

/** Return Blankie options with the GTM and Google Analytics sources merged in. */
export function withGoogleAnalyticsBlankieCsp<Options extends object>(options: Options & BlankieCspOptions) {
  return {
    ...options,
    scriptSrc: [...new Set([...(options.scriptSrc ?? []), ...googleAnalyticsCspDirectives['script-src']])],
    connectSrc: [...new Set([...(options.connectSrc ?? []), ...googleAnalyticsCspDirectives['connect-src']])],
    imgSrc: [...new Set([...(options.imgSrc ?? []), ...googleAnalyticsCspDirectives['img-src']])],
    frameSrc: [...new Set([...(options.frameSrc ?? []), ...googleAnalyticsCspDirectives['frame-src']])]
  }
}

/** Return Helmet directives with the GTM and Google Analytics sources merged in. */
export function withGoogleAnalyticsHelmetCsp<Directives extends object>(directives: Directives & HelmetCspDirectives) {
  return {
    ...directives,
    scriptSrc: [...new Set([...(directives.scriptSrc ?? []), ...googleAnalyticsCspDirectives['script-src']])],
    connectSrc: [...new Set([...(directives.connectSrc ?? []), ...googleAnalyticsCspDirectives['connect-src']])],
    imgSrc: [...new Set([...(directives.imgSrc ?? []), ...googleAnalyticsCspDirectives['img-src']])],
    frameSrc: [...new Set([...(directives.frameSrc ?? []), ...googleAnalyticsCspDirectives['frame-src']])]
  }
}