export interface ConsentState {
  version: number
  /** `null` means the user has not made a choice yet; keys are non-essential category ids. */
  categories: Record<string, boolean> | null
  updatedAt: string
}

/** Minimal category shape needed to decide whether a choice is implied or must be stored. */
export interface ConsentCategoryRef {
  id: string
  /** `true` means always granted; never rendered as a toggle. */
  essential?: boolean
}

/** Minimal category shape needed to build Consent Mode payloads. */
export interface ConsentModeCategory extends ConsentCategoryRef {
  /** Google Consent Mode signal names this category controls, e.g. `['analytics_storage']`. */
  gtagSignals?: string[]
}

export interface CookieCategory extends ConsentModeCategory {
  title: string
  description: string
  /** Short label used in the cookies-page radios, e.g. "analytics" in "Do you want to accept analytics cookies?". */
  shortName?: string
}

/**
 * What to expire when the cookie's category is rejected: nothing, the cookie on the current host,
 * or the current host plus every parent domain (needed for cookies GA sets on the broadest domain).
 */
export type CookieRemoval = 'never' | 'host-only' | 'host-and-parents'

export interface CookieDefinition {
  name: string
  categoryId: string
  purpose: string
  expiry: string
  provider?: string
  /** Glob matching the real cookie names, e.g. `_ga_*` for the `_ga_<id>` row; only `*` is a wildcard. Without it, `name` must match exactly. */
  match?: string
  /** Defaults to `'host-only'`, or `'never'` for essential categories. */
  removeOnReject?: CookieRemoval
}

export type CookieDefinitionFactory = (messages: ConsentMessages) => CookieDefinition[]

export type CookieDefinitionInput = CookieDefinition | CookieDefinitionFactory

export interface ConsentMessages {
  bannerTitle: string
  bannerIntro: string
  bannerAdditional: string
  acceptAll: string
  rejectAll: string
  viewCookies: string
  accepted: string
  rejected: string
  changeSettings: string
  cookiesPageTitle: string
  cookiesPageIntro: string
  essentialCookies: string
  categoryQuestion: string
  saveSettings: string
  successBanner: string
  successBannerLink: string
  essentialCategoryTitle: string
  essentialCategoryDescription: string
  analyticsCategoryTitle: string
  analyticsCategoryDescription: string
  advertisingCategoryTitle: string
  advertisingCategoryDescription: string
  functionalityCategoryTitle: string
  functionalityCategoryDescription: string
  personalizationCategoryTitle: string
  personalizationCategoryDescription: string
  defaultCookiePurpose: string
  gaCookiePurpose: string
  gaSessionCookiePurpose: string
  gaCookieProvider: string
  gaCookieExpiry: string
  tableHeaderName: string
  tableHeaderPurpose: string
  tableHeaderExpiry: string
  yesLabel: string
  noLabel: string
  hideMessage: string
  successTitle: string
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
  /** Cookie definitions or factories called with the resolved messages; merges with built-in cookies by `name`. */
  cookies?: CookieDefinitionInput[]
  /** Set to `false` to omit the built-in consent-cookie row. Defaults to `true`. */
  includeDefaultCookies?: boolean
  serviceName?: string
  messages?: Partial<ConsentMessages>
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
  cookies: CookieDefinition[]
  serviceName: string
  messages: ConsentMessages
  cookie: ResolvedCookieOptions
}
