import { createInitialState } from '../consent/state.js'
import type { ConsentState, CookieCategory, CookieDefinition, ResolvedOptions } from '../consent/types.js'

export interface ConsentViewModel {
  gtmContainerId: string | null
  cookieName: string
  cookieVersion: number
  routePrefix: string
  cookiesPageUrl: string | null
  consentWaitForUpdate: number | null
  categories: CookieCategory[]
  cookies: CookieDefinition[]
  serviceName: string
  messages: ResolvedOptions['messages']
  consent: ConsentState
  currentPath: string
  /** The page to return to once cookie preferences are saved; defaults to `currentPath`. */
  returnTo: string
  /** Whether the current request just redirected here after saving cookie preferences. */
  cookiesSaved: boolean
  nonce: string | null
}

export interface ViewModelInput {
  consent?: ConsentState
  currentPath?: string
  returnTo?: string
  cookiesSaved?: boolean
  nonce?: string | null
}

export function buildViewModel(
  options: ResolvedOptions,
  { consent, currentPath = '/', returnTo, cookiesSaved = false, nonce = null }: ViewModelInput = {}
): ConsentViewModel {
  return {
    gtmContainerId: options.gtmContainerId,
    cookieName: options.cookieName,
    cookieVersion: options.cookieVersion,
    routePrefix: options.routePrefix,
    cookiesPageUrl: options.cookiesPageUrl,
    consentWaitForUpdate: options.consentWaitForUpdate,
    categories: options.categories,
    cookies: options.cookies,
    serviceName: options.serviceName,
    messages: options.messages,
    consent: consent ?? createInitialState(options.cookieVersion),
    currentPath,
    returnTo: returnTo ?? currentPath,
    cookiesSaved,
    nonce
  }
}
