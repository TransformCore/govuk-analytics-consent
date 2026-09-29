import { parseCookieHeader } from '../dist/index.js'
import { safeInternalPath } from '../dist/shared/url.js'

export const languageCookieName = 'example_language'

export function exampleLanguage(cookieHeader) {
  return parseCookieHeader(cookieHeader)[languageCookieName] === 'cy' ? 'cy' : 'en'
}

export function languageView(cookieHeader, currentPath) {
  const htmlLang = exampleLanguage(cookieHeader)
  const nextLanguage = htmlLang === 'cy' ? 'en' : 'cy'

  return {
    htmlLang,
    languageSwitch: {
      href: `/language/${nextLanguage}?returnUrl=${encodeURIComponent(safeInternalPath(currentPath))}`,
      text: nextLanguage === 'cy' ? 'Cymraeg' : 'English'
    }
  }
}

export function languageReturnUrl(value) {
  return safeInternalPath(value)
}