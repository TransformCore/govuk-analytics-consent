import { matchingDeclarations, matchingIgnorePattern, sameCookie } from './policy.js'
import type { AuditConfig, CookieIdentity } from './policy.js'
import type { AuditReport } from './runner.js'

type TableReport = Pick<AuditReport, 'status' | 'observations' | 'builtInDeclarations'>

function cell(value: string): string {
  return JSON.stringify(value).slice(1, -1).replace(/[\u007f-\u009f\u2028\u2029]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

export function cookieTable(config: Pick<AuditConfig, 'cookies' | 'ignoreCookies'>, report: TableReport): string {
  const identities = new Map<string, { cookie: CookieIdentity; stored: boolean }>()
  for (const observation of report.observations) {
    const key = JSON.stringify([observation.name, observation.domain, observation.path, observation.partitionKey])
    const entry = identities.get(key) ?? {
      cookie: { name: observation.name, domain: observation.domain, path: observation.path, partitionKey: observation.partitionKey },
      stored: false
    }
    entry.stored ||= observation.source === 'browser'
    identities.set(key, entry)
  }

  const rows: string[][] = []
  for (const { cookie, stored } of identities.values()) {
    const matches = matchingDeclarations(cookie, config.cookies)
    const builtin = report.builtInDeclarations.some((declaration) => sameCookie(cookie, declaration))
    const ignored = matches.length === 0 && !builtin ? matchingIgnorePattern(cookie.name, config.ignoreCookies) : undefined
    const categories = [...new Set(matches.map((declaration) => declaration.categoryId ?? 'Unspecified'))].sort()
    rows.push([
      cookie.name,
      builtin ? 'essential (built-in)' : categories.join(', ') || 'Unknown',
      matches.length > 0 ? [...new Set(matches.map((declaration) => declaration.match ?? declaration.name))].join(', ')
        : builtin ? '(built-in)' : ignored === undefined ? 'Undeclared' : `Ignored: ${ignored}`,
      stored ? 'Stored' : 'Header only', cookie.domain, cookie.path, cookie.partitionKey ?? '-'
    ])
  }

  const unobserved = report.status === 'incomplete' ? 'Not assessed' : 'Not observed'
  for (const declaration of config.cookies) {
    if (!report.observations.some((cookie) => matchingDeclarations(cookie, [declaration]).length > 0)) {
      rows.push([
        declaration.name, declaration.categoryId ?? 'Unspecified', declaration.match ?? declaration.name,
        unobserved, declaration.domain ?? 'Any', declaration.path ?? 'Any', '-'
      ])
    }
  }
  for (const declaration of report.builtInDeclarations) {
    if (!report.observations.some((cookie) => sameCookie(cookie, declaration)) && matchingDeclarations(declaration, config.cookies).length === 0) {
      rows.push([
        declaration.name, 'essential (built-in)', '(built-in)', unobserved,
        declaration.domain, declaration.path, declaration.partitionKey ?? '-'
      ])
    }
  }

  rows.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  const headers = ['Cookie', 'Category', 'Declaration / Pattern', 'Observed', 'Domain', 'Path', 'Partition']
  const content = [headers, ...rows].map((row) => row.map(cell))
  const widths = headers.map((_header, index) => Math.max(...content.map((row) => row[index]!.length)))
  const border = `+-${widths.map((width) => '-'.repeat(width)).join('-+-')}-+`
  const renderRow = (row: string[]): string => `| ${row.map((value, index) => value.padEnd(widths[index]!)).join(' | ')} |`
  const title = report.status === 'incomplete' ? 'Cookies (partial audit)' : 'Cookies'
  return [title, border, renderRow(content[0]!), border,
    ...content.slice(1).map(renderRow), border,
    ...(rows.length === 0 ? ['No cookie declarations or observations.'] : [])].join('\n')
}