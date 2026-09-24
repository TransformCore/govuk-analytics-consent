import { initBanner } from './banner.js'
import { updateConsentMode } from './gtag.js'
import { readConsent } from './storage.js'
import { CLIENT_SCRIPT_MODULE } from '../ui/html.js'

function readConfig(): { cookieName: string; cookieVersion: number } | null {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector<HTMLScriptElement>(`script[data-module="${CLIENT_SCRIPT_MODULE}"]`)

  const cookieName = script?.dataset.cookieName
  const cookieVersion = Number(script?.dataset.cookieVersion)

  if (cookieName === undefined || !Number.isInteger(cookieVersion)) {
    return null
  }

  return { cookieName, cookieVersion }
}

export function start(): void {
  const config = readConfig()

  if (config === null) {
    return
  }

  const consent = readConsent(config.cookieName, config.cookieVersion)

  if (consent.analytics !== null) {
    updateConsentMode(consent.analytics)
  }

  initBanner(config)
}

try {
  start()
} catch {
  // Analytics consent must never break the page it is embedded in.
}
