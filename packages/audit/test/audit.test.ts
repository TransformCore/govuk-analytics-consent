import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chmod, link, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { EventEmitter } from 'node:events'
import type { BrowserContext } from 'playwright'
import { cookieProblem, matchingDeclarations, parseAuditConfig, sameCookie } from '../src/policy.js'
import { responseCookie, runAudit } from '../src/runner.js'
import { chromium } from 'playwright'
import { main } from '../src/cli.js'
import { loadAuditConfiguration } from '../src/config.js'
import { cookieTable } from '../src/table.js'
import type { AuditReport, CookieObservation } from '../src/runner.js'
import { checkReportPath, writeAuditReport } from '../src/report-file.js'
import { createCookieObserver } from '../src/observer.js'

const input = { mode: 'library' as const, url: 'https://service.example', cookies: [{ name: '_ga', match: '_ga*', domain: '.service.example', path: '/' }] }
const consent = { name: 'govuk_analytics_consent', domain: 'service.example', path: '/' }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('deployed audit configuration', () => {
  const document = {
    schemaVersion: 1, cookieName: 'service_consent', cookieVersion: 3, cookiesPageUrl: '/cookie-settings',
    categories: [{ id: 'essential', essential: true }, { id: 'analytics', essential: false }],
    cookies: [{ name: 'session', categoryId: 'essential' }, { name: '_ga_<id>', match: '_ga_*', categoryId: 'analytics' }]
  }

  function serve(data: unknown = document, status = 200, contentType = 'application/json') {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status, headers: { 'content-type': contentType } }))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('reads resolved declarations without loading any local module', async () => {
    const fetchMock = serve()
    const config = await loadAuditConfiguration({ url: input.url })
    expect(config.cookies).toEqual(document.cookies)
    expect(config.cookieName).toBe('service_consent')
    expect(config.cookieVersion).toBe(3)
    expect(config.categories).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(new URL('/govuk-analytics-consent/audit.json', input.url), expect.objectContaining({ redirect: 'error', cache: 'no-store' }))
  })

  it('uses a custom endpoint path and derives category checks from the response', async () => {
    const fetchMock = serve()
    const config = await loadAuditConfiguration({ url: input.url, categoryChecks: true, auditPath: '/tools/audit.json' })
    expect(config.categories).toEqual(document.categories)
    expect(config.cookiesPage).toBe('/cookie-settings')
    expect(fetchMock.mock.calls[0]?.[0].pathname).toBe('/tools/audit.json')
  })

  it('preserves run settings and validates overridden settings-page paths', async () => {
    serve()
    const settings = { url: input.url, pages: ['/start'], observationMs: 100, timeoutMs: 500, categoryChecks: true }
    expect(await loadAuditConfiguration({ ...settings, cookiesPage: '/custom-settings' })).toMatchObject({
      pages: ['/start'], observationMs: 100, timeoutMs: 500, cookiesPage: '/custom-settings'
    })
    serve()
    await expect(loadAuditConfiguration({ ...settings, cookiesPage: '//other.example' })).rejects.toThrow('same-origin')
  })

  it('takes ignore patterns only from local settings, never the deployed document', async () => {
    serve()
    expect((await loadAuditConfiguration({ url: input.url, ignoreCookies: ['session_*'] })).ignoreCookies).toEqual(['session_*'])
    serve({ ...document, ignoreCookies: ['*'] })
    await expect(loadAuditConfiguration({ url: input.url })).rejects.toThrow('unsupported')
  })

  it('rejects invalid local ignore patterns before fetching the endpoint', async () => {
    const fetchMock = serve()
    await expect(loadAuditConfiguration({ url: input.url, ignoreCookies: ['invalid pattern'] })).rejects.toThrow('ignoreCookies')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requires a settings page only for category checks', async () => {
    serve({ ...document, cookiesPageUrl: null })
    await expect(loadAuditConfiguration({ url: input.url })).resolves.toBeDefined()
    serve({ ...document, cookiesPageUrl: null })
    await expect(loadAuditConfiguration({ url: input.url, categoryChecks: true })).rejects.toThrow()
  })

  it.each([
    { ...document, schemaVersion: 2 }, { ...document, cookieName: null }, { ...document, cookieVersion: 0 },
    { ...document, cookiesPageUrl: '//other.example' }, { ...document, secret: 'unexpected' },
    { ...document, cookies: [{ name: 'x', categoryId: 'missing' }] }, null
  ])('rejects malformed or unsupported documents', async (data) => {
    serve(data)
    await expect(loadAuditConfiguration({ url: input.url })).rejects.toThrow()
  })

  it('rejects errors, HTML and oversized responses', async () => {
    serve(document, 404)
    await expect(loadAuditConfiguration({ url: input.url })).rejects.toThrow()
    serve(document, 200, 'text/html')
    await expect(loadAuditConfiguration({ url: input.url })).rejects.toThrow()
    serve('x'.repeat(1024 * 1024))
    await expect(loadAuditConfiguration({ url: input.url })).rejects.toThrow('1 MiB')
  })

  it('rejects cross-origin endpoint paths before making a request', async () => {
    const fetchMock = serve()
    await expect(loadAuditConfiguration({ url: input.url, auditPath: '//other.example/audit.json' })).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('audit cookie policy', () => {
  it('works without category declarations and only approves matching cookies', () => {
    const config = parseAuditConfig(input)
    expect(cookieProblem({ name: '_ga_123', domain: '.service.example', path: '/' }, config, [], consent)).toBeUndefined()
    expect(cookieProblem({ name: 'surprise', domain: 'service.example', path: '/' }, config, ['analytics'], consent)).toBe('undeclared-cookie')
    expect(cookieProblem({ name: '_ga', domain: 'other.example', path: '/' }, config, [], consent)).toBe('undeclared-cookie')
    expect(cookieProblem({ name: '_ga', domain: 'service.example', path: '/other' }, config, [], consent)).toBe('undeclared-cookie')
  })

  it('allows the built-in consent cookie only at its expected scope', () => {
    const config = parseAuditConfig(input)
    expect(cookieProblem(consent, config, [], consent)).toBeUndefined()
    expect(cookieProblem({ ...consent, domain: 'other.example' }, config, [], consent)).toBe('undeclared-cookie')
    expect(cookieProblem({ ...consent, path: '/other' }, config, [], consent)).toBe('undeclared-cookie')
    expect(cookieProblem({ ...consent, domain: '.SERVICE.EXAMPLE' }, config, [], consent)).toBeUndefined()
    expect(cookieProblem({ ...consent, partitionKey: 'https://other.example' }, config, [], consent)).toBe('undeclared-cookie')
    expect(sameCookie(consent, { ...consent, name: 'different' })).toBe(false)
  })

  it('treats a name literally unless a match pattern is supplied', () => {
    const config = parseAuditConfig({ ...input, cookies: [{ name: 'literal*' }] })
    expect(cookieProblem({ name: 'literal*', domain: 'service.example', path: '/' }, config, [], consent)).toBeUndefined()
    expect(cookieProblem({ name: 'literal-other', domain: 'service.example', path: '/' }, config, [], consent)).toBe('undeclared-cookie')
  })

  it.each([
    ['*', '', true], ['prefix*', 'prefix', true], ['*suffix', 'suffix', true],
    ['ab*bc', 'abc', false], ['ab*bc', 'abbc', true],
    ['a*b*c', 'abxc', true], ['a*b*c', 'acb', false],
    ['***a***b***', 'xa--by', true], ['_pk_id.*', '_pk_id.1', true],
    ['_pk_id.*', '_pk_idX1', false], ['*', 'invalid name', false],
    ['*', 'invalid=name', false], ['*', 'invalid;name', false],
    ['a*'.repeat(18) + 'b', 'a'.repeat(20), false],
    ['a*'.repeat(18) + 'b', 'a'.repeat(80) + 'b', true]
  ])('matches glob %j against %j without regex expansion', (match, name, expected) => {
    expect(matchingDeclarations({ name, domain: 'service.example', path: '/' }, [{ name: 'display', match }]).length > 0).toBe(expected)
  })

  it('checks mapped categories only when enabled', () => {
    const config = parseAuditConfig({ ...input, cookiesPage: '/cookies', categories: [{ id: 'analytics' }], cookies: [{ name: '_ga', categoryId: 'analytics' }] })
    const cookie = { name: '_ga', domain: 'service.example', path: '/' }
    expect(cookieProblem(cookie, config, [], consent)).toBe('category-not-consented')
    expect(cookieProblem(cookie, config, ['analytics'], consent)).toBeUndefined()
    expect(cookieProblem(cookie, { ...config, cookies: [...config.cookies, { name: '_ga' }] }, [], consent)).toBe('ambiguous-category')
  })

  it('ignores only undeclared names matching explicit whole-name globs', () => {
    const config = parseAuditConfig({ ...input, ignoreCookies: ['session_*', 'exception', 'session_*'] })
    expect(config.ignoreCookies).toEqual(['session_*', 'exception'])
    const cookie = { name: 'session_123', domain: 'service.example', path: '/' }
    expect(cookieProblem(cookie, config, [], consent)).toBe('ignored-undeclared-cookie')
    expect(cookieProblem({ ...cookie, name: 'exception' }, config, [], consent)).toBe('ignored-undeclared-cookie')
    expect(cookieProblem({ ...cookie, name: 'xsession_123' }, config, [], consent)).toBe('undeclared-cookie')
    expect(cookieProblem({ ...cookie, name: 'other' }, config, [], consent)).toBe('undeclared-cookie')
  })

  it('does not let ignore patterns bypass consent checks for declared cookies', () => {
    const config = parseAuditConfig({
      ...input, categories: [{ id: 'analytics' }], cookiesPage: '/cookies', ignoreCookies: ['*'],
      cookies: [{ name: '_ga', categoryId: 'analytics' }]
    })
    const cookie = { name: '_ga', domain: 'service.example', path: '/' }
    expect(cookieProblem(cookie, config, [], consent)).toBe('category-not-consented')
    expect(cookieProblem(cookie, { ...config, cookies: [...config.cookies, { name: '_ga' }] }, [], consent)).toBe('ambiguous-category')
    expect(cookieProblem(consent, config, [], consent)).toBeUndefined()
  })

  it.each([null, '*', [3], [''], ['invalid name'], ['invalid=pattern'], ['invalid;pattern']])(
    'rejects invalid ignore configuration %j', (ignoreCookies) => {
      expect(() => parseAuditConfig({ ...input, ignoreCookies })).toThrow('ignoreCookies')
    }
  )

  it.each([
    { url: 'file:///tmp/site' }, { url: 'https://user:secret@service.example' },
    { url: 'https://service.example/path' }, { pages: [] }, { pages: ['//other.example'] },
    { pages: ['/\\other.example'] }, { observationMs: 0 }, { timeoutMs: Infinity },
    { cookieVersion: 0 },
    { cookeis: [] }, { cookies: [{ name: 'bad name' }] },
    { categories: [{ id: 'analytics' }] },
    { cookiesPage: '/cookies', categories: [{ id: 'analytics' }, { id: 'analytics' }] },
    { cookiesPage: '/cookies', categories: [], cookies: [{ name: 'x', categoryId: 'missing' }] }
  ])('rejects invalid configuration %j', (override) => {
    expect(() => parseAuditConfig({ ...input, ...override })).toThrow()
  })
})

describe('custom banner configuration', () => {
  const banner = { acceptSelector: '#accept-cookies', rejectSelector: '#reject-cookies' }

  it('accepts local selectors without library metadata or a settings page', () => {
    const config = parseAuditConfig({ ...input, mode: 'custom', banner })
    expect(config.mode).toBe('custom')
    expect(config.banner).toEqual(banner)
    expect(config.categories).toBeUndefined()
    expect(cookieProblem({ ...consent }, config, [])).toBe('undeclared-cookie')
  })

  it('allows default banner selectors and individual overrides', () => {
    expect(parseAuditConfig({ ...input, mode: 'custom' }).banner).toEqual({})
    expect(parseAuditConfig({ ...input, mode: 'custom', banner: { acceptSelector: '#accept' } }).banner)
      .toEqual({ acceptSelector: '#accept' })
  })

  it.each([
    null, { acceptSelector: '' }, { ...banner, acceptSelector: '' }, { ...banner, rejectSelector: banner.acceptSelector },
    { ...banner, rejectSelector: 42 }, { ...banner, script: 'unexpected' }
  ])('rejects incomplete or ambiguous custom banner configuration', (value) => {
    expect(() => parseAuditConfig({ ...input, mode: 'custom', banner: value })).toThrow()
  })

  it.each([{ categories: [] }, { cookiesPage: '/cookies' }, { cookieName: 'library_cookie' }, { cookieVersion: 1 }])(
    'rejects library-only controls in custom banner mode', (extra) => {
      expect(() => parseAuditConfig({ ...input, mode: 'custom', banner, ...extra })).toThrow('Custom banners support accept/reject only')
    }
  )

  it('defaults to library mode and rejects banner selectors unless custom mode is selected', () => {
    const { mode: _mode, ...withoutMode } = input
    expect(parseAuditConfig(withoutMode).mode).toBe('library')
    expect(() => parseAuditConfig({ ...input, mode: 'other' })).toThrow('mode')
    expect(() => parseAuditConfig({ ...input, banner: {} })).toThrow('only supported in custom mode')
  })
})

describe('audit browser launch', () => {
  it('requires sandboxing and never retries without it', async () => {
    vi.spyOn(chromium, 'executablePath').mockReturnValue(process.execPath)
    const launch = vi.spyOn(chromium, 'launch').mockRejectedValue(new Error('PRIVATE launch failure'))
    const report = await runAudit(parseAuditConfig(input))
    expect(launch).toHaveBeenCalledExactlyOnceWith({ chromiumSandbox: true })
    expect(report.status).toBe('incomplete')
    expect(report.findings[0]?.code).toContain('browser-launch-failed')
    expect(report.findings[0]?.code).toContain('sandbox support')
    expect(JSON.stringify(report)).not.toContain('PRIVATE')
  })

  it('reports a missing browser without trying to launch or install it', async () => {
    vi.spyOn(chromium, 'executablePath').mockReturnValue('/no/such/consent-audit-chromium')
    const launch = vi.spyOn(chromium, 'launch')
    const report = await runAudit(parseAuditConfig(input))
    expect(launch).not.toHaveBeenCalled()
    expect(report.status).toBe('incomplete')
    expect(report.findings[0]?.code).toContain('browser-unavailable')
    expect(report.findings[0]?.code).toContain('Install it manually')
  })
})

describe('audit response evidence', () => {
  it('extracts scope without recording values, including Expires commas', () => {
    expect(responseCookie('session=SECRET; HttpOnly; Domain=.service.example; Path=/private; Expires=Wed, 21 Oct 2099 07:28:00 GMT', input.url)).toEqual({
      name: 'session', domain: '.service.example', path: '/private'
    })
    expect(responseCookie('session=SECRET', `${input.url}/account/page`)).toEqual({ name: 'session', domain: 'service.example', path: '/account' })
  })

  it('ignores deletions and honors Max-Age over Expires', () => {
    expect(responseCookie('session=; Max-Age=0', input.url)).toBeUndefined()
    expect(responseCookie('session=; Expires=Thu, 01 Jan 1970 00:00:00 GMT', input.url)).toBeUndefined()
    expect(responseCookie('session=x; Max-Age=100; Expires=Thu, 01 Jan 1970 00:00:00 GMT', input.url)?.name).toBe('session')
  })

  it('does not treat partitioned response cookies as the built-in consent cookie', () => {
    const cookie = responseCookie('govuk_analytics_consent=x; Secure; Partitioned', input.url)!
    expect(cookieProblem(cookie, parseAuditConfig(input), [], consent)).toBe('undeclared-cookie')
  })
})

describe('audit observation recorder', () => {
  it('deduplicates redacted evidence, retains request stages and removes listeners', async () => {
    const cookie = { name: 'surprise', value: 'PRIVATE_COOKIE_VALUE', domain: 'service.example', path: '/' }
    const context = Object.assign(new EventEmitter(), { cookies: vi.fn().mockResolvedValue([cookie]) })
    const report: Pick<AuditReport, 'observations' | 'findings'> = { observations: [], findings: [] }
    let stage = 'before-choice'
    const observer = createCookieObserver(context as unknown as BrowserContext, parseAuditConfig(input), report, 'test', () => ({
      stage, page: 0, accepted: [], consentCookie: consent
    }))
    await observer.snapshot()
    await observer.snapshot()
    expect(report.observations).toHaveLength(1)
    expect(report.findings).toHaveLength(1)
    const request = {}
    context.emit('request', request)
    stage = 'accepted'
    context.emit('response', {
      request: () => request, url: () => input.url,
      headersArray: async () => [{ name: 'Set-Cookie', value: 'surprise=PRIVATE_COOKIE_VALUE; Path=/' }]
    })
    await observer.drain()
    expect(report.observations[1]).toMatchObject({ source: 'response-header', stage: 'before-choice' })
    expect(report.findings[1]).toMatchObject({ severity: 'warning', stage: 'before-choice' })
    expect(JSON.stringify(report)).not.toContain('PRIVATE_COOKIE_VALUE')
    await observer.stop()
    expect(context.listenerCount('request')).toBe(0)
    expect(context.listenerCount('response')).toBe(0)
  })
})

describe('audit cookie table', () => {
  function observed(name: string, source: CookieObservation['source'] = 'browser'): CookieObservation {
    return { name, domain: 'service.example', path: '/', source, scenario: 'accept-all', stage: 'accepted', page: 0 }
  }

  it('combines repeated observations and matches wildcard declarations to category IDs', () => {
    const config = parseAuditConfig({ ...input, cookies: [{ name: '_ga_<id>', match: '_ga_*', categoryId: 'analytics' }] })
    const report = {
      status: 'passed' as const, builtInDeclarations: [consent],
      observations: [observed('_ga_123', 'response-header'), observed('_ga_123'), observed('_ga_123'), observed(consent.name)]
    }
    const table = cookieTable(config, report)
    expect(table).toContain('analytics')
    expect(table).toContain('_ga_*')
    expect(table.split('\n').filter((line) => line.includes('_ga_123'))).toHaveLength(1)
    expect(table).toContain('Stored')
    expect(table).toContain('essential (built-in)')
    expect(table).not.toContain('Undeclared')
    expect(table).not.toContain('Header only')
  })

  it('includes unobserved declarations, undeclared cookies and header-only attempts', () => {
    const table = cookieTable({ cookies: [{ name: 'never_set', categoryId: 'analytics' }] }, {
      status: 'failed', builtInDeclarations: [], observations: [observed('surprise'), observed('attempt', 'response-header')]
    })
    expect(table).toContain('never_set')
    expect(table).toContain('Not observed')
    expect(table).toContain('surprise')
    expect(table).toContain('Unknown')
    expect(table).toContain('Undeclared')
    expect(table).toContain('Header only')
  })

  it('keeps domain, path and partition scopes distinct and shows ambiguous categories', () => {
    const table = cookieTable({ cookies: [
      { name: 'session', categoryId: 'analytics', path: '/' },
      { name: 'session', categoryId: 'advertising', path: '/' }
    ] }, {
      status: 'failed', builtInDeclarations: [], observations: [
        observed('session'), { ...observed('session'), domain: 'other.example' },
        { ...observed('session'), path: '/other' }, { ...observed('session'), partitionKey: 'https://partition.example' }
      ]
    })
    expect(table.split('\n').filter((line) => line.startsWith('| session'))).toHaveLength(4)
    expect(table).toContain('advertising, analytics')
    expect(table).toContain('https://partition.example')
    expect(table).toContain('/other')
  })

  it('labels incomplete results and does not print cookie values or terminal controls', () => {
    const table = cookieTable({ cookies: [{ name: 'unseen', categoryId: 'analytics' }] }, {
      status: 'incomplete', builtInDeclarations: [], observations: [{ ...observed('seen'), path: '/\n\u001b[31m', value: 'COOKIE_SECRET' } as CookieObservation]
    })
    expect(table).toContain('Cookies (partial audit)')
    expect(table).toContain('Not assessed')
    expect(table).not.toContain('Not observed')
    expect(table).not.toContain('COOKIE_SECRET')
    expect(table).not.toContain('\u001b')
    expect(table).toContain('\\n\\u001b[31m')
  })

  it('handles an empty inventory', () => {
    expect(cookieTable({ cookies: [] }, { status: 'passed', observations: [], builtInDeclarations: [] }))
      .toContain('No cookie declarations or observations.')
  })

  it('labels ignored undeclared cookies without hiding them or relabelling declared cookies', () => {
    const table = cookieTable({ cookies: [{ name: '_ga', categoryId: 'analytics' }], ignoreCookies: ['*'] }, {
      status: 'passed', builtInDeclarations: [], observations: [observed('exception'), observed('_ga')]
    })
    expect(table).toContain('exception')
    expect(table).toContain('Ignored: *')
    expect(table.split('\n').find((line) => line.startsWith('| _ga'))).toContain('analytics')
    expect(table.split('\n').find((line) => line.startsWith('| _ga'))).not.toContain('Ignored')
  })
})

describe('audit report files', () => {
  let directory: string
  const report: AuditReport = {
    schemaVersion: 1, origin: input.url, startedAt: '', finishedAt: '', status: 'passed', pages: 1,
    scenarios: [], builtInDeclarations: [], observations: [], findings: [], limitations: []
  }

  beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'audit-report-test-')) })
  afterEach(async () => { await rm(directory, { recursive: true, force: true }) })

  it.each(['same-path', 'symbolic-link', 'hard-link', 'parent-alias'])(
    'rejects configuration alias %s without modifying the input', async (alias) => {
      const configuration = join(directory, 'config.json')
      const original = JSON.stringify(input)
      await writeFile(configuration, original)
      let output = configuration
      if (alias === 'symbolic-link' || alias === 'hard-link') {
        output = join(directory, 'output.json')
        if (alias === 'symbolic-link') await symlink(configuration, output)
        else await link(configuration, output)
      }
      if (alias === 'parent-alias') {
        await symlink(directory, join(directory, 'alias'), 'dir')
        output = join(directory, 'alias', 'config.json')
      }
      await expect(checkReportPath(output, configuration)).rejects.toThrow()
      await expect(writeAuditReport(output, report, configuration)).rejects.toThrow()
      expect(await readFile(configuration, 'utf8')).toBe(original)
    }
  )

  it('atomically replaces reports with a private file and cleans temporary files', async () => {
    const output = join(directory, 'report.json')
    await writeAuditReport(output, report)
    await chmod(output, 0o644)
    const previous = await stat(output)
    await writeAuditReport(output, { ...report, status: 'failed' })
    const written = await stat(output)
    expect(JSON.parse(await readFile(output, 'utf8')).status).toBe('failed')
    expect(written.ino).not.toBe(previous.ino)
    if (process.platform !== 'win32') expect(written.mode & 0o777).toBe(0o600)
    expect(await readdir(directory)).toEqual(['report.json'])
  })

  it('does not follow a dangling output link or accept a directory', async () => {
    const output = join(directory, 'dangling.json')
    await symlink(join(directory, 'missing.json'), output)
    await expect(writeAuditReport(output, report)).rejects.toThrow('symbolic link')
    await expect(writeAuditReport(directory, report)).rejects.toThrow('regular file')
    expect(await readdir(directory)).toEqual(['dangling.json'])
  })
})

describe('audit CLI arguments', () => {
  it('returns help without launching a browser', async () => {
    expect(await main(['--help'])).toBe(0)
  })

  it('rejects missing, unknown and invalid configuration arguments', async () => {
    expect(await main([])).toBe(2)
    expect(await main(['audit', '--unknown'])).toBe(2)
    expect(await main(['audit', '--config', '/no/such/config.json'])).toBe(2)
    expect(await main(['audit', '--config', 'same.json', '--output', './same.json'])).toBe(2)
    expect(await main(['--consent', 'consent.mjs'])).toBe(2)
    expect(await main(['--consent', 'consent.mjs', '--url', input.url, '--config', 'audit.json'])).toBe(2)
    expect(await main(['--consent', '/no/such/consent.mjs', '--url', input.url])).toBe(2)
  })
})