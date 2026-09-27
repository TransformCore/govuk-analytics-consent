import type { CookieMatcher } from '../consent/removal.js'
import type { ConsentModeCategory } from '../consent/types.js'

export interface ClientCategory extends ConsentModeCategory {
  cookies?: CookieMatcher[]
}

export interface ClientConfig {
  cookieName: string
  cookieVersion: number
  categories: ClientCategory[]
}
