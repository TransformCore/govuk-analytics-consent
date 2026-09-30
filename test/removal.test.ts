import { describe, expect, it } from 'vitest'
import { resolveOptions } from '../src/consent/options.js'
import { googleAnalytics } from '../src/tags/google-analytics.js'
import {
  buildExpiryCookies,
  buildRemovalCategories,
  cookieDomains,
  findCookiesToRemove,
  globToPattern
} from '../src/consent/removal.js'
import { createInitialState, withCategoryChoices } from '../src/consent/state.js'

const options = resolveOptions({
  gtmContainerId: 'GTM-ABC123',
  tags: [googleAnalytics({ measurementId: 'G-ABC123' })],
  cookies: [
    { name: 'hotjar', categoryId: 'analytics', purpose: 'Heatmaps', expiry: '1 year' },
    { name: 'kept', categoryId: 'analytics', purpose: 'Kept', expiry: '1 year', removeOnReject: 'never' }
  ]
})
const categories = buildRemovalCategories(options.categories, options.cookies)
const names = ['_ga', '_ga_ABC123', 'hotjar', 'kept', 'govuk_analytics_consent', 'session']

describe('findCookiesToRemove', () => {
  it('removes nothing before a choice is made', () => {
    expect(findCookiesToRemove(names, createInitialState(1), categories)).toEqual([])
  })

  it('removes nothing when the category is accepted', () => {
    const state = withCategoryChoices(createInitialState(1), { analytics: true })

    expect(findCookiesToRemove(names, state, categories)).toEqual([])
  })

  it('matches exact names and globs of rejected categories', () => {
    const state = withCategoryChoices(createInitialState(1), { analytics: false })

    expect(findCookiesToRemove(names, state, categories)).toEqual([
      { name: '_ga', parentDomains: true },
      { name: '_ga_ABC123', parentDomains: true },
      { name: 'hotjar', parentDomains: false }
    ])
  })

  it('ignores names that are not valid cookie tokens', () => {
    const state = withCategoryChoices(createInitialState(1), { analytics: false })

    expect(findCookiesToRemove(['_ga_x\r\nSet-Cookie: a', '_ga_x y'], state, categories)).toEqual([])
  })
})

describe('globToPattern', () => {
  const matches = (glob: string, name: string): boolean => new RegExp(globToPattern(glob)).test(name)

  it('supports wildcards anywhere in the name', () => {
    expect(matches('_ga_*', '_ga_ABC123')).toBe(true)
    expect(matches('mp_*_mixpanel', 'mp_abc123_mixpanel')).toBe(true)
    expect(matches('mp_*_mixpanel', 'mp_abc123_other')).toBe(false)
  })

  it('treats everything except * literally and anchors both ends', () => {
    expect(matches('_pk_id.*', '_pk_id.1.abcd')).toBe(true)
    expect(matches('_pk_id.*', '_pk_idX1')).toBe(false)
    expect(matches('_ga', '_ga_ABC')).toBe(false)
    expect(matches('_ga', 'x_ga')).toBe(false)
  })
})

describe('cookieDomains', () => {
  it('lists the host and each parent except the TLD', () => {
    expect(cookieDomains('a.b.example.gov.uk', true)).toEqual([
      'a.b.example.gov.uk',
      'b.example.gov.uk',
      'example.gov.uk',
      'gov.uk'
    ])
  })

  it('returns only the host when parents are excluded', () => {
    expect(cookieDomains('Service.Example.com', false)).toEqual(['service.example.com'])
  })

  it.each(['localhost', '127.0.0.1', '[::1]', 'example.com:3000', 'evil.com;x', 'a.com\r\nx', ''])(
    'returns no domains for %j',
    (hostname) => {
      expect(cookieDomains(hostname, true)).toEqual([])
    }
  )
})

describe('buildExpiryCookies', () => {
  const expired = 'Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'

  it('expires host-only and Domain=<host> variants', () => {
    expect(buildExpiryCookies([{ name: 'hotjar', parentDomains: false }], 'svc.example.com')).toEqual([
      `hotjar=; ${expired}`,
      `hotjar=; ${expired}; Domain=svc.example.com`
    ])
  })

  it('adds parent domains when requested', () => {
    expect(buildExpiryCookies([{ name: '_ga', parentDomains: true }], 'svc.example.com')).toEqual([
      `_ga=; ${expired}`,
      `_ga=; ${expired}; Domain=svc.example.com`,
      `_ga=; ${expired}; Domain=example.com`
    ])
  })

  it('handles __Secure- and __Host- prefixes', () => {
    expect(buildExpiryCookies([{ name: '__Host-x', parentDomains: true }], 'svc.example.com')).toEqual([
      `__Host-x=; ${expired}; Secure`
    ])
    expect(buildExpiryCookies([{ name: '__Secure-x', parentDomains: false }], 'example.com')).toEqual([
      `__Secure-x=; ${expired}; Secure`,
      `__Secure-x=; ${expired}; Secure; Domain=example.com`
    ])
  })
})
