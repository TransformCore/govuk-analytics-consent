import { parseCookieHeader, readConsentFromHeader, serialiseConsent } from '../consent/cookie.js'
import { negotiateLanguage, selectLanguage } from '../consent/messages.js'
import { buildExpiryCookies, buildRemovalCategories, findCookiesToRemove } from '../consent/removal.js'
import {
  buildCategoryChoices,
  createInitialState,
  hasChoice,
  isCategoryAccepted,
  withCategoryChoices
} from '../consent/state.js'
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
  request?: unknown
  response?: unknown
  cookieHeader?: string | null
  consent?: ConsentState
  currentPath?: string
  returnTo?: string
  cookiesSaved?: boolean
  nonce?: string | null
}

export async function createConsentContext(
  options: ResolvedOptions,
  {
    request,
    response,
    cookieHeader,
    consent,
    currentPath = '/',
    returnTo,
    cookiesSaved = false,
    nonce = null
  }: ContextInput = {}
): Promise<ConsentContext> {
  const resolvedConsent = consent ?? readConsentFromHeader(cookieHeader, options.cookieName, options.cookieVersion)
  const formFields = await options.getCsrfFormFields?.(request, response) ?? {}
  const requestedLanguage = await options.getLanguage?.(request, response)
  const header = (request as { headers?: Record<string, unknown> } | undefined)?.headers?.['accept-language']
  const language = requestedLanguage === undefined
    ? negotiateLanguage(typeof header === 'string' ? header : undefined, options.hasHostTranslator)
    : selectLanguage(requestedLanguage, options.hasHostTranslator)
  const viewModel = buildViewModel({ ...options, ...options.localize(language, request, response) }, {
    consent: resolvedConsent,
    currentPath,
    returnTo,
    cookiesSaved,
    nonce,
    formFields
  })

  return {
    ...viewModel,
    head: renderConsentHead(viewModel),
    noscript: renderConsentNoscript(viewModel),
    banner: renderConsentBanner(viewModel),
    cookiesPage: renderConsentCookiesPage(viewModel),
    scripts: renderConsentScripts(viewModel)
  }
}

export interface ConsentRequestState {
  state: ConsentState
  hasChoice: boolean
  isCategoryAccepted: (categoryId: string) => boolean
  /** `Set-Cookie` values expiring cookies the user has rejected but the browser still sent. */
  expiryCookies: string[]
}

export function createConsentRequestState(
  options: ResolvedOptions,
  cookieHeader?: string | null,
  hostname?: string | null
): ConsentRequestState {
  const state = readConsentFromHeader(cookieHeader, options.cookieName, options.cookieVersion)
  const categories = new Map(options.categories.map((category) => [category.id, category]))

  return {
    state,
    hasChoice: hasChoice(state),
    isCategoryAccepted: (categoryId) => {
      const category = categories.get(categoryId)

      return category !== undefined && isCategoryAccepted(state, category)
    },
    expiryCookies: buildRequestExpiryCookies(options, state, cookieHeader, hostname)
  }
}

function buildRequestExpiryCookies(
  options: ResolvedOptions,
  state: ConsentState,
  cookieHeader: string | null | undefined,
  hostname: string | null | undefined
): string[] {
  const removals = findCookiesToRemove(
    Object.keys(parseCookieHeader(cookieHeader)),
    state,
    buildRemovalCategories(options.categories, options.cookies)
  )

  return buildExpiryCookies(removals, hostname ?? '')
}

export interface ConsentPostResult {
  state: ConsentState
  cookieValue: string
  redirectTo: string
  expiryCookies: string[]
}

export interface ConsentPostRequest {
  cookieHeader?: string | null
  hostname?: string | null
}

/**
 * Handles both the banner's accept-all/reject-all form and the cookies page's granular
 * `cookies[{id}]=yes|no` radios; anything not recognised as `yes` is treated as a rejection.
 * A granular save appends `cookies-updated=true` so the returned-to page shows the
 * confirmation notification banner; the banner has its own inline confirmation instead.
 */
export function handleConsentPost(
  options: ResolvedOptions,
  body: Record<string, unknown> | undefined,
  { cookieHeader, hostname }: ConsentPostRequest = {}
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
    redirectTo: isBannerChoice ? returnUrl : appendQueryParam(returnUrl, 'cookies-updated', 'true'),
    expiryCookies: buildRequestExpiryCookies(options, state, cookieHeader, hostname)
  }
}

export async function verifyConsentSubmission(
  options: ResolvedOptions,
  request: unknown,
  body: Record<string, unknown>
): Promise<boolean> {
  return options.verifyCsrfFormSubmission === undefined ||
    await options.verifyCsrfFormSubmission(request, body)
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
