import { resolveOptions } from './consent/options.js'
import { createConsentContext, createConsentRequestState } from './integrations/core.js'
import { isExpressApp, registerExpress } from './integrations/express.js'
import {
  govukAnalyticsConsentPlugin,
  isHapiServer,
  registerHapi
} from './integrations/hapi.js'
import type { ExpressAppLike } from './integrations/express.js'
import type { HapiServerLike } from './integrations/hapi.js'
import type { GovUkAnalyticsConsentOptions, ResolvedOptions } from './consent/types.js'

export function registerGovUkAnalyticsConsent(
  target: HapiServerLike | ExpressAppLike,
  options: GovUkAnalyticsConsentOptions = {}
): ResolvedOptions {
  if (isHapiServer(target)) {
    return registerHapi(target, options)
  }

  if (isExpressApp(target)) {
    return registerExpress(target, options)
  }

  throw new Error(
    'registerGovUkAnalyticsConsent expects a Hapi server or an Express application.'
  )
}

export {
  resolveOptions,
  createConsentContext,
  createConsentRequestState,
  registerHapi,
  registerExpress,
  govukAnalyticsConsentPlugin
}
export { isHapiServer, isExpressApp }
export type { HapiPlugin, HapiServerLike } from './integrations/hapi.js'
export type { ExpressAppLike }
export type {
  ConsentContext,
  ConsentRequestState,
  ContextInput
} from './integrations/core.js'
export {
  advertisingCategory,
  analyticsCategory,
  buildAdditionalConsentModeCategories,
  essentialCategory,
  functionalityCategory,
  personalizationCategory,
  defaultCategories
} from './consent/categories.js'
export { defaultMessages, resolveMessages, welshMessages } from './consent/messages.js'
export type { ConsentMessages } from './consent/types.js'
export { defaultCookieDefinitions } from './consent/default-cookies.js'
export {
  parseConsentCookie,
  serialiseConsent,
  parseCookieHeader,
  readConsentFromHeader
} from './consent/cookie.js'
export {
  createInitialState,
  withCategoryChoices,
  buildCategoryChoices,
  isCategoryAccepted,
  hasChoice
} from './consent/state.js'
export { buildConsentDefault, buildConsentUpdate } from './gtm/consent-mode.js'
export {
  renderConsentHead,
  renderConsentNoscript,
  renderConsentBanner,
  renderConsentCookiesPage,
  renderConsentScripts
} from './ui/html.js'
export { buildViewModel } from './ui/view-model.js'
export type { ConsentViewModel } from './ui/view-model.js'
export {
  govukAnalyticsConsentTemplatePath,
  MACRO_IMPORT_PATH,
  PAGE_TEMPLATE_IMPORT_PATH
} from './ui/template-path.js'
export type {
  ConsentState,
  CookieCategory,
  CookieDefinition,
  GovUkAnalyticsConsentOptions,
  ResolvedOptions
} from './consent/types.js'
