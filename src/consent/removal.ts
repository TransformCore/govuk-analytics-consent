import { hasChoice, isCategoryAccepted } from './state.js'
import type { ConsentCategoryRef, ConsentState, CookieDefinition } from './types.js'

/** Deletion rule derived from a `CookieDefinition`; also serialised to the browser bundle. */
export interface CookieMatcher {
  /** Anchored RegExp source built by `globToPattern`, never user-supplied regex. */
  pattern: string
  parentDomains: boolean
}

export interface RemovalCategory extends ConsentCategoryRef {
  cookies: CookieMatcher[]
}

export interface CookieToRemove {
  name: string
  parentDomains: boolean
}

const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/
const HOSTNAME = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/
const IPV4 = /^\d+(\.\d+){3}$/
const EXPIRED = 'Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'

export function buildRemovalCategories(
  categories: ConsentCategoryRef[],
  cookies: CookieDefinition[]
): RemovalCategory[] {
  return categories
    .filter((category) => category.essential !== true)
    .map((category) => ({
      id: category.id,
      cookies: cookies
        .filter((cookie) => cookie.categoryId === category.id)
        .flatMap((cookie) => toMatcher(cookie))
    }))
}

function toMatcher(cookie: CookieDefinition): CookieMatcher[] {
  const removal = cookie.removeOnReject ?? 'host-only'

  if (removal === 'never') {
    return []
  }

  return [
    {
      pattern: cookie.match === undefined ? exactPattern(cookie.name) : globToPattern(cookie.match),
      parentDomains: removal === 'host-and-parents'
    }
  ]
}

/** Only `*` is special; it matches any run of cookie-name characters. */
export function globToPattern(glob: string): string {
  return `^${glob.split(/\*+/).map(escapeRegExp).join('[^=;\\s]*')}$`
}

function exactPattern(name: string): string {
  return `^${escapeRegExp(name)}$`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Nothing is removed until the user has made a choice. */
export function findCookiesToRemove(
  names: string[],
  state: ConsentState,
  categories: RemovalCategory[]
): CookieToRemove[] {
  if (!hasChoice(state)) {
    return []
  }

  const matchers = categories
    .filter((category) => !isCategoryAccepted(state, category))
    .flatMap((category) => category.cookies)
    .map((matcher) => ({ regex: new RegExp(matcher.pattern), parentDomains: matcher.parentDomains }))
  const removals: CookieToRemove[] = []

  for (const name of new Set(names)) {
    const matching = matchers.filter((matcher) => matcher.regex.test(name))

    if (matching.length > 0 && COOKIE_NAME.test(name)) {
      removals.push({ name, parentDomains: matching.some((matcher) => matcher.parentDomains) })
    }
  }

  return removals
}

/** `Domain` values to expire on; empty when the hostname is untrusted, an IP or a single label. */
export function cookieDomains(hostname: string, includeParents: boolean): string[] {
  const host = hostname.trim().toLowerCase()

  if (!HOSTNAME.test(host) || IPV4.test(host)) {
    return []
  }

  const labels = host.split('.')
  const domains = [host]

  if (includeParents) {
    // Browsers silently ignore public-suffix domains, so no suffix list is needed.
    for (let index = 1; index < labels.length - 1; index++) {
      domains.push(labels.slice(index).join('.'))
    }
  }

  return domains
}

/** A host-only cookie and one set with `Domain=<host>` are distinct, so both are expired. */
export function buildExpiryCookies(removals: CookieToRemove[], hostname: string): string[] {
  const headers: string[] = []

  for (const { name, parentDomains } of removals) {
    const attributes = name.startsWith('__Secure-') || name.startsWith('__Host-') ? `${EXPIRED}; Secure` : EXPIRED

    headers.push(`${name}=; ${attributes}`)

    if (!name.startsWith('__Host-')) {
      for (const domain of cookieDomains(hostname, parentDomains)) {
        headers.push(`${name}=; ${attributes}; Domain=${domain}`)
      }
    }
  }

  return headers
}
