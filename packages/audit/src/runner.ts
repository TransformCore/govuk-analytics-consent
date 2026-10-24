import { setTimeout as delay } from 'node:timers/promises'
import { existsSync } from 'node:fs'
import type { Browser, BrowserContext, Page } from 'playwright'
import { matchingDeclarations } from './policy.js'
import { createCookieObserver } from './observer.js'
import type { AuditCategory, AuditConfig, CookieDeclaration, CookieIdentity } from './policy.js'

export { responseCookie } from './observer.js'

export interface CookieObservation extends CookieIdentity {
  source: 'browser' | 'response-header'
  scenario: string
  stage: string
  page: number | 'cookies'
}

export interface AuditFinding {
  code: string
  severity: 'failure' | 'warning' | 'error' | 'info'
  scenario: string
  stage: string
  page: number | 'cookies'
  cookie?: CookieIdentity
  declaration?: CookieDeclaration
  ignorePattern?: string
}

export interface AuditRunOptions {
  onProgress?: (message: string) => void
}

export interface AuditReport {
  schemaVersion: 1
  ignoreCookies?: string[]
  origin: string
  startedAt: string
  finishedAt: string
  browserVersion?: string
  status: 'passed' | 'failed' | 'incomplete'
  pages: number
  scenarios: { name: string; completed: boolean }[]
  builtInDeclarations: CookieIdentity[]
  observations: CookieObservation[]
  findings: AuditFinding[]
  limitations: string[]
}

interface Metadata {
  cookieName: string
  cookieVersion: number
  categories: AuditCategory[]
}

class AuditError extends Error {}

export function auditExitCode(report: AuditReport): number {
  return report.status === 'incomplete' ? 2 : report.status === 'failed' ? 1 : 0
}

async function metadata(page: Page, config: AuditConfig): Promise<Metadata> {
  const scripts = page.locator('script[data-module="govuk-analytics-consent"]')
  if (await scripts.count() !== 1) throw new AuditError('missing-or-ambiguous-consent-metadata')
  const data = await scripts.evaluate((element) => ({
    name: element.getAttribute('data-cookie-name'),
    version: element.getAttribute('data-cookie-version'),
    categories: element.getAttribute('data-categories')
  }))
  try {
    const categories: unknown = JSON.parse(decodeURIComponent(data.categories ?? ''))
    if (!data.name || !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(data.name) ||
        !data.version || !Number.isInteger(Number(data.version)) || Number(data.version) < 1 ||
        !Array.isArray(categories) || !categories.every((category: unknown) =>
          typeof category === 'object' && category !== null &&
          'id' in category && typeof category.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(category.id) &&
          (!('essential' in category) || typeof category.essential === 'boolean'))) throw new Error()
    const declared = categories as AuditCategory[]
    if (new Set(declared.map((category) => category.id)).size !== declared.length) throw new Error()
    if (config.cookieName !== undefined && config.cookieName !== data.name) throw new Error()
    if (config.cookieVersion !== undefined && config.cookieVersion !== Number(data.version)) throw new Error()
    if (config.categories !== undefined && (config.categories.length !== declared.length ||
        config.categories.some((category) => !declared.some((entry) =>
          entry.id === category.id && (entry.essential === true) === (category.essential === true))))) {
      throw new Error()
    }
    return { cookieName: data.name, cookieVersion: Number(data.version), categories: declared }
  } catch {
    throw new AuditError('invalid-or-mismatched-consent-metadata')
  }
}

async function verifyChoice(
  context: BrowserContext, config: AuditConfig, meta: Metadata, accepted: string[], currentUrl = config.url
): Promise<void> {
  const deadline = Date.now() + config.timeoutMs
  do {
    const cookies = await context.cookies(currentUrl)
    {
      const cookie = cookies.find((entry) => entry.name === meta.cookieName && entry.path === '/')
      try {
        const state = JSON.parse(decodeURIComponent(cookie?.value ?? ''))
        const optional = meta.categories.filter((category) => !category.essential)
        if (state.version === meta.cookieVersion && typeof state.categories === 'object' && state.categories !== null &&
            !Array.isArray(state.categories) && Object.keys(state.categories).length === optional.length &&
            optional.every((category) => state.categories[category.id] === accepted.includes(category.id))) return
      } catch {}
    }
    await delay(50)
  } while (Date.now() < deadline)
  throw new AuditError('choice-not-persisted-or-invalid')
}

function bannerControl(page: Page, config: AuditConfig, action: 'accept' | 'reject') {
  const selector = action === 'accept' ? config.banner?.acceptSelector : config.banner?.rejectSelector
  if (selector !== undefined) return page.locator(selector)
  const name = action === 'accept' ? /^Accept\b/i : /^Reject\b/i
  return page.locator('.govuk-cookie-banner').getByRole('button', { name })
}

export async function runAudit(config: AuditConfig, options: AuditRunOptions = {}): Promise<AuditReport> {
  const progress = options.onProgress ?? (() => {})
  const report: AuditReport = {
    schemaVersion: 1, origin: config.url, startedAt: new Date().toISOString(), finishedAt: '',
    ...(config.ignoreCookies?.length ? { ignoreCookies: [...config.ignoreCookies] } : {}),
    status: 'incomplete', pages: config.pages.length, scenarios: [], builtInDeclarations: [], observations: [], findings: [],
    limitations: [
      'Observations cover only the configured anonymous pages, Chromium and observation windows; this is not legal certification.',
      'Browser snapshots can miss short-lived JavaScript cookies. Response headers show attempts, not proof of storage.',
      'Browser privacy settings, third-party blocking, service workers, geography and conditional journeys can limit coverage.',
      'Network tracking policy, other storage and JavaScript-disabled journeys are not checked.',
      'Cookie names, domains and paths are reported; values, request bodies and URL queries are omitted.'
    ]
  }
  if (config.mode === 'custom') {
    report.limitations.push('Custom banner mode clicks the configured accept/reject controls and observes resulting cookies; it does not verify that consent was saved or enforced, or check granular categories and withdrawal.')
  }
  let browser: Browser | undefined
  try {
    progress('Launching Chromium...')
    const { chromium } = await import('playwright')
    if (!existsSync(chromium.executablePath())) {
      throw new AuditError('browser-unavailable: Chromium could not start. Install it manually with: npx --package=govuk-analytics-consent-audit playwright install chromium')
    }
    try {
      browser = await chromium.launch({ chromiumSandbox: true })
    } catch {
      throw new AuditError('browser-launch-failed: Chromium could not start with sandboxing enabled. Check browser system dependencies and sandbox support; use a non-root user in a suitably configured container.')
    }
    report.browserVersion = browser.version()
    const scenarios = ['no-choice', 'reject-all', 'accept-all',
      ...(config.categories?.filter((category) => !category.essential).map((category) => `category:${category.id}`) ?? []),
      ...(config.categories !== undefined ? ['withdraw-all'] : [])]
    for (const name of scenarios) {
      progress(`[${name}] Starting scenario...`)
      const result = { name, completed: false }
      report.scenarios.push(result)
      const context = await browser.newContext()
      context.setDefaultTimeout(config.timeoutMs)
      context.setDefaultNavigationTimeout(config.timeoutMs)
      let stage = 'before-choice'
      let pageIndex: number | 'cookies' = 0
      let accepted: string[] = []
      let meta: Metadata | undefined
      let consentCookie: CookieIdentity | undefined = config.mode === 'library'
        ? { name: config.cookieName ?? 'govuk_analytics_consent', domain: new URL(config.url).hostname, path: '/' } : undefined
      const observer = createCookieObserver(context, config, report, name, () => ({
        stage, page: pageIndex, accepted, consentCookie
      }))
      try {
        const page = await context.newPage()
        const navigate = async (path: string): Promise<void> => {
          progress(`[${name}/${stage}] Visiting ${pageIndex === 'cookies' ? 'cookie settings page' : `page ${pageIndex + 1}/${config.pages.length}`}...`)
          const response = await page.goto(new URL(path, config.url).href, { waitUntil: 'load' })
          if (response === null || !response.ok() || new URL(page.url()).origin !== config.url) {
            throw new AuditError('page-unavailable-or-cross-origin-redirect')
          }
          if (config.mode === 'library') {
            const next = await metadata(page, config)
            if (meta !== undefined && JSON.stringify(next) !== JSON.stringify(meta)) throw new AuditError('consent-metadata-changed')
            meta = next
            consentCookie = { name: meta.cookieName, domain: new URL(config.url).hostname, path: '/' }
            if (!report.builtInDeclarations.some((entry) => JSON.stringify(entry) === JSON.stringify(consentCookie))) {
              report.builtInDeclarations.push(consentCookie)
            }
          }
        }
        const observe = async (): Promise<void> => {
          progress(`[${name}/${stage}] Observing cookies for ${config.observationMs} ms...`)
          const deadline = Date.now() + config.observationMs
          do {
            await observer.snapshot()
            await delay(Math.min(50, Math.max(0, deadline - Date.now())))
          } while (Date.now() < deadline)
          await observer.snapshot()
          await observer.drain()
        }
        const visitPages = async (verify: boolean): Promise<void> => {
          for (const [index, path] of config.pages.entries()) {
            pageIndex = index
            await navigate(path)
            if (verify && config.mode === 'library') {
              progress(`[${name}/${stage}] Checking that consent persists...`)
              await verifyChoice(context, config, meta!, accepted, page.url())
            }
            await observe()
          }
        }
        await navigate(config.pages[0]!)
        progress(`[${name}/${stage}] Checking the consent banner...`)
        if (config.mode === 'library') {
          await page.locator('#govuk-analytics-consent-banner [data-consent-state="prompt"]').waitFor({ state: 'visible' })
        } else {
          await bannerControl(page, config, 'accept').waitFor({ state: 'visible' })
          await bannerControl(page, config, 'reject').waitFor({ state: 'visible' })
        }
        await observe()
        if (name === 'no-choice') {
          await visitPages(false)
        } else {
          const optionalIds = meta?.categories.filter((category) => !category.essential).map((category) => category.id) ?? []
          const action = name === 'reject-all' ? 'reject' : 'accept'
          stage = action === 'accept' ? 'accepting' : 'rejecting'
          accepted = action === 'accept' ? optionalIds : []
          progress(`[${name}/${stage}] ${action === 'accept' ? 'Accepting' : 'Rejecting'} all optional cookies...`)
          const control = config.mode === 'library'
            ? page.locator(`#govuk-analytics-consent-banner [data-consent-action="${action}"]`)
            : bannerControl(page, config, action)
          await control.click()
          await page.waitForLoadState('load')
          if (new URL(page.url()).origin !== config.url) throw new AuditError('cross-origin-consent-redirect')
          if (config.mode === 'library') {
            progress(`[${name}/${stage}] Checking the saved consent choice...`)
            await verifyChoice(context, config, meta!, accepted, page.url())
          }
          stage = config.mode === 'library'
            ? action === 'accept' ? 'accepted' : 'rejected'
            : action === 'accept' ? 'after-accept-click' : 'after-reject-click'
          await observe()
          await visitPages(true)
          if (name.startsWith('category:') || name === 'withdraw-all') {
            pageIndex = 'cookies'
            await navigate(config.cookiesPage!)
            await observe()
            const chosen = name.startsWith('category:') ? [name.slice('category:'.length)] : []
            progress(`[${name}] ${name === 'withdraw-all' ? 'Withdrawing all optional consent' : `Enabling only category ${chosen[0]}`}...`)
            for (const id of optionalIds) {
              await page.locator(`input[type="radio"][name="cookies[${id}]"][value="${chosen.includes(id) ? 'yes' : 'no'}"]`).check()
            }
            stage = 'changing-choice'
            const form = page.locator('form').filter({ has: page.locator('input[name="preference"][value="save"]') })
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'load' }),
              form.locator('button[type="submit"]').click()
            ])
            if (new URL(page.url()).origin !== config.url) throw new AuditError('cross-origin-consent-redirect')
            accepted = chosen
            progress(`[${name}/${stage}] Checking the saved consent choice...`)
            await verifyChoice(context, config, meta!, accepted)
            stage = name === 'withdraw-all' ? 'withdrawn' : name
            await observe()
            await visitPages(true)
          }
        }
        result.completed = true
        progress(`[${name}] Scenario completed.`)
      } catch (error) {
        observer.addFinding({ code: error instanceof AuditError ? error.message : 'scenario-incomplete', severity: 'error', scenario: name, stage, page: pageIndex })
        progress(`[${name}] Scenario could not complete.`)
      } finally {
        await observer.stop()
        await context.close()
      }
    }
  } catch (error) {
    report.findings.push({ code: error instanceof AuditError ? error.message : 'audit-incomplete', severity: 'error', scenario: 'setup', stage: 'setup', page: 0 })
  } finally {
    try {
      await browser?.close()
    } catch {
      report.findings.push({ code: 'browser-cleanup-failed', severity: 'error', scenario: 'cleanup', stage: 'cleanup', page: 0 })
    }
    report.finishedAt = new Date().toISOString()
    report.status = report.findings.some((finding) => finding.severity === 'error') ? 'incomplete'
      : report.findings.some((finding) => finding.severity === 'failure') ? 'failed' : 'passed'
  }
  if (report.status !== 'incomplete') {
    progress('Checking for declared cookies not observed during this audit...')
    const stored = report.observations.filter((observation) => observation.source === 'browser')
    for (const declaration of config.cookies) {
      if (!stored.some((cookie) => matchingDeclarations(cookie, [declaration]).length > 0)) {
        report.findings.push({
          code: 'declared-cookie-not-observed', severity: 'info',
          scenario: 'summary', stage: 'all-scenarios', page: 0, declaration
        })
      }
    }
  }
  return report
}