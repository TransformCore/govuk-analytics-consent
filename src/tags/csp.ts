export const CSP_DIRECTIVE_NAMES = [
  'script-src',
  'connect-src',
  'img-src',
  'frame-src',
  'style-src',
  'font-src'
] as const

export type CspDirectiveName = (typeof CSP_DIRECTIVE_NAMES)[number]

export type CspDirectives = { readonly [Name in CspDirectiveName]?: readonly string[] }

export type ResolvedCspDirectives = { readonly [Name in CspDirectiveName]: readonly string[] }

export interface BlankieCspOptions {
  readonly scriptSrc?: readonly string[]
  readonly connectSrc?: readonly string[]
  readonly imgSrc?: readonly string[]
  readonly frameSrc?: readonly string[]
  readonly styleSrc?: readonly string[]
  readonly fontSrc?: readonly string[]
}

export type HelmetCspSource = string | ((...args: any[]) => string)

export interface HelmetCspDirectives {
  readonly scriptSrc?: readonly HelmetCspSource[]
  readonly connectSrc?: readonly HelmetCspSource[]
  readonly imgSrc?: readonly HelmetCspSource[]
  readonly frameSrc?: readonly HelmetCspSource[]
  readonly styleSrc?: readonly HelmetCspSource[]
  readonly fontSrc?: readonly HelmetCspSource[]
}

const CAMEL_CASE_NAMES = {
  'script-src': 'scriptSrc',
  'connect-src': 'connectSrc',
  'img-src': 'imgSrc',
  'frame-src': 'frameSrc',
  'style-src': 'styleSrc',
  'font-src': 'fontSrc'
} as const satisfies Record<CspDirectiveName, string>

/** Sources required to load the GTM container itself. */
export const gtmCspDirectives: CspDirectives = Object.freeze({
  'script-src': Object.freeze(['https://www.googletagmanager.com']),
  'connect-src': Object.freeze(['https://www.googletagmanager.com']),
  'img-src': Object.freeze(['https://www.googletagmanager.com']),
  'frame-src': Object.freeze(['https://www.googletagmanager.com'])
})

/** Merge directive sets in order, removing duplicate sources. */
export function mergeCspDirectives(...sets: readonly CspDirectives[]): ResolvedCspDirectives {
  const merged = {} as Record<CspDirectiveName, readonly string[]>

  for (const name of CSP_DIRECTIVE_NAMES) {
    merged[name] = Object.freeze([...new Set(sets.flatMap((set) => set[name] ?? []))])
  }

  return Object.freeze(merged)
}

/** Return Blankie options with the given sources merged in; directives with no sources are left untouched. */
export function toBlankieCsp<Options extends object>(
  options: Options & BlankieCspOptions,
  directives: CspDirectives
): Options & BlankieCspOptions {
  return mergeCamelCase(options, directives)
}

/** Return Helmet directives with the given sources merged in; directives with no sources are left untouched. */
export function toHelmetCsp<Directives extends object>(
  base: Directives & HelmetCspDirectives,
  directives: CspDirectives
): Directives & HelmetCspDirectives {
  return mergeCamelCase(base, directives)
}

function mergeCamelCase<Target extends object>(target: Target, directives: CspDirectives): Target {
  const result: Record<string, unknown> = { ...(target as Record<string, unknown>) }

  for (const name of CSP_DIRECTIVE_NAMES) {
    const sources = directives[name] ?? []

    if (sources.length === 0) {
      continue
    }

    const key = CAMEL_CASE_NAMES[name]
    const existing = (result[key] as readonly unknown[] | undefined) ?? []

    result[key] = [...new Set([...existing, ...sources])]
  }

  return result as Target
}
