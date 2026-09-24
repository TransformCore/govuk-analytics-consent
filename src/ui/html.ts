import { hasChoice } from '../consent/state.js'
import { headSnippet, nonceAttribute } from '../gtm/snippets.js'
import { gtmNoscriptSnippet } from '../gtm/loader.js'
import { escapeHtml } from '../shared/escape.js'
import { safeInternalPath } from '../shared/url.js'
import type { ConsentViewModel } from './view-model.js'

export const BANNER_ID = 'govuk-analytics-consent-banner'
export const CLIENT_SCRIPT_MODULE = 'govuk-analytics-consent'

export function renderConsentHead(viewModel: ConsentViewModel): string {
  return headSnippet({
    containerId: viewModel.gtmContainerId,
    waitForUpdate: viewModel.consentWaitForUpdate,
    nonce: viewModel.nonce
  })
}

export function renderConsentNoscript(viewModel: ConsentViewModel): string {
  return gtmNoscriptSnippet(viewModel.gtmContainerId)
}

export function renderConsentScripts(viewModel: ConsentViewModel): string {
  const attributes = [
    `src="${escapeHtml(`${viewModel.routePrefix}/consent.js`)}"`,
    'defer',
    `data-module="${CLIENT_SCRIPT_MODULE}"`,
    `data-cookie-name="${escapeHtml(viewModel.cookieName)}"`,
    `data-cookie-version="${viewModel.cookieVersion}"`,
    `data-route-prefix="${escapeHtml(viewModel.routePrefix)}"`
  ].join(' ')

  return `<script${nonceAttribute(viewModel.nonce)} ${attributes}></script>`
}

/** Renders nothing once a choice exists; the client script shows the confirmation messages. */
export function renderConsentBanner(viewModel: ConsentViewModel): string {
  if (hasChoice(viewModel.consent)) {
    return ''
  }

  const serviceName = escapeHtml(viewModel.serviceName)
  const action = escapeHtml(`${viewModel.routePrefix}/consent`)
  const returnUrl = escapeHtml(safeInternalPath(viewModel.currentPath))

  return [
    `<div class="govuk-cookie-banner" data-nosnippet role="region" aria-label="Cookies on ${serviceName}" id="${BANNER_ID}">`,
    renderPrompt(serviceName, action, returnUrl, viewModel),
    renderConfirmation('accepted', `You've accepted analytics cookies.`, viewModel),
    renderConfirmation('rejected', `You've rejected analytics cookies.`, viewModel),
    '</div>'
  ].join('')
}

function renderPrompt(
  serviceName: string,
  action: string,
  returnUrl: string,
  viewModel: ConsentViewModel
): string {
  return [
    '<div class="govuk-cookie-banner__message govuk-width-container" data-consent-state="prompt">',
    '<div class="govuk-grid-row"><div class="govuk-grid-column-two-thirds">',
    `<h2 class="govuk-cookie-banner__heading govuk-heading-m">Cookies on ${serviceName}</h2>`,
    '<div class="govuk-cookie-banner__content">',
    '<p class="govuk-body">We use some essential cookies to make this service work.</p>',
    "<p class=\"govuk-body\">We'd also like to use analytics cookies so we can understand how you use the service and make improvements.</p>",
    '</div></div></div>',
    `<form class="govuk-button-group" method="post" action="${action}">`,
    `<input type="hidden" name="returnUrl" value="${returnUrl}">`,
    '<button type="submit" name="analytics" value="accept" class="govuk-button" data-module="govuk-button" data-consent-action="accept">Accept analytics cookies</button>',
    '<button type="submit" name="analytics" value="reject" class="govuk-button" data-module="govuk-button" data-consent-action="reject">Reject analytics cookies</button>',
    renderCookiesPageLink(viewModel, 'View cookies'),
    '</form>',
    '</div>'
  ].join('')
}

function renderConfirmation(
  state: 'accepted' | 'rejected',
  message: string,
  viewModel: ConsentViewModel
): string {
  return [
    `<div class="govuk-cookie-banner__message govuk-width-container" data-consent-state="${state}" role="alert" tabindex="-1" hidden>`,
    '<div class="govuk-grid-row"><div class="govuk-grid-column-two-thirds">',
    '<div class="govuk-cookie-banner__content">',
    `<p class="govuk-body">${message} You can change your cookie settings at any time.</p>`,
    '</div></div></div>',
    '<div class="govuk-button-group">',
    '<button type="button" class="govuk-button" data-module="govuk-button" data-consent-action="hide">Hide this message</button>',
    renderCookiesPageLink(viewModel, 'Change your cookie settings'),
    '</div>',
    '</div>'
  ].join('')
}

function renderCookiesPageLink(viewModel: ConsentViewModel, text: string): string {
  if (viewModel.cookiesPageUrl === null) {
    return ''
  }

  return `<a class="govuk-link" href="${escapeHtml(viewModel.cookiesPageUrl)}">${escapeHtml(text)}</a>`
}
