import express from 'express'
import nunjucks from 'nunjucks'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { registerGovUkAnalyticsConsent } from '../src/index.js'
import { govukAnalyticsConsentTemplatePath } from '../src/ui/template-path.js'

let app: express.Express

beforeEach(() => {
  app = express()

  nunjucks.configure([govukAnalyticsConsentTemplatePath(), 'test/fixtures'], {
    express: app,
    autoescape: true
  })

  registerGovUkAnalyticsConsent(app, { gtmContainerId: 'GTM-ABC123' })

  app.get('/start', (_req, res) => res.render('page.njk'))
})

describe('express integration', () => {
  it('serves the browser bundle', async () => {
    const response = await request(app).get('/govuk-analytics-consent/consent.js')

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('application/javascript')
  })

  it('answers a matching If-None-Match with 304', async () => {
    const first = await request(app).get('/govuk-analytics-consent/consent.js')
    const second = await request(app)
      .get('/govuk-analytics-consent/consent.js')
      .set('if-none-match', String(first.headers.etag))

    expect(second.status).toBe(304)
  })

  it('sets the consent cookie and redirects on the no-JavaScript fallback', async () => {
    const response = await request(app)
      .post('/govuk-analytics-consent/consent')
      .type('form')
      .send({ analytics: 'accept', returnUrl: '/start' })

    const cookie = String(response.headers['set-cookie'])

    expect(response.status).toBe(303)
    expect(response.headers.location).toBe('/start')
    expect(decodeURIComponent(cookie)).toContain('"analytics":true')
    expect(cookie).toContain('SameSite=Lax')
  })

  it('records a rejection for any value other than accept', async () => {
    const response = await request(app)
      .post('/govuk-analytics-consent/consent')
      .type('form')
      .send({ analytics: 'anything-else', returnUrl: '/start' })

    expect(decodeURIComponent(String(response.headers['set-cookie']))).toContain(
      '"analytics":false'
    )
  })

  it('refuses to redirect off-site', async () => {
    const response = await request(app)
      .post('/govuk-analytics-consent/consent')
      .type('form')
      .send({ analytics: 'reject', returnUrl: 'https://evil.example' })

    expect(response.headers.location).toBe('/')
  })

  it('works when the service already mounts a body parser', async () => {
    const parsed = express()
    parsed.use(express.urlencoded({ extended: false }))
    registerGovUkAnalyticsConsent(parsed, { gtmContainerId: 'GTM-ABC123' })

    const response = await request(parsed)
      .post('/govuk-analytics-consent/consent')
      .type('form')
      .send({ analytics: 'accept', returnUrl: '/start' })

    expect(response.headers.location).toBe('/start')
    expect(decodeURIComponent(String(response.headers['set-cookie']))).toContain(
      '"analytics":true'
    )
  })

  it('injects the consent context into rendered views', async () => {
    const response = await request(app).get('/start')

    expect(response.status).toBe(200)
    expect(response.text).toContain("gtag('consent','default'")
    expect(response.text).toContain('govuk-cookie-banner')
    expect(response.text).toContain('/govuk-analytics-consent/consent.js')
  })

  it('omits the banner once a choice has been stored', async () => {
    const consent = encodeURIComponent(
      JSON.stringify({ version: 1, analytics: false, updatedAt: new Date().toISOString() })
    )

    const response = await request(app).get('/start').set('cookie', `cookies_policy=${consent}`)

    expect(response.text).not.toContain('govuk-cookie-banner')
  })
})

describe('registerGovUkAnalyticsConsent', () => {
  it('rejects an unsupported target', () => {
    expect(() => registerGovUkAnalyticsConsent({} as never)).toThrow(
      /expects a Hapi server or an Express application/
    )
  })
})
