import { hasChoice, isCategoryAccepted } from '../consent/state.js'
import { MESSAGE_PREFIX } from '../consent/messages.js'
import { buildRemovalCategories } from '../consent/removal.js'
import { headSnippet, nonceAttribute } from '../gtm/snippets.js'
import { gtmNoscriptSnippet } from '../gtm/loader.js'
import { escapeHtml, safeHtmlAttribute } from '../shared/escape.js'
import { appendQueryParam, safeInternalPath } from '../shared/url.js'
import type { ConsentViewModel } from './view-model.js'
import type { CookieCategory, CookieDefinition } from '../consent/types.js'

export const BANNER_ID = 'govuk-analytics-consent-banner'
export const CLIENT_SCRIPT_MODULE = 'govuk-analytics-consent'

export function renderConsentHead(viewModel: ConsentViewModel): string {
  return headSnippet({
    categories: viewModel.categories,
    containerId: viewModel.gtmContainerId,
    restrictions: viewModel.gtmRestrictions,
    waitForUpdate: viewModel.consentWaitForUpdate,
    nonce: viewModel.nonce
  })
}

export function renderConsentNoscript(viewModel: ConsentViewModel): string {
  return gtmNoscriptSnippet(viewModel.gtmContainerId)
}

export function renderConsentScripts(viewModel: ConsentViewModel): string {
  const removals = new Map(
    buildRemovalCategories(viewModel.categories, viewModel.cookies).map((category) => [category.id, category.cookies])
  )
  const categoriesJson = JSON.stringify(
    viewModel.categories.map((category) => ({
      id: category.id,
      essential: category.essential === true,
      gtagSignals: category.gtagSignals ?? [],
      cookies: removals.get(category.id) ?? []
    }))
  )

  const safeCategoriesJson = encodeURIComponent(categoriesJson)
  const attributes = [
    `src="${safeHtmlAttribute(`${viewModel.routePrefix}/consent.js`)}"`,
    'defer',
    `data-module="${CLIENT_SCRIPT_MODULE}"`,
    `data-cookie-name="${safeHtmlAttribute(viewModel.cookieName)}"`,
    `data-cookie-version="${safeHtmlAttribute(String(viewModel.cookieVersion))}"`,
    `data-route-prefix="${safeHtmlAttribute(viewModel.routePrefix)}"`,
    `data-categories="${safeHtmlAttribute(safeCategoriesJson)}"`
  ].join(' ')

  return `<script${nonceAttribute(viewModel.nonce)} ${attributes}></script>`
}

/** Renders nothing once a choice exists; the client script shows the confirmation messages. */
export function renderConsentBanner(viewModel: ConsentViewModel): string {
  if (hasChoice(viewModel.consent)) {
    return ''
  }

  const serviceName = viewModel.serviceName
  const action = safeHtmlAttribute(`${viewModel.routePrefix}/consent`)
  const returnUrl = safeHtmlAttribute(safeInternalPath(viewModel.currentPath))
  const ariaLabel = escapeHtml(viewModel.translateMessage(`${MESSAGE_PREFIX}banner.title`, viewModel.messages.banner.title, { serviceName }))

  return [
    `<div class="govuk-cookie-banner" data-nosnippet role="region" aria-label="${ariaLabel}" id="${BANNER_ID}">`,
    renderPrompt(serviceName, action, returnUrl, viewModel),
    renderConfirmation('accepted', viewModel.messages.banner.accepted, viewModel),
    renderConfirmation('rejected', viewModel.messages.banner.rejected, viewModel),
    '</div>'
  ].join('')
}

function renderPrompt(
  serviceName: string,
  action: string,
  returnUrl: string,
  viewModel: ConsentViewModel
): string {
  const bannerTitle = escapeHtml(viewModel.translateMessage(`${MESSAGE_PREFIX}banner.title`, viewModel.messages.banner.title, { serviceName }))
  const intro = escapeHtml(viewModel.messages.banner.intro)
  const additional = escapeHtml(viewModel.messages.banner.additional)

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
    ...renderHiddenFields(viewModel.formFields),
    `<button type="submit" name="preference" value="accept-all" class="govuk-button" data-module="govuk-button" data-consent-action="accept">${escapeHtml(viewModel.messages.banner.acceptAll)}</button>`,
    `<button type="submit" name="preference" value="reject-all" class="govuk-button" data-module="govuk-button" data-consent-action="reject">${escapeHtml(viewModel.messages.banner.rejectAll)}</button>`,
    renderCookiesPageLink(viewModel, viewModel.messages.banner.viewCookies),
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
    `<p class="govuk-body">${escapeHtml(message)} ${escapeHtml(viewModel.messages.cookies.changeSettings)}</p>`,
    '</div></div></div>',
    '<div class="govuk-button-group">',
    `<button type="button" class="govuk-button" data-module="govuk-button" data-consent-action="hide">${escapeHtml(viewModel.messages.banner.hide)}</button>`,
    renderCookiesPageLink(viewModel, viewModel.messages.cookies.changeSettings),
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

  return `<a class="govuk-link" href="${safeHtmlAttribute(href)}">${escapeHtml(text)}</a>`
}

export const NOTIFICATION_BANNER_TITLE_ID = 'govuk-notification-banner-title'

/** GOV.UK cookies-page pattern: per-category tables of cookies, then a Change your cookie settings form. */
export function renderConsentCookiesPage(viewModel: ConsentViewModel): string {
  const action = safeHtmlAttribute(`${viewModel.routePrefix}/consent`)
  const returnUrl = safeHtmlAttribute(safeInternalPath(viewModel.currentPath))
  const pageTitle = escapeHtml(viewModel.translateMessage(`${MESSAGE_PREFIX}cookies.title`, viewModel.messages.cookies.title, { serviceName: viewModel.serviceName }))
  const intro = escapeHtml(
    viewModel.translateMessage(`${MESSAGE_PREFIX}cookies.intro`, viewModel.messages.cookies.intro, { serviceName: viewModel.serviceName })
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
    ...renderHiddenFields(viewModel.formFields),
    '<input type="hidden" name="preference" value="save">',
    renderChangeSettings(viewModel.categories, viewModel),
    '</form>',
    '</div>',
    '</div>'
  ].join('')
}

function renderHiddenFields(fields: Record<string, string>): string[] {
  return Object.entries(fields).map(
    ([name, value]) =>
      `<input type="hidden" ${renderHtmlAttribute('name', name)} ${renderHtmlAttribute('value', value)}>`
  )
}

function renderHtmlAttribute(name: string, value: string): string {
  return `${name}="${escapeHtml(value)}"`
}

/** Matches the markup a real `govukNotificationBanner({ type: "success" })` call would produce. */
function renderSavedNotificationBanner(viewModel: ConsentViewModel): string {
  if (!viewModel.cookiesSaved) {
    return ''
  }

  const backLink = safeHtmlAttribute(safeInternalPath(viewModel.returnTo))
  const successText = escapeHtml(viewModel.messages.cookies.successBanner)
  const successLinkText = escapeHtml(viewModel.messages.cookies.successBannerLink)

  return [
    '<div class="govuk-notification-banner govuk-notification-banner--success" role="alert" ' +
      `aria-labelledby="${NOTIFICATION_BANNER_TITLE_ID}" data-module="govuk-notification-banner">`,
    '<div class="govuk-notification-banner__header">',
    `<h2 class="govuk-notification-banner__title" id="${NOTIFICATION_BANNER_TITLE_ID}">${escapeHtml(viewModel.messages.cookies.successTitle)}</h2>`,
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
    ...viewModel.tagDescriptions
      .filter((description) => description.categoryId === category.id)
      .map((description) => `<p class="govuk-body">${escapeHtml(description.text)}</p>`),
    renderCookiesTable(category, viewModel.cookies, viewModel),
    category.essential === true ? `<p class="govuk-body">${escapeHtml(viewModel.messages.cookies.essential)}</p>` : ''
  ].join('')
}

function renderChangeSettings(categories: CookieCategory[], viewModel: ConsentViewModel): string {
  const optional = categories.filter((category) => category.essential !== true)

  if (optional.length === 0) {
    return ''
  }

  return [
    `<h2 class="govuk-heading-m">${escapeHtml(viewModel.messages.cookies.changeSettings)}</h2>`,
    ...optional.map((category) => renderCategoryRadios(category, viewModel)),
    `<button type="submit" class="govuk-button" data-module="govuk-button">${escapeHtml(viewModel.messages.cookies.saveSettings)}</button>`
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
    `<th scope="col" class="govuk-table__header">${escapeHtml(viewModel.messages.cookies.table.name)}</th>`,
    `<th scope="col" class="govuk-table__header">${escapeHtml(viewModel.messages.cookies.table.purpose)}</th>`,
    `<th scope="col" class="govuk-table__header">${escapeHtml(viewModel.messages.cookies.table.expiry)}</th>`,
    '</tr></thead>',
    `<tbody class="govuk-table__body">${body}</tbody>`,
    '</table>'
  ].join('')
}

/** Matches the markup a real `govukRadios({...})` call would produce. */
function renderCategoryRadios(
  category: CookieCategory,
  viewModel: ConsentViewModel
): string {
  const { consent, messages } = viewModel
  const idPrefix = safeHtmlAttribute(`cookies-${category.id}`)
  const name = safeHtmlAttribute(`cookies[${category.id}]`)
  const label = category.shortName ?? category.title
  const accepted = hasChoice(consent) && isCategoryAccepted(consent, category)
  const legend = escapeHtml(viewModel.translateMessage(`${MESSAGE_PREFIX}cookies.categoryQuestion`, messages.cookies.categoryQuestion, { label }))

  return [
    '<div class="govuk-form-group">',
    '<fieldset class="govuk-fieldset">',
    `<legend class="govuk-fieldset__legend govuk-fieldset__legend--s">${legend}</legend>`,
    '<div class="govuk-radios" data-module="govuk-radios">',
    '<div class="govuk-radios__item">',
    `<input class="govuk-radios__input" id="${idPrefix}" name="${name}" type="radio" value="yes"${accepted ? ' checked' : ''}>`,
    `<label class="govuk-label govuk-radios__label" for="${idPrefix}">${escapeHtml(messages.cookies.yes)}</label>`,
    '</div>',
    '<div class="govuk-radios__item">',
    `<input class="govuk-radios__input" id="${idPrefix}-2" name="${name}" type="radio" value="no"${accepted ? '' : ' checked'}>`,
    `<label class="govuk-label govuk-radios__label" for="${idPrefix}-2">${escapeHtml(messages.cookies.no)}</label>`,
    '</div>',
    '</div>',
    '</fieldset>',
    '</div>'
  ].join('')
}
