import { buildConsentDefault } from './consent-mode.js'
import { gtmLoaderSnippet } from './loader.js'
import { gtmRestrictionsSnippet, type GtmRestrictions } from './restrictions.js'
import { escapeHtml } from '../shared/escape.js'
import type { ConsentModeCategory } from '../consent/types.js'

export interface HeadSnippetParams {
  categories: ConsentModeCategory[]
  containerId: string | null
  restrictions?: GtmRestrictions
  waitForUpdate: number | null
  nonce?: string | null
}

export function consentDefaultSnippet(
  categories: ConsentModeCategory[],
  waitForUpdate: number | null
): string {
  const payload = JSON.stringify(buildConsentDefault(categories, waitForUpdate))

  return [
    'window.dataLayer=window.dataLayer||[];',
    'function gtag(){dataLayer.push(arguments);}',
    `gtag('consent','default',${payload});`
  ].join('')
}

/** Consent defaults are always emitted before the GTM loader so no tag can fire ungated. */
export function headSnippet({ categories, containerId, restrictions, waitForUpdate, nonce }: HeadSnippetParams): string {
  const body = consentDefaultSnippet(categories, waitForUpdate) +
    (restrictions === undefined ? '' : gtmRestrictionsSnippet(restrictions)) +
    gtmLoaderSnippet(containerId)

  return `<script${nonceAttribute(nonce)}>${body}</script>`
}

export function nonceAttribute(nonce: string | null | undefined): string {
  return typeof nonce === 'string' && nonce !== '' ? ` nonce="${escapeHtml(nonce)}"` : ''
}
