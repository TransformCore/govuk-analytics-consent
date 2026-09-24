export interface ConsentState {
  version: number
  /** `null` means the user has not made a choice yet. */
  analytics: boolean | null
  updatedAt: string
}

export interface CookieCategory {
  id: string
  title: string
  description: string
}

export interface GovUkAnalyticsConsentOptions {
  /** Defaults to `process.env.GTM_CONTAINER_ID`. */
  gtmContainerId?: string
  cookieName?: string
  cookieVersion?: number
  routePrefix?: string
  /** Rendered as the banner's "View cookies" link only when supplied. */
  cookiesPageUrl?: string
  /** Consent Mode `wait_for_update` in ms. `false` or `0` omits the property. */
  consentWaitForUpdate?: number | false
  categories?: CookieCategory[]
  serviceName?: string
  secureCookie?: boolean
  cookieMaxAge?: number
  /** Return a CSP nonce for the current request; applied to every injected <script>. */
  getNonce?: (request: unknown) => string | null | undefined
}

export interface ResolvedCookieOptions {
  path: string
  sameSite: 'Lax'
  httpOnly: false
  secure: boolean
  maxAge: number
}

export interface ResolvedOptions {
  gtmContainerId: string | null
  cookieName: string
  cookieVersion: number
  routePrefix: string
  cookiesPageUrl: string | null
  consentWaitForUpdate: number | null
  categories: CookieCategory[]
  serviceName: string
  cookie: ResolvedCookieOptions
}
