import { describe, expect, it } from 'vitest'
import { buildConsentDefault, buildConsentUpdate } from '../src/gtm/consent-mode.js'
import { gtmLoaderSnippet, gtmNoscriptSnippet } from '../src/gtm/loader.js'
import { consentDefaultSnippet, headSnippet } from '../src/gtm/snippets.js'
import {
  advertisingCategory,
  analyticsCategory,
  essentialCategory,
  functionalityCategory,
  personalizationCategory
} from '../src/consent/categories.js'
import { createInitialState, withCategoryChoices } from '../src/consent/state.js'

const categories = [essentialCategory, analyticsCategory]

describe('consent mode payloads', () => {
  it('denies optional signals and grants essential security storage by default', () => {
    expect(buildConsentDefault(categories, null)).toEqual({
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      security_storage: 'granted'
    })
  })

  it('also denies a custom signal declared by a category', () => {
    const withMarketing = [
      essentialCategory,
      { id: 'marketing', title: 'Marketing', description: '', gtagSignals: ['personalization_storage'] }
    ]

    expect(buildConsentDefault(withMarketing, null).personalization_storage).toBe('denied')
  })

  it('includes wait_for_update when configured', () => {
    expect(buildConsentDefault(categories, 500).wait_for_update).toBe(500)
  })

  it('floors a fractional wait_for_update', () => {
    expect(buildConsentDefault(categories, 500.9).wait_for_update).toBe(500)
  })

  it('still denies the standard signals when only an essential category is configured', () => {
    expect(buildConsentDefault([essentialCategory], null)).toEqual({
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      security_storage: 'granted'
    })
  })

  it('maps consent updates to Consent Mode signals', () => {
    const accepted = withCategoryChoices(createInitialState(1), { analytics: true })
    const rejected = withCategoryChoices(createInitialState(1), { analytics: false })

    expect(buildConsentUpdate(categories, accepted)).toEqual({
      security_storage: 'granted',
      analytics_storage: 'granted'
    })
    expect(buildConsentUpdate(categories, rejected)).toEqual({
      security_storage: 'granted',
      analytics_storage: 'denied'
    })
  })

  it('provides opt-in presets for every additional Consent Mode category', () => {
    expect(advertisingCategory.gtagSignals).toEqual([
      'ad_storage',
      'ad_user_data',
      'ad_personalization'
    ])
    expect(functionalityCategory.gtagSignals).toEqual(['functionality_storage'])
    expect(personalizationCategory.gtagSignals).toEqual(['personalization_storage'])
  })

  it('maps choices for all additional Consent Mode categories', () => {
    const allCategories = [
      ...categories,
      advertisingCategory,
      functionalityCategory,
      personalizationCategory
    ]
    const state = withCategoryChoices(createInitialState(1), {
      analytics: true,
      advertising: false,
      functionality: true,
      personalization: false
    })

    expect(buildConsentUpdate(allCategories, state)).toEqual({
      security_storage: 'granted',
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
      personalization_storage: 'denied'
    })
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
  const snippet = headSnippet({ categories, containerId: 'GTM-ABC123', waitForUpdate: 500 })

  it('sets the consent default before loading GTM', () => {
    expect(snippet.indexOf("gtag('consent','default'")).toBeLessThan(
      snippet.indexOf('googletagmanager.com/gtm.js')
    )
  })

  it('declares the consent default exactly once', () => {
    expect(snippet.match(/gtag\('consent','default'/g)).toHaveLength(1)
  })

  it('initialises the dataLayer before calling gtag', () => {
    expect(consentDefaultSnippet(categories, null).indexOf('window.dataLayer')).toBe(0)
  })

  it('applies a CSP nonce', () => {
    expect(
      headSnippet({ categories, containerId: null, waitForUpdate: null, nonce: 'abc123' })
    ).toContain('nonce="abc123"')
  })

  it('still gates consent when GTM is not configured', () => {
    const withoutGtm = headSnippet({ categories, containerId: null, waitForUpdate: 500 })

    expect(withoutGtm).toContain("gtag('consent','default'")
    expect(withoutGtm).not.toContain('googletagmanager.com')
  })
})
