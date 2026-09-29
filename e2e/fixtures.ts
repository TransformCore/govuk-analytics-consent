import { test as base, expect, type BrowserContext, type Page } from '@playwright/test'
import { defaultMessages, welshMessages } from '../src/consent/messages.js'
import { buildCategoryPreset } from '../src/consent/categories.js'
import { scenarios, type Scenario } from './scenarios.js'
import type { ConsentMessages, CookieCategory } from '../src/consent/types.js'

export interface ScenarioOptions {
  scenario: Scenario
}

interface Fixtures {
  messages: ConsentMessages
  bannerTitle: string
  /** Non-essential categories the scenario's server offers, in cookies-page order. */
  optionalCategories: CookieCategory[]
  /** The example's server-rendered message for a personalisation choice (`null` = no choice yet). */
  serverMessage: (personalizationAccepted: boolean | null) => string
  /** Non-essential cookies the example defines, so rejecting should remove them. */
  nonEssentialCookies: string[]
  /** Every non-localhost URL the page tried to load; these are stubbed, never hit the network. */
  externalRequests: string[]
}

export const SERVICE_NAME = 'Example service'
export const CONSENT_COOKIE = 'govuk_analytics_consent'

export const serverMessages = {
  none: 'You have not chosen your cookie preferences yet.',
  enabled: 'Personalisation cookies are enabled.',
  disabled: 'Personalisation cookies are disabled.',
  notUsed: 'This service does not use personalisation cookies.'
}

export const test = base.extend<ScenarioOptions & Fixtures>({
  scenario: [scenarios[0]!, { option: true }],
  messages: async ({ scenario }, use) => {
    await use(scenario.language === 'cy' ? welshMessages : defaultMessages)
  },
  bannerTitle: async ({ messages }, use) => {
    await use(format(messages.bannerTitle, { serviceName: SERVICE_NAME }))
  },
  optionalCategories: async ({ scenario, messages }, use) => {
    await use(
      (['analytics', ...scenario.extraCategories] as const).flatMap((preset) => buildCategoryPreset(preset, messages))
    )
  },
  serverMessage: async ({ scenario }, use) => {
    const usesPersonalization = scenario.extraCategories.includes('personalization')

    await use((accepted) => {
      if (!usesPersonalization) {
        return serverMessages.notUsed
      }

      return accepted === null ? serverMessages.none : accepted ? serverMessages.enabled : serverMessages.disabled
    })
  },
  nonEssentialCookies: async ({ scenario }, use) => {
    await use([
      '_ga',
      '_ga_ABC123',
      ...(scenario.extraCategories.includes('personalization') ? ['example_preferences'] : []),
      ...(scenario.extraCategories.includes('advertising') ? ['example_advertising'] : []),
      ...(scenario.extraCategories.includes('functionality') ? ['example_functionality'] : [])
    ])
  },
  externalRequests: [
    async ({ context }, use) => {
      const requests: string[] = []

      await context.route(
        (url) => url.hostname !== 'localhost',
        (route) => {
          requests.push(route.request().url())
          return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
        }
      )
      await use(requests)
    },
    { auto: true }
  ]
})

export { expect }

export function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`)
}

/** Expected stored choices, e.g. `{ analytics: true, personalization: false }`. */
export function choices(
  categories: CookieCategory[],
  accepted: boolean | ((category: CookieCategory) => boolean)
): Record<string, boolean> {
  return Object.fromEntries(
    categories.map((category) => [category.id, typeof accepted === 'function' ? accepted(category) : accepted])
  )
}

/** Expected Consent Mode signals for the given stored choices. */
export function signals(categories: CookieCategory[], chosen: Record<string, boolean>): Record<string, string> {
  return Object.fromEntries(
    categories.flatMap((category) =>
      (category.gtagSignals ?? []).map((signal) => [signal, chosen[category.id] === true ? 'granted' : 'denied'])
    )
  )
}

export function categoryQuestion(messages: ConsentMessages, category: CookieCategory): string {
  return format(messages.categoryQuestion, { label: category.shortName ?? category.title })
}

export async function readConsent(context: BrowserContext): Promise<Record<string, boolean> | null> {
  const cookie = (await context.cookies()).find((entry) => entry.name === CONSENT_COOKIE)

  if (cookie === undefined) {
    return null
  }

  return JSON.parse(decodeURIComponent(cookie.value)).categories
}

export async function cookieNames(context: BrowserContext): Promise<string[]> {
  return (await context.cookies()).map((cookie) => cookie.name)
}

/** gtag() pushes `arguments` objects, so normalise them to arrays before serialising. */
export async function readDataLayer(page: Page): Promise<unknown[]> {
  return page.evaluate(() =>
    JSON.parse(
      JSON.stringify(
        ((window as unknown as { dataLayer?: unknown[] }).dataLayer ?? []).map((entry) =>
          typeof entry === 'object' && entry !== null && !Array.isArray(entry) && 'length' in entry
            ? Array.from(entry as ArrayLike<unknown>)
            : entry
        )
      )
    )
  )
}

export function consentCommands(dataLayer: unknown[], command: 'default' | 'update'): Record<string, unknown>[] {
  return dataLayer
    .filter((entry): entry is unknown[] => Array.isArray(entry) && entry[0] === 'consent' && entry[1] === command)
    .map((entry) => entry[2] as Record<string, unknown>)
}
