export type ConsentSignal = 'granted' | 'denied'

export interface ConsentDefaultPayload {
  ad_storage: ConsentSignal
  ad_user_data: ConsentSignal
  ad_personalization: ConsentSignal
  analytics_storage: ConsentSignal
  wait_for_update?: number
}

export interface ConsentUpdatePayload {
  analytics_storage: ConsentSignal
}

export function buildConsentDefault(waitForUpdate: number | null): ConsentDefaultPayload {
  const payload: ConsentDefaultPayload = {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied'
  }

  if (waitForUpdate !== null && Number.isFinite(waitForUpdate) && waitForUpdate > 0) {
    payload.wait_for_update = Math.floor(waitForUpdate)
  }

  return payload
}

export function buildConsentUpdate(analytics: boolean): ConsentUpdatePayload {
  return { analytics_storage: analytics ? 'granted' : 'denied' }
}
