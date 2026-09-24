import { describe, expect, it } from 'vitest'
import { buildConsentDefault, buildConsentUpdate } from '../src/gtm/consent-mode.js'
import { gtmLoaderSnippet, gtmNoscriptSnippet } from '../src/gtm/loader.js'
import { consentDefaultSnippet, headSnippet } from '../src/gtm/snippets.js'

describe('consent mode payloads', () => {
  it('denies every signal by default', () => {
    expect(buildConsentDefault(null)).toEqual({
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied'
    })
  })

  it('includes wait_for_update when configured', () => {
    expect(buildConsentDefault(500).wait_for_update).toBe(500)
  })

  it('floors a fractional wait_for_update', () => {
    expect(buildConsentDefault(500.9).wait_for_update).toBe(500)
  })

  it('maps consent updates to Consent Mode signals', () => {
    expect(buildConsentUpdate(true)).toEqual({ analytics_storage: 'granted' })
    expect(buildConsentUpdate(false)).toEqual({ analytics_storage: 'denied' })
  })
})

describe('gtmLoaderSnippet', () => {
  it('returns nothing when no container is configured', () => {
    expect(gtmLoaderSnippet(null)).toBe('')
    expect(gtmNoscriptSnippet(null)).toBe('')
  })

  it('embeds a valid container id', () => {
    expect(gtmLoaderSnippet('GTM-ABC123')).toContain("'GTM-ABC123'")
    expect(gtmNoscriptSnippet('GTM-ABC123')).toContain('id=GTM-ABC123')
  })

  it('refuses to render an injected container id', () => {
    expect(() => gtmLoaderSnippet("GTM-A';alert(1);//")).toThrow(/Refusing to render/)
  })
})

describe('headSnippet', () => {
  const snippet = headSnippet({ containerId: 'GTM-ABC123', waitForUpdate: 500 })

  it('sets the consent default before loading GTM', () => {
    expect(snippet.indexOf("gtag('consent','default'")).toBeLessThan(
      snippet.indexOf('googletagmanager.com/gtm.js')
    )
  })

  it('declares the consent default exactly once', () => {
    expect(snippet.match(/gtag\('consent','default'/g)).toHaveLength(1)
  })

  it('initialises the dataLayer before calling gtag', () => {
    expect(consentDefaultSnippet(null).indexOf('window.dataLayer')).toBe(0)
  })

  it('applies a CSP nonce', () => {
    expect(headSnippet({ containerId: null, waitForUpdate: null, nonce: 'abc123' })).toContain(
      'nonce="abc123"'
    )
  })

  it('still gates consent when GTM is not configured', () => {
    const withoutGtm = headSnippet({ containerId: null, waitForUpdate: 500 })

    expect(withoutGtm).toContain("gtag('consent','default'")
    expect(withoutGtm).not.toContain('googletagmanager.com')
  })
})
