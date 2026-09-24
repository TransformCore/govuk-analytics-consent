import { readConsentFromHeader, serialiseConsent } from '../consent/cookie.js'
import { createInitialState, withAnalytics } from '../consent/state.js'
import { safeInternalPath } from '../shared/url.js'
import {
  renderConsentBanner,
  renderConsentHead,
  renderConsentNoscript,
  renderConsentScripts
} from '../ui/html.js'
import { buildViewModel, type ConsentViewModel } from '../ui/view-model.js'
import type { ConsentState, ResolvedOptions } from '../consent/types.js'

export interface ConsentContext extends ConsentViewModel {
  head: string
  noscript: string
  banner: string
  scripts: string
}

export interface ContextInput {
  cookieHeader?: string | null
  currentPath?: string
  nonce?: string | null
}

export function createConsentContext(
  options: ResolvedOptions,
  { cookieHeader, currentPath = '/', nonce = null }: ContextInput = {}
): ConsentContext {
  const consent = readConsentFromHeader(cookieHeader, options.cookieName, options.cookieVersion)
  const viewModel = buildViewModel(options, { consent, currentPath, nonce })

  return {
    ...viewModel,
    head: renderConsentHead(viewModel),
    noscript: renderConsentNoscript(viewModel),
    banner: renderConsentBanner(viewModel),
    scripts: renderConsentScripts(viewModel)
  }
}

export interface ConsentPostResult {
  state: ConsentState
  cookieValue: string
  redirectTo: string
}

/** Non-JavaScript fallback: any unrecognised `analytics` value is treated as a rejection. */
export function handleConsentPost(
  options: ResolvedOptions,
  body: Record<string, unknown> | undefined
): ConsentPostResult {
  const analytics = body?.analytics === 'accept'
  const state = withAnalytics(createInitialState(options.cookieVersion), analytics)

  return {
    state,
    cookieValue: serialiseConsent(state),
    redirectTo: safeInternalPath(body?.returnUrl)
  }
}

export function consentRoutePaths(options: ResolvedOptions): { script: string; consent: string } {
  return {
    script: `${options.routePrefix}/consent.js`,
    consent: `${options.routePrefix}/consent`
  }
}
