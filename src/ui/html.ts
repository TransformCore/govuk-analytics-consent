import { hasChoice, isCategoryAccepted } from '../consent/state.js'
import { headSnippet, nonceAttribute } from '../gtm/snippets.js'
import { gtmNoscriptSnippet } from '../gtm/loader.js'
import { escapeHtml } from '../shared/escape.js'
import { appendQueryParam, safeInternalPath } from '../shared/url.js'
import type { ConsentViewModel } from './view-model.js'
import type { CookieCategory, CookieDefinition, ConsentState } from '../consent/types.js'

function formatMessage(template: string, values: Record<string, string> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`)
}

export const BANNER_ID = 'govuk-analytics-consent-banner'
export const CLIENT_SCRIPT_MODULE = 'govuk-analytics-consent'

export function renderConsentHead(viewModel: ConsentViewModel): string {
  return headSnippet({
    categories: viewModel.categories,
    containerId: viewModel.gtmContainerId,
    waitForUpdate: viewModel.consentWaitForUpdate,
    nonce: viewModel.nonce
  })
}

export function renderConsentNoscript(viewModel: ConsentViewModel): string {
  return gtmNoscriptSnippet(viewModel.gtmContainerId)
}

export function renderConsentScripts(viewModel: ConsentViewModel): string {
  const categoriesJson = JSON.stringify(
    viewModel.categories.map((category) => ({
      id: category.id,
      essential: category.essential === true,
      gtagSignals: category.gtagSignals ?? []
    }))
  )

  const attributes = [
    `src="${escapeHtml(`${viewModel.routePrefix}/consent.js`)}"`,
    'defer',
    `data-module="${CLIENT_SCRIPT_MODULE}"`,
    `data-cookie-name="${escapeHtml(viewModel.cookieName)}"`,
    `data-cookie-version="${viewModel.cookieVersion}"`,
    `data-route-prefix="${escapeHtml(viewModel.routePrefix)}"`,
    `data-categories="${escapeHtml(categoriesJson)}"`
  ].join(' ')

  return `<script${nonceAttribute(viewModel.nonce)} ${attributes}></script>`
}

/** Renders nothing once a choice exists; the client script shows the confirmation messages. */
export function renderConsentBanner(viewModel: ConsentViewModel): string {
  if (hasChoice(viewModel.consent)) {
    return ''
  }

  const serviceName = viewModel.serviceName
  const action = escapeHtml(`${viewModel.routePrefix}/consent`)
  const returnUrl = escapeHtml(safeInternalPath(viewModel.currentPath))
  const ariaLabel = escapeHtml(formatMessage(viewModel.messages.bannerTitle, { serviceName }))

  return [
    `<div class="govuk-cookie-banner" data-nosnippet role="region" aria-label="${ariaLabel}" id="${BANNER_ID}">`,
    renderPrompt(serviceName, action, returnUrl, viewModel),
    renderConfirmation('accepted', viewModel.messages.accepted, viewModel),
    renderConfirmation('rejected', viewModel.messages.rejected, viewModel),
    '</div>'
  ].join('')
}

function renderPrompt(
  serviceName: string,
  action: string,
  returnUrl: string,
  viewModel: ConsentViewModel
): string {
  const bannerTitle = escapeHtml(formatMessage(viewModel.messages.bannerTitle, { serviceName }))
  const intro = escapeHtml(viewModel.messages.bannerIntro)
  const additional = escapeHtml(viewModel.messages.bannerAdditional)

  return [
    '<div class="govuk-cookie-banner__message govuk-width-container" data-consent-state="prompt">',
    '<div class="govuk-grid-row"><div class="govuk-grid-column-two-thirds">',
    `<h2 class="govuk-cookie-banner__heading govuk-heading-m">${bannerTitle}</h2>`,
    '<div class="govuk-cookie-banner__content">',
    `<p class="govuk-body">${intro}</p>`,
    `<p class="govuk-body">${additional}</p>`,
    '</div></div></div>',
    `<form class="govuk-button-group" method="post" action="${action}">`,
    `<input type="hidden" name="returnUrl" value="${returnUrl}">`,
    `<button type="submit" name="preference" value="accept-all" class="govuk-button" data-module="govuk-button" data-consent-action="accept">${escapeHtml(viewModel.messages.acceptAll)}</button>`,
    `<button type="submit" name="preference" value="reject-all" class="govuk-button" data-module="govuk-button" data-consent-action="reject">${escapeHtml(viewModel.messages.rejectAll)}</button>`,
    renderCookiesPageLink(viewModel, viewModel.messages.viewCookies),
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
    `<p class="govuk-body">${escapeHtml(message)} ${escapeHtml(viewModel.messages.changeSettings)}</p>`,
    '</div></div></div>',
    '<div class="govuk-button-group">',
    `<button type="button" class="govuk-button" data-module="govuk-button" data-consent-action="hide">${escapeHtml(viewModel.messages.hideMessage)}</button>`,
    renderCookiesPageLink(viewModel, viewModel.messages.changeSettings),
    '</div>',
    '</div>'
  ].join('')
}

function renderCookiesPageLink(viewModel: ConsentViewModel, text: string): string {
  if (viewModel.cookiesPageUrl === null) {
    return ''
  }

  const href = appendQueryParam(
    viewModel.cookiesPageUrl,
    'returnUrl',
    safeInternalPath(viewModel.currentPath)
  )

  return `<a class="govuk-link" href="${escapeHtml(href)}">${escapeHtml(text)}</a>`
}

export const NOTIFICATION_BANNER_TITLE_ID = 'govuk-notification-banner-title'

/** GOV.UK cookies-page pattern: per-category tables of cookies, then a Change your cookie settings form. */
export function renderConsentCookiesPage(viewModel: ConsentViewModel): string {
  const action = escapeHtml(`${viewModel.routePrefix}/consent`)
  const returnUrl = escapeHtml(safeInternalPath(viewModel.currentPath))
  const pageTitle = escapeHtml(formatMessage(viewModel.messages.cookiesPageTitle, { serviceName: viewModel.serviceName }))
  const intro = escapeHtml(
    formatMessage(viewModel.messages.cookiesPageIntro, { serviceName: viewModel.serviceName })
  )

  return [
    '<div class="govuk-grid-row">',
    '<div class="govuk-grid-column-two-thirds">',
    renderSavedNotificationBanner(viewModel),
    `<h1 class="govuk-heading-l">${pageTitle}</h1>`,
    `<p class="govuk-body">${intro}</p>`,
    ...viewModel.categories.map((category) => renderCategorySection(category, viewModel)),
    `<form method="post" action="${action}">`,
    `<input type="hidden" name="returnUrl" value="${returnUrl}">`,
    '<input type="hidden" name="preference" value="save">',
    renderChangeSettings(viewModel.categories, viewModel),
    '</form>',
    '</div>',
    '</div>'
  ].join('')
}

/** Matches the markup a real `govukNotificationBanner({ type: "success" })` call would produce. */
function renderSavedNotificationBanner(viewModel: ConsentViewModel): string {
  if (!viewModel.cookiesSaved) {
    return ''
  }

  const backLink = escapeHtml(safeInternalPath(viewModel.returnTo))
  const successText = escapeHtml(viewModel.messages.successBanner)
  const successLinkText = escapeHtml(viewModel.messages.successBannerLink)

  return [
    '<div class="govuk-notification-banner govuk-notification-banner--success" role="alert" ' +
      `aria-labelledby="${NOTIFICATION_BANNER_TITLE_ID}" data-module="govuk-notification-banner">`,
    '<div class="govuk-notification-banner__header">',
    `<h2 class="govuk-notification-banner__title" id="${NOTIFICATION_BANNER_TITLE_ID}">${escapeHtml(viewModel.messages.successTitle)}</h2>`,
    '</div>',
    '<div class="govuk-notification-banner__content">',
    '<p class="govuk-notification-banner__heading">',
    `${successText} <a class="govuk-notification-banner__link" href="${backLink}">${successLinkText}</a>.`,
    '</p>',
    '</div>',
    '</div>'
  ].join('')
}

function renderCategorySection(category: CookieCategory, viewModel: ConsentViewModel): string {
  return [
    `<h2 class="govuk-heading-m">${escapeHtml(category.title)}</h2>`,
    `<p class="govuk-body">${escapeHtml(category.description)}</p>`,
    renderCookiesTable(category, viewModel.cookies, viewModel),
    category.essential === true ? `<p class="govuk-body">${escapeHtml(viewModel.messages.essentialCookies)}</p>` : ''
  ].join('')
}

function renderChangeSettings(categories: CookieCategory[], viewModel: ConsentViewModel): string {
  const optional = categories.filter((category) => category.essential !== true)

  if (optional.length === 0) {
    return ''
  }

  return [
    `<h2 class="govuk-heading-m">${escapeHtml(viewModel.messages.changeSettings)}</h2>`,
    ...optional.map((category) => renderCategoryRadios(category, viewModel.consent, viewModel.messages)),
    `<button type="submit" class="govuk-button" data-module="govuk-button">${escapeHtml(viewModel.messages.saveSettings)}</button>`
  ].join('')
}

function renderCookiesTable(
  category: CookieCategory,
  cookies: CookieDefinition[],
  viewModel: ConsentViewModel
): string {
  const rows = cookies.filter((cookie) => cookie.categoryId === category.id)

  if (rows.length === 0) {
    return ''
  }

  const body = rows
    .map(
      (cookie) =>
        '<tr class="govuk-table__row">' +
        `<td class="govuk-table__cell">${escapeHtml(cookie.name)}</td>` +
        `<td class="govuk-table__cell">${escapeHtml(cookie.purpose)}</td>` +
        `<td class="govuk-table__cell">${escapeHtml(cookie.expiry)}</td>` +
        '</tr>'
    )
    .join('')

  return [
    '<table class="govuk-table">',
    '<thead class="govuk-table__head"><tr class="govuk-table__row">',
    `<th scope="col" class="govuk-table__header">${escapeHtml(viewModel.messages.tableHeaderName)}</th>`,
    `<th scope="col" class="govuk-table__header">${escapeHtml(viewModel.messages.tableHeaderPurpose)}</th>`,
    `<th scope="col" class="govuk-table__header">${escapeHtml(viewModel.messages.tableHeaderExpiry)}</th>`,
    '</tr></thead>',
    `<tbody class="govuk-table__body">${body}</tbody>`,
    '</table>'
  ].join('')
}

/** Matches the markup a real `govukRadios({...})` call would produce. */
function renderCategoryRadios(
  category: CookieCategory,
  consent: ConsentState,
  messages: ConsentViewModel['messages']
): string {
  const idPrefix = `cookies-${category.id}`
  const name = `cookies[${category.id}]`
  const label = category.shortName ?? category.title
  const accepted = hasChoice(consent) && isCategoryAccepted(consent, category)
  const legend = escapeHtml(formatMessage(messages.categoryQuestion, { label }))

  return [
    '<div class="govuk-form-group">',
    '<fieldset class="govuk-fieldset">',
    `<legend class="govuk-fieldset__legend govuk-fieldset__legend--s">${legend}</legend>`,
    '<div class="govuk-radios" data-module="govuk-radios">',
    '<div class="govuk-radios__item">',
    `<input class="govuk-radios__input" id="${idPrefix}" name="${name}" type="radio" value="yes"${accepted ? ' checked' : ''}>`,
    `<label class="govuk-label govuk-radios__label" for="${idPrefix}">${escapeHtml(messages.yesLabel)}</label>`,
    '</div>',
    '<div class="govuk-radios__item">',
    `<input class="govuk-radios__input" id="${idPrefix}-2" name="${name}" type="radio" value="no"${accepted ? '' : ' checked'}>`,
    `<label class="govuk-label govuk-radios__label" for="${idPrefix}-2">${escapeHtml(messages.noLabel)}</label>`,
    '</div>',
    '</div>',
    '</fieldset>',
    '</div>'
  ].join('')
}
