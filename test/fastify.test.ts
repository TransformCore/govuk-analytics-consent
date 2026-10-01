import Fastify from 'fastify'
import nunjucks from 'nunjucks'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import govukAnalyticsConsentPlugin from '../src/integrations/fastify.js'
import { googleAnalytics } from '../src/tags/google-analytics.js'
import { govukAnalyticsConsentTemplatePath } from '../src/ui/template-path.js'
import type { FastifyInstance, FastifyReply } from 'fastify'

let server: FastifyInstance

beforeEach(async () => {
  server = Fastify()

  server.addHook('onRequest', async (_request, reply) => {
    const cspReply = reply as FastifyReply & {
      cspNonce?: { script: string }
      generateCsrf?: () => Promise<string>
    }
    cspReply.cspNonce = { script: 'fastify-nonce' }
    cspReply.generateCsrf = async () => 'fastify-token'
  })

  const env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader([govukAnalyticsConsentTemplatePath(), 'test/fixtures'])
  )

  await server.register(govukAnalyticsConsentPlugin, {
    gtmContainerId: 'GTM-ABC123',
    tags: [googleAnalytics({ measurementId: 'G-ABC123' })],
    messages: {
      en: { 'govuk-analytics-consent': { banner: { acceptAll: 'Accept everything' } } },
      cy: { 'govuk-analytics-consent': { banner: { acceptAll: 'Derbyn popeth' } } }
    },
    translate: (key, { request, response }) =>
      key === 'govuk-analytics-consent.banner.acceptAll' && response !== undefined
        ? (request as { headers: Record<string, unknown> }).headers['x-consent-copy'] as string | undefined
        : undefined,
    getCsrfFormFields: async (_request, response) => ({
      csrfToken: await (response as FastifyReply & { generateCsrf: () => Promise<string> }).generateCsrf()
    })
  })

  server.get('/start', (request, reply) => reply.type('text/html').send(env.render('page.njk', {
    govukAnalyticsConsent: request.govukAnalyticsConsentContext
  })))

  server.get<{ Params: { category: string } }>('/request-consent/:category', (request) => ({
    hasChoice: request.govukAnalyticsConsent.hasChoice,
    accepted: request.govukAnalyticsConsent.isCategoryAccepted(request.params.category),
    state: request.govukAnalyticsConsent.state
  }))

  await server.ready()
})

afterEach(async () => {
  await server.close()
})

describe('fastify integration', () => {
  it('uses the current request and reply for host translation', async () => {
    const translated = await server.inject({ url: '/start', headers: { 'x-consent-copy': 'From Fastify' } })
    const ordinary = await server.inject('/start')

    expect(translated.body).toContain('From Fastify')
    expect(ordinary.body).toContain('Accept everything')
  })

  it('renders each request in its preferred language with its own overrides', async () => {
    const english = await server.inject({ url: '/start', headers: { 'accept-language': 'en' } })
    const welsh = await server.inject({ url: '/start', headers: { 'accept-language': 'cy-GB' } })
    const fallback = await server.inject({ url: '/start', headers: { 'accept-language': 'fr' } })

    expect(english.body).toContain('Accept everything')
    expect(english.body).not.toContain('Derbyn popeth')
    expect(welsh.body).toContain('Derbyn popeth')
    expect(fallback.body).toContain('Accept everything')
  })

  it('uses Fastify reply CSP nonces and CSRF token generation', async () => {
    const response = await server.inject('/start')

    expect(response.body).toContain('nonce="fastify-nonce"')
    expect(response.body).toContain('name="csrfToken" value="fastify-token"')
  })

  it('exposes consent state to request handlers', async () => {
    const withoutChoice = await server.inject('/request-consent/analytics')
    const accepted = await server.inject({
      url: '/request-consent/analytics',
      headers: {
        cookie: `govuk_analytics_consent=${encodeURIComponent(JSON.stringify({
          version: 1,
          categories: { analytics: true },
          updatedAt: new Date().toISOString()
        }))}`
      }
    })

    expect(withoutChoice.json()).toMatchObject({ hasChoice: false, accepted: false })
    expect(accepted.json()).toMatchObject({ hasChoice: true, accepted: true })
  })

  it('serves the browser bundle and supports conditional requests', async () => {
    const first = await server.inject('/govuk-analytics-consent/consent.js')
    const second = await server.inject({
      url: '/govuk-analytics-consent/consent.js',
      headers: { 'if-none-match': String(first.headers.etag) }
    })

    expect(first.statusCode).toBe(200)
    expect(first.headers['content-type']).toContain('application/javascript')
    expect(second.statusCode).toBe(304)
  })

  it('sets the consent cookie and redirects on the no-JavaScript fallback', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/govuk-analytics-consent/consent',
      payload: 'preference=accept-all&returnUrl=/start',
      headers: { 'content-type': 'application/x-www-form-urlencoded' }
    })

    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe('/start')
    expect(decodeURIComponent(String(response.headers['set-cookie']))).toContain('"analytics":true')
    expect(String(response.headers['set-cookie'])).toContain('SameSite=Lax')
  })

  it('records granular category choices and refuses off-site redirects', async () => {
    const granular = await server.inject({
      method: 'POST',
      url: '/govuk-analytics-consent/consent',
      payload: 'preference=save&cookies[analytics]=yes&returnUrl=/start',
      headers: { 'content-type': 'application/x-www-form-urlencoded' }
    })
    const unsafe = await server.inject({
      method: 'POST',
      url: '/govuk-analytics-consent/consent',
      payload: 'preference=reject-all&returnUrl=//evil.example',
      headers: { 'content-type': 'application/x-www-form-urlencoded' }
    })

    expect(decodeURIComponent(String(granular.headers['set-cookie']))).toContain('"analytics":true')
    expect(granular.headers.location).toBe('/start?cookies-updated=true')
    expect(unsafe.headers.location).toBe('/')
  })

  it('expires rejected cookies even on not-found responses', async () => {
    const consent = encodeURIComponent(JSON.stringify({
      version: 1,
      categories: { analytics: false },
      updatedAt: new Date().toISOString()
    }))
    const response = await server.inject({
      url: '/missing',
      headers: {
        host: 'svc.example.com',
        cookie: `govuk_analytics_consent=${consent}; _ga=GA1.1.1`
      }
    })

    expect(response.statusCode).toBe(404)
    expect(response.headers['set-cookie']).toContain(
      '_ga=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Domain=example.com'
    )
  })

  it('validates submissions when a verifier is configured', async () => {
    const guarded = Fastify()
    await guarded.register(govukAnalyticsConsentPlugin, {
      verifyCsrfFormSubmission: async (_request, body) => body.csrf === 'valid'
    })

    const rejected = await guarded.inject({
      method: 'POST',
      url: '/govuk-analytics-consent/consent',
      payload: 'csrf=invalid&preference=accept-all',
      headers: { 'content-type': 'application/x-www-form-urlencoded' }
    })

    expect(rejected.statusCode).toBe(403)
    expect(rejected.headers['set-cookie']).toBeUndefined()
    await guarded.close()
  })
})