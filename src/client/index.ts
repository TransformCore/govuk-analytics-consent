import { initBanner } from './banner.js'
import { updateConsentMode } from './gtag.js'
import { readConsent } from './storage.js'
import { hasChoice } from '../consent/state.js'
import { CLIENT_SCRIPT_MODULE } from '../ui/html.js'
import type { ClientConfig } from './config.js'
import type { ConsentModeCategory } from '../consent/types.js'

function readConfig(): ClientConfig | null {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector<HTMLScriptElement>(`script[data-module="${CLIENT_SCRIPT_MODULE}"]`)

  const cookieName = script?.dataset.cookieName
  const cookieVersion = Number(script?.dataset.cookieVersion)
  const categories = parseCategories(script?.dataset.categories)

  if (cookieName === undefined || !Number.isInteger(cookieVersion) || categories === null) {
    return null
  }

  return { cookieName, cookieVersion, categories }
}

function parseCategories(value: string | undefined): ConsentModeCategory[] | null {
  if (value === undefined) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(value)

    return Array.isArray(parsed) ? (parsed as ConsentModeCategory[]) : null
  } catch {
    return null
  }
}

export function start(): void {
  const config = readConfig()

  if (config === null) {
    return
  }

  const consent = readConsent(config.cookieName, config.cookieVersion)

  if (hasChoice(consent)) {
    updateConsentMode(config.categories, consent)
  }

  initBanner(config)
}

try {
  start()
} catch {
  // Analytics consent must never break the page it is embedded in.
}
