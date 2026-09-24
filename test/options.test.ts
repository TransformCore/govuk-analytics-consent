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

    expect(resolved.cookieName).toBe('cookies_policy')
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
