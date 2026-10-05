import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveOptions } from '../src/consent/options.js'
import { googleAnalytics } from '../src/tags/google-analytics.js'
import { defaultMessages, getDefaultMessages, negotiateLanguage, resolveMessages, selectLanguage } from '../src/consent/messages.js'
import { createConsentContext } from '../src/integrations/core.js'
import { safeInternalPath, normaliseRoutePrefix } from '../src/shared/url.js'
import type { ConsentMessages, TranslateMessage } from '../src/consent/types.js'

const originalContainerId = process.env.GTM_CONTAINER_ID
const originalGaMeasurementId = process.env.GA_MEASUREMENT_ID
const originalNodeEnv = process.env.NODE_ENV

function restore(key: 'GTM_CONTAINER_ID' | 'GA_MEASUREMENT_ID' | 'NODE_ENV', value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}

beforeEach(() => {
  delete process.env.GTM_CONTAINER_ID
  delete process.env.GA_MEASUREMENT_ID
})

afterEach(() => {
  restore('GTM_CONTAINER_ID', originalContainerId)
  restore('GA_MEASUREMENT_ID', originalGaMeasurementId)
  restore('NODE_ENV', originalNodeEnv)
})

describe('resolveOptions', () => {
  it('uses the request translator for built-in and custom cookie copy with literal fallback', async () => {
    const options = resolveOptions({
      tags: [googleAnalytics({ measurementId: 'G-ABC123' })],
      cookies: [
        { name: 'custom_id', categoryId: 'analytics', purpose: 'Default purpose', purposeKey: 'govuk-analytics-consent.cookies.custom.purpose', expiry: '1 day', expiryKey: 'govuk-analytics-consent.cookies.custom.expiry', provider: 'Example provider', providerKey: 'govuk-analytics-consent.cookies.custom.provider' },
        (_messages, translate) => [{ name: 'factory_id', categoryId: 'analytics', purpose: translate('govuk-analytics-consent.cookies.factory.purpose', 'Factory fallback'), expiry: 'Session' }]
      ],
      translate: (key, { request, response, values }) => {
        expect(response).toBe((request as { reply: unknown }).reply)
        if (key === 'govuk-analytics-consent.banner.title') return `Cookies: ${values?.serviceName ?? '{{serviceName}}'}`
        if (key === 'govuk-analytics-consent.cookies.categoryQuestion') return 'Accept {{label}} <cookies>?'
        if (key === 'govuk-analytics-consent.tags.google-analytics.description') return 'Description from host'
        return (request as { copy: Record<string, string> }).copy[key]
      }
    })
    const french = { reply: {}, headers: { 'accept-language': 'fr' }, copy: {
      'govuk-analytics-consent.cookies.custom.purpose': 'But en francais',
      'govuk-analytics-consent.cookies.factory.purpose': 'Fabrique'
    } }
    const welsh = { reply: {}, headers: { 'accept-language': 'cy' }, copy: {} }
    const [frContext, cyContext] = await Promise.all([
      createConsentContext(options, { request: french, response: french.reply }),
      createConsentContext(options, { request: welsh, response: welsh.reply })
    ])

    expect(frContext.banner).toContain('Cookies: this service')
    expect(frContext.cookiesPage).toContain('Accept analytics &lt;cookies&gt;?')
    expect(frContext.cookiesPage).not.toContain('Accept analytics <cookies>?')
    expect(frContext.cookies.find((cookie) => cookie.name === 'custom_id')?.purpose).toBe('But en francais')
    expect(frContext.cookies.find((cookie) => cookie.name === 'factory_id')?.purpose).toBe('Fabrique')
    expect(frContext.tagDescriptions[0]?.text).toBe('Description from host')
    expect(frContext.messages.banner.rejectAll).toBe(defaultMessages.en.banner.rejectAll)
    expect(cyContext.cookies.find((cookie) => cookie.name === 'custom_id')?.purpose).toBe('Default purpose')
    expect(cyContext.cookies.find((cookie) => cookie.name === 'custom_id')?.provider).toBe('Example provider')
    expect(cyContext.cookies.find((cookie) => cookie.name === 'factory_id')?.purpose).toBe('Factory fallback')
    expect(cyContext.messages.banner.rejectAll).toBe(defaultMessages.cy.banner.rejectAll)
    expect(options.cookies.find((cookie) => cookie.name === 'custom_id')?.purpose).toBe('Default purpose')
  })

  it('uses nested messages without a host library and only warns about unusable language catalogs', async () => {
    const warnings: string[] = []
    const logger = {
      debug: (_message: string, ..._meta: unknown[]) => {},
      info: (_message: string, ..._meta: unknown[]) => {},
      warn: (message: string, ..._meta: unknown[]) => warnings.push(message),
      error: (_message: string, ..._meta: unknown[]) => {}
    }
    const options = resolveOptions({
      logger,
      messages: { en: { 'govuk-analytics-consent': { banner: { acceptAll: 'Accept here' } } }, fr: { 'govuk-analytics-consent': { banner: { acceptAll: 'Accepter' } } } },
      cookies: [{ name: 'custom_id', categoryId: 'analytics', purpose: 'Purpose', purposeKey: 'govuk-analytics-consent.cookies.custom.purpose', expiry: 'Session' }]
    })
    const context = await createConsentContext(options, { request: { headers: { 'accept-language': 'fr' } } })

    expect(context.messages.banner.acceptAll).toBe('Accept here')
    expect(context.cookies.find((cookie) => cookie.name === 'custom_id')?.purpose).toBe('Purpose')
    expect(options.logger).toBe(logger)
    expect(warnings).toEqual([expect.stringContaining('"fr"')])
    expect(resolveMessages('cy', {
      en: { 'govuk-analytics-consent': { banner: { acceptAll: 'Accept here' } } }
    }).banner.acceptAll).toBe(defaultMessages.cy.banner.acceptAll)
  })

  it('uses console as the default logger', () => {
    expect(resolveOptions().logger).toBe(console)
  })

  it('scopes custom tag translation keys to its definition id', async () => {
    const keys: string[] = []
    const options = resolveOptions({
      tags: [{
        id: 'my-tag',
        csp: {},
        description: (_messages: ConsentMessages, translate: TranslateMessage) => translate('description', 'Tag fallback'),
        cookies: (_messages: ConsentMessages, translate: TranslateMessage) => [{
          name: 'my_tag', categoryId: 'analytics',
          purpose: translate('cookies.my_tag.purpose', 'Purpose fallback'), expiry: 'Session'
        }]
      }],
      translate: (key) => {
        if (key.startsWith('govuk-analytics-consent.tags.my-tag.')) keys.push(key)
        return key.endsWith('.description') ? 'Translated tag' : undefined
      }
    })
    const context = await createConsentContext(options, { request: { headers: { 'accept-language': 'en' } } })

    expect(keys).toEqual([
      'govuk-analytics-consent.tags.my-tag.cookies.my_tag.purpose',
      'govuk-analytics-consent.tags.my-tag.description'
    ])
    expect(context.tagDescriptions[0]?.text).toBe('Translated tag')
    expect(context.cookies.find((cookie) => cookie.name === 'my_tag')?.purpose).toBe('Purpose fallback')
  })

  it('localizes categories and built-in cookie descriptions per request', async () => {
    const options = resolveOptions({
      tags: [googleAnalytics({ measurementId: 'G-ABC123' })],
      messages: { cy: { 'govuk-analytics-consent': {
        categories: { analytics: { title: 'Dadansoddi' } },
        tags: { 'google-analytics': { cookies: { ga: { purpose: 'Cyfrif ymweliadau' } } } }
      } } }
    })
    const english = await createConsentContext(options, { request: { headers: { 'accept-language': 'en' } } })
    const welsh = await createConsentContext(options, { request: { headers: { 'accept-language': 'cy' } } })

    expect(english.categories.find((category) => category.id === 'analytics')?.title).toBe(defaultMessages.en.categories.analytics.title)
    expect(welsh.categories.find((category) => category.id === 'analytics')?.title).toBe('Dadansoddi')
    expect(english.cookies.find((cookie) => cookie.name === '_ga')?.purpose).toBe(defaultMessages.en.tags['google-analytics'].cookies.ga.purpose)
    expect(welsh.cookies.find((cookie) => cookie.name === '_ga')?.purpose).toBe('Cyfrif ymweliadau')
    expect(welsh.cookies.find((cookie) => cookie.name === options.cookieName)?.purpose).toBe(defaultMessages.cy.cookies.consent.purpose)
    expect(welsh.categories.map((category) => category.id)).toEqual(english.categories.map((category) => category.id))
    expect(welsh.cookies.map((cookie) => cookie.name)).toEqual(english.cookies.map((cookie) => cookie.name))
  })

  it('keeps consent and removal identifiers stable when a factory changes them by language', async () => {
    const options = resolveOptions({
      cookies: [(messages) => [{
        name: messages.banner.acceptAll === defaultMessages.cy.banner.acceptAll ? 'other_id' : 'tracking_id',
        categoryId: 'analytics',
        purpose: messages.banner.acceptAll,
        expiry: '1 year'
      }]]
    })
    const welsh = await createConsentContext(options, { request: { headers: { 'accept-language': 'cy' } } })

    expect(welsh.cookies.find((cookie) => cookie.name === 'tracking_id')).toEqual(
      expect.objectContaining({ name: 'tracking_id', categoryId: 'analytics' })
    )
    expect(welsh.cookies.some((cookie) => cookie.name === 'other_id')).toBe(false)
  })

  it('uses an async service language callback before browser preferences', async () => {
    const options = resolveOptions({ getLanguage: async () => 'cy-GB' })
    const context = await createConsentContext(options, { request: { headers: { 'accept-language': 'en' } } })

    expect(context.messages.banner.acceptAll).toBe(defaultMessages.cy.banner.acceptAll)
    const browserOptions = resolveOptions({ getLanguage: () => undefined })
    const browser = await createConsentContext(browserOptions, { request: { headers: { 'accept-language': 'cy' } } })
    expect(browser.messages.banner.acceptAll).toBe(defaultMessages.cy.banner.acceptAll)
  })

  it('negotiates a supported browser language, including regional preferences and quality', () => {
    expect(negotiateLanguage('en-GB,en;q=0.9,cy-GB;q=0.8')).toBe('en')
    expect(negotiateLanguage('en;q=0.2,cy-GB;q=0.9')).toBe('cy')
    expect(negotiateLanguage('fr,cy;q=0.8,en;q=0.7')).toBe('cy')
    expect(negotiateLanguage('cy;q=0,en;q=0.5')).toBe('en')
    expect(negotiateLanguage('fr,es')).toBe('en')
    expect(negotiateLanguage('cy;q=invalid')).toBe('en')
    expect(negotiateLanguage()).toBe('en')
    expect(selectLanguage('CY-gb')).toBe('cy')
    expect(selectLanguage('fr')).toBe('en')
  })

  it('applies only the selected language overrides and falls back to overridden English', () => {
    const messages = {
      en: { 'govuk-analytics-consent': { banner: { acceptAll: 'Accept' } } },
      cy: { 'govuk-analytics-consent': { banner: { acceptAll: 'Derbyn' } } }
    }

    expect(resolveMessages('cy', messages).banner.acceptAll).toBe('Derbyn')
    expect(resolveMessages('cy', messages).banner.rejectAll).toBe(defaultMessages.cy.banner.rejectAll)
    expect(resolveMessages('cy', { en: messages.en }).banner.acceptAll).toBe(defaultMessages.cy.banner.acceptAll)
    expect(resolveMessages('en', messages).banner.acceptAll).toBe('Accept')
    expect(resolveMessages('fr', messages).banner.acceptAll).toBe('Accept')
  })

  it('falls back to English when a language has no built-in messages', () => {
    expect(getDefaultMessages('cy')).toBe(defaultMessages.cy)
    expect(getDefaultMessages('fr')).toBe(defaultMessages.en)
    expect(getDefaultMessages('toString')).toBe(defaultMessages.en)
    expect(resolveOptions().localize('en').messages.banner.acceptAll).toBe('Accept all cookies')
  })

  it('builds category presets with the resolved localized messages', () => {
    const resolved = resolveOptions({
      categories: ['default', 'personalization']
    })

    expect(resolved.localize('cy').categories.map(({ title, description }) => [title, description])).toEqual([
      [defaultMessages.cy.categories.essential.title, defaultMessages.cy.categories.essential.description],
      [defaultMessages.cy.categories.analytics.title, defaultMessages.cy.categories.analytics.description],
      [defaultMessages.cy.categories.personalization.title, defaultMessages.cy.categories.personalization.description]
    ])
  })

  it('rejects an unknown category preset', () => {
    expect(() => resolveOptions({ categories: ['custom' as never] })).toThrow(
      'Unknown category preset: custom'
    )
  })

  it('applies documented defaults', () => {
    const resolved = resolveOptions()

    expect(resolved.cookieName).toBe('govuk_analytics_consent')
    expect(resolved.cookieVersion).toBe(1)
    expect(resolved.routePrefix).toBe('/govuk-analytics-consent')
    expect(resolved.consentWaitForUpdate).toBe(500)
    expect(resolved.gtmContainerId).toBeNull()
    expect(resolved.cookiesPageUrl).toBeNull()
  })

  it('reads GTM_CONTAINER_ID from the environment', () => {
    process.env.GTM_CONTAINER_ID = 'GTM-ABC123'

    expect(resolveOptions().gtmContainerId).toBe('GTM-ABC123')
  })

  it('provides sensible default English copy', () => {
    const resolved = resolveOptions()

    expect(resolved.messages.banner.acceptAll).toBe('Accept all cookies')
    expect(resolved.messages.banner.rejectAll).toBe('Reject additional cookies')
    expect(resolved.messages.cookies.changeSettings).toBe('Change your cookie settings')
    expect(resolved.messages.cookies.saveSettings).toBe('Save cookie settings')
  })

  it('merges custom text over the default English copy', () => {
    const resolved = resolveOptions({
      messages: {
        en: {
          'govuk-analytics-consent': {
            banner: { acceptAll: 'Accept all', rejectAll: 'Reject all' },
            cookies: { changeSettings: 'Manage cookies' }
          }
        }
      }
    })

    expect(resolved.messages.banner.acceptAll).toBe('Accept all')
    expect(resolved.messages.banner.rejectAll).toBe('Reject all')
    expect(resolved.messages.cookies.changeSettings).toBe('Manage cookies')
    expect(resolved.messages.cookies.saveSettings).toBe('Save cookie settings')
  })

  it('prefers an explicit container id over the environment', () => {
    process.env.GTM_CONTAINER_ID = 'GTM-ABC123'

    expect(resolveOptions({ gtmContainerId: 'GTM-XYZ789' }).gtmContainerId).toBe('GTM-XYZ789')
  })

  it.each(["GTM-'+alert(1)+'", 'gtm-lowercase', 'UA-123456'])(
    'rejects the malformed container id %s',
    (value) => {
      expect(() => resolveOptions({ gtmContainerId: value })).toThrow(/Invalid GTM container ID/)
    }
  )

  it('normalises the route prefix', () => {
    expect(resolveOptions({ routePrefix: 'consent/' }).routePrefix).toBe('/consent')
    expect(() => resolveOptions({ routePrefix: '/' })).toThrow(/Invalid routePrefix/)
  })

  it.each([false, 0])('omits wait_for_update when set to %s', (value) => {
    expect(resolveOptions({ consentWaitForUpdate: value as number | false }).consentWaitForUpdate).toBeNull()
  })

  it('keeps a cookiesPageUrl that is a same-origin path', () => {
    expect(resolveOptions({ cookiesPageUrl: '/cookies' }).cookiesPageUrl).toBe('/cookies')
  })

  it.each(['//evil.example', 'https://evil.example/cookies', 'javascript:alert(1)'])(
    'drops the unsafe cookiesPageUrl %s',
    (value) => {
      expect(resolveOptions({ cookiesPageUrl: value }).cookiesPageUrl).toBeNull()
    }
  )

  it('rejects an invalid cookie name or version', () => {
    expect(() => resolveOptions({ cookieName: 'bad name' })).toThrow(/Invalid cookieName/)
    expect(() => resolveOptions({ cookieVersion: 0 })).toThrow(/Invalid cookieVersion/)
  })

  it('secures the cookie in production only', () => {
    process.env.NODE_ENV = 'production'
    expect(resolveOptions().cookie.secure).toBe(true)

    process.env.NODE_ENV = 'development'
    expect(resolveOptions().cookie.secure).toBe(false)
  })
})

describe('cookies table defaults', () => {
  it('always documents the consent cookie itself', () => {
    const resolved = resolveOptions({ cookieName: 'my_policy' })

    expect(resolved.cookies).toContainEqual(
      expect.objectContaining({ name: 'my_policy', categoryId: 'essential' })
    )
  })

  it('generates GA cookie rows from a full measurement ID', () => {
    const resolved = resolveOptions({
      tags: [googleAnalytics({ measurementId: 'G-ABC123' })],
      messages: {
        en: {
          'govuk-analytics-consent': {
            tags: {
              'google-analytics': {
                cookies: {
                  ga: { purpose: 'Custom analytics purpose' },
                  session: { purpose: 'Custom session purpose' }
                },
                provider: 'Custom provider',
                expiry: 'Custom duration'
              }
            }
          }
        }
      }
    })

    expect(resolved.cookies).toContainEqual(
      expect.objectContaining({
        name: '_ga',
        categoryId: 'analytics',
        purpose: 'Custom analytics purpose',
        provider: 'Custom provider',
        expiry: 'Custom duration',
        removeOnReject: 'host-and-parents'
      })
    )
    expect(resolved.cookies).toContainEqual(
      expect.objectContaining({
        name: '_ga_ABC123',
        categoryId: 'analytics',
        purpose: 'Custom session purpose',
        provider: 'Custom provider',
        expiry: 'Custom duration',
        match: '_ga_*',
        removeOnReject: 'host-and-parents'
      })
    )
  })

  it('uses a generic GA4 cookie name when no measurement ID is supplied', () => {
    const resolved = resolveOptions({ tags: [googleAnalytics()] })

    expect(resolved.cookies.map((cookie) => cookie.name)).toEqual([
      'govuk_analytics_consent',
      '_ga',
      '_ga_<id>'
    ])
  })

  it('reads the GA measurement ID from the environment when no ID is passed', () => {
    process.env.GA_MEASUREMENT_ID = 'G-ENV123'
    const resolved = resolveOptions({ tags: [googleAnalytics()] })

    expect(resolved.cookies.map((cookie) => cookie.name)).toEqual([
      'govuk_analytics_consent',
      '_ga',
      '_ga_ENV123'
    ])
  })

  it('prefers an explicit GA measurement ID over the environment', () => {
    process.env.GA_MEASUREMENT_ID = 'G-ENV123'
    const resolved = resolveOptions({ tags: [googleAnalytics({ measurementId: 'G-EXPLICIT456' })] })

    expect(resolved.cookies.some((cookie) => cookie.name === '_ga_EXPLICIT456')).toBe(true)
    expect(resolved.cookies.some((cookie) => cookie.name === '_ga_ENV123')).toBe(false)
  })

  it.each(['GA-12345', 'G-abc123', 'UA-123456', 'G-ABC 123'])(
    'rejects the malformed GA measurement ID %s',
    (value) => {
      expect(() => googleAnalytics({ measurementId: value })).toThrow(/Invalid GA measurement ID/)
    }
  )

  it('does not add GA rows unless explicitly supplied', () => {
    const defaults = resolveOptions({ gtmContainerId: 'GTM-ABC123' })
    const withGaCookies = resolveOptions({
      gtmContainerId: 'GTM-ABC123',
      tags: [googleAnalytics({ measurementId: 'G-ABC123' })]
    })

    expect(defaults.cookies.some((cookie) => cookie.categoryId === 'analytics')).toBe(false)
    expect(withGaCookies.cookies.map((cookie) => cookie.name)).toEqual([
      'govuk_analytics_consent',
      '_ga',
      '_ga_ABC123'
    ])
  })

  it('lets a user-supplied cookie override a default with the same name', () => {
    const resolved = resolveOptions({
      cookieName: 'my_policy',
      cookies: [{ name: 'my_policy', categoryId: 'essential', purpose: 'Custom purpose', expiry: '1 day' }]
    })

    expect(resolved.cookies).toContainEqual({
      name: 'my_policy',
      categoryId: 'essential',
      purpose: 'Custom purpose',
      expiry: '1 day',
      removeOnReject: 'never'
    })
  })

  it('defaults removeOnReject to host-only for non-essential cookies and host-and-parents for GA', () => {
    const resolved = resolveOptions({
      gtmContainerId: 'GTM-ABC123',
      tags: [googleAnalytics({ measurementId: 'G-ABC123' })],
      cookies: [
        { name: 'hotjar', categoryId: 'analytics', purpose: 'Heatmaps', expiry: '1 year' }
      ]
    })
    const removal = (name: string): string | undefined =>
      resolved.cookies.find((cookie) => cookie.name === name)?.removeOnReject

    expect(removal('hotjar')).toBe('host-only')
    expect(removal('_ga')).toBe('host-and-parents')
    expect(removal('_ga_ABC123')).toBe('host-and-parents')
    expect(removal(resolved.cookieName)).toBe('never')
  })

  it('rejects invalid removal settings', () => {
    const base = { name: 'x', purpose: 'p', expiry: '1 day' }

    expect(() =>
      resolveOptions({ cookies: [{ ...base, categoryId: 'essential', removeOnReject: 'host-only' }] })
    ).toThrow(/removeOnReject/)
    expect(() =>
      resolveOptions({
        cookies: [{ ...base, categoryId: 'analytics', removeOnReject: 'always' as never }]
      })
    ).toThrow(/removeOnReject/)
    expect(() => resolveOptions({ cookies: [{ ...base, categoryId: 'analytics', match: '' }] })).toThrow(
      /match/
    )
    expect(() => resolveOptions({ cookies: [{ ...base, categoryId: 'analytics', match: '**' }] })).toThrow(
      /match/
    )
    expect(() => resolveOptions({ cookies: [{ ...base, categoryId: 'analytics', match: 'a b*' }] })).toThrow(
      /match/
    )
    expect(() => resolveOptions({ cookies: [{ ...base, categoryId: 'analytics', match: 'govuk_*' }] })).toThrow(
      /consent cookie/
    )
    expect(() =>
      resolveOptions({ cookies: [{ ...base, categoryId: 'analytics', match: 'govuk_*', removeOnReject: 'never' }] })
    ).not.toThrow()
  })

  it('adds a user-supplied cookie alongside the defaults', () => {
    const resolved = resolveOptions({
      cookies: [{ name: 'session_id', categoryId: 'essential', purpose: 'Keeps you signed in', expiry: 'Session' }]
    })

    expect(resolved.cookies.some((cookie) => cookie.name === 'session_id')).toBe(true)
    expect(resolved.cookies.length).toBeGreaterThan(1)
  })

  it('omits every default cookie when includeDefaultCookies is false', () => {
    const resolved = resolveOptions({ gtmContainerId: 'GTM-ABC123', includeDefaultCookies: false })

    expect(resolved.cookies).toEqual([])
  })

  it('rejects a cookie definition referencing an unknown category', () => {
    expect(() =>
      resolveOptions({
        cookies: [{ name: 'x', categoryId: 'marketing', purpose: 'p', expiry: '1 year' }]
      })
    ).toThrow(/Invalid cookie definition/)
  })

  it('rejects a cookie definition with a blank field', () => {
    expect(() =>
      resolveOptions({
        cookies: [{ name: '', categoryId: 'essential', purpose: 'p', expiry: '1 year' }]
      })
    ).toThrow(/Invalid cookie definition/)
  })
})

describe('safeInternalPath', () => {
  it('keeps same-origin paths', () => {
    expect(safeInternalPath('/start?a=1')).toBe('/start?a=1')
  })

  it('returns the validated decoded path instead of the raw input', () => {
    expect(safeInternalPath('/%73tart')).toBe('/start')
  })

  it.each([
    '//evil.example',
    '/\\evil.example',
    '/%5C%5Cevil.example',
    '/%2f%2fevil.example',
    '/%5cjavascript:alert(1)',
    '/%252f%252fevil.example',
    '/%25252f%25252fevil.example',
    '/invalid%encoding',
    'https://evil.example',
    'javascript:alert(1)',
    '',
    42
  ])('rejects %s', (value) => {
    expect(safeInternalPath(value)).toBe('/')
  })
})

describe('normaliseRoutePrefix', () => {
  it('adds a leading slash and strips trailing slashes', () => {
    expect(normaliseRoutePrefix('a/b//')).toBe('/a/b')
  })
})
