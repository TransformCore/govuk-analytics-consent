import type { ConsentMessages, CookieDefinitionFactory, TranslateMessage } from '../consent/types.js'
import type { CspDirectives } from './csp.js'

/** A tag loaded through GTM, describing the cookies it sets and the CSP sources it needs. */
export interface ConsentTag {
  id: string
  cookies: CookieDefinitionFactory
  csp: CspDirectives
  /** Plain text shown above the tag's cookie rows on the cookies page. */
  /** The translator accepts keys relative to `govuk-analytics-consent.tags.<id>`. */
  description?: string | ((messages: ConsentMessages, translate: TranslateMessage) => string)
  /** GTM tag type IDs or classes added by `gtmAllowlist: 'auto'`, e.g. `['hjtc']`. */
  gtmTypes?: readonly string[]
}

export interface TagOptions {
  /** Category the tag's cookies belong to. Defaults to `'analytics'`. */
  categoryId?: string
  /** Overrides the preset's GTM type IDs used by `gtmAllowlist: 'auto'`. */
  gtmTypes?: readonly string[]
}
