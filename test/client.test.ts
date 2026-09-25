// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { resolveOptions } from '../src/consent/options.js'
import { createInitialState, withCategoryChoices } from '../src/consent/state.js'
import { serialiseConsent } from '../src/consent/cookie.js'
import { renderConsentBanner, renderConsentCookiesPage, renderConsentScripts } from '../src/ui/html.js'
import { buildViewModel } from '../src/ui/view-model.js'
import { start } from '../src/client/index.js'
import { readConsent } from '../src/client/storage.js'
import type { ConsentState } from '../src/consent/types.js'

const options = resolveOptions({ gtmContainerId: 'GTM-ABC123', consentWaitForUpdate: 500 })

function mount({ consent, cookiesPage = false }: { consent?: ConsentState; cookiesPage?: boolean } = {}): void {
  const viewModel = buildViewModel(options, { consent, currentPath: '/start' })

  document.head.innerHTML = renderConsentScripts(viewModel)
  document.body.innerHTML = cookiesPage
    ? renderConsentCookiesPage(viewModel)
    : renderConsentBanner(viewModel)
  window.dataLayer = []
  start()
}

function click(action: 'accept' | 'reject' | 'hide'): void {
  document.querySelector<HTMLElement>(`[data-consent-action="${action}"]`)?.click()
}

beforeEach(() => {
  document.cookie = `${options.cookieName}=; path=/; max-age=0`
  delete window.gtag
})

describe('browser consent manager', () => {
  it('shows the prompt when no choice has been made', () => {
    mount()

    expect(document.querySelector('[data-consent-state="prompt"]')).not.toBeNull()
    expect(window.dataLayer).toHaveLength(0)
  })

  it('stores consent and grants analytics storage on accept', () => {
    mount()
    click('accept')

    expect(readConsent(options.cookieName, options.cookieVersion).categories).toEqual({
      analytics: true
    })
    expect(window.dataLayer?.[0]).toEqual([
      'consent',
      'update',
      { security_storage: 'granted', analytics_storage: 'granted' }
    ])
  })

  it('stores consent and denies analytics storage on reject', () => {
    mount()
    click('reject')

    expect(readConsent(options.cookieName, options.cookieVersion).categories).toEqual({
      analytics: false
    })
    expect(window.dataLayer?.[0]).toEqual([
      'consent',
      'update',
      { security_storage: 'granted', analytics_storage: 'denied' }
    ])
  })

  it('emits a dataLayer event so GTM tags can trigger on the change', () => {
    mount()
    click('accept')

    expect(window.dataLayer?.[1]).toEqual({
      event: 'cookie_consent_update',
      analytics_consent: true
    })
  })

  it('prefers the gtag function defined by the head snippet', () => {
    const calls: unknown[][] = []
    window.gtag = (...args: unknown[]) => calls.push(args)

    mount()
    click('accept')

    expect(calls[0]).toEqual([
      'consent',
      'update',
      { security_storage: 'granted', analytics_storage: 'granted' }
    ])
  })

  it('swaps the prompt for the matching confirmation and focuses it', () => {
    mount()
    click('accept')

    const accepted = document.querySelector<HTMLElement>('[data-consent-state="accepted"]')

    expect(document.querySelector<HTMLElement>('[data-consent-state="prompt"]')?.hidden).toBe(true)
    expect(accepted?.hidden).toBe(false)
    expect(document.activeElement).toBe(accepted)
  })

  it('hides the banner from the confirmation message', () => {
    mount()
    click('accept')
    click('hide')

    expect(document.getElementById('govuk-analytics-consent-banner')?.hidden).toBe(true)
  })

  it('applies a stored choice to Consent Mode without rendering a banner', () => {
    const consent = withCategoryChoices(createInitialState(options.cookieVersion), { analytics: true })
    document.cookie = `${options.cookieName}=${serialiseConsent(consent)}; path=/`

    mount({ consent })

    expect(document.getElementById('govuk-analytics-consent-banner')).toBeNull()
    expect(window.dataLayer?.[0]).toEqual([
      'consent',
      'update',
      { security_storage: 'granted', analytics_storage: 'granted' }
    ])
  })

  it('does nothing when the configuration script tag is absent', () => {
    document.head.innerHTML = ''
    document.body.innerHTML = ''
    window.dataLayer = []

    expect(() => start()).not.toThrow()
    expect(window.dataLayer).toHaveLength(0)
  })
})

describe('cookies page', () => {
  it('is a plain form: start() does not error and applies the stored choice on the next load', () => {
    // Simulates the fresh page load after the cookies page form posts and redirects back.
    const consent = withCategoryChoices(createInitialState(options.cookieVersion), { analytics: true })
    document.cookie = `${options.cookieName}=${serialiseConsent(consent)}; path=/`

    expect(() => mount({ consent, cookiesPage: true })).not.toThrow()
    expect(document.querySelector('form input[name="cookies[analytics]"]')).not.toBeNull()
    expect(window.dataLayer?.[0]).toEqual([
      'consent',
      'update',
      { security_storage: 'granted', analytics_storage: 'granted' }
    ])
  })
})
