import type { ResolvedOptions } from './types.js'

export function auditConfiguration(options: ResolvedOptions) {
  return {
    schemaVersion: 1 as const,
    cookieName: options.cookieName,
    cookieVersion: options.cookieVersion,
    cookiesPageUrl: options.cookiesPageUrl,
    categories: options.categories.map(({ id, essential }) => ({ id, essential: essential === true })),
    cookies: options.cookies.map(({ name, match, categoryId }) => ({
      name, ...(match === undefined ? {} : { match }), categoryId
    }))
  }
}