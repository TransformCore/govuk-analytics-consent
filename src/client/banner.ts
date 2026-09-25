import { updateConsentMode } from './gtag.js'
import { writeConsent } from './storage.js'
import { buildCategoryChoices } from '../consent/state.js'
import { BANNER_ID } from '../ui/html.js'
import type { ClientConfig } from './config.js'

export function initBanner(config: ClientConfig): void {
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

    const accepted = action === 'accept'
    const choices = buildCategoryChoices(config.categories, accepted)
    const state = writeConsent(config.cookieName, config.cookieVersion, choices)

    updateConsentMode(config.categories, state)
    showConfirmation(banner, accepted ? 'accepted' : 'rejected')
  })
}

function showConfirmation(banner: HTMLElement, state: 'accepted' | 'rejected'): void {
  for (const message of banner.querySelectorAll<HTMLElement>('[data-consent-state]')) {
    message.hidden = message.dataset.consentState !== state
  }

  banner.querySelector<HTMLElement>(`[data-consent-state="${state}"]`)?.focus()
}
