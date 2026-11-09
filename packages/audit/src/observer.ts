import type { BrowserContext, Request, Response } from 'playwright'
import { cookieProblem, matchingIgnorePattern } from './policy.js'
import type { AuditConfig, CookieIdentity } from './policy.js'
import type { AuditFinding, AuditReport, CookieObservation } from './runner.js'

interface ObservationState {
  stage: string
  page: number | 'cookies'
  accepted: string[]
  consentCookie?: CookieIdentity
}

export function responseCookie(header: string, responseUrl: string): CookieIdentity | undefined {
  const parts = header.split(';')
  const pair = parts.shift() ?? ''
  const separator = pair.indexOf('=')
  const name = pair.slice(0, separator).trim()
  if (separator < 1 || !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)) return undefined
  const url = new URL(responseUrl)
  const attributes = new Map(parts.map((part) => {
    const index = part.indexOf('=')
    return index === -1
      ? [part.trim().toLowerCase(), '']
      : [part.slice(0, index).trim().toLowerCase(), part.slice(index + 1).trim()]
  }))
  const maxAge = attributes.get('max-age')
  const expires = attributes.get('expires')
  if (maxAge !== undefined && /^-?\d+$/.test(maxAge) && Number(maxAge) <= 0) return undefined
  if (maxAge === undefined && expires !== undefined && Date.parse(expires) <= Date.now()) return undefined
  const defaultPath = url.pathname.slice(0, url.pathname.lastIndexOf('/')) || '/'
  const path = attributes.get('path')
  return {
    name, domain: (attributes.get('domain') ?? url.hostname).toLowerCase(),
    path: path?.startsWith('/') ? path : defaultPath,
    ...(attributes.has('partitioned') ? { partitionKey: 'partitioned' } : {})
  }
}

export function createCookieObserver(
  context: BrowserContext,
  config: AuditConfig,
  report: Pick<AuditReport, 'observations' | 'findings'>,
  scenario: string,
  getState: () => ObservationState
) {
  const observed = new Set<string>()
  const findings = new Set<string>()
  const requests = new WeakMap<Request, { stage: string; page: number | 'cookies' }>()
  let pending = Promise.resolve()

  const addFinding = (finding: AuditFinding): void => {
    const key = JSON.stringify(finding)
    if (!findings.has(key)) {
      findings.add(key)
      report.findings.push(finding)
    }
  }
  const record = (cookie: CookieIdentity, source: CookieObservation['source'], location: { stage: string; page: number | 'cookies' }, accepted: string[]): void => {
    const observation: CookieObservation = { ...cookie, source, scenario, ...location }
    const key = JSON.stringify(observation)
    if (!observed.has(key)) {
      observed.add(key)
      report.observations.push(observation)
    }
    const problem = cookieProblem(cookie, config, accepted, getState().consentCookie)
    const ignored = problem === 'ignored-undeclared-cookie'
    if (problem !== undefined && (source === 'browser' || problem === 'undeclared-cookie' || ignored)) {
      addFinding({
        code: ignored || source === 'browser' ? problem : 'undeclared-set-cookie-attempt',
        severity: ignored ? 'info' : source === 'browser' ? 'failure' : 'warning', scenario, ...location, cookie,
        ...(ignored ? { ignorePattern: matchingIgnorePattern(cookie.name, config.ignoreCookies) } : {})
      })
    }
  }
  const onRequest = (request: Request): void => {
    const { stage, page } = getState()
    requests.set(request, { stage, page })
  }
  const onResponse = (response: Response): void => {
    const { stage, page } = requests.get(response.request()) ?? getState()
    const location = { stage, page }
    pending = pending.then(async () => {
      for (const header of await response.headersArray()) {
        if (header.name.toLowerCase() !== 'set-cookie') continue
        const cookie = responseCookie(header.value, response.url())
        if (cookie !== undefined) record(cookie, 'response-header', location, [])
      }
    }).catch(() => {
      addFinding({ code: 'cookie-observation-incomplete', severity: 'error', scenario, ...location })
    })
  }
  context.on('request', onRequest)
  context.on('response', onResponse)

  return {
    addFinding,
    async snapshot(): Promise<void> {
      const { stage, page, accepted } = getState()
      const choices = [...accepted]
      for (const cookie of await context.cookies()) {
        record({
          name: cookie.name, domain: cookie.domain, path: cookie.path,
          ...(cookie.partitionKey === undefined ? {} : { partitionKey: cookie.partitionKey })
        }, 'browser', { stage, page }, choices)
      }
    },
    async drain(): Promise<void> { await pending },
    async stop(): Promise<void> {
      context.off('request', onRequest)
      context.off('response', onResponse)
      await pending
    }
  }
}