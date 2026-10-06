import { buildCategoryPreset, buildDefaultCategories } from './categories.js'
import { defaultCookieDefinitions } from './default-cookies.js'
import { globToPattern } from './removal.js'
import { normaliseRoutePrefix, safeInternalPath } from '../shared/url.js'
import { gtmCspDirectives, mergeCspDirectives } from '../tags/csp.js'
import { resolveTag } from '../tags/presets.js'
import { resolveGtmRestrictions } from '../gtm/restrictions.js'
import { MESSAGE_PREFIX, createMessageResolver, resolveMessages } from './messages.js'
import type {
  CookieDefinition,
  CookieRemoval,
  GovUkAnalyticsConsentOptions,
  ResolvedOptions
} from './types.js'

export const GTM_CONTAINER_ID_PATTERN = /^GTM-[A-Z0-9]+$/

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365
const COOKIE_REMOVALS: readonly CookieRemoval[] = ['never', 'host-only', 'host-and-parents']
const COOKIE_GLOB = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

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

  const cookieMaxAge = options.cookieMaxAge ?? ONE_YEAR_SECONDS
  const logger = options.logger ?? console
  const resolvedGtmContainerId = gtmContainerId === '' ? null : gtmContainerId
  const tags = (options.tags ?? []).map(resolveTag)
  const tagIds = new Set<string>()

  for (const tag of tags) {
    if (tagIds.has(tag.id)) {
      throw new Error(`Duplicate tag id: "${tag.id}"`)
    }

    tagIds.add(tag.id)
  }

  for (const language of Object.keys(options.messages ?? {})) {
    if (language !== 'en' && language !== 'cy' && options.translate === undefined) {
      logger.warn(`Messages for "${language}" cannot be selected without a host translator`)
    }
  }

  const localize = (language: string, request?: unknown, response?: unknown) => {
    const hostTranslator = request === undefined && response === undefined ? undefined : options.translate
    const messages = resolveMessages(language, options.messages, hostTranslator, request, response)
    const translate = createMessageResolver(language, options.messages, hostTranslator, request, response)
    const categories = options.categories === undefined
      ? buildDefaultCategories(messages)
      : options.categories.flatMap((category) =>
          typeof category === 'string' ? buildCategoryPreset(category, messages) : [category]
        )
    const tagCookies = tags.map((tag) => {
      const tagTranslate: typeof translate = (key, fallback, values) =>
        translate(key.startsWith(MESSAGE_PREFIX) ? key : `${MESSAGE_PREFIX}tags.${tag.id}.${key}`, fallback, values)

      return { tag, cookies: tag.cookies(messages, tagTranslate), tagTranslate }
    })
    const cookies = resolveCookieDefinitions(options, tagCookies.flatMap(({ cookies }) => cookies), categories, { cookieName, cookieMaxAge, messages }, translate)
    const tagDescriptions = tagCookies.flatMap(({ tag, cookies, tagTranslate }) => {
      const categoryId = cookies[0]?.categoryId
      const text = typeof tag.description === 'function' ? tag.description(messages, tagTranslate) : tag.description
      return categoryId !== undefined && text ? [{ categoryId, text }] : []
    })

    return { messages, categories, cookies, tagDescriptions, translateMessage: translate }
  }
  const { messages, categories, cookies, tagDescriptions } = localize('en')
  const localizedDisplay = (language: string, request?: unknown, response?: unknown) => {
    const localized = localize(language, request, response)
    const categoriesById = new Map(localized.categories.map((category) => [category.id, category]))
    const cookiesByName = new Map(localized.cookies.map((cookie) => [cookie.name, cookie]))

    return {
      messages: localized.messages,
      translateMessage: localized.translateMessage,
      categories: categories.map((category) => {
        const translation = categoriesById.get(category.id)
        return translation === undefined ? category : {
          ...category,
          title: translation.title,
          description: translation.description,
          shortName: translation.shortName
        }
      }),
      cookies: cookies.map((cookie) => {
        const translation = cookiesByName.get(cookie.name)
        return translation === undefined ? cookie : {
          ...cookie,
          purpose: translation.purpose,
          expiry: translation.expiry,
          provider: translation.provider
        }
      }),
      tagDescriptions: localized.tagDescriptions
    }
  }

  return {
    gtmContainerId: resolvedGtmContainerId,
    cookieName,
    cookieVersion,
    routePrefix: normaliseRoutePrefix(options.routePrefix ?? defaults.routePrefix),
    cookiesPageUrl: resolveCookiesPageUrl(options.cookiesPageUrl),
    consentWaitForUpdate: resolveWaitForUpdate(options.consentWaitForUpdate),
    categories,
    cookies,
    tagDescriptions,
    serviceName: options.serviceName ?? defaults.serviceName,
    messages,
    logger,
    translateMessage: createMessageResolver('en', options.messages),
    hasHostTranslator: options.translate !== undefined,
    getLanguage: options.getLanguage,
    localize: localizedDisplay,
    csp: mergeCspDirectives(gtmCspDirectives, ...tags.map((tag) => tag.csp)),
    gtmRestrictions: resolveGtmRestrictions({
      allowlist: options.gtmAllowlist,
      blocklist: options.gtmBlocklist,
      tags
    }),
    getNonce: options.getNonce,
    getCsrfFormFields: options.getCsrfFormFields,
    verifyCsrfFormSubmission: options.verifyCsrfFormSubmission,
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
  tagCookies: CookieDefinition[],
  categories: ResolvedOptions['categories'],
  defaultsContext: {
    cookieName: string
    cookieMaxAge: number
    messages: ResolvedOptions['messages']
  },
  translate: (key: string, fallback?: string) => string
): CookieDefinition[] {
  const includeDefaults = options.includeDefaultCookies ?? true
  const defaults = includeDefaults ? defaultCookieDefinitions(defaultsContext) : []
  const suppliedCookies: CookieDefinition[] = []

  suppliedCookies.push(...tagCookies)

  for (const cookie of options.cookies ?? []) {
    suppliedCookies.push(
      ...(typeof cookie === 'function' ? cookie(defaultsContext.messages, translate) : [cookie])
    )
  }

  const merged = mergeCookieDefinitions(defaults, suppliedCookies)
  const categoriesById = new Map(categories.map((category) => [category.id, category]))

  return merged.map((cookie) => {
    const category = categoriesById.get(cookie.categoryId)

    if (
      typeof cookie.name !== 'string' ||
      cookie.name.trim() === '' ||
      typeof cookie.purpose !== 'string' ||
      cookie.purpose.trim() === '' ||
      typeof cookie.expiry !== 'string' ||
      cookie.expiry.trim() === '' ||
      category === undefined
    ) {
      throw new Error(`Invalid cookie definition: ${JSON.stringify(cookie)}`)
    }

    const essential = category.essential === true
    const removeOnReject = cookie.removeOnReject ?? (essential ? 'never' : 'host-only')

    if (!COOKIE_REMOVALS.includes(removeOnReject) || (essential && removeOnReject !== 'never')) {
      throw new Error(`Invalid removeOnReject for cookie "${cookie.name}": ${String(cookie.removeOnReject)}`)
    }

    if (
      cookie.match !== undefined &&
      (typeof cookie.match !== 'string' || !COOKIE_GLOB.test(cookie.match) || /^\*+$/.test(cookie.match))
    ) {
      throw new Error(`Invalid match for cookie "${cookie.name}": ${String(cookie.match)}`)
    }

    const matchesConsentCookie =
      cookie.match === undefined
        ? cookie.name === defaultsContext.cookieName
        : new RegExp(globToPattern(cookie.match)).test(defaultsContext.cookieName)

    if (removeOnReject !== 'never' && matchesConsentCookie) {
      throw new Error(`The consent cookie "${defaultsContext.cookieName}" cannot be removed on reject`)
    }

    const { purposeKey, expiryKey, providerKey, ...definition } = cookie

    return {
      ...definition,
      purpose: purposeKey === undefined ? cookie.purpose : translate(purposeKey, cookie.purpose),
      expiry: expiryKey === undefined ? cookie.expiry : translate(expiryKey, cookie.expiry),
      provider: providerKey === undefined ? cookie.provider : translate(providerKey, cookie.provider ?? ''),
      removeOnReject
    }
  })
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
