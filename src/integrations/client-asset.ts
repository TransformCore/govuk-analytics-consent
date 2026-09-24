import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { packageRoot } from '../shared/package-root.js'

export interface ClientAsset {
  body: string
  etag: string
  contentType: string
  cacheControl: string
}

let cached: ClientAsset | null = null

export function clientAsset(): ClientAsset {
  if (cached !== null) {
    return cached
  }

  const path = join(packageRoot(), 'dist', 'client', 'consent.js')

  let body: string

  try {
    body = readFileSync(path, 'utf8')
  } catch {
    throw new Error(
      `Missing browser bundle at ${path}. Run "npm run build:client" in @transform-uk/govuk-analytics-consent.`
    )
  }

  cached = {
    body,
    etag: `"${createHash('sha256').update(body).digest('base64url').slice(0, 27)}"`,
    contentType: 'application/javascript; charset=utf-8',
    cacheControl: 'public, max-age=3600, must-revalidate'
  }

  return cached
}
