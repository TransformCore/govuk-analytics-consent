import { resolveOptions } from '../consent/options.js'
import { clientAsset } from './client-asset.js'
import {
  consentRoutePaths,
  createConsentContext,
  createConsentRequestState,
  handleConsentPost,
  verifyConsentSubmission
} from './core.js'
import { readQueryParam, safeInternalPath } from '../shared/url.js'
import type { GovUkAnalyticsConsentOptions, ResolvedOptions } from '../consent/types.js'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface HapiServerLike {
  route: (...args: any[]) => any
  ext: (...args: any[]) => any
  state?: (...args: any[]) => any
}

export interface HapiPlugin {
  name: string
  register: (
    server: HapiServerLike,
    options?: GovUkAnalyticsConsentOptions
  ) => void
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
      handler: async (request: any, h: any) => {
        if (!(await verifyConsentSubmission(resolved, request, request.payload))) {
          return h.response().code(403)
        }

        const result = handleConsentPost(resolved, request.payload, {
          cookieHeader: request.headers.cookie,
          hostname: request.info?.hostname
        })
        const redirectTo = result.redirectTo
        const safeRedirectTo = typeof redirectTo === 'string' && redirectTo.startsWith('/') &&
          !redirectTo.startsWith('//') &&
          !redirectTo.includes('\\')
          ? redirectTo
          : '/'
        const response = h.redirect(safeRedirectTo).code(303)

        if (result.expiryCookies.length > 0) {
          response.header('set-cookie', result.expiryCookies, { append: true })
        }

        return response.state(resolved.cookieName, result.cookieValue, cookieSettings(resolved))
      }
    }
  ])

  // onRequest (not onPreAuth) so unrouted 404s still get rejected cookies expired.
  server.ext('onRequest', (request: any, h: any) => {
    request.app.govukAnalyticsConsent = createConsentRequestState(
      resolved,
      request.headers.cookie,
      request.info?.hostname
    )

    return h.continue
  })

  server.ext('onPreResponse', async (request: any, h: any) => {
    const response = request.response
    const expiryCookies: string[] = request.app.govukAnalyticsConsent?.expiryCookies ?? []
    const isConsentPost = request.method === 'post' && request.route?.path === paths.consent

    if (expiryCookies.length > 0 && !isConsentPost && response !== null && response !== undefined) {
      appendSetCookie(response, expiryCookies)
    }

    if (response?.variety === 'view') {
      const currentPath = `${request.url?.pathname ?? request.path ?? '/'}${request.url?.search ?? ''}`
      const returnUrl = readQueryParam(currentPath, 'returnUrl')

      response.source.context = {
        ...(response.source.context ?? {}),
        govukAnalyticsConsent: await createConsentContext(resolved, {
          request,
          consent: request.app.govukAnalyticsConsent.state,
          currentPath,
          returnTo: returnUrl !== null ? safeInternalPath(returnUrl, currentPath) : undefined,
          cookiesSaved: readQueryParam(currentPath, 'cookies-updated') === 'true',
          nonce: requestNonce(options, request)
        })
      }
    }

    return h.continue
  })

  return resolved
}

export const govukAnalyticsConsentPlugin: HapiPlugin = {
  name: 'govuk-analytics-consent',
  register: (server, options) => {
    registerHapi(server, options)
  }
}

export default govukAnalyticsConsentPlugin

function requestNonce(options: GovUkAnalyticsConsentOptions, request: any): string | null {
  if (options.getNonce !== undefined) {
    return options.getNonce(request) ?? null
  }

  const nonce = request.plugins?.blankie?.nonces?.script

  return typeof nonce === 'string' && nonce !== '' ? nonce : null
}

function appendSetCookie(response: any, values: string[]): void {
  if (response.isBoom === true) {
    const headers = response.output.headers
    const existing = headers['set-cookie']

    headers['set-cookie'] = [...(existing === undefined ? [] : [existing].flat()), ...values]
    return
  }

  response.header('set-cookie', values, { append: true })
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
