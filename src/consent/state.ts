import type { ConsentCategoryRef, ConsentState } from './types.js'

const EPOCH = new Date(0).toISOString()

export function createInitialState(version: number): ConsentState {
  return { version, categories: null, updatedAt: EPOCH }
}

export function hasChoice(state: ConsentState): boolean {
  return state.categories !== null
}

export function isCategoryAccepted(state: ConsentState, category: ConsentCategoryRef): boolean {
  if (category.essential === true) {
    return true
  }

  return state.categories?.[category.id] ?? false
}

export function withCategoryChoices(
  state: ConsentState,
  choices: Record<string, boolean>
): ConsentState {
  return { version: state.version, categories: choices, updatedAt: new Date().toISOString() }
}

/** Builds a choices map applying one accept/reject decision to every non-essential category. */
export function buildCategoryChoices(
  categories: ConsentCategoryRef[],
  accepted: boolean
): Record<string, boolean> {
  const choices: Record<string, boolean> = {}

  for (const category of categories) {
    if (category.essential !== true) {
      choices[category.id] = accepted
    }
  }

  return choices
}
