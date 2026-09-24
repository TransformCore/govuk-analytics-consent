import Hapi from '@hapi/hapi'
import Vision from '@hapi/vision'
import nunjucks from 'nunjucks'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { registerGovUkAnalyticsConsent } from '../src/index.js'
import { govukAnalyticsConsentTemplatePath } from '../src/ui/template-path.js'

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

  registerGovUkAnalyticsConsent(server, { gtmContainerId: 'GTM-ABC123' })

  await server.initialize()
})

afterEach(async () => {
  await server.stop()
})

describe('hapi integration', () => {
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

  it('sets the consent cookie and redirects on the no-JavaScript fallback', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/govuk-analytics-consent/consent',
      payload: 'analytics=accept&returnUrl=/start',
      headers: { 'content-type': 'application/x-www-form-urlencoded' }
    })

    const cookie = String(response.headers['set-cookie'])

    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe('/start')
    expect(cookie).toContain('cookies_policy=')
    expect(decodeURIComponent(cookie)).toContain('"analytics":true')
    expect(cookie).toContain('SameSite=Lax')
  })

  it('refuses to redirect off-site', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/govuk-analytics-consent/consent',
      payload: 'analytics=reject&returnUrl=//evil.example',
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

  it('omits the banner once a choice has been stored', async () => {
    const consent = encodeURIComponent(
      JSON.stringify({ version: 1, analytics: true, updatedAt: new Date().toISOString() })
    )

    const response = await server.inject({
      url: '/start',
      headers: { cookie: `cookies_policy=${consent}` }
    })

    expect(response.result).not.toContain('govuk-cookie-banner')
    expect(response.result).toContain("gtag('consent','default'")
  })
})
