import { defaultCategories } from './categories.js'
import { normaliseRoutePrefix, safeInternalPath } from '../shared/url.js'
import type { GovUkAnalyticsConsentOptions, ResolvedOptions } from './types.js'

export const GTM_CONTAINER_ID_PATTERN = /^GTM-[A-Z0-9]+$/

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export const defaults = {
  cookieName: 'cookies_policy',
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

  return {
    gtmContainerId: gtmContainerId === '' ? null : gtmContainerId,
    cookieName,
    cookieVersion,
    routePrefix: normaliseRoutePrefix(options.routePrefix ?? defaults.routePrefix),
    cookiesPageUrl: resolveCookiesPageUrl(options.cookiesPageUrl),
    consentWaitForUpdate: resolveWaitForUpdate(options.consentWaitForUpdate),
    categories: options.categories ?? defaultCategories,
    serviceName: options.serviceName ?? defaults.serviceName,
    cookie: {
      path: '/',
      sameSite: 'Lax',
      httpOnly: false,
      secure: options.secureCookie ?? process.env.NODE_ENV === 'production',
      maxAge: options.cookieMaxAge ?? ONE_YEAR_SECONDS
    }
  }
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
