import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

let cached: string | null = null

/** Works from both `src` (tests) and `dist` (published package). */
export function packageRoot(): string {
  if (cached !== null) {
    return cached
  }

  let current = dirname(fileURLToPath(import.meta.url))

  while (true) {
    if (existsSync(join(current, 'package.json'))) {
      cached = current
      return cached
    }

    const parent = dirname(current)

    if (parent === current) {
      throw new Error('Unable to locate the @transform-uk/govuk-analytics-consent package root')
    }

    current = parent
  }
}
