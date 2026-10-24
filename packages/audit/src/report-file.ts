import { lstat, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { AuditReport } from './runner.js'

export async function checkReportPath(output: string, configuration?: string): Promise<void> {
  const target = await lstat(output).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
    return undefined
  })
  if (target === undefined) return
  if (!target.isFile()) throw new Error('Report output must be a regular file, not a symbolic link')
  if (configuration !== undefined) {
    const source = await stat(configuration)
    if (source.dev === target.dev && source.ino === target.ino) {
      throw new Error('Report output must not overwrite the configuration')
    }
  }
}

export async function writeAuditReport(output: string, report: AuditReport, configuration?: string): Promise<void> {
  const destination = resolve(output)
  await checkReportPath(destination, configuration)
  const temporaryDirectory = await mkdtemp(join(dirname(destination), '.consent-audit-'))
  try {
    const temporaryFile = join(temporaryDirectory, 'report.json')
    await writeFile(temporaryFile, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
    await checkReportPath(destination, configuration)
    await rename(temporaryFile, destination)
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}