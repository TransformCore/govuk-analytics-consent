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

export interface CookieDefinition {
  name: string
  categoryId: string
  purpose: string
  expiry: string
  provider?: string
}

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
  /** Documents cookies for the cookies page; merges with (and can override by `name`) the built-in defaults. */
  cookies?: CookieDefinition[]
  /** Set to `false` to omit the built-in consent-cookie and GA rows entirely. Defaults to `true`. */
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
