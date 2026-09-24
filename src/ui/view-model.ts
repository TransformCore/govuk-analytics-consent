import { createInitialState } from '../consent/state.js'
import type { ConsentState, CookieCategory, ResolvedOptions } from '../consent/types.js'

export interface ConsentViewModel {
  gtmContainerId: string | null
  cookieName: string
  cookieVersion: number
  routePrefix: string
  cookiesPageUrl: string | null
  consentWaitForUpdate: number | null
  categories: CookieCategory[]
  serviceName: string
  consent: ConsentState
  currentPath: string
  nonce: string | null
}

export interface ViewModelInput {
  consent?: ConsentState
  currentPath?: string
  nonce?: string | null
}

export function buildViewModel(
  options: ResolvedOptions,
  { consent, currentPath = '/', nonce = null }: ViewModelInput = {}
): ConsentViewModel {
  return {
    gtmContainerId: options.gtmContainerId,
    cookieName: options.cookieName,
    cookieVersion: options.cookieVersion,
    routePrefix: options.routePrefix,
    cookiesPageUrl: options.cookiesPageUrl,
    consentWaitForUpdate: options.consentWaitForUpdate,
    categories: options.categories,
    serviceName: options.serviceName,
    consent: consent ?? createInitialState(options.cookieVersion),
    currentPath,
    nonce
  }
}
