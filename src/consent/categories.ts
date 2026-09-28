import { defaultMessages } from './messages.js'
import type { ConsentMessages, CookieCategory, CookieCategoryPreset } from './types.js'

export function buildDefaultCategories(messages: ConsentMessages = defaultMessages): CookieCategory[] {
  return [buildEssentialCategory(messages), buildAnalyticsCategory(messages)]
}

export function buildAdditionalConsentModeCategories(
  messages: ConsentMessages = defaultMessages
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
    title: messages.essentialCategoryTitle,
    description: messages.essentialCategoryDescription,
    essential: true,
    gtagSignals: ['security_storage']
  }
}

function buildAnalyticsCategory(messages: ConsentMessages): CookieCategory {
  return {
    id: 'analytics',
    title: messages.analyticsCategoryTitle,
    shortName: 'analytics',
    description: messages.analyticsCategoryDescription,
    gtagSignals: ['analytics_storage']
  }
}

function buildAdvertisingCategory(messages: ConsentMessages): CookieCategory {
  return {
    id: 'advertising',
    title: messages.advertisingCategoryTitle,
    shortName: 'communications and marketing',
    description: messages.advertisingCategoryDescription,
    gtagSignals: ['ad_storage', 'ad_user_data', 'ad_personalization']
  }
}

function buildFunctionalityCategory(messages: ConsentMessages): CookieCategory {
  return {
    id: 'functionality',
    title: messages.functionalityCategoryTitle,
    shortName: 'functionality',
    description: messages.functionalityCategoryDescription,
    gtagSignals: ['functionality_storage']
  }
}

export function buildPersonalizationCategory(messages: ConsentMessages): CookieCategory {
  return {
    id: 'personalization',
    title: messages.personalizationCategoryTitle,
    shortName: 'settings',
    description: messages.personalizationCategoryDescription,
    gtagSignals: ['personalization_storage']
  }
}

export const analyticsCategory: CookieCategory = buildAnalyticsCategory(defaultMessages)
export const essentialCategory: CookieCategory = buildEssentialCategory(defaultMessages)
export const advertisingCategory: CookieCategory = buildAdvertisingCategory(defaultMessages)
export const functionalityCategory: CookieCategory = buildFunctionalityCategory(defaultMessages)
export const personalizationCategory: CookieCategory = buildPersonalizationCategory(defaultMessages)
export const defaultCategories: CookieCategory[] = [essentialCategory, analyticsCategory]
