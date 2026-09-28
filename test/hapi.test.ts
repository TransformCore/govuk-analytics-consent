  getCsrfFormFields: async () => ({ csrfToken: 'hapi-token' })
import Hapi from '@hapi/hapi'
import Vision from '@hapi/vision'
import nunjucks from 'nunjucks'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import govukAnalyticsConsentPlugin from '../src/integrations/hapi.js'
import { gaCookies } from '../src/consent/default-cookies.js'
import { govukAnalyticsConsentTemplatePath } from '../src/ui/template-path.js'
import type { ConsentRequestState } from '../src/integrations/core.js'

let server: Hapi.Server

beforeEach(async () => {
  server = Hapi.server()

  await server.register(Vision)

  const env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader([govukAnalyticsConsentTemplatePath(), 'test/fixtures'])
  )

  server.views({
    engines: {
      njk: {
        compile: (src: string, opts: { filename: string }) => {
          const template = new nunjucks.Template(src, env, opts.filename, true)
          return (ctx: object) => template.render(ctx)
        }
      }
    },
    relativeTo: process.cwd(),
    path: 'test/fixtures'
  })

  server.route({
    method: 'GET',
    path: '/start',
    handler: (_request, h) => h.view('page.njk')
  })

  server.ext('onPreAuth', (request, h) => {
    (request.plugins as Record<string, unknown>).blankie = {
      nonces: { script: 'blankie-nonce' }
    }
    return h.continue
  })

  await server.register({
    plugin: govukAnalyticsConsentPlugin,
    options: {
      gtmContainerId: 'GTM-ABC123',
      cookies: [gaCookies('G-ABC123')],
      getCsrfFormFields: async () => ({ csrfToken: 'hapi-token' })
    }
  })

  server.route({
    method: 'GET',
    path: '/request-consent/{category}',
    handler: (request) => {
      const consent = (request.app as { govukAnalyticsConsent: ConsentRequestState })
        .govukAnalyticsConsent

      return {
        hasChoice: consent.hasChoice,
        accepted: consent.isCategoryAccepted(request.params.category as string),
        state: consent.state
      }
    }
  })

  await server.initialize()
})

afterEach(async () => {
  await server.stop()
})

describe('hapi integration', () => {
  it('exposes consent state to request handlers', async () => {
    const withoutChoice = await server.inject('/request-consent/analytics')
    const essential = await server.inject('/request-consent/essential')
    const unknown = await server.inject('/request-consent/unknown')
    const consent = encodeURIComponent(
      JSON.stringify({
        version: 1,
        categories: { analytics: true },
        updatedAt: new Date().toISOString()
      })
    )
    const accepted = await server.inject({
      url: '/request-consent/analytics',
      headers: { cookie: `govuk_analytics_consent=${consent}` }
    })

    expect(JSON.parse(withoutChoice.payload)).toMatchObject({
      hasChoice: false,
      accepted: false,
      state: { categories: null }
    })
    expect(JSON.parse(essential.payload)).toMatchObject({ hasChoice: false, accepted: true })
    expect(JSON.parse(unknown.payload)).toMatchObject({ hasChoice: false, accepted: false })
    expect(JSON.parse(accepted.payload)).toMatchObject({ hasChoice: true, accepted: true })
  })

  it('serves the browser bundle', async () => {
    const response = await server.inject('/govuk-analytics-consent/consent.js')

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/javascript')
    expect(response.headers.etag).toBeDefined()
  })

  it('answers a matching If-None-Match with 304', async () => {
    const first = await server.inject('/govuk-analytics-consent/consent.js')
    const second = await server.inject({
      url: '/govuk-analytics-consent/consent.js',
      headers: { 'if-none-match': String(first.headers.etag) }
    })

    expect(second.statusCode).toBe(304)
  })

  it('sets the consent cookie and redirects on the no-JavaScript banner fallback', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/govuk-analytics-consent/consent',
      payload: 'preference=accept-all&returnUrl=/start',
      headers: { 'content-type': 'application/x-www-form-urlencoded' }
    })

    const cookie = String(response.headers['set-cookie'])

    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe('/start')
    expect(cookie).toContain('govuk_analytics_consent=')
    expect(decodeURIComponent(cookie)).toContain('"analytics":true')
    expect(cookie).toContain('SameSite=Lax')
  })

  it('records a granular per-category choice from the cookies page', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/govuk-analytics-consent/consent',
      payload: 'preference=save&cookies[analytics]=yes&returnUrl=/start',
      headers: { 'content-type': 'application/x-www-form-urlencoded' }
    })

    expect(decodeURIComponent(String(response.headers['set-cookie']))).toContain(
      '"analytics":true'
    )
    expect(response.headers.location).toBe('/start?cookies-updated=true')
  })

  it('refuses to redirect off-site', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/govuk-analytics-consent/consent',
      payload: 'preference=reject-all&returnUrl=//evil.example',
      headers: { 'content-type': 'application/x-www-form-urlencoded' }
    })

    expect(response.headers.location).toBe('/')
  })

  it('injects the consent context into rendered views', async () => {
    const response = await server.inject('/start')

    expect(response.statusCode).toBe(200)
    expect(response.result).toContain("gtag('consent','default'")
    expect(response.result).toContain('govuk-cookie-banner')
    expect(response.result).toContain('/govuk-analytics-consent/consent.js')
  })

  it('renders async host-provided hidden fields in the banner form', async () => {
    const response = await server.inject('/start')

    expect(response.result).toContain('name="csrfToken" value="hapi-token"')
  })

  it('uses a Blankie-generated script nonce by default', async () => {
    const response = await server.inject('/start')

    expect(response.result).toContain('nonce="blankie-nonce"')
  })

  it('omits the banner once a choice has been stored', async () => {
    const consent = encodeURIComponent(
      JSON.stringify({
        version: 1,
        categories: { analytics: true },
        updatedAt: new Date().toISOString()
      })
    )

    const response = await server.inject({
      url: '/start',
      headers: { cookie: `govuk_analytics_consent=${consent}` }
    })

    expect(response.result).not.toContain('govuk-cookie-banner')
    expect(response.result).toContain("gtag('consent','default'")
  })

  it('expires GA cookies on the host and parent domains when rejecting', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/govuk-analytics-consent/consent',
      payload: 'preference=reject-all&returnUrl=/start',
      headers: {
        host: 'svc.example.com',
        cookie: '_ga=GA1.1.1; _ga_ABC123=GS1.1',
        'content-type': 'application/x-www-form-urlencoded'
      }
    })
    const cookies = response.headers['set-cookie'] as string[]

    expect(cookies).toContain('_ga=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Domain=example.com')
    expect(cookies.filter((cookie) => cookie.startsWith('_ga_ABC123=;'))).toHaveLength(3)
    expect(cookies.some((cookie) => cookie.startsWith('govuk_analytics_consent='))).toBe(true)
  })

  it('expires rejected cookies on later requests, including error responses', async () => {
    const consent = encodeURIComponent(
      JSON.stringify({ version: 1, categories: { analytics: false }, updatedAt: new Date().toISOString() })
    )
    const headers = { host: 'svc.example.com', cookie: `govuk_analytics_consent=${consent}; _ga=GA1.1.1` }
    const page = await server.inject({ url: '/start', headers })
    const notFound = await server.inject({ url: '/missing', headers })
    const clean = await server.inject({ url: '/start', headers: { cookie: `govuk_analytics_consent=${consent}` } })

    expect(page.headers['set-cookie']).toHaveLength(3)
    expect(notFound.statusCode).toBe(404)
    expect(notFound.headers['set-cookie']).toHaveLength(3)
    expect(clean.headers['set-cookie']).toBeUndefined()
  })

  it('awaits submission verification and rejects before setting cookies or redirecting', async () => {
    const guardedServer = Hapi.server()
    await guardedServer.register({
      plugin: govukAnalyticsConsentPlugin,
      options: {
        verifyCsrfFormSubmission: async (_request, body) => body.csrf === 'valid'
      }
    })
    await guardedServer.initialize()

    try {
      const rejected = await guardedServer.inject({
        method: 'POST',
        url: '/govuk-analytics-consent/consent',
        payload: 'csrf=invalid&preference=accept-all&returnUrl=%2Fstart',
        headers: { 'content-type': 'application/x-www-form-urlencoded' }
      })
      const accepted = await guardedServer.inject({
        method: 'POST',
        url: '/govuk-analytics-consent/consent',
        payload: 'csrf=valid&preference=accept-all&returnUrl=%2Fstart',
        headers: { 'content-type': 'application/x-www-form-urlencoded' }
      })

      expect(rejected.statusCode).toBe(403)
      expect(rejected.headers['set-cookie']).toBeUndefined()
      expect(rejected.headers.location).toBeUndefined()
      expect(accepted.statusCode).toBe(303)
      expect(accepted.headers['set-cookie']).toBeDefined()
    } finally {
      await guardedServer.stop()
    }
  })
})
