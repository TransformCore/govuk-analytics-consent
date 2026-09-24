import { buildConsentUpdate } from '../gtm/consent-mode.js'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export function updateConsentMode(analytics: boolean): void {
  const payload = buildConsentUpdate(analytics)

  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', payload)
  } else {
    // Fallback when the head snippet was omitted; GTM reads index 0 of the pushed array.
    dataLayer().push(['consent', 'update', payload])
  }

  dataLayer().push({ event: 'cookie_consent_update', analytics_consent: analytics })
}

function dataLayer(): unknown[] {
  window.dataLayer = window.dataLayer ?? []
  return window.dataLayer
}
