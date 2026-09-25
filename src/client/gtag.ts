import { buildConsentUpdate } from '../gtm/consent-mode.js'
import { isCategoryAccepted } from '../consent/state.js'
import type { ConsentModeCategory, ConsentState } from '../consent/types.js'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export function updateConsentMode(categories: ConsentModeCategory[], state: ConsentState): void {
  const payload = buildConsentUpdate(categories, state)
  const analyticsCategory = categories.find((category) => category.id === 'analytics')
  const analyticsAccepted = analyticsCategory !== undefined && isCategoryAccepted(state, analyticsCategory)

  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', payload)
  } else {
    // Fallback when the head snippet was omitted; GTM reads index 0 of the pushed array.
    dataLayer().push(['consent', 'update', payload])
  }

  dataLayer().push({ event: 'cookie_consent_update', analytics_consent: analyticsAccepted })
}

function dataLayer(): unknown[] {
  window.dataLayer = window.dataLayer ?? []
  return window.dataLayer
}
