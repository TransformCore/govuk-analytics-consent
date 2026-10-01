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
import type { ResolvedOptions } from './consent/types.js'
import type { GovUkAnalyticsConsentInput } from './consent/create.js'

export function registerGovUkAnalyticsConsent(
  target: HapiServerLike | ExpressAppLike,
  options: GovUkAnalyticsConsentInput = {}
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
  buildDefaultCategories,
  buildAdditionalConsentModeCategories,
  buildPersonalizationCategory,
  essentialCategory,
  functionalityCategory,
  personalizationCategory,
  defaultCategories
} from './consent/categories.js'
export { defaultMessages, getDefaultMessages, resolveMessages, createMessageResolver, MESSAGE_PREFIX } from './consent/messages.js'
export type { LocalizedMessages, MessageTranslator, TranslationContext, MessageTree } from './consent/messages.js'
export type { ConsentMessages, TranslateMessage } from './consent/types.js'
export { defaultCookieDefinitions } from './consent/default-cookies.js'
export { createGovUkAnalyticsConsent, isGovUkAnalyticsConsent } from './consent/create.js'
export type { GovUkAnalyticsConsent, GovUkAnalyticsConsentInput } from './consent/create.js'
export { googleAnalytics } from './tags/google-analytics.js'
export type { GoogleAnalyticsTagOptions } from './tags/google-analytics.js'
export { hotjar } from './tags/hotjar.js'
export type { HotjarTagOptions } from './tags/hotjar.js'
export { microsoftClarity } from './tags/microsoft-clarity.js'
export type { MicrosoftClarityTagOptions } from './tags/microsoft-clarity.js'
export type { ConsentTag, TagOptions } from './tags/types.js'
export type { ConsentTagInput, ConsentTagPreset } from './tags/presets.js'
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
export { gtmBaseAllowlist } from './gtm/restrictions.js'
export type { GtmAllowlistInput, GtmRestrictions } from './gtm/restrictions.js'
export { gtmCspDirectives, mergeCspDirectives, toBlankieCsp, toHelmetCsp } from './tags/csp.js'
export type {
  BlankieCspOptions,
  CspDirectiveName,
  CspDirectives,
  HelmetCspDirectives,
  HelmetCspSource,
  ResolvedCspDirectives
} from './tags/csp.js'
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
  CookieCategoryInput,
  CookieCategoryPreset,
  CookieDefinition,
  CookieDefinitionFactory,
  CookieDefinitionInput,
  CookieRemoval,
  GovUkAnalyticsConsentOptions,
  ResolvedOptions
} from './consent/types.js'
