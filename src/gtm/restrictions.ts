const GTM_TYPE_ID = /^[A-Za-z0-9_]+$/

/** Expands to the configured tags' GTM types plus `gtmBaseAllowlist`. */
export const AUTO_ALLOWLIST = 'auto'

/** Built-in GTM trigger and variable types, excluding Custom JavaScript, kept working by the automatic allowlist. */
export const gtmBaseAllowlist: readonly string[] = Object.freeze([
  'evl', 'cl', 'fsl', 'hl', 'jel', 'lcl', 'sdl', 'tl', 'ytl',
  'k', 'v', 'c', 'ctv', 'e', 'dbg', 'd', 'vis', 'f', 'j', 'smm', 'remm', 'r', 'u'
])

export type GtmAllowlistInput = typeof AUTO_ALLOWLIST | readonly string[]

export interface GtmRestrictions {
  /** `null` means no allowlist is pushed. */
  allowlist: readonly string[] | null
  /** `null` means no blocklist is pushed. */
  blocklist: readonly string[] | null
}

export interface GtmRestrictionsInput {
  allowlist?: GtmAllowlistInput
  blocklist?: readonly string[]
  tags: readonly { id: string; gtmTypes?: readonly string[] }[]
}

export function resolveGtmRestrictions({ allowlist, blocklist, tags }: GtmRestrictionsInput): GtmRestrictions {
  const entries = typeof allowlist === 'string' ? [allowlist] : allowlist
  const resolvedAllowlist = entries?.includes(AUTO_ALLOWLIST) === true
    ? [...autoAllowlist(tags), ...entries.filter((entry) => entry !== AUTO_ALLOWLIST)]
    : entries

  return {
    allowlist: validateIds('gtmAllowlist', resolvedAllowlist),
    blocklist: validateIds('gtmBlocklist', blocklist)
  }
}

function autoAllowlist(tags: GtmRestrictionsInput['tags']): string[] {
  const untyped = tags.find((tag) => (tag.gtmTypes ?? []).length === 0)

  if (untyped !== undefined) {
    throw new Error(
      `Tag "${untyped.id}" declares no GTM type IDs, so gtmAllowlist 'auto' would block it. Set its gtmTypes option.`
    )
  }

  return [...gtmBaseAllowlist, ...tags.flatMap((tag) => tag.gtmTypes ?? [])]
}

/** Must run after the consent default and before the GTM loader so it applies to every tag. */
export function gtmRestrictionsSnippet({ allowlist, blocklist }: GtmRestrictions): string {
  const payload: Record<string, readonly string[]> = {}

  if (allowlist !== null) {
    payload['gtm.allowlist'] = allowlist
  }

  if (blocklist !== null) {
    payload['gtm.blocklist'] = blocklist
  }

  return Object.keys(payload).length === 0 ? '' : `dataLayer.push(${JSON.stringify(payload)});`
}

function validateIds(name: string, ids: readonly string[] | undefined): readonly string[] | null {
  if (ids === undefined) {
    return null
  }

  for (const id of ids) {
    if (typeof id !== 'string' || !GTM_TYPE_ID.test(id)) {
      throw new Error(`Invalid ${name} entry: ${JSON.stringify(id)}`)
    }
  }

  return Object.freeze([...new Set(ids)])
}
