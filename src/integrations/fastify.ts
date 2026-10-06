import fastifyPlugin from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { resolveInput, type GovUkAnalyticsConsentInput } from '../consent/create.js'
import { clientAsset } from './client-asset.js'
import {
  consentRoutePaths,
  createConsentContext,
  createConsentRequestState,
  handleConsentPost,
  verifyConsentSubmission
} from './core.js'
import { readQueryParam, safeInternalPath } from '../shared/url.js'
import type { ConsentContext, ConsentRequestState } from './core.js'
import type { ResolvedOptions } from '../consent/types.js'

declare module 'fastify' {
  interface FastifyRequest {
    govukAnalyticsConsent: ConsentRequestState
    govukAnalyticsConsentContext: ConsentContext
  }
}

export const govukAnalyticsConsentFastifyPlugin: FastifyPluginAsync<GovUkAnalyticsConsentInput> =
  async (fastify, options) => {
    const resolved = resolveInput(options)
    const paths = consentRoutePaths(resolved)

    fastify.decorateRequest('govukAnalyticsConsent', null as unknown as ConsentRequestState)
    fastify.decorateRequest('govukAnalyticsConsentContext', null as unknown as ConsentContext)

    if (!fastify.hasContentTypeParser('application/x-www-form-urlencoded')) {
      fastify.addContentTypeParser(
        'application/x-www-form-urlencoded',
        { parseAs: 'string', bodyLimit: 4096 },
        (_request, body, done) => {
          done(null, Object.fromEntries(new URLSearchParams(body.toString())))
        }
      )
    }

    fastify.addHook('onRequest', async (request, reply) => {
      request.govukAnalyticsConsent = createConsentRequestState(
        resolved,
        request.headers.cookie,
        request.hostname
      )
    })

    fastify.addHook('preHandler', async (request, reply) => {
      const currentPath = request.raw.url ?? '/'
      const returnUrl = readQueryParam(currentPath, 'returnUrl')

      request.govukAnalyticsConsentContext = await createConsentContext(resolved, {
        request,
        response: reply,
        consent: request.govukAnalyticsConsent.state,
        currentPath,
        returnTo: returnUrl !== null ? safeInternalPath(returnUrl, currentPath) : undefined,
        cookiesSaved: readQueryParam(currentPath, 'cookies-updated') === 'true',
        nonce: resolved.getNonce === undefined
          ? (reply as FastifyReply & { cspNonce?: { script?: string } }).cspNonce?.script ?? null
          : resolved.getNonce(request) ?? null
      })
    })

    fastify.addHook('onSend', async (request, reply, payload) => {
      const isConsentPost = request.method === 'POST' && request.url.split('?')[0] === paths.consent
      const expiryCookies = request.govukAnalyticsConsent?.expiryCookies ?? []

      if (expiryCookies.length > 0 && !isConsentPost) {
        appendSetCookie(reply, expiryCookies)
      }

      return payload
    })

    fastify.get(paths.script, async (request, reply) => {
      const asset = clientAsset()

      reply.header('etag', asset.etag).header('cache-control', asset.cacheControl)

      if (request.headers['if-none-match'] === asset.etag) {
        return reply.code(304).send()
      }

      return reply.type(asset.contentType).send(asset.body)
    })

    fastify.post<{ Body: Record<string, unknown> }>(paths.consent, {
      bodyLimit: 4096
    }, async (request, reply) => {
      const body = request.body ?? {}

      if (!(await verifyConsentSubmission(resolved, request, body))) {
        return reply.code(403).send()
      }

      const result = handleConsentPost(resolved, body, {
        cookieHeader: request.headers.cookie,
        hostname: request.hostname
      })
      const consentCookie = serializeConsentCookie(resolved, result.cookieValue)

      if (result.expiryCookies.length > 0) {
        appendSetCookie(reply, result.expiryCookies)
      }

      appendSetCookie(reply, [consentCookie])

      const redirectTo = safeInternalPath(result.redirectTo, '/')
      return reply.code(303).header('location', redirectTo).send()
    })
  }

export default fastifyPlugin(govukAnalyticsConsentFastifyPlugin, {
  fastify: '5.x',
  name: 'govuk-analytics-consent'
})

function serializeConsentCookie(resolved: ResolvedOptions, value: string): string {
  const attributes = [
    `Path=${resolved.cookie.path}`,
    `Max-Age=${resolved.cookie.maxAge}`,
    'SameSite=Lax'
  ]

  if (resolved.cookie.httpOnly) {
    attributes.push('HttpOnly')
  }

  if (resolved.cookie.secure) {
    attributes.push('Secure')
  }

  return `${resolved.cookieName}=${value}; ${attributes.join('; ')}`
}

function appendSetCookie(reply: FastifyReply, values: string[]): void {
  const existing = reply.getHeader('set-cookie')
  const headers = existing === undefined
    ? []
    : Array.isArray(existing)
      ? existing.map(String)
      : [String(existing)]

  reply.header('set-cookie', [...headers, ...values])
}