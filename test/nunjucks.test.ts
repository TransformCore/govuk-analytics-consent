import nunjucks from 'nunjucks'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveOptions } from '../src/consent/options.js'
import { createConsentContext } from '../src/integrations/core.js'
import {
  govukAnalyticsConsentTemplatePath,
  MACRO_IMPORT_PATH,
  PAGE_TEMPLATE_IMPORT_PATH
} from '../src/ui/template-path.js'

const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader([
    govukAnalyticsConsentTemplatePath(),
    join(process.cwd(), 'node_modules', 'govuk-frontend', 'dist')
  ])
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

describe('GOV.UK page template', () => {
  function renderPage(template: string, includeContext = true): string {
    return env.renderString(template, includeContext ? { govukAnalyticsConsent: context } : {})
  }

  it('adds the consent fragments to the GOV.UK page template blocks', () => {
    const html = renderPage(`
      {% extends "${PAGE_TEMPLATE_IMPORT_PATH}" %}
      {% block content %}<h1>Example service</h1>{% endblock %}
    `)

    expect(html.match(/dataLayer/g)?.length).toBeGreaterThan(0)
    expect(html.split(context.head)).toHaveLength(2)
    expect(html.split(context.noscript)).toHaveLength(2)
    expect(html.split(context.banner)).toHaveLength(2)
    expect(html.split(context.scripts)).toHaveLength(2)
    expect(html.indexOf(context.head)).toBeLessThan(html.indexOf('</head>'))
    expect(html.indexOf(context.noscript)).toBeGreaterThan(html.indexOf('<body'))
    expect(html.indexOf(context.noscript)).toBeLessThan(html.indexOf(context.banner))
    expect(html.indexOf(context.scripts)).toBeLessThan(html.indexOf('</body>'))
  })

  it('preserves child content added to the populated blocks with super()', () => {
    const html = renderPage(`
      {% extends "${PAGE_TEMPLATE_IMPORT_PATH}" %}
      {% block head %}{{ super() }}<meta name="service-head">{% endblock %}
      {% block bodyStart %}{{ super() }}<div id="service-body-start"></div>{% endblock %}
      {% block bodyEnd %}{{ super() }}<script src="/service.js"></script>{% endblock %}
    `)

    expect(html).toContain(context.head)
    expect(html).toContain(context.noscript)
    expect(html).toContain(context.banner)
    expect(html).toContain(context.scripts)
    expect(html).toContain('<meta name="service-head">')
    expect(html).toContain('<div id="service-body-start"></div>')
    expect(html).toContain('<script src="/service.js"></script>')
  })

  it('renders a valid GOV.UK page when the consent context is missing', () => {
    const html = renderPage(`
      {% extends "${PAGE_TEMPLATE_IMPORT_PATH}" %}
      {% block content %}<h1>Example service</h1>{% endblock %}
    `, false)

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<h1>Example service</h1>')
    expect(html).not.toContain('<noscript>')
    expect(html).not.toContain('govuk-cookie-banner')
  })
})
