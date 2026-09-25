import { isCategoryAccepted } from '../consent/state.js'
import type { ConsentModeCategory, ConsentState } from '../consent/types.js'

export type ConsentSignal = 'granted' | 'denied'

export type ConsentPayload = Record<string, ConsentSignal>

export interface ConsentDefaultPayload {
  [signal: string]: ConsentSignal | number | undefined
  wait_for_update?: number
}

/**
 * GTM treats any Consent Mode signal never explicitly defaulted as implicitly "granted", so the
 * standard Google signals must always be denied up front even when no category declares them.
 */
const STANDARD_DENIED_SIGNALS = ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage']

/** Every standard signal, plus any declared optional signal, denied until a choice is made. */
export function buildConsentDefault(
  categories: ConsentModeCategory[],
  waitForUpdate: number | null
): ConsentDefaultPayload {
  const signals = new Set(STANDARD_DENIED_SIGNALS)

  for (const category of categories) {
    if (category.essential !== true) {
      for (const signal of category.gtagSignals ?? []) {
        signals.add(signal)
      }
    }
  }

  const payload: ConsentDefaultPayload = {}

  for (const signal of signals) {
    payload[signal] = 'denied'
  }

  for (const category of categories) {
    if (category.essential === true) {
      for (const signal of category.gtagSignals ?? []) {
        payload[signal] = 'granted'
      }
    }
  }

  if (waitForUpdate !== null && Number.isFinite(waitForUpdate) && waitForUpdate > 0) {
    payload.wait_for_update = Math.floor(waitForUpdate)
  }

  return payload
}

/** Maps optional signals to the stored choice and essential signals to granted. */
export function buildConsentUpdate(
  categories: ConsentModeCategory[],
  state: ConsentState
): ConsentPayload {
  const payload: ConsentPayload = {}

  for (const category of categories) {
    const granted = category.essential === true || isCategoryAccepted(state, category)

    for (const signal of category.gtagSignals ?? []) {
      payload[signal] = granted ? 'granted' : 'denied'
    }
  }

  return payload
}
