import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveOptions } from '../src/consent/options.js'
import { safeInternalPath, normaliseRoutePrefix } from '../src/shared/url.js'

const originalContainerId = process.env.GTM_CONTAINER_ID
const originalNodeEnv = process.env.NODE_ENV

function restore(key: 'GTM_CONTAINER_ID' | 'NODE_ENV', value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}

beforeEach(() => {
  delete process.env.GTM_CONTAINER_ID
})

afterEach(() => {
  restore('GTM_CONTAINER_ID', originalContainerId)
  restore('NODE_ENV', originalNodeEnv)
})

describe('resolveOptions', () => {
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

    expect(resolved.messages.acceptAll).toBe('Accept all cookies')
    expect(resolved.messages.rejectAll).toBe('Reject additional cookies')
    expect(resolved.messages.changeSettings).toBe('Change your cookie settings')
    expect(resolved.messages.saveSettings).toBe('Save cookie settings')
  })

  it('merges custom text over the default English copy', () => {
    const resolved = resolveOptions({
      messages: {
        acceptAll: 'Accept all',
        rejectAll: 'Reject all',
        changeSettings: 'Manage cookies'
      }
    })

    expect(resolved.messages.acceptAll).toBe('Accept all')
    expect(resolved.messages.rejectAll).toBe('Reject all')
    expect(resolved.messages.changeSettings).toBe('Manage cookies')
    expect(resolved.messages.saveSettings).toBe('Save cookie settings')
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

  it('adds the standard GA cookies once a GTM container is configured', () => {
    const resolved = resolveOptions({ gtmContainerId: 'GTM-ABC123' })

    expect(resolved.cookies.some((cookie) => cookie.name === '_ga')).toBe(true)
    expect(resolved.cookies.every((cookie) => cookie.categoryId !== 'analytics' || cookie.name.startsWith('_ga'))).toBe(true)
  })

  it('omits the GA cookies when no GTM container is configured', () => {
    const resolved = resolveOptions({})

    expect(resolved.cookies.some((cookie) => cookie.name === '_ga')).toBe(false)
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
      expiry: '1 day'
    })
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

  it.each([
    '//evil.example',
    '/\\evil.example',
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
