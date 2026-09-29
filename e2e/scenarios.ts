import type { CookieCategoryPreset } from '../src/consent/types.js'

export interface Scenario {
  name: string
  server: string
  port: number
  language: 'en' | 'cy'
  gtmContainerId: string | null
  gaMeasurementId: string | null
  /** Presets added after essential and analytics (the examples default to `personalization`). */
  extraCategories: CookieCategoryPreset[]
}

const EXPRESS = 'e2e/servers/express.js'
const HAPI = 'e2e/servers/hapi.js'
const gtm = { gtmContainerId: 'GTM-E2ETEST', gaMeasurementId: 'G-E2ETEST' }
const noGtm = { gtmContainerId: null, gaMeasurementId: null }

// Express example uses English messages; Hapi example uses welshMessages.
export const scenarios: Scenario[] = [
  { name: 'express', server: EXPRESS, port: 3101, language: 'en', ...noGtm, extraCategories: [] },
  { name: 'express-personalization-gtm', server: EXPRESS, port: 3102, language: 'en', ...gtm, extraCategories: ['personalization'] },
  { name: 'hapi-welsh-personalization', server: HAPI, port: 3103, language: 'cy', ...noGtm, extraCategories: ['personalization'] },
  { name: 'hapi-welsh', server: HAPI, port: 3104, language: 'cy', ...gtm, extraCategories: [] },
  {
    name: 'express-gtm-all-categories',
    server: EXPRESS,
    port: 3105,
    language: 'en',
    ...gtm,
    extraCategories: ['personalization', 'advertising', 'functionality']
  },
  { name: 'hapi-welsh-advertising', server: HAPI, port: 3106, language: 'cy', ...noGtm, extraCategories: ['advertising'] }
]
