import { describe, expect, it } from 'vitest'
import {
  parseCookieHeader,
  parseConsentCookie,
  readConsentFromHeader,
  serialiseConsent
} from '../src/consent/cookie.js'
import { createInitialState, hasChoice, withCategoryChoices } from '../src/consent/state.js'

describe('consent cookie', () => {
  it('round-trips a state', () => {
    const state = withCategoryChoices(createInitialState(1), { analytics: true })

    expect(parseConsentCookie(serialiseConsent(state), 1)).toEqual(state)
  })

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['not json', 'nonsense'],
    ['an array', encodeURIComponent('[1,2,3]')],
    ['null', encodeURIComponent('null')],
    ['a bad escape', '%E0%A4%A']
  ])('treats %s as no choice made', (_label, value) => {
    expect(parseConsentCookie(value, 1)).toEqual(createInitialState(1))
  })

  it('discards a state written under a different version', () => {
    const old = serialiseConsent(withCategoryChoices(createInitialState(1), { analytics: true }))

    expect(parseConsentCookie(old, 2).categories).toBeNull()
  })

  it('coerces a non-boolean category value to null categories', () => {
    const value = encodeURIComponent(JSON.stringify({ version: 1, categories: { analytics: 'yes' } }))

    expect(parseConsentCookie(value, 1).categories).toBeNull()
  })

  it('reports whether a choice has been made', () => {
    expect(hasChoice(createInitialState(1))).toBe(false)
    expect(hasChoice(withCategoryChoices(createInitialState(1), { analytics: false }))).toBe(true)
  })
})

describe('parseCookieHeader', () => {
  it('parses multiple cookies', () => {
    expect(parseCookieHeader('a=1; b=2')).toEqual({ a: '1', b: '2' })
  })

  it('ignores malformed pairs and keeps the first duplicate', () => {
    expect(parseCookieHeader('novalue; a=1; a=2; =3')).toEqual({ a: '1' })
  })

  it('handles an absent header', () => {
    expect(parseCookieHeader(undefined)).toEqual({})
  })

  it('reads consent straight from a header', () => {
    const cookie = `cookies_policy=${serialiseConsent(withCategoryChoices(createInitialState(1), { analytics: true }))}`

    expect(readConsentFromHeader(cookie, 'cookies_policy', 1).categories).toEqual({ analytics: true })
  })
})
