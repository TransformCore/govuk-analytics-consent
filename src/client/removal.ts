import { buildExpiryCookies, findCookiesToRemove } from '../consent/removal.js'
import type { ClientCategory } from './config.js'
import type { ConsentState } from '../consent/types.js'

export function removeRejectedCookies(categories: ClientCategory[], state: ConsentState): void {
  const names = document.cookie
    .split(';')
    .map((pair) => (pair.split('=')[0] ?? '').trim())
    .filter((name) => name !== '')
  const removals = findCookiesToRemove(
    names,
    state,
    categories.map((category) => ({ ...category, cookies: category.cookies ?? [] }))
  )

  for (const cookie of buildExpiryCookies(removals, window.location.hostname)) {
    document.cookie = cookie
  }
}
