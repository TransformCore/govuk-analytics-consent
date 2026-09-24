import type { ConsentState } from './types.js'

const EPOCH = new Date(0).toISOString()

export function createInitialState(version: number): ConsentState {
  return { version, analytics: null, updatedAt: EPOCH }
}

export function withAnalytics(state: ConsentState, analytics: boolean): ConsentState {
  return { version: state.version, analytics, updatedAt: new Date().toISOString() }
}

export function hasChoice(state: ConsentState): boolean {
  return state.analytics !== null
}
