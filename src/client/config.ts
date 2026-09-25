import type { ConsentModeCategory } from '../consent/types.js'

export interface ClientConfig {
  cookieName: string
  cookieVersion: number
  categories: ConsentModeCategory[]
}
