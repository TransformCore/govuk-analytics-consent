import { updateConsentMode } from './gtag.js'
import { writeConsent } from './storage.js'
import { BANNER_ID } from '../ui/html.js'

export interface BannerConfig {
  cookieName: string
  cookieVersion: number
}

export function initBanner(config: BannerConfig): void {
  const banner = document.getElementById(BANNER_ID)

  if (banner === null) {
    return
  }

  banner.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    const trigger = target?.closest<HTMLElement>('[data-consent-action]')
    const action = trigger?.dataset.consentAction

    if (action === undefined) {
      return
    }

    event.preventDefault()

    if (action === 'hide') {
      banner.hidden = true
      return
    }

    const analytics = action === 'accept'

    writeConsent(config.cookieName, config.cookieVersion, analytics)
    updateConsentMode(analytics)
    showConfirmation(banner, analytics ? 'accepted' : 'rejected')
  })
}

function showConfirmation(banner: HTMLElement, state: 'accepted' | 'rejected'): void {
  for (const message of banner.querySelectorAll<HTMLElement>('[data-consent-state]')) {
    message.hidden = message.dataset.consentState !== state
  }

  banner.querySelector<HTMLElement>(`[data-consent-state="${state}"]`)?.focus()
}
