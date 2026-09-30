import Fastify from 'fastify'
import Hapi from '@hapi/hapi'
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createGovUkAnalyticsConsent,
  googleAnalytics,
  gtmCspDirectives,
  hotjar,
  mergeCspDirectives,
  microsoftClarity,
  registerGovUkAnalyticsConsent,
  toBlankieCsp,
  toHelmetCsp
} from '../src/index.js'
import { resolveOptions } from '../src/consent/options.js'
import { buildRemovalCategories, findCookiesToRemove } from '../src/consent/removal.js'
import { createInitialState, withCategoryChoices } from '../src/consent/state.js'
import govukAnalyticsConsentFastifyPlugin from '../src/integrations/fastify.js'
import govukAnalyticsConsentHapiPlugin from '../src/integrations/hapi.js'
import { renderConsentHead } from '../src/ui/html.js'
import { buildViewModel } from '../src/ui/view-model.js'

const originalHotjarSiteId = process.env.HOTJAR_SITE_ID

beforeEach(() => {
  delete process.env.HOTJAR_SITE_ID
})

afterEach(() => {
  if (originalHotjarSiteId === undefined) {
    delete process.env.HOTJAR_SITE_ID
  } else {
    process.env.HOTJAR_SITE_ID = originalHotjarSiteId
  }
})

describe('CSP directives', () => {
  it('includes only the GTM sources when no tags are configured', () => {
    expect(resolveOptions().csp).toEqual({
      'script-src': ['https://www.googletagmanager.com'],
      'connect-src': ['https://www.googletagmanager.com'],
      'img-src': ['https://www.googletagmanager.com'],
      'frame-src': ['https://www.googletagmanager.com'],
      'style-src': [],
      'font-src': []
    })
  })

  it('merges the GTM and Google Analytics sources', () => {
    expect(resolveOptions({ tags: [googleAnalytics()] }).csp).toEqual({
      'script-src': ['https://www.googletagmanager.com'],
      'connect-src': [
        'https://www.googletagmanager.com',
        'https://*.google-analytics.com',
        'https://*.analytics.google.com',
        'https://www.google.com'
      ],
      'img-src': ['https://www.googletagmanager.com', 'https://*.google-analytics.com'],
      'frame-src': ['https://www.googletagmanager.com'],
      'style-src': [],
      'font-src': []
    })
  })

  it('removes duplicate sources across tags', () => {
    const merged = mergeCspDirectives(gtmCspDirectives, { 'script-src': ['https://www.googletagmanager.com', 'https://a'] })

    expect(merged['script-src']).toEqual(['https://www.googletagmanager.com', 'https://a'])
  })

  it('merges into Blankie options without changing the input', () => {
    const options = { generateNonces: true, scriptSrc: ['self', 'https://www.googletagmanager.com'], imgSrc: ['self'] }
    const merged = toBlankieCsp(options, resolveOptions({ tags: [hotjar({ siteId: 123 })] }).csp)

    expect(merged).toEqual({
      generateNonces: true,
      scriptSrc: ['self', 'https://www.googletagmanager.com', 'https://*.hotjar.com'],
      connectSrc: [
        'https://www.googletagmanager.com',
        'https://*.hotjar.com',
        'https://*.hotjar.io',
        'wss://*.hotjar.com'
      ],
      imgSrc: ['self', 'https://www.googletagmanager.com', 'https://*.hotjar.com'],
      frameSrc: ['https://www.googletagmanager.com'],
      styleSrc: ['https://*.hotjar.com'],
      fontSrc: ['https://*.hotjar.com']
    })
    expect(options).toEqual({ generateNonces: true, scriptSrc: ['self', 'https://www.googletagmanager.com'], imgSrc: ['self'] })
  })

  it('merges into Helmet directives without losing a nonce callback', () => {
    const nonce = (_request: unknown, response: { locals: { cspNonce: string } }) =>
      `'nonce-${response.locals.cspNonce}'`
    const directives = { defaultSrc: ["'self'"], scriptSrc: ["'self'", nonce] }
    const merged = toHelmetCsp(directives, gtmCspDirectives)

    expect(merged.scriptSrc).toEqual(["'self'", nonce, 'https://www.googletagmanager.com'])
    expect(merged).not.toHaveProperty('styleSrc')
    expect(directives.scriptSrc).toEqual(["'self'", nonce])
  })
})

describe('tags', () => {
  it('rejects duplicate tag ids', () => {
    expect(() => resolveOptions({ tags: [googleAnalytics(), googleAnalytics()] })).toThrow(/Duplicate tag id/)
  })

  it('lets a user-supplied cookie override a tag cookie with the same name', () => {
    const resolved = resolveOptions({
      tags: [googleAnalytics()],
      cookies: [{ name: '_ga', categoryId: 'analytics', purpose: 'Custom', expiry: '1 day' }]
    })

    expect(resolved.cookies.find((cookie) => cookie.name === '_ga')).toEqual({
      name: '_ga',
      categoryId: 'analytics',
      purpose: 'Custom',
      expiry: '1 day',
      removeOnReject: 'host-only'
    })
  })

  it('assigns tag cookies to a custom category', () => {
    const resolved = resolveOptions({
      categories: ['default', 'personalization'],
      tags: [microsoftClarity({ categoryId: 'personalization' })]
    })

    expect(resolved.cookies.filter((cookie) => cookie.name.startsWith('_cl')).map((cookie) => cookie.categoryId))
      .toEqual(['personalization', 'personalization'])
  })

  it('fails when a tag uses an unknown category', () => {
    expect(() => resolveOptions({ tags: [hotjar({ categoryId: 'marketing' })] })).toThrow(/Invalid cookie definition/)
  })

  it('documents Hotjar cookies with the site ID', () => {
    const resolved = resolveOptions({ tags: [hotjar({ siteId: '123' })] })

    expect(resolved.cookies.map((cookie) => cookie.name)).toEqual([
      'govuk_analytics_consent',
      '_hjSessionUser_123',
      '_hjSession_123',
      '_hj*'
    ])
  })

  it('reads the Hotjar site ID from the environment', () => {
    process.env.HOTJAR_SITE_ID = '456'

    expect(resolveOptions({ tags: [hotjar()] }).cookies.some((cookie) => cookie.name === '_hjSession_456')).toBe(true)
  })

  it.each(['abc', '12a', '-1'])('rejects the malformed Hotjar site ID %s', (siteId) => {
    expect(() => hotjar({ siteId })).toThrow(/Invalid Hotjar site ID/)
  })

  it('expires Hotjar cookies on the host and parent domains when analytics is rejected', () => {
    const resolved = resolveOptions({ tags: [hotjar({ siteId: 123 })] })
    const categories = buildRemovalCategories(resolved.categories, resolved.cookies)
    const rejected = withCategoryChoices(createInitialState(1), { analytics: false })

    expect(findCookiesToRemove(['_hjSession_123', '_hjTLDTest', 'session'], rejected, categories)).toEqual([
      { name: '_hjSession_123', parentDomains: true },
      { name: '_hjTLDTest', parentDomains: true }
    ])
  })

  it('never tries to remove third-party Clarity cookies', () => {
    const resolved = resolveOptions({ tags: [microsoftClarity()] })
    const removal = (name: string) => resolved.cookies.find((cookie) => cookie.name === name)?.removeOnReject

    expect(removal('_clck')).toBe('host-and-parents')
    expect(removal('MUID')).toBe('never')
    expect(removal('CLID')).toBe('never')
  })
})

describe('automatic GTM allowlist', () => {
  it('allowlists the GTM types of the configured tags', () => {
    const resolved = resolveOptions({
      gtmAllowlist: 'auto',
      tags: [googleAnalytics(), hotjar(), microsoftClarity({ gtmTypes: ['sandboxedScripts'] })]
    })

    expect(resolved.gtmRestrictions.allowlist).toEqual(
      expect.arrayContaining(['googtag', 'gaawc', 'gaawe', 'hjtc', 'sandboxedScripts'])
    )
    expect(resolved.gtmRestrictions.blocklist).toBeNull()
  })

  it('requires GTM types for Microsoft Clarity', () => {
    expect(() => resolveOptions({ gtmAllowlist: 'auto', tags: [microsoftClarity()] })).toThrow(/gtmTypes/)
  })

  it('renders the restrictions in the head markup', () => {
    const resolved = resolveOptions({
      gtmContainerId: 'GTM-ABC123',
      gtmAllowlist: 'auto',
      gtmBlocklist: ['customScripts'],
      tags: [hotjar()]
    })
    const head = renderConsentHead(buildViewModel(resolved))

    expect(head).toContain('"gtm.allowlist":[')
    expect(head).toContain('"hjtc"')
    expect(head).toContain('"gtm.blocklist":["customScripts"]')
  })
})

describe('createGovUkAnalyticsConsent', () => {
  const consent = createGovUkAnalyticsConsent({
    gtmContainerId: 'GTM-ABC123',
    routePrefix: '/consent-instance',
    tags: [googleAnalytics({ measurementId: 'G-ABC123' })]
  })

  it('exposes the merged CSP and helpers', () => {
    expect(consent.csp).toBe(consent.options.csp)
    expect(consent.helmetCsp({}).connectSrc).toContain('https://*.google-analytics.com')
    expect(consent.blankieCsp({ scriptSrc: ['self'] }).scriptSrc).toEqual(['self', 'https://www.googletagmanager.com'])
  })

  it('is accepted by the Hapi plugin', async () => {
    const server = Hapi.server()
    await server.register({ plugin: govukAnalyticsConsentHapiPlugin, options: consent })
    await server.initialize()

    const response = await server.inject('/consent-instance/consent.js')

    expect(response.statusCode).toBe(200)
    await server.stop()
  })

  it('is accepted by the Fastify plugin', async () => {
    const app = Fastify()
    await app.register(govukAnalyticsConsentFastifyPlugin, consent)

    const response = await app.inject('/consent-instance/consent.js')

    expect(response.statusCode).toBe(200)
    await app.close()
  })

  it('is accepted by the Express integration', async () => {
    const app = express()
    const resolved = registerGovUkAnalyticsConsent(app, consent)

    expect(resolved).toBe(consent.options)
    expect((await request(app).get('/consent-instance/consent.js')).status).toBe(200)
  })
})
