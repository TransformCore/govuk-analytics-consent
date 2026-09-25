import { describe, expect, it } from 'vitest'
import { resolveOptions } from '../src/consent/options.js'
import { createInitialState, withCategoryChoices } from '../src/consent/state.js'
import {
  renderConsentBanner,
  renderConsentCookiesPage,
  renderConsentScripts
} from '../src/ui/html.js'
import { buildViewModel } from '../src/ui/view-model.js'
import type { GovUkAnalyticsConsentOptions } from '../src/consent/types.js'

function banner(options: GovUkAnalyticsConsentOptions = {}, currentPath = '/start'): string {
  const resolved = resolveOptions({ gtmContainerId: 'GTM-ABC123', ...options })

  return renderConsentBanner(buildViewModel(resolved, { currentPath }))
}

describe('renderConsentBanner', () => {
  it('prompts when no choice has been made', () => {
    const html = banner()

    expect(html).toContain('govuk-cookie-banner')
    expect(html).toContain('Accept all cookies')
    expect(html).toContain('Reject additional cookies')
  })

  it('renders nothing once a choice exists', () => {
    const resolved = resolveOptions({ gtmContainerId: 'GTM-ABC123' })
    const consent = withCategoryChoices(createInitialState(resolved.cookieVersion), { analytics: false })

    expect(renderConsentBanner(buildViewModel(resolved, { consent }))).toBe('')
  })

  it('posts the no-JavaScript fallback to the consent route', () => {
    expect(banner()).toContain('action="/govuk-analytics-consent/consent"')
  })

  it('carries a safe return path', () => {
    expect(banner({}, '/start?a=1')).toContain('value="/start?a=1"')
    expect(banner({}, '//evil.example')).toContain('value="/"')
  })

  it('omits the View cookies link when no cookiesPageUrl is set', () => {
    expect(banner()).not.toContain('View cookies')
  })

  it('renders the View cookies link when a cookiesPageUrl is set', () => {
    expect(banner({ cookiesPageUrl: '/cookies' })).toContain('href="/cookies?returnUrl=')
  })

  it.each(['//evil.example', 'https://evil.example', 'javascript:alert(1)'])(
    'renders no link for the unsafe cookiesPageUrl %s',
    (cookiesPageUrl) => {
      expect(banner({ cookiesPageUrl })).not.toContain('View cookies')
    }
  )

  it('escapes the service name', () => {
    expect(banner({ serviceName: '<script>x</script>' })).not.toContain('<script>x')
  })

  it('hides the confirmation messages until a choice is made', () => {
    const html = banner()

    expect(html).toContain('data-consent-state="accepted" role="alert" tabindex="-1" hidden')
    expect(html).toContain('data-consent-state="rejected" role="alert" tabindex="-1" hidden')
  })
})

describe('renderConsentScripts', () => {
  it('passes the client configuration as data attributes', () => {
    const resolved = resolveOptions({ cookieName: 'my_policy', cookieVersion: 3 })
    const html = renderConsentScripts(buildViewModel(resolved))

    expect(html).toContain('src="/govuk-analytics-consent/consent.js"')
    expect(html).toContain('data-cookie-name="my_policy"')
    expect(html).toContain('data-cookie-version="3"')
    expect(html).toContain('defer')
  })

  it('serialises the category/signal config for the browser bundle', () => {
    const resolved = resolveOptions({ gtmContainerId: 'GTM-ABC123' })
    const html = renderConsentScripts(buildViewModel(resolved))

    expect(html).toContain('data-categories=')
    expect(html).toContain('analytics_storage')
  })
})

describe('renderConsentCookiesPage', () => {
  function cookiesPage(options: GovUkAnalyticsConsentOptions = {}, consent = createInitialState(1)): string {
    const resolved = resolveOptions({ gtmContainerId: 'GTM-ABC123', ...options })

    return renderConsentCookiesPage(buildViewModel(resolved, { consent }))
  }

  it('renders a heading and a Save button', () => {
    const html = cookiesPage()

    expect(html).toContain('<h1 class="govuk-heading-l">Cookies</h1>')
    expect(html).toContain('Change your cookie settings')
    expect(html).toContain('Save cookie settings')
  })

  it('lists the essential consent cookie in a table without a Yes/No toggle', () => {
    const html = cookiesPage({ cookieName: 'my_policy' })

    expect(html).toContain('my_policy')
    expect(html).toContain('These cookies always run.')
    expect(html).not.toContain('name="cookies[essential]"')
  })

  it('renders category and default-cookie copy from the configured messages', () => {
    const html = cookiesPage({
      messages: {
        essentialCategoryTitle: 'Cwcis hanfodol',
        essentialCategoryDescription: 'Mae hyn yn angenrheidiol.',
        analyticsCategoryTitle: 'Cwcis dadansoddi',
        analyticsCategoryDescription: 'Dadansoddiad.',
        defaultCookiePurpose: 'Cadw’ch dewisiadau.',
        tableHeaderName: 'Enw',
        tableHeaderPurpose: 'Pwrpas',
        tableHeaderExpiry: 'Dyddiad dod i ben'
      }
    })

    expect(html).toContain('Cwcis hanfodol')
    expect(html).toContain('Mae hyn yn angenrheidiol.')
    expect(html).toContain('Cwcis dadansoddi')
    expect(html).toContain('Cadw’ch dewisiadau.')
    expect(html).toContain('Enw')
    expect(html).toContain('Pwrpas')
  })

  it('lists the default GA cookies for the analytics category', () => {
    const html = cookiesPage()

    expect(html).toContain('_ga')
    expect(html).toContain('name="cookies[analytics]"')
  })

  it('omits the analytics cookies table when GTM is not configured', () => {
    const resolved = resolveOptions({})
    const html = renderConsentCookiesPage(buildViewModel(resolved, { consent: createInitialState(1) }))

    expect(html).not.toContain('_ga')
  })

  it('pre-checks the Yes radio matching an accepted choice', () => {
    const resolved = resolveOptions({ gtmContainerId: 'GTM-ABC123' })
    const accepted = withCategoryChoices(createInitialState(resolved.cookieVersion), { analytics: true })
    const html = renderConsentCookiesPage(buildViewModel(resolved, { consent: accepted }))

    expect(html).toContain('value="yes" checked')
  })

  it('defaults to the No radio when no choice has been made', () => {
    const html = cookiesPage()

    expect(html).toContain('value="no" checked')
    expect(html).not.toContain('value="yes" checked')
  })

  it('carries its own path as the hidden returnUrl so saving redirects back here', () => {
    const resolved = resolveOptions({ gtmContainerId: 'GTM-ABC123' })
    const html = renderConsentCookiesPage(buildViewModel(resolved, { currentPath: '/cookies?returnUrl=/start' }))

    expect(html).toContain('value="/cookies?returnUrl=/start"')
  })

  it('renders nothing when cookies have not just been saved', () => {
    expect(cookiesPage()).not.toContain('govuk-notification-banner')
  })

  it('renders a success banner linking back to the originating page once saved', () => {
    const resolved = resolveOptions({ gtmContainerId: 'GTM-ABC123' })
    const html = renderConsentCookiesPage(
      buildViewModel(resolved, { returnTo: '/start', cookiesSaved: true })
    )

    expect(html).toContain('govuk-notification-banner--success')
    expect(html).toContain('data-module="govuk-notification-banner"')
    expect(html).toContain('Success')
    expect(html).toContain('Go back to the page you were looking at')
    expect(html).toContain('href="/start"')
  })
})
