import type { CookieDefinitionFactory } from '../consent/types.js'
import type { CspDirectives } from './csp.js'

/** A tag loaded through GTM, describing the cookies it sets and the CSP sources it needs. */
export interface ConsentTag {
  id: string
  cookies: CookieDefinitionFactory
  csp: CspDirectives
}

export interface TagOptions {
  /** Category the tag's cookies belong to. Defaults to `'analytics'`. */
  categoryId?: string
}
