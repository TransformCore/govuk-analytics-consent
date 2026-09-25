import { defaultMessages } from './messages.js'
import type { ConsentMessages, CookieCategory } from './types.js'

export function buildDefaultCategories(messages: ConsentMessages = defaultMessages): CookieCategory[] {
  return [
    {
      id: 'essential',
      title: messages.essentialCategoryTitle,
      description: messages.essentialCategoryDescription,
      essential: true,
      gtagSignals: ['security_storage']
    },
    {
      id: 'analytics',
      title: messages.analyticsCategoryTitle,
      shortName: 'analytics',
      description: messages.analyticsCategoryDescription,
      gtagSignals: ['analytics_storage']
    }
  ]
}

export function buildAdditionalConsentModeCategories(
  messages: ConsentMessages = defaultMessages
): CookieCategory[] {
  return [
    {
      id: 'advertising',
      title: messages.advertisingCategoryTitle,
      shortName: 'communications and marketing',
      description: messages.advertisingCategoryDescription,
      gtagSignals: ['ad_storage', 'ad_user_data', 'ad_personalization']
    },
    {
      id: 'functionality',
      title: messages.functionalityCategoryTitle,
      shortName: 'functionality',
      description: messages.functionalityCategoryDescription,
      gtagSignals: ['functionality_storage']
    },
    {
      id: 'personalization',
      title: messages.personalizationCategoryTitle,
      shortName: 'settings',
      description: messages.personalizationCategoryDescription,
      gtagSignals: ['personalization_storage']
    }
  ]
}

const [essentialCategoryValue, analyticsCategoryValue] = buildDefaultCategories() as [CookieCategory, CookieCategory]
const [advertisingCategoryValue, functionalityCategoryValue, personalizationCategoryValue] =
  buildAdditionalConsentModeCategories() as [CookieCategory, CookieCategory, CookieCategory]

export const analyticsCategory: CookieCategory = analyticsCategoryValue
export const essentialCategory: CookieCategory = essentialCategoryValue
export const advertisingCategory: CookieCategory = advertisingCategoryValue
export const functionalityCategory: CookieCategory = functionalityCategoryValue
export const personalizationCategory: CookieCategory = personalizationCategoryValue
export const defaultCategories: CookieCategory[] = buildDefaultCategories()
export const additionalConsentModeCategories: CookieCategory[] = buildAdditionalConsentModeCategories()
