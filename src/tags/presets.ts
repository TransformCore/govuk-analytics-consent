import { googleAnalytics } from './google-analytics.js'
import { hotjar } from './hotjar.js'
import { microsoftClarity } from './microsoft-clarity.js'
import type { ConsentTag } from './types.js'

const tagPresets = {
  'google-analytics': googleAnalytics,
  hotjar,
  'microsoft-clarity': microsoftClarity
} satisfies Record<string, () => ConsentTag>

export type ConsentTagPreset = keyof typeof tagPresets

export type ConsentTagInput = ConsentTag | ConsentTagPreset

export function resolveTag(tag: ConsentTagInput): ConsentTag {
  if (typeof tag !== 'string') {
    return tag
  }

  if (!Object.hasOwn(tagPresets, tag)) {
    throw new Error(`Unknown tag preset: ${String(tag)}`)
  }

  return tagPresets[tag]()
}
