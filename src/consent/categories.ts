import { defaultMessages } from './messages.js'
import type { ConsentMessages, CookieCategory, CookieCategoryPreset } from './types.js'

export function buildDefaultCategories(messages: ConsentMessages = defaultMessages.en): CookieCategory[] {
  return [buildEssentialCategory(messages), buildAnalyticsCategory(messages)]
}

export function buildAdditionalConsentModeCategories(
  messages: ConsentMessages = defaultMessages.en
): CookieCategory[] {
  return [
    buildAdvertisingCategory(messages),
    buildFunctionalityCategory(messages),
    buildPersonalizationCategory(messages)
  ]
}

export function buildCategoryPreset(
  preset: CookieCategoryPreset,
  messages: ConsentMessages
): CookieCategory[] {
  switch (preset) {
    case 'default':
      return buildDefaultCategories(messages)
    case 'essential':
      return [buildEssentialCategory(messages)]
    case 'analytics':
      return [buildAnalyticsCategory(messages)]
    case 'advertising':
      return [buildAdvertisingCategory(messages)]
    case 'functionality':
      return [buildFunctionalityCategory(messages)]
    case 'personalization':
      return [buildPersonalizationCategory(messages)]
    default:
      throw new Error(`Unknown category preset: ${String(preset)}`)
  }
}

function buildEssentialCategory(messages: ConsentMessages): CookieCategory {
  return {
    id: 'essential',
    title: messages.categories.essential.title,
    description: messages.categories.essential.description,
    essential: true,
    gtagSignals: ['security_storage']
  }
}

function buildAnalyticsCategory(messages: ConsentMessages): CookieCategory {
  return {
    id: 'analytics',
    title: messages.categories.analytics.title,
    shortName: 'analytics',
    description: messages.categories.analytics.description,
    gtagSignals: ['analytics_storage']
  }
}

function buildAdvertisingCategory(messages: ConsentMessages): CookieCategory {
  return {
    id: 'advertising',
    title: messages.categories.advertising.title,
    shortName: 'communications and marketing',
    description: messages.categories.advertising.description,
    gtagSignals: ['ad_storage', 'ad_user_data', 'ad_personalization']
  }
}

function buildFunctionalityCategory(messages: ConsentMessages): CookieCategory {
  return {
    id: 'functionality',
    title: messages.categories.functionality.title,
    shortName: 'functionality',
    description: messages.categories.functionality.description,
    gtagSignals: ['functionality_storage']
  }
}

export function buildPersonalizationCategory(messages: ConsentMessages): CookieCategory {
  return {
    id: 'personalization',
    title: messages.categories.personalization.title,
    shortName: 'settings',
    description: messages.categories.personalization.description,
    gtagSignals: ['personalization_storage']
  }
}

export const analyticsCategory: CookieCategory = buildAnalyticsCategory(defaultMessages.en)
export const essentialCategory: CookieCategory = buildEssentialCategory(defaultMessages.en)
export const advertisingCategory: CookieCategory = buildAdvertisingCategory(defaultMessages.en)
export const functionalityCategory: CookieCategory = buildFunctionalityCategory(defaultMessages.en)
export const personalizationCategory: CookieCategory = buildPersonalizationCategory(defaultMessages.en)
export const defaultCategories: CookieCategory[] = [essentialCategory, analyticsCategory]
