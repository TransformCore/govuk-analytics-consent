function matchesGlob(name: string, glob: string): boolean {
  if (/[=;\s]/.test(name)) return false
  const parts = glob.split(/\*+/)
  const prefix = parts[0]!
  if (parts.length === 1) return name === prefix
  const suffix = parts[parts.length - 1]!
  if (!name.startsWith(prefix) || !name.endsWith(suffix) || name.length < prefix.length + suffix.length) return false
  let offset = prefix.length
  const end = name.length - suffix.length
  for (const part of parts.slice(1, -1)) {
    const position = name.indexOf(part, offset)
    if (position === -1 || position + part.length > end) return false
    offset = position + part.length
  }
  return true
}

export interface CookieDeclaration {
  name: string
  match?: string
  domain?: string
  path?: string
  categoryId?: string
}

export interface AuditCategory {
  id: string
  essential?: boolean
}

export interface CustomBanner {
  acceptSelector?: string
  rejectSelector?: string
}

export interface AuditConfig {
  mode: 'library' | 'custom'
  url: string
  pages: string[]
  cookies: CookieDeclaration[]
  categories?: AuditCategory[]
  cookiesPage?: string
  observationMs: number
  timeoutMs: number
  cookieName?: string
  cookieVersion?: number
  ignoreCookies?: string[]
  banner?: CustomBanner
}

export interface CookieIdentity {
  name: string
  domain: string
  path: string
  partitionKey?: string
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function keys(value: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error('Unknown audit configuration field')
  }
}

export function isInternalPath(value: unknown, origin: string): value is string {
  if (!text(value) || !value.startsWith('/') || value.startsWith('//')) return false
  try {
    const parsed = new URL(value, origin)
    return parsed.origin === origin && parsed.username === '' && parsed.password === '' && parsed.hash === ''
  } catch {
    return false
  }
}

export function parseAuditConfig(input: unknown): AuditConfig {
  if (!object(input)) throw new Error('Audit configuration must be an object')
  keys(input, ['mode', 'url', 'pages', 'cookies', 'categories', 'cookiesPage', 'observationMs', 'timeoutMs', 'cookieName', 'cookieVersion', 'ignoreCookies', 'banner'])
  const mode = input.mode ?? 'library'
  if (mode !== 'library' && mode !== 'custom') {
    throw new Error('mode must be either "library" or "custom"')
  }
  let target: URL
  try {
    if (!text(input.url)) throw new Error()
    target = new URL(input.url)
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash) {
      throw new Error()
    }
    if (target.pathname !== '/') throw new Error()
  } catch {
    throw new Error('url must be an HTTP(S) origin without credentials, path, query or fragment')
  }
  const pages = input.pages ?? ['/']
  if (!Array.isArray(pages) || pages.length === 0 || !pages.every((page) => isInternalPath(page, target.origin))) {
    throw new Error('pages must be a non-empty array of same-origin paths')
  }
  if (input.cookiesPage !== undefined && !isInternalPath(input.cookiesPage, target.origin)) {
    throw new Error('cookiesPage must be a same-origin path')
  }
  const observationMs = input.observationMs ?? 2000
  const timeoutMs = input.timeoutMs ?? 30000
  if (!Number.isInteger(observationMs) || Number(observationMs) < 100 || Number(observationMs) > 60000) {
    throw new Error('observationMs must be an integer between 100 and 60000')
  }
  if (!Number.isInteger(timeoutMs) || Number(timeoutMs) < 100 || Number(timeoutMs) > 120000) {
    throw new Error('timeoutMs must be an integer between 100 and 120000')
  }
  const token = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/
  if (input.ignoreCookies !== undefined && (!Array.isArray(input.ignoreCookies) ||
      !input.ignoreCookies.every((pattern) => text(pattern) && token.test(pattern)))) {
    throw new Error('ignoreCookies must be an array of non-empty cookie-name glob patterns')
  }
  if (input.cookieName !== undefined && (!text(input.cookieName) || !token.test(input.cookieName))) {
    throw new Error('cookieName must be a valid cookie name')
  }
  if (input.cookieVersion !== undefined && (!Number.isInteger(input.cookieVersion) || Number(input.cookieVersion) < 1)) {
    throw new Error('cookieVersion must be a positive integer')
  }
  let banner: CustomBanner | undefined
  if (mode === 'custom') {
    if (input.banner !== undefined && !object(input.banner)) throw new Error('banner must be an object')
    const bannerInput = input.banner ?? {}
    if (!object(bannerInput)) throw new Error('banner must be an object')
    keys(bannerInput, ['acceptSelector', 'rejectSelector'])
    const { acceptSelector, rejectSelector } = bannerInput
    if ((acceptSelector !== undefined && !text(acceptSelector)) ||
        (rejectSelector !== undefined && !text(rejectSelector)) ||
        (acceptSelector !== undefined && rejectSelector !== undefined && acceptSelector === rejectSelector)) {
      throw new Error('banner selectors must be non-empty and distinct when both are supplied')
    }
    if (input.categories !== undefined || input.cookiesPage !== undefined || input.cookieName !== undefined || input.cookieVersion !== undefined) {
      throw new Error('Custom banners support accept/reject only; omit categories, cookiesPage, cookieName and cookieVersion')
    }
    banner = {
      ...(acceptSelector === undefined ? {} : { acceptSelector }),
      ...(rejectSelector === undefined ? {} : { rejectSelector })
    }
  } else if (input.banner !== undefined) {
    throw new Error('banner selectors are only supported in custom mode')
  }
  let categories: AuditCategory[] | undefined
  if (input.categories !== undefined) {
    if (!Array.isArray(input.categories)) throw new Error('categories must be an array')
    categories = input.categories.map((category) => {
      if (!object(category)) throw new Error('Invalid category declaration')
      keys(category, ['id', 'essential'])
      if (!text(category.id) || !/^[a-zA-Z0-9_-]+$/.test(category.id) ||
          (category.essential !== undefined && typeof category.essential !== 'boolean')) {
        throw new Error('Invalid category declaration')
      }
      return { id: category.id, essential: category.essential === true }
    })
    if (new Set(categories.map((category) => category.id)).size !== categories.length) {
      throw new Error('Category IDs must be unique')
    }
    if (!text(input.cookiesPage)) throw new Error('cookiesPage is required for category checks')
  }
  if (!Array.isArray(input.cookies)) throw new Error('cookies must be an array of reviewed declarations')
  const cookies = input.cookies.map((cookie): CookieDeclaration => {
    if (!object(cookie)) throw new Error('Invalid cookie declaration')
    keys(cookie, ['name', 'match', 'domain', 'path', 'categoryId'])
    if (!text(cookie.name) || (cookie.match === undefined && !token.test(cookie.name)) ||
        (cookie.match !== undefined && (!text(cookie.match) || !token.test(cookie.match))) ||
        (cookie.domain !== undefined && (!text(cookie.domain) || !/^\.?[a-zA-Z0-9.-]+$/.test(cookie.domain))) ||
        (cookie.path !== undefined && (!text(cookie.path) || !cookie.path.startsWith('/'))) ||
        (cookie.categoryId !== undefined && (!text(cookie.categoryId) ||
          (categories !== undefined && !categories.some((category) => category.id === cookie.categoryId))))) {
      throw new Error('Invalid cookie declaration or category reference')
    }
    return {
      name: cookie.name, match: cookie.match as string | undefined,
      domain: cookie.domain as string | undefined, path: cookie.path as string | undefined,
      categoryId: cookie.categoryId as string | undefined
    }
  })
  return {
    mode, url: target.origin, pages: [...new Set(pages)] as string[], cookies, categories,
    cookiesPage: input.cookiesPage as string | undefined,
    observationMs: Number(observationMs), timeoutMs: Number(timeoutMs), cookieName: input.cookieName as string | undefined,
    cookieVersion: input.cookieVersion as number | undefined,
    ignoreCookies: input.ignoreCookies === undefined ? undefined : [...new Set(input.ignoreCookies as string[])],
    banner
  }
}

function normalizedDomain(domain: string): string {
  return domain.toLowerCase().replace(/^\./, '')
}

export function sameCookie(left: CookieIdentity, right: CookieIdentity): boolean {
  return left.name === right.name && normalizedDomain(left.domain) === normalizedDomain(right.domain) &&
    left.path === right.path && left.partitionKey === right.partitionKey
}

export function matchingIgnorePattern(name: string, patterns: string[] = []): string | undefined {
  return patterns.find((pattern) => matchesGlob(name, pattern))
}

export function matchingDeclarations(cookie: CookieIdentity, declarations: CookieDeclaration[]): CookieDeclaration[] {
  return declarations.filter((declaration) =>
    (declaration.match === undefined ? declaration.name === cookie.name : matchesGlob(cookie.name, declaration.match)) &&
    (declaration.domain === undefined || normalizedDomain(declaration.domain) === normalizedDomain(cookie.domain)) &&
    (declaration.path === undefined || declaration.path === cookie.path)
  )
}

export function cookieProblem(
  cookie: CookieIdentity,
  config: AuditConfig,
  accepted: string[],
  consentCookie?: CookieIdentity
): 'undeclared-cookie' | 'ignored-undeclared-cookie' | 'category-not-consented' | 'ambiguous-category' | undefined {
  if (consentCookie !== undefined && sameCookie(cookie, consentCookie)) return undefined
  const matches = matchingDeclarations(cookie, config.cookies)
  if (matches.length === 0) {
    return matchingIgnorePattern(cookie.name, config.ignoreCookies) === undefined ? 'undeclared-cookie' : 'ignored-undeclared-cookie'
  }
  if (config.categories === undefined) return undefined
  const categoryIds = new Set(matches.map((declaration) => declaration.categoryId))
  if (categoryIds.size > 1) return 'ambiguous-category'
  const categoryId = matches[0]?.categoryId
  if (categoryId !== undefined && !accepted.includes(categoryId) &&
      !config.categories.some((category) => category.id === categoryId && category.essential)) {
    return 'category-not-consented'
  }
  return undefined
}