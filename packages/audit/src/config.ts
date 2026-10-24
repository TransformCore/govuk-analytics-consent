import { isInternalPath, parseAuditConfig } from './policy.js'
import type { AuditConfig } from './policy.js'

export interface AuditOptions {
  url: string
  pages?: string[]
  observationMs?: number
  timeoutMs?: number
  categoryChecks?: boolean
  cookiesPage?: string
  auditPath?: string
  ignoreCookies?: string[]
}

export async function loadAuditConfiguration(settings: AuditOptions): Promise<AuditConfig> {
  const base = parseAuditConfig({
    mode: 'library', url: settings.url, pages: settings.pages, cookies: [],
    observationMs: settings.observationMs, timeoutMs: settings.timeoutMs, ignoreCookies: settings.ignoreCookies
  })
  const auditPath = settings.auditPath ?? '/govuk-analytics-consent/audit.json'
  if (!isInternalPath(auditPath, base.url)) throw new Error('auditPath must be a same-origin path')
  const response = await fetch(new URL(auditPath, base.url), {
    headers: { accept: 'application/json' }, cache: 'no-store', redirect: 'error',
    signal: AbortSignal.timeout(base.timeoutMs)
  })
  if (!response.ok || !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') ?? '') || response.body === null) {
    throw new Error('Audit endpoint is unavailable or did not return JSON; enable auditEnabled on the server')
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let body = ''
  let bytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > 1024 * 1024) throw new Error('Audit configuration exceeds 1 MiB')
      body += decoder.decode(value, { stream: true })
    }
  } finally {
    await reader.cancel()
  }
  const document: unknown = JSON.parse(body + decoder.decode())
  if (typeof document !== 'object' || document === null || Array.isArray(document)) throw new Error('Invalid audit document')
  const data = document as Record<string, unknown>
  if (data.schemaVersion !== 1 || typeof data.cookieName !== 'string' || !Number.isInteger(data.cookieVersion) ||
      !Array.isArray(data.categories) || !Array.isArray(data.cookies) ||
      (data.cookiesPageUrl !== null && typeof data.cookiesPageUrl !== 'string') ||
      Object.keys(data).some((key) => !['schemaVersion', 'cookieName', 'cookieVersion', 'cookiesPageUrl', 'categories', 'cookies'].includes(key))) {
    throw new Error('Invalid or unsupported audit document')
  }
  const validated = parseAuditConfig({
    ...base, cookies: data.cookies, categories: data.categories,
    cookiesPage: data.cookiesPageUrl ?? '/', cookieName: data.cookieName, cookieVersion: data.cookieVersion
  })
  if (settings.categoryChecks) {
    const cookiesPage = settings.cookiesPage ?? data.cookiesPageUrl
    if (!isInternalPath(cookiesPage, base.url)) throw new Error('cookiesPage is required and must be a same-origin path for category checks')
    return { ...validated, cookiesPage }
  }
  return { ...validated, categories: undefined, cookiesPage: undefined }
}