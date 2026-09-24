import { describe, expect, it } from 'vitest'
import {
  parseCookieHeader,
  parseConsentCookie,
  readConsentFromHeader,
  serialiseConsent
} from '../src/consent/cookie.js'
import { createInitialState, hasChoice, withAnalytics } from '../src/consent/state.js'

describe('consent cookie', () => {
  it('round-trips a state', () => {
    const state = withAnalytics(createInitialState(1), true)

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
    const old = serialiseConsent(withAnalytics(createInitialState(1), true))

    expect(parseConsentCookie(old, 2).analytics).toBeNull()
  })

  it('coerces a non-boolean analytics value to null', () => {
    const value = encodeURIComponent(JSON.stringify({ version: 1, analytics: 'yes' }))

    expect(parseConsentCookie(value, 1).analytics).toBeNull()
  })

  it('reports whether a choice has been made', () => {
    expect(hasChoice(createInitialState(1))).toBe(false)
    expect(hasChoice(withAnalytics(createInitialState(1), false))).toBe(true)
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
    const cookie = `cookies_policy=${serialiseConsent(withAnalytics(createInitialState(1), true))}`

    expect(readConsentFromHeader(cookie, 'cookies_policy', 1).analytics).toBe(true)
  })
})
