import type { CookieCategory } from './types.js'

export const analyticsCategory: CookieCategory = {
  id: 'analytics',
  title: 'Cookies that measure website use',
  description:
    'We use Google Analytics to measure how you use the service so we can improve it based on user needs. ' +
    'We do not allow Google to use or share the data about how you use this site.'
}

export const essentialCategory: CookieCategory = {
  id: 'essential',
  title: 'Strictly necessary cookies',
  description:
    'These essential cookies do things like remember your progress through a form. They always need to be on.'
}

export const defaultCategories: CookieCategory[] = [essentialCategory, analyticsCategory]
