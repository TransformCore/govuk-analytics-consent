import { defaultMessages } from './messages.js'
import type { ConsentMessages, CookieCategory } from './types.js'

export function buildDefaultCategories(messages: ConsentMessages = defaultMessages): CookieCategory[] {
  return [
    {
      id: 'essential',
      title: messages.essentialCategoryTitle,
      description: messages.essentialCategoryDescription,
      essential: true
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

const [essentialCategoryValue, analyticsCategoryValue] = buildDefaultCategories() as [CookieCategory, CookieCategory]

export const analyticsCategory: CookieCategory = analyticsCategoryValue
export const essentialCategory: CookieCategory = essentialCategoryValue
export const defaultCategories: CookieCategory[] = buildDefaultCategories()
