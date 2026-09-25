import { resolveOptions } from '../consent/options.js'
import { clientAsset } from './client-asset.js'
import {
  consentRoutePaths,
  createConsentContext,
  createConsentRequestState,
  handleConsentPost
} from './core.js'
import { readQueryParam, safeInternalPath } from '../shared/url.js'
import type { GovUkAnalyticsConsentOptions, ResolvedOptions } from '../consent/types.js'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface HapiServerLike {
  route: (...args: any[]) => any
  ext: (...args: any[]) => any
  state?: (...args: any[]) => any
}

export function isHapiServer(target: unknown): target is HapiServerLike {
  const candidate = target as Partial<HapiServerLike> | null

  return (
    typeof candidate?.route === 'function' &&
    typeof candidate?.ext === 'function' &&
    typeof (candidate as { use?: unknown }).use !== 'function'
  )
}

export function registerHapi(
  server: HapiServerLike,
  options: GovUkAnalyticsConsentOptions = {}
): ResolvedOptions {
  const resolved = resolveOptions(options)
  const paths = consentRoutePaths(resolved)

  defineCookie(server, resolved)

  server.route([
    {
      method: 'GET',
      path: paths.script,
      options: { auth: false },
      handler: (request: any, h: any) => {
        const asset = clientAsset()

        if (request.headers['if-none-match'] === asset.etag) {
          return h.response().code(304).header('etag', asset.etag)
        }

        return h
          .response(asset.body)
          .type(asset.contentType)
          .header('cache-control', asset.cacheControl)
          .header('etag', asset.etag)
      }
    },
    {
      method: 'POST',
      path: paths.consent,
      options: {
        auth: false,
        payload: { parse: true, allow: 'application/x-www-form-urlencoded', maxBytes: 4096 }
      },
      handler: (request: any, h: any) => {
        const result = handleConsentPost(resolved, request.payload)

        return h
          .redirect(result.redirectTo)
          .code(303)
          .state(resolved.cookieName, result.cookieValue, cookieSettings(resolved))
      }
    }
  ])

  server.ext('onPreAuth', (request: any, h: any) => {
    request.app.govukAnalyticsConsent = createConsentRequestState(
      resolved,
      request.headers.cookie
    )

    return h.continue
  })

  server.ext('onPreResponse', (request: any, h: any) => {
    const response = request.response

    if (response?.variety === 'view') {
      const currentPath = `${request.url?.pathname ?? request.path ?? '/'}${request.url?.search ?? ''}`
      const returnUrl = readQueryParam(currentPath, 'returnUrl')

      response.source.context = {
        ...(response.source.context ?? {}),
        govukAnalyticsConsent: createConsentContext(resolved, {
          consent: request.app.govukAnalyticsConsent.state,
          currentPath,
          returnTo: returnUrl !== null ? safeInternalPath(returnUrl, currentPath) : undefined,
          cookiesSaved: readQueryParam(currentPath, 'cookies-updated') === 'true',
          nonce: options.getNonce?.(request) ?? null
        })
      }
    }

    return h.continue
  })

  return resolved
}

function cookieSettings(resolved: ResolvedOptions): Record<string, unknown> {
  return {
    path: resolved.cookie.path,
    isHttpOnly: resolved.cookie.httpOnly,
    isSecure: resolved.cookie.secure,
    isSameSite: resolved.cookie.sameSite,
    ttl: resolved.cookie.maxAge * 1000,
    encoding: 'none',
    strictHeader: false,
    clearInvalid: true
  }
}

function defineCookie(server: HapiServerLike, resolved: ResolvedOptions): void {
  try {
    server.state?.(resolved.cookieName, cookieSettings(resolved))
  } catch {
    // Already defined by the consuming service; its definition wins.
  }
}
