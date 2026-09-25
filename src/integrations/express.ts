import { resolveOptions } from '../consent/options.js'
import { clientAsset } from './client-asset.js'
import { consentRoutePaths, createConsentContext, handleConsentPost } from './core.js'
import { readQueryParam, safeInternalPath } from '../shared/url.js'
import type { ConsentContext } from './core.js'
import type { GovUkAnalyticsConsentOptions, ResolvedOptions } from '../consent/types.js'

/* eslint-disable @typescript-eslint/no-explicit-any */

const MAX_BODY_BYTES = 4096

export interface ExpressAppLike {
  use: (...args: any[]) => any
  get: (...args: any[]) => any
  post: (...args: any[]) => any
}

export function isExpressApp(target: unknown): target is ExpressAppLike {
  const candidate = target as Partial<ExpressAppLike> | null

  return (
    typeof candidate?.use === 'function' &&
    typeof candidate?.get === 'function' &&
    typeof candidate?.post === 'function'
  )
}

export function registerExpress(
  app: ExpressAppLike,
  options: GovUkAnalyticsConsentOptions = {}
): ResolvedOptions {
  const resolved = resolveOptions(options)
  const paths = consentRoutePaths(resolved)

  app.use((req: any, res: any, next: () => void) => {
    let context: ConsentContext | null = null

    Object.defineProperty(res.locals, 'govukAnalyticsConsent', {
      configurable: true,
      enumerable: true,
      get: () => {
        const currentPath: string = req.originalUrl ?? req.url ?? '/'
        const returnUrl = readQueryParam(currentPath, 'returnUrl')

        context ??= createConsentContext(resolved, {
          cookieHeader: req.headers?.cookie,
          currentPath,
          returnTo: returnUrl !== null ? safeInternalPath(returnUrl, currentPath) : undefined,
          cookiesSaved: readQueryParam(currentPath, 'cookies-updated') === 'true',
          nonce: options.getNonce?.(req) ?? null
        })

        return context
      }
    })

    next()
  })

  app.get(paths.script, (req: any, res: any) => {
    const asset = clientAsset()

    res.set('etag', asset.etag)
    res.set('cache-control', asset.cacheControl)

    if (req.headers['if-none-match'] === asset.etag) {
      res.status(304).end()
      return
    }

    res.set('content-type', asset.contentType)
    res.send(asset.body)
  })

  app.post(paths.consent, (req: any, res: any) => {
    void withBody(req).then((body) => {
      const result = handleConsentPost(resolved, body)

      res.cookie(resolved.cookieName, result.cookieValue, {
        path: resolved.cookie.path,
        httpOnly: resolved.cookie.httpOnly,
        secure: resolved.cookie.secure,
        sameSite: 'lax',
        maxAge: resolved.cookie.maxAge * 1000,
        encode: (value: string) => value
      })

      res.redirect(303, result.redirectTo)
    })
  })

  return resolved
}

/** Uses an existing body parser when one is mounted, otherwise reads the form body itself. */
async function withBody(req: any): Promise<Record<string, unknown>> {
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object') {
    return req.body as Record<string, unknown>
  }

  const raw = await readRawBody(req)

  return Object.fromEntries(new URLSearchParams(raw))
}

function readRawBody(req: any): Promise<string> {
  return new Promise((resolve) => {
    let raw = ''

    req.setEncoding?.('utf8')

    req.on('data', (chunk: string) => {
      raw += chunk

      if (raw.length > MAX_BODY_BYTES) {
        raw = raw.slice(0, MAX_BODY_BYTES)
        req.destroy?.()
      }
    })

    req.on('end', () => resolve(raw))
    req.on('error', () => resolve(''))
  })
}
