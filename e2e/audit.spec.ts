import { test, expect } from '@playwright/test'
import express from 'express'
import type { Server } from 'node:http'
import { link, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { registerExpress } from '../src/integrations/express.js'
import type { ConsentContext } from '../src/integrations/core.js'
import { parseAuditConfig } from '../packages/audit/src/policy.js'
import { auditExitCode, runAudit } from '../packages/audit/src/runner.js'

const execute = promisify(execFile)
let server: Server
let origin: string

test.beforeAll(async ({}, workerInfo) => {
  test.skip(workerInfo.project.name !== 'express', 'Audit checks use an independent local server')
  const app = express()
  app.post('/custom/submit', express.urlencoded({ extended: false }), (req, res) => {
    if (req.body.csrf !== 'custom-token') { res.sendStatus(403); return }
    res.cookie('site_choice', req.body.preference === 'accept' ? 'yes' : 'no', { path: '/', httpOnly: true })
    res.redirect(303, '/custom/form')
  })
  app.get('/custom/:behavior', (req, res) => {
    const form = req.params.behavior === 'form'
    const inert = req.params.behavior === 'noop'
    const cookie = req.headers.cookie ?? ''
    if (req.params.behavior === 'reset') res.clearCookie('site_choice', { path: '/' })
    if (req.params.behavior === 'undeclared') res.cookie('govuk_analytics_consent', 'COOKIE_SECRET', { path: '/' })
    const chosen = cookie.includes('site_choice=yes') ? 'yes' : cookie.includes('site_choice=no') ? 'no' : ''
    const tracking = chosen === 'yes' ? '<script>document.cookie="custom_analytics=COOKIE_SECRET; Path=/"</script>' : ''
    const buttons = '<button id="accept-cookies" name="preference" value="accept">Accept additional cookies</button><button id="reject-cookies" name="preference" value="reject">Reject additional cookies</button>'
    const content = form ? `<form method="post" action="/custom/submit"><input type="hidden" name="csrf" value="custom-token">${buttons}</form>` : buttons
    const script = form ? '' : `<script>
      for (const button of document.querySelectorAll('button')) button.onclick = () => {
        ${inert ? '' : 'document.cookie="site_choice=" + (button.value === "accept" ? "yes" : "no") + "; Path=/";'}
        document.querySelector('.govuk-cookie-banner').hidden = true;
      };
    </script>`
    res.send(`<!doctype html><div class="govuk-cookie-banner"${chosen ? ' hidden' : ''}>${content}</div>${script}${tracking}`)
  })
  registerExpress(app, {
    serviceName: 'Audit fixture', auditEnabled: true, gtmContainerId: '', secureCookie: false,
    categories: ['default', 'personalization'], cookiesPageUrl: '/cookies',
    cookies: [() => [
      { name: 'analytics_cookie', categoryId: 'analytics', purpose: 'Test analytics', expiry: 'Session' },
      { name: 'preferences_cookie', categoryId: 'personalization', purpose: 'Test preferences', expiry: 'Session' }
    ]],
    getCsrfFormFields: () => ({ csrf: 'audit-token' }),
    verifyCsrfFormSubmission: (_request, body) => body.csrf === 'audit-token'
  })
  app.get('/audit-redirect', (_req, res) => { res.redirect('/govuk-analytics-consent/audit.json') })
  app.get('/audit-invalid', (_req, res) => { res.json({ schemaVersion: 99 }) })
  app.get('/broken', (_req, res) => { res.status(503).send('Unavailable') })
  app.get('*', (req, res) => {
    const context = res.locals.govukAnalyticsConsent as ConsentContext
    if (req.path === '/unknown') res.append('Set-Cookie', 'surprise=COOKIE_SECRET; HttpOnly; Path=/private')
    if (req.path === '/transient') res.append('Set-Cookie', ['transient=COOKIE_SECRET; Path=/', 'transient=; Path=/; Max-Age=0'])
    if (req.path === '/blocked') res.append('Set-Cookie', 'blocked=COOKIE_SECRET; Domain=unrelated.example; Path=/')
    if (req.path === '/scope') res.append('Set-Cookie', 'analytics_cookie=COOKIE_SECRET; Path=/private')
    const stored = context.consent.categories
    let scripts = context.scripts
    if (req.path === '/missing-metadata') scripts = ''
    if (req.path === '/no-client') scripts = scripts.replace(' defer ', ' type="application/json" ')
    let cookiesPage = req.path.startsWith('/cookies') ? context.cookiesPage : ''
    if (req.path === '/cookies-bad-csrf') cookiesPage = cookiesPage.replace('value="audit-token"', 'value="wrong"')
    const delayed = req.path === '/delayed' ? '<script>setTimeout(() => { document.cookie = "late=COOKIE_SECRET; Path=/" }, 100)</script>' : ''
    const tracking = `${stored?.analytics || req.path === '/category-leak' ? '<script>document.cookie="analytics_cookie=COOKIE_SECRET; Path=/"</script>' : ''}${stored?.personalization ? '<script>document.cookie="preferences_cookie=COOKIE_SECRET; Path=/"</script>' : ''}`
    res.send(`<!doctype html><html><head>${context.head}</head><body>${context.banner}${cookiesPage}${scripts}${delayed}${tracking}</body></html>`)
  })
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening))
  })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('No fixture port')
  origin = `http://127.0.0.1:${address.port}`
})

test.afterAll(async () => {
  if (server === undefined) return
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

function config(path = '/') {
  return parseAuditConfig({
    mode: 'library', url: origin, pages: [path], observationMs: 200, timeoutMs: 2000,
    cookies: [{ name: 'analytics_cookie', path: '/' }, { name: 'preferences_cookie', path: '/' }]
  })
}

test('passes reviewed cookies without requiring category mappings', async () => {
  const report = await runAudit(config())
  expect(report.findings).toEqual([])
  expect(auditExitCode(report)).toBe(0)
  expect(report.scenarios).toEqual([
    { name: 'no-choice', completed: true }, { name: 'reject-all', completed: true }, { name: 'accept-all', completed: true }
  ])
  expect(report.observations.some((cookie) => cookie.name === 'analytics_cookie' && cookie.stage === 'accepted')).toBe(true)
  expect(JSON.stringify(report)).not.toContain('COOKIE_SECRET')
})

test('audits custom JavaScript and server-form banners without library metadata', async () => {
  for (const behavior of ['working', 'form']) {
    const options = parseAuditConfig({
      mode: 'custom', url: origin, pages: [`/custom/${behavior}`], observationMs: 100, timeoutMs: 1000,
      cookies: [{ name: 'site_choice', categoryId: 'essential' }, { name: 'custom_analytics', categoryId: 'analytics' }]
    })
    const report = await runAudit(options)
    expect(auditExitCode(report), JSON.stringify(report.findings)).toBe(0)
    expect(report.scenarios.every((scenario) => scenario.completed)).toBe(true)
    expect(report.scenarios).toHaveLength(3)
    expect(report.builtInDeclarations).toEqual([])
    expect(report.observations.some((cookie) => cookie.name === 'custom_analytics' && cookie.stage === 'after-accept-click')).toBe(true)
    expect(JSON.stringify(report)).not.toContain('COOKIE_SECRET')
  }
})

test('custom mode records a no-op click without claiming consent was saved', async () => {
  const options = parseAuditConfig({
    mode: 'custom', url: origin, pages: ['/custom/noop'], observationMs: 100, timeoutMs: 200,
    cookies: [{ name: 'site_choice' }],
    banner: {}
  })
  const report = await runAudit(options)
  expect(auditExitCode(report)).toBe(0)
  expect(report.scenarios.every((scenario) => scenario.completed)).toBe(true)
  expect(report.limitations).toContainEqual(expect.stringContaining('does not verify that consent was saved or enforced'))
})

test('custom banner checks cannot pass missing or ambiguous controls', async () => {
  for (const acceptSelector of ['#missing', 'button']) {
    const options = parseAuditConfig({
      mode: 'custom', url: origin, pages: ['/custom/working'], observationMs: 100, timeoutMs: 200,
      cookies: [{ name: 'site_choice' }, { name: 'custom_analytics' }],
      banner: { acceptSelector, rejectSelector: '#reject-cookies' }
    })
    const report = await runAudit(options)
    expect(auditExitCode(report), JSON.stringify(report.findings)).toBe(2)
  }
})

test('custom mode does not validate the site consent cookie on page revisits', async () => {
  const options = parseAuditConfig({
    mode: 'custom', url: origin, pages: ['/custom/reset'], observationMs: 100, timeoutMs: 500,
    cookies: [{ name: 'site_choice' }, { name: 'custom_analytics' }],
    banner: { acceptSelector: '#accept-cookies', rejectSelector: '#reject-cookies' }
  })
  const report = await runAudit(options)
  expect(auditExitCode(report)).toBe(0)
  expect(report.scenarios.every((scenario) => scenario.completed)).toBe(true)
  expect(report.observations.some((cookie) => cookie.name === 'site_choice' && cookie.stage === 'after-accept-click')).toBe(true)
  expect(report.observations.some((cookie) => cookie.name === 'site_choice' && cookie.stage === 'after-accept-click' && cookie.page === 0)).toBe(true)
})

test('CLI custom JSON mode audits independent banners without implicit consent-cookie exemptions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'custom-consent-cli-'))
  const configuration = join(directory, 'config.json')
  const output = join(directory, 'report.json')
  try {
    for (const [behavior, expected] of [['working', 0], ['undeclared', 1]] as const) {
      await writeFile(configuration, JSON.stringify({
        mode: 'custom', url: origin, pages: [`/custom/${behavior}`], observationMs: 100, timeoutMs: 1000,
        cookies: [{ name: 'site_choice', categoryId: 'essential' }, { name: 'custom_analytics', categoryId: 'analytics' }],
        banner: {}
      }))
      let exitCode = 0
      let stdout = ''
      try {
        stdout = (await execute(process.execPath, ['packages/audit/dist/cli.js', '--config', configuration, '--output', output])).stdout
      } catch (error) {
        const result = error as { code: number; stdout: string }
        exitCode = result.code
        stdout = result.stdout
      }
      expect(exitCode).toBe(expected)
      const text = await readFile(output, 'utf8')
      const report = JSON.parse(text)
      expect(auditExitCode(report)).toBe(expected)
      expect(report.scenarios.every((scenario: { completed: boolean }) => scenario.completed)).toBe(true)
      expect(report.builtInDeclarations).toEqual([])
      expect(text + stdout).not.toContain('COOKIE_SECRET')
      if (expected === 1) {
        expect(report.findings).toContainEqual(expect.objectContaining({
          code: 'undeclared-cookie', severity: 'failure', cookie: expect.objectContaining({ name: 'govuk_analytics_consent' })
        }))
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('reports progress and informational declarations not observed in browser storage', async () => {
  const options = config('/blocked?token=URL_SECRET')
  options.cookies = [
    { name: 'analytics_<id>', match: 'analytics_*', domain: '127.0.0.1', path: '/' },
    { name: 'preferences_cookie', path: '/' },
    { name: 'unused_<id>', match: 'unused_*' },
    { name: 'analytics_cookie', domain: 'other.example' },
    { name: 'preferences_cookie', path: '/other' },
    { name: 'blocked', domain: 'unrelated.example' }
  ]
  const messages: string[] = []
  const report = await runAudit(options, { onProgress: (message) => messages.push(message) })
  expect(auditExitCode(report)).toBe(0)
  expect(report.findings).toEqual(options.cookies.slice(2).map((declaration) => ({
    code: 'declared-cookie-not-observed', severity: 'info',
    scenario: 'summary', stage: 'all-scenarios', page: 0, declaration
  })))
  expect(messages[0]).toBe('Launching Chromium...')
  expect(messages).toContain('[no-choice] Starting scenario...')
  expect(messages).toContain('[reject-all/rejecting] Rejecting all optional cookies...')
  expect(messages).toContain('[accept-all/accepting] Accepting all optional cookies...')
  expect(messages).toContain('[accept-all/accepted] Checking that consent persists...')
  expect(messages).toContain('[accept-all] Scenario completed.')
  expect(JSON.stringify(messages) + JSON.stringify(report)).not.toMatch(/URL_SECRET|COOKIE_SECRET/)
})

test('fails unknown HttpOnly cookies, unvisited paths and delayed JavaScript cookies', async () => {
  for (const path of ['/unknown?token=URL_SECRET', '/delayed', '/scope']) {
    const report = await runAudit(config(path))
    expect(auditExitCode(report), path).toBe(1)
    expect(report.findings.some((finding) => finding.code === 'undeclared-cookie' && finding.severity === 'failure')).toBe(true)
    expect(JSON.stringify(report)).not.toContain('COOKIE_SECRET')
    expect(JSON.stringify(report)).not.toContain('URL_SECRET')
  }
})

test('explicit glob exceptions retain cookie evidence as info instead of failures or warnings', async () => {
  for (const path of ['/unknown', '/blocked']) {
    const options = config(path)
    options.ignoreCookies = ['sur*', 'blocked']
    const report = await runAudit(options)
    expect(auditExitCode(report)).toBe(0)
    expect(report.ignoreCookies).toEqual(['sur*', 'blocked'])
    expect(report.findings.some((finding) => finding.code === 'ignored-undeclared-cookie' && finding.severity === 'info')).toBe(true)
    expect(report.findings.some((finding) => finding.severity === 'failure' || finding.severity === 'warning')).toBe(false)
    expect(report.observations.some((cookie) => cookie.name === (path === '/unknown' ? 'surprise' : 'blocked'))).toBe(true)
  }
})

test('preserves transient server writes and distinguishes blocked attempts from storage', async () => {
  for (const path of ['/transient', '/blocked']) {
    const report = await runAudit(config(path))
    expect(auditExitCode(report)).toBe(0)
    expect(report.findings.some((finding) => finding.code === 'undeclared-set-cookie-attempt' && finding.severity === 'warning')).toBe(true)
    expect(report.findings.some((finding) => finding.severity === 'failure')).toBe(false)
  }
})

test('checks individual categories and withdrawal through real CSRF-protected forms', async () => {
  const options = config()
  options.categories = [{ id: 'essential', essential: true }, { id: 'analytics' }, { id: 'personalization' }]
  options.cookiesPage = '/cookies'
  options.cookies = [
    { name: 'analytics_cookie', categoryId: 'analytics' },
    { name: 'preferences_cookie', categoryId: 'personalization' }
  ]
  const report = await runAudit(options)
  expect(report.findings).toEqual([])
  expect(auditExitCode(report)).toBe(0)
  expect(report.scenarios).toContainEqual({ name: 'withdraw-all', completed: true })
  expect(report.scenarios).toContainEqual({ name: 'category:analytics', completed: true })
  expect(report.scenarios).toContainEqual({ name: 'category:personalization', completed: true })
})

test('returns incomplete rather than passing unreachable pages and missing metadata', async () => {
  for (const path of ['/broken', '/missing-metadata']) {
    const report = await runAudit(config(path))
    expect(auditExitCode(report)).toBe(2)
    expect(report.scenarios.every((scenario) => !scenario.completed)).toBe(true)
    expect(report.findings.some((finding) => finding.severity === 'error')).toBe(true)
    expect(report.findings.some((finding) => finding.code === 'declared-cookie-not-observed')).toBe(false)
  }
})

test('fails declared cookies when their mapped category has not been accepted', async () => {
  const options = config('/category-leak')
  options.categories = [{ id: 'essential', essential: true }, { id: 'analytics' }, { id: 'personalization' }]
  options.cookiesPage = '/cookies'
  options.cookies[0]!.categoryId = 'analytics'
  const report = await runAudit(options)
  expect(auditExitCode(report)).toBe(1)
  expect(report.findings.some((finding) => finding.code === 'category-not-consented' && finding.stage === 'before-choice')).toBe(true)
})

test('does not bypass rejected CSRF submissions', async () => {
  const options = config()
  options.categories = [{ id: 'essential', essential: true }, { id: 'analytics' }, { id: 'personalization' }]
  options.cookiesPage = '/cookies-bad-csrf'
  options.timeoutMs = 500
  const report = await runAudit(options)
  expect(auditExitCode(report)).toBe(2)
  expect(report.scenarios).toContainEqual({ name: 'withdraw-all', completed: false })
  expect(report.findings.some((finding) => finding.code === 'declared-cookie-not-observed')).toBe(false)
})

test('CLI reads the deployed generated cookie inventory without local configuration', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'remote-consent-cli-'))
  const output = join(directory, 'report.json')
  try {
    const result = await execute(process.execPath, ['packages/audit/dist/cli.js',
      '--url', origin,
      '--page', '/', '--categories', '--observation-ms', '100', '--timeout-ms', '2000', '--output', output])
    expect(result.stdout).toContain('Cookie audit passed')
    expect(result.stdout).toContain('Loading deployed cookie declarations...')
    expect(result.stdout).toContain('\n\nLaunching Chromium...')
    expect(result.stdout).toContain('\n\nCookies\n')
    expect(result.stdout).toContain('\n\nBounded browser observations')
    expect(result.stdout).toContain('[withdraw-all] Withdrawing all optional consent...')
    expect(result.stdout.indexOf('Launching Chromium...')).toBeLessThan(result.stdout.indexOf('Cookie audit passed'))
    expect(result.stdout).toContain('| Cookie')
    expect(result.stdout).toContain('Category')
    expect(result.stdout).toContain('Declaration / Pattern')
    expect(result.stdout).toContain('analytics_cookie')
    expect(result.stdout).toContain('analytics')
    expect(result.stdout).toContain('essential (built-in)')
    expect(result.stdout.indexOf('| Cookie')).toBeLessThan(result.stdout.indexOf('Cookie audit passed'))
    expect(result.stdout.trim().split('\n').at(-1)).toBe('✅ Cookie audit passed: 6/6 scenarios completed.')
    expect(result.stdout).toContain('🔍 Loading deployed cookie declarations...')
    const report = JSON.parse(await readFile(output, 'utf8'))
    expect(auditExitCode(report)).toBe(0)
    expect(report.scenarios).toContainEqual({ name: 'category:analytics', completed: true })
    expect(report.observations.some((cookie: { name: string }) => cookie.name === 'analytics_cookie')).toBe(true)
    expect(JSON.stringify(report)).not.toContain('COOKIE_SECRET')
    for (const auditPath of ['/audit-redirect', '/audit-invalid', '/missing-metadata']) {
      let exitCode = 0
      try {
        await execute(process.execPath, ['packages/audit/dist/cli.js', '--url', origin, '--audit-path', auditPath])
      } catch (error) {
        exitCode = (error as { code: number }).code
      }
      expect(exitCode).toBe(2)
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('CLI applies repeatable glob exceptions in remote and JSON modes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'consent-audit-ignore-'))
  const output = join(directory, 'report.json')
  const configuration = join(directory, 'config.json')
  try {
    for (const mode of ['remote', 'json']) {
      const options = { ...config('/unknown'), ignoreCookies: ['json_only_*'] }
      await writeFile(configuration, JSON.stringify(options))
      const source = mode === 'remote'
        ? ['--url', origin, '--page', '/unknown', '--observation-ms', '100', '--timeout-ms', '2000']
        : ['--config', configuration]
      const result = await execute(process.execPath, ['packages/audit/dist/cli.js', ...source,
        '--ignore-cookie', 'other_*', '--ignore-cookie', 'sur*', '--output', output])
      expect(result.stdout).toContain('INFO Ignored undeclared cookie matching "sur*"')
      expect(result.stdout).toContain('Ignored: sur*')
      expect(result.stdout.lastIndexOf('\n+')).toBeLessThan(result.stdout.indexOf('\nINFO Ignored'))
      expect(result.stdout).toContain('Cookie audit passed')
      const report = JSON.parse(await readFile(output, 'utf8'))
      expect(report.ignoreCookies).toEqual(mode === 'json' ? ['json_only_*', 'other_*', 'sur*'] : ['other_*', 'sur*'])
      expect(report.observations.some((cookie: { name: string }) => cookie.name === 'surprise')).toBe(true)
      expect(JSON.stringify(report)).not.toContain('COOKIE_SECRET')
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('compiled CLI rejects report aliases before starting the audit', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'consent-audit-alias-'))
  const configuration = join(directory, 'config.json')
  const original = JSON.stringify(config())
  try {
    await writeFile(configuration, original)
    const symbolic = join(directory, 'symbolic.json')
    const hard = join(directory, 'hard.json')
    await symlink(configuration, symbolic)
    await link(configuration, hard)
    for (const output of [configuration, symbolic, hard]) {
      await expect(execute(process.execPath, [
        'packages/audit/dist/cli.js', '--config', configuration, '--output', output
      ])).rejects.toMatchObject({ code: 2, stdout: '', stderr: expect.stringContaining('distinct from the configuration') })
      expect(await readFile(configuration, 'utf8')).toBe(original)
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('compiled CLI writes redacted JSON and returns success, failure and incomplete exit codes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'consent-audit-'))
  const configuration = join(directory, 'config.json')
  const output = join(directory, 'report.json')
  try {
    const linkedCli = join(directory, 'audit-cli.js')
    await symlink(resolve('packages/audit/dist/cli.js'), linkedCli)
    expect((await execute(process.execPath, [linkedCli, '--help'])).stdout).toContain('Usage:')
    for (const [path, expected] of [['/', 0], ['/unknown?token=URL_SECRET', 1], ['/broken', 2]] as const) {
      const options = config(path)
      options.cookies.push({ name: 'unused_cookie' })
      await writeFile(configuration, JSON.stringify(options))
      let exitCode = 0
      let stdout = ''
      try {
        const result = await execute(process.execPath, ['packages/audit/dist/cli.js', 'audit', '--config', configuration, '--output', output])
        stdout = result.stdout
      } catch (error) {
        const result = error as { code: number; stdout: string }
        exitCode = result.code
        stdout = result.stdout
      }
      expect(exitCode).toBe(expected)
      const text = await readFile(output, 'utf8')
      expect(auditExitCode(JSON.parse(text))).toBe(expected)
      expect(text + stdout).not.toContain('COOKIE_SECRET')
      expect(text + stdout).not.toContain('URL_SECRET')
      if (expected === 2) {
        expect(stdout).not.toContain('INFO Declared cookie')
        expect(stdout).toContain('Cookies (partial audit)')
        expect(stdout).toContain('Not assessed')
      } else {
        expect(stdout).toContain('INFO Declared cookie was not observed in browser storage during this audit: {"name":"unused_cookie"}')
        expect(stdout).toContain('Not observed')
        expect(stdout).toContain('| Cookie')
        expect(stdout).toMatch(/\+\n\n(?:INFO|FAILURE|WARNING|ERROR) /)
        expect(stdout.lastIndexOf('\n+')).toBeLessThan(stdout.indexOf('\nINFO Declared'))
        if (expected === 1) {
          expect(stdout).toContain('surprise')
          expect(stdout).toContain('Undeclared')
          expect(stdout.lastIndexOf('\n+')).toBeLessThan(stdout.indexOf('\nFAILURE '))
        }
        expect(JSON.parse(text).findings).toContainEqual(expect.objectContaining({
          code: 'declared-cookie-not-observed', severity: 'info', declaration: { name: 'unused_cookie' }
        }))
      }
    }
    await writeFile(configuration, JSON.stringify(config()))
    let unavailableCode = 0
    let unavailableStdout = ''
    let unavailableStderr = ''
    try {
      await execute(process.execPath, ['packages/audit/dist/cli.js', 'audit', '--config', configuration, '--output', output], {
        env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: join(directory, 'no-browsers') }
      })
    } catch (error) {
      const result = error as { code: number; stdout: string; stderr: string }
      unavailableCode = result.code
      unavailableStdout = result.stdout
      unavailableStderr = result.stderr
    }
    expect(unavailableCode).toBe(2)
    expect(unavailableStdout).toContain('Cookie audit incomplete')
    expect(unavailableStdout).toContain('Chromium could not start. Install it manually with:')
    expect(unavailableStdout).toContain('npx --package=govuk-analytics-consent-audit playwright install chromium')
    expect(unavailableStdout).not.toMatch(/^\s+at\s/m)
    expect(unavailableStderr).toBe('')
    expect(await readdir(directory)).not.toContain('no-browsers')
    const unavailable = JSON.parse(await readFile(output, 'utf8'))
    expect(unavailable.status).toBe('incomplete')
    expect(unavailable.scenarios).toEqual([])
    expect(unavailable.findings[0].code).toContain('browser-unavailable')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})