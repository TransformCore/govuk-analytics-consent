import { readConsentFromHeader, serialiseConsent } from '../consent/cookie.js'
import { buildCategoryChoices, createInitialState, withCategoryChoices } from '../consent/state.js'
import { appendQueryParam, safeInternalPath } from '../shared/url.js'
import {
  renderConsentBanner,
  renderConsentCookiesPage,
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
  cookiesPage: string
  scripts: string
}

export interface ContextInput {
  cookieHeader?: string | null
  currentPath?: string
  returnTo?: string
  cookiesSaved?: boolean
  nonce?: string | null
}

export function createConsentContext(
  options: ResolvedOptions,
  { cookieHeader, currentPath = '/', returnTo, cookiesSaved = false, nonce = null }: ContextInput = {}
): ConsentContext {
  const consent = readConsentFromHeader(cookieHeader, options.cookieName, options.cookieVersion)
  const viewModel = buildViewModel(options, { consent, currentPath, returnTo, cookiesSaved, nonce })

  return {
    ...viewModel,
    head: renderConsentHead(viewModel),
    noscript: renderConsentNoscript(viewModel),
    banner: renderConsentBanner(viewModel),
    cookiesPage: renderConsentCookiesPage(viewModel),
    scripts: renderConsentScripts(viewModel)
  }
}

export interface ConsentPostResult {
  state: ConsentState
  cookieValue: string
  redirectTo: string
}

/**
 * Handles both the banner's accept-all/reject-all form and the cookies page's granular
 * `cookies[{id}]=yes|no` radios; anything not recognised as `yes` is treated as a rejection.
 * A granular save appends `cookies-updated=true` so the returned-to page shows the
 * confirmation notification banner; the banner has its own inline confirmation instead.
 */
export function handleConsentPost(
  options: ResolvedOptions,
  body: Record<string, unknown> | undefined
): ConsentPostResult {
  const preference = body?.preference
  const isBannerChoice = preference === 'accept-all' || preference === 'reject-all'

  const choices = isBannerChoice
    ? buildCategoryChoices(options.categories, preference === 'accept-all')
    : readCategoryChoices(options.categories, body)

  const state = withCategoryChoices(createInitialState(options.cookieVersion), choices)
  const returnUrl = safeInternalPath(body?.returnUrl)

  return {
    state,
    cookieValue: serialiseConsent(state),
    redirectTo: isBannerChoice ? returnUrl : appendQueryParam(returnUrl, 'cookies-updated', 'true')
  }
}

function readCategoryChoices(
  categories: ResolvedOptions['categories'],
  body: Record<string, unknown> | undefined
): Record<string, boolean> {
  const nested = body?.cookies
  const nestedChoices = typeof nested === 'object' && nested !== null ? (nested as Record<string, unknown>) : undefined
  const choices: Record<string, boolean> = {}

  for (const category of categories) {
    if (category.essential !== true) {
      const value = body?.[`cookies[${category.id}]`] ?? nestedChoices?.[category.id]

      choices[category.id] = value === 'yes'
    }
  }

  return choices
}

export function consentRoutePaths(options: ResolvedOptions): { script: string; consent: string } {
  return {
    script: `${options.routePrefix}/consent.js`,
    consent: `${options.routePrefix}/consent`
  }
}
