import nunjucks from 'nunjucks'
import { describe, expect, it } from 'vitest'
import { resolveOptions } from '../src/consent/options.js'
import { createConsentContext } from '../src/integrations/core.js'
import {
  govukAnalyticsConsentTemplatePath,
  MACRO_IMPORT_PATH
} from '../src/ui/template-path.js'

const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(govukAnalyticsConsentTemplatePath())
)

const context = createConsentContext(resolveOptions({ gtmContainerId: 'GTM-ABC123' }), {
  currentPath: '/start'
})

function render(macro: string): string {
  return env.renderString(
    `{% from "${MACRO_IMPORT_PATH}" import ${macro} %}{{ ${macro}(govukAnalyticsConsent) }}`,
    { govukAnalyticsConsent: context }
  )
}

describe('nunjucks macros', () => {
  it('renders the head snippet unescaped and identically to the HTML builder', () => {
    expect(render('govukAnalyticsConsentHead')).toBe(context.head)
  })

  it('renders the banner identically to the HTML builder', () => {
    expect(render('govukAnalyticsConsentBanner')).toBe(context.banner)
  })

  it('renders the cookies page identically to the HTML builder', () => {
    expect(render('govukAnalyticsConsentCookiesPage')).toBe(context.cookiesPage)
  })

  it('renders the script tag identically to the HTML builder', () => {
    expect(render('govukAnalyticsConsentScripts')).toBe(context.scripts)
  })

  it('renders the GTM noscript fallback', () => {
    expect(render('govukAnalyticsConsentNoscript')).toContain('<noscript>')
  })

  it('renders nothing rather than throwing when the context is missing', () => {
    const html = env.renderString(
      `{% from "${MACRO_IMPORT_PATH}" import govukAnalyticsConsentBanner %}{{ govukAnalyticsConsentBanner(undefined) }}`,
      {}
    )

    expect(html.trim()).toBe('')
  })
})
