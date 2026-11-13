#!/usr/bin/env node
import { realpathSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { parseAuditConfig } from './policy.js'
import { auditExitCode, runAudit } from './runner.js'
import { loadAuditConfiguration } from './config.js'
import { cookieTable } from './table.js'
import { checkReportPath, writeAuditReport } from './report-file.js'

const help = `Usage: govuk-analytics-consent-audit --url <origin> [options]
  govuk-analytics-consent-audit --config <file.json> [--output <report.json>]

Reads the deployed cookie declarations from /govuk-analytics-consent/audit.json.
Enable auditEnabled on the server. No application configuration import is needed.

Options: --page <path> (repeatable), --categories, --cookies-page <path>,
  --audit-path <path>, --observation-ms <number>, --timeout-ms <number>, --output <report.json>,
  --ignore-cookie <glob> (repeatable; undeclared cookies only)

Playwright is included; browser installation is manual:
  npx --package=govuk-analytics-consent-audit playwright install chromium

Exit codes: 0 passed, 1 undeclared/disallowed cookies, 2 invalid config or incomplete audit.
`

export async function main(args: string[]): Promise<number> {
  try {
    const { values, positionals } = parseArgs({
      args, allowPositionals: true,
      options: {
        config: { type: 'string' }, output: { type: 'string' }, help: { type: 'boolean', short: 'h' },
        url: { type: 'string' }, page: { type: 'string', multiple: true }, 'audit-path': { type: 'string' },
        'ignore-cookie': { type: 'string', multiple: true },
        categories: { type: 'boolean' }, 'cookies-page': { type: 'string' },
        'observation-ms': { type: 'string' }, 'timeout-ms': { type: 'string' }
      }
    })
    if (values.help) {
      console.log(help)
      return 0
    }
    const remoteOptions = values.url !== undefined || values.page !== undefined || values.categories !== undefined ||
      values['audit-path'] !== undefined || values['cookies-page'] !== undefined || values['observation-ms'] !== undefined || values['timeout-ms'] !== undefined
    if (positionals.length > 1 || (positionals.length === 1 && positionals[0] !== 'audit') ||
        (!values.config && !values.url) || (values.config && remoteOptions) ||
        (values['cookies-page'] && !values.categories)) {
      console.error(help)
      return 2
    }
    if (values.output) {
      try {
        await checkReportPath(values.output, values.config)
      } catch {
        console.error('Report output must be a regular file distinct from the configuration, without symbolic links.')
        return 2
      }
    }
    let config
    try {
      console.log(`🔍 ${values.url ? 'Loading deployed cookie declarations...' : 'Loading audit configuration...'}`)
      config = values.url ? await loadAuditConfiguration({
        url: values.url!, pages: values.page, categoryChecks: values.categories,
        cookiesPage: values['cookies-page'], auditPath: values['audit-path'],
        ignoreCookies: values['ignore-cookie'],
        observationMs: values['observation-ms'] === undefined ? undefined : Number(values['observation-ms']),
        timeoutMs: values['timeout-ms'] === undefined ? undefined : Number(values['timeout-ms'])
      }) : parseAuditConfig(JSON.parse(await readFile(values.config!, 'utf8')))
      if (values.config && values['ignore-cookie']) {
        config = parseAuditConfig({ ...config, ignoreCookies: [...(config.ignoreCookies ?? []), ...values['ignore-cookie']] })
      }
    } catch {
      console.error('Cannot load audit configuration. Enable auditEnabled on the server, check --audit-path, or supply valid audit JSON. See the auditing guide.')
      return 2
    }
    console.log(`Loaded ${config.cookies.length} cookie declarations; auditing ${config.pages.length} page(s).`)
    if (config.ignoreCookies?.length) console.log(`Ignoring undeclared cookie names matching: ${config.ignoreCookies.map((pattern) => JSON.stringify(pattern)).join(', ')}`)
    console.log()
    const report = await runAudit(config, { onProgress: (message) => console.log(message) })
    if (values.output) await writeAuditReport(values.output, report, values.config)
    console.log(`\n${cookieTable(config, report)}`)
    if (report.findings.length > 0) console.log()
    for (const finding of report.findings) {
      if (finding.code === 'ignored-undeclared-cookie') {
        console.log(`INFO Ignored undeclared cookie matching ${JSON.stringify(finding.ignorePattern)}: ${JSON.stringify(finding.cookie)}`)
        continue
      }
      if (finding.code === 'declared-cookie-not-observed') {
        console.log(`INFO Declared cookie was not observed in browser storage during this audit: ${JSON.stringify(finding.declaration)}`)
        continue
      }
      const cookie = finding.cookie === undefined ? '' : ` ${JSON.stringify(finding.cookie)}`
      console.log(`${finding.severity.toUpperCase()} ${finding.code} [${finding.scenario}/${finding.stage}, page ${finding.page}]${cookie}`)
    }
    console.log('\nBounded browser observations, not certification of legal compliance.')
    const statusIcon = report.status === 'passed' ? '✅' : report.status === 'failed' ? '❌' : '⚠️'
    console.log(`${statusIcon} Cookie audit ${report.status}: ${report.scenarios.filter((scenario) => scenario.completed).length}/${report.scenarios.length} scenarios completed.`)
    return auditExitCode(report)
  } catch {
    console.error('Audit could not complete. Check arguments, browser installation and report output permissions.')
    return 2
  }
}

function isMain(): boolean {
  try {
    return process.argv[1] !== undefined && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
  } catch {
    return false
  }
}

if (isMain()) {
  process.exitCode = await main(process.argv.slice(2))
}