import type { LocalizedMessages, MessageTranslator } from './messages.js'
import type { ResolvedCspDirectives } from '../tags/csp.js'
import type { ConsentTagInput } from '../tags/presets.js'
import type { GtmAllowlistInput, GtmRestrictions } from '../gtm/restrictions.js'

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

export type CookieCategoryPreset =
  | 'default'
  | 'essential'
  | 'analytics'
  | 'advertising'
  | 'functionality'
  | 'personalization'

export type CookieCategoryInput = CookieCategory | CookieCategoryPreset

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
  purposeKey?: string
  expiryKey?: string
  providerKey?: string
  /** Glob matching the real cookie names, e.g. `_ga_*` for the `_ga_<id>` row; only `*` is a wildcard. Without it, `name` must match exactly. */
  match?: string
  /** Defaults to `'host-only'`, or `'never'` for essential categories. */
  removeOnReject?: CookieRemoval
}

export interface TagDescription {
  categoryId: string
  text: string
}

export type TranslateMessage = (key: string, fallback?: string, values?: Record<string, string>) => string
export type CookieDefinitionFactory = (messages: ConsentMessages, translate: TranslateMessage) => CookieDefinition[]

export type CookieDefinitionInput = CookieDefinition | CookieDefinitionFactory

export interface ConsentMessages {
  banner: {
    title: string
    intro: string
    additional: string
    acceptAll: string
    rejectAll: string
    viewCookies: string
    accepted: string
    rejected: string
    hide: string
  }
  cookies: {
    title: string
    intro: string
    essential: string
    categoryQuestion: string
    changeSettings: string
    saveSettings: string
    successBanner: string
    successBannerLink: string
    successTitle: string
    yes: string
    no: string
    consent: { purpose: string }
    table: { name: string; purpose: string; expiry: string }
  }
  categories: Record<'essential' | 'analytics' | 'advertising' | 'functionality' | 'personalization', {
    title: string
    description: string
  }>
  tags: {
    'google-analytics': {
      description: string
      provider: string
      expiry: string
      cookies: { ga: { purpose: string }; session: { purpose: string } }
    }
    hotjar: {
      description: string
      provider: string
      cookies: {
        sessionUser: { purpose: string; expiry: string }
        session: { purpose: string; expiry: string }
        other: { purpose: string; expiry: string }
      }
    }
    'microsoft-clarity': {
      provider: string
      cookies: {
        user: { purpose: string; expiry: string }
        session: { purpose: string; expiry: string }
        clid: { purpose: string }
        muid: { purpose: string }
      }
    }
  }
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
  /** Built-in category presets or custom category objects. Presets use the resolved messages. */
  categories?: CookieCategoryInput[]
  /** Tags loaded through GTM, as preset names or tag objects; each adds its cookie rows and CSP sources. */
  tags?: ConsentTagInput[]
  /**
   * GTM tag, trigger and variable type IDs or classes pushed as `gtm.allowlist`.
   * `'auto'` (alone or as an entry) expands to the GTM types of `tags` plus built-in triggers and variables.
   */
  gtmAllowlist?: GtmAllowlistInput
  /** GTM tag, trigger and variable type IDs or classes pushed as `gtm.blocklist`; overrides the allowlist. */
  gtmBlocklist?: string[]
  /** Cookie definitions or factories called with the resolved messages; merges with built-in and tag cookies by `name`. */
  cookies?: CookieDefinitionInput[]
  /** Set to `false` to omit the built-in consent-cookie row. Defaults to `true`. */
  includeDefaultCookies?: boolean
  serviceName?: string
  /** Partial message overrides for each supported language. */
  messages?: LocalizedMessages
  /** Host message lookup; called separately for each request with that request's i18n context. */
  translate?: MessageTranslator
  /** Optional host logger for actionable non-fatal configuration warnings. */
  logger?: { warn(message: string): void }
  /** Select a language from this request; defaults to the browser's Accept-Language preference. */
  getLanguage?: (request: unknown, response?: unknown) => string | undefined | Promise<string | undefined>
  secureCookie?: boolean
  cookieMaxAge?: number
  /** Return a CSP nonce for the current request; applied to every injected <script>. */
  getNonce?: (request: unknown) => string | null | undefined
  /** Return CSRF hidden fields for the current request. Names and values are HTML-escaped. */
  getCsrfFormFields?: (
    request: unknown,
    response?: unknown
  ) => Record<string, string> | Promise<Record<string, string>>
  /** Verify a submitted CSRF-protected consent form when middleware does not protect the route. */
  verifyCsrfFormSubmission?: (
    request: unknown,
    body: Record<string, unknown>
  ) => boolean | Promise<boolean>
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
  tagDescriptions: TagDescription[]
  serviceName: string
  messages: ConsentMessages
  translateMessage: TranslateMessage
  hasHostTranslator: boolean
  getLanguage?: GovUkAnalyticsConsentOptions['getLanguage']
  localize: (language: string, request?: unknown, response?: unknown) => Pick<ResolvedOptions, 'messages' | 'categories' | 'cookies' | 'tagDescriptions' | 'translateMessage'>
  cookie: ResolvedCookieOptions
  /** GTM sources merged with every tag's sources. */
  csp: ResolvedCspDirectives
  gtmRestrictions: GtmRestrictions
  getNonce?: GovUkAnalyticsConsentOptions['getNonce']
  getCsrfFormFields?: GovUkAnalyticsConsentOptions['getCsrfFormFields']
  verifyCsrfFormSubmission?: GovUkAnalyticsConsentOptions['verifyCsrfFormSubmission']
}
