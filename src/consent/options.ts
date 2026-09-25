import { buildDefaultCategories } from './categories.js'
import { defaultCookieDefinitions } from './default-cookies.js'
import { normaliseRoutePrefix, safeInternalPath } from '../shared/url.js'
import { resolveMessages } from './messages.js'
import type {
  CookieDefinition,
  GovUkAnalyticsConsentOptions,
  ResolvedOptions
} from './types.js'

export const GTM_CONTAINER_ID_PATTERN = /^GTM-[A-Z0-9]+$/

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export const defaults = {
  cookieName: 'govuk_analytics_consent',
  cookieVersion: 1,
  routePrefix: '/govuk-analytics-consent',
  consentWaitForUpdate: 500,
  serviceName: 'this service'
} as const

export function resolveOptions(options: GovUkAnalyticsConsentOptions = {}): ResolvedOptions {
  const rawContainerId = options.gtmContainerId ?? process.env.GTM_CONTAINER_ID ?? ''
  const gtmContainerId = rawContainerId.trim()

  if (gtmContainerId !== '' && !GTM_CONTAINER_ID_PATTERN.test(gtmContainerId)) {
    throw new Error(
      `Invalid GTM container ID "${gtmContainerId}". Expected the form GTM-XXXXXXX.`
    )
  }

  const cookieVersion = options.cookieVersion ?? defaults.cookieVersion

  if (!Number.isInteger(cookieVersion) || cookieVersion < 1) {
    throw new Error(`Invalid cookieVersion: ${String(options.cookieVersion)}`)
  }

  const cookieName = (options.cookieName ?? defaults.cookieName).trim()

  if (!/^[\w.-]+$/.test(cookieName)) {
    throw new Error(`Invalid cookieName: "${cookieName}"`)
  }

  const messages = resolveMessages(options.messages)
  const categories = options.categories ?? buildDefaultCategories(messages)
  const cookieMaxAge = options.cookieMaxAge ?? ONE_YEAR_SECONDS
  const resolvedGtmContainerId = gtmContainerId === '' ? null : gtmContainerId

  const cookies = resolveCookieDefinitions(options, categories, {
    cookieName,
    cookieMaxAge,
    gtmContainerId: resolvedGtmContainerId,
    messages
  })

  return {
    gtmContainerId: resolvedGtmContainerId,
    cookieName,
    cookieVersion,
    routePrefix: normaliseRoutePrefix(options.routePrefix ?? defaults.routePrefix),
    cookiesPageUrl: resolveCookiesPageUrl(options.cookiesPageUrl),
    consentWaitForUpdate: resolveWaitForUpdate(options.consentWaitForUpdate),
    categories,
    cookies,
    serviceName: options.serviceName ?? defaults.serviceName,
    messages,
    cookie: {
      path: '/',
      sameSite: 'Lax',
      httpOnly: false,
      secure: options.secureCookie ?? process.env.NODE_ENV === 'production',
      maxAge: cookieMaxAge
    }
  }
}

function resolveCookieDefinitions(
  options: GovUkAnalyticsConsentOptions,
  categories: ResolvedOptions['categories'],
  defaultsContext: {
    cookieName: string
    cookieMaxAge: number
    gtmContainerId: string | null
    messages: ResolvedOptions['messages']
  }
): CookieDefinition[] {
  const includeDefaults = options.includeDefaultCookies ?? true
  const defaults = includeDefaults ? defaultCookieDefinitions(defaultsContext) : []
  const merged = mergeCookieDefinitions(defaults, options.cookies ?? [])
  const categoryIds = new Set(categories.map((category) => category.id))

  for (const cookie of merged) {
    if (
      typeof cookie.name !== 'string' ||
      cookie.name.trim() === '' ||
      typeof cookie.purpose !== 'string' ||
      cookie.purpose.trim() === '' ||
      typeof cookie.expiry !== 'string' ||
      cookie.expiry.trim() === '' ||
      !categoryIds.has(cookie.categoryId)
    ) {
      throw new Error(`Invalid cookie definition: ${JSON.stringify(cookie)}`)
    }
  }

  return merged
}

/** A user-supplied entry overrides a default with the same `name`. */
function mergeCookieDefinitions(
  defaults: CookieDefinition[],
  overrides: CookieDefinition[]
): CookieDefinition[] {
  const byName = new Map<string, CookieDefinition>()

  for (const cookie of [...defaults, ...overrides]) {
    byName.set(cookie.name, cookie)
  }

  return [...byName.values()]
}

function resolveCookiesPageUrl(value: string | undefined): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }

  const safe = safeInternalPath(value, '')

  return safe === '' ? null : safe
}

function resolveWaitForUpdate(value: number | false | undefined): number | null {
  if (value === false || value === 0) {
    return null
  }

  if (value === undefined) {
    return defaults.consentWaitForUpdate
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid consentWaitForUpdate: ${String(value)}`)
  }

  return Math.floor(value)
}
