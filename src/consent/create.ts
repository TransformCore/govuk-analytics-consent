import { resolveOptions } from './options.js'
import { toBlankieCsp, toHelmetCsp } from '../tags/csp.js'
import type { BlankieCspOptions, HelmetCspDirectives, ResolvedCspDirectives } from '../tags/csp.js'
import type { GovUkAnalyticsConsentOptions, ResolvedOptions } from './types.js'

const BRAND = Symbol.for('@transform-uk/govuk-analytics-consent')

export interface GovUkAnalyticsConsent {
  readonly [BRAND]: true
  readonly options: ResolvedOptions
  readonly csp: ResolvedCspDirectives
  /** Return Blankie options with the GTM and tag sources merged in. */
  blankieCsp<Options extends object>(options: Options & BlankieCspOptions): Options & BlankieCspOptions
  /** Return Helmet directives with the GTM and tag sources merged in. */
  helmetCsp<Directives extends object>(directives: Directives & HelmetCspDirectives): Directives & HelmetCspDirectives
}

export type GovUkAnalyticsConsentInput = GovUkAnalyticsConsentOptions | GovUkAnalyticsConsent

/** Resolve options once so the same configuration drives CSP and every framework integration. */
export function createGovUkAnalyticsConsent(options: GovUkAnalyticsConsentOptions = {}): GovUkAnalyticsConsent {
  const resolved = resolveOptions(options)

  return Object.freeze({
    [BRAND]: true as const,
    options: resolved,
    csp: resolved.csp,
    blankieCsp: <Options extends object>(base: Options & BlankieCspOptions) => toBlankieCsp(base, resolved.csp),
    helmetCsp: <Directives extends object>(base: Directives & HelmetCspDirectives) => toHelmetCsp(base, resolved.csp)
  })
}

export function isGovUkAnalyticsConsent(value: unknown): value is GovUkAnalyticsConsent {
  return typeof value === 'object' && value !== null && (value as Record<symbol, unknown>)[BRAND] === true
}

export function resolveInput(input: GovUkAnalyticsConsentInput = {}): ResolvedOptions {
  return isGovUkAnalyticsConsent(input) ? input.options : resolveOptions(input)
}
