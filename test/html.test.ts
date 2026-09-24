import { describe, expect, it } from 'vitest'
import { resolveOptions } from '../src/consent/options.js'
import { createInitialState, withAnalytics } from '../src/consent/state.js'
import { renderConsentBanner, renderConsentScripts } from '../src/ui/html.js'
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
    expect(html).toContain('Accept analytics cookies')
    expect(html).toContain('Reject analytics cookies')
  })

  it('renders nothing once a choice exists', () => {
    const resolved = resolveOptions({ gtmContainerId: 'GTM-ABC123' })
    const consent = withAnalytics(createInitialState(resolved.cookieVersion), false)

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
    expect(banner({ cookiesPageUrl: '/cookies' })).toContain('href="/cookies"')
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
})
