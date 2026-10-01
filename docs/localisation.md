# Localisation

Built-in English and Welsh messages are selected for each request from the browser's
`Accept-Language` header. Regional codes such as `cy-GB` are supported; missing or unsupported
preferences fall back to English. The same language is used for the banner, cookies page,
category presets, and built-in cookie descriptions:

```js
import { registerGovUkAnalyticsConsent } from '@transform-uk/govuk-analytics-consent'

registerGovUkAnalyticsConsent(server, {
  serviceName: 'Example service',
  categories: ['default', 'personalization']
})
```

## Selecting a language

If your service selects a language through its own route or session, use `getLanguage` to take
priority over the browser preference. Returning `undefined` uses `Accept-Language` instead:

```js
registerGovUkAnalyticsConsent(server, {
  getLanguage: (request) => request.params.language
})
```

For a fixed Welsh service, use `getLanguage: () => 'cy'`. Without a host translator, unsupported
languages fall back to English, including any `messages.en` overrides. With a host translator,
missing host-only-language keys fall back to built-in English.

## Overriding messages

Use nested `messages` to override individual strings for each language without an external i18n
library. Overrides for one language do not affect the other, and unspecified strings retain their
built-in translations:

```js
registerGovUkAnalyticsConsent(server, {
  messages: {
    en: { 'govuk-analytics-consent': { banner: { acceptAll: 'Accept cookies' } } },
    cy: { 'govuk-analytics-consent': {
      banner: { acceptAll: 'Derbyn cwcis' },
      categories: { analytics: { title: 'Cwcis dadansoddi' } }
    } }
  }
})
```

The built-in message structure is available as `ConsentMessages` and `defaultMessages`. It covers
banner text, cookies-page text, category titles/descriptions, table headings, radio labels, and
notification copy. `getDefaultMessages('cy')` returns the complete Welsh catalogue.

## Using a host translator

Hierarchical keys can instead be kept in the service's message catalogue. The package looks up
`govuk-analytics-consent.*` keys first and uses its built-in English/Welsh copy when a key is
absent. No host translator is required. For example, an Express service using request-bound
i18next can register its i18n middleware **before** the consent middleware:

```js
registerGovUkAnalyticsConsent(app, {
  getLanguage: (request) => request.language,
  translate: (key, { request, language, values }) =>
    request.i18n?.exists(key, { lng: language })
      ? request.t(key, { lng: language, ...values })
      : undefined,
  logger: { warn: (message) => appLogger.warn(message) }
})
```

For node-i18n, an adapter can similarly call the translator attached to the **current** request
or response, returning `undefined` when a key is missing (some libraries return the key itself).
The callback receives `{ language, request, response, values }`; it must return a string or
`undefined`, and must not change a global locale. The translator also receives the reply/response
on Fastify, Express and Hapi. Host-only languages can be selected by `getLanguage` or
`Accept-Language` when a translator is configured; otherwise only English and Welsh are selected.

## Custom tags and cookies

Keys for tags use their definition IDs, for example
`govuk-analytics-consent.tags.google-analytics.description`. Custom tag factories receive a
translator scoped to `govuk-analytics-consent.tags.<tag.id>`; calling `translate('description',
'Fallback')` from a tag with ID `my-tag` looks up `govuk-analytics-consent.tags.my-tag.description`.
Custom cookie factories receive a translator accepting full keys and a literal fallback.
Plain custom cookies can localize their display copy directly:

```js
cookies: [{
  name: 'custom_id', categoryId: 'analytics',
  purpose: 'Counts visits', purposeKey: 'govuk-analytics-consent.cookies.custom.purpose',
  expiry: '1 day', expiryKey: 'govuk-analytics-consent.cookies.custom.expiry'
}]
```

The literal fields are fallbacks if a key is missing; specifying both is intentional and does
not warn. `providerKey` works the same way. Structural fields such as cookie names and category
IDs never vary by language. A custom factory using a key not in the built-in catalogue must
provide a fallback or a configured translation. An optional `logger.warn` receives non-fatal
configuration warnings once at registration; there is no default console logging.

## Upgrading

Move flat `messages` overrides into the nested `govuk-analytics-consent` tree as shown above.
Custom cookie and tag factories now receive that same nested `ConsentMessages` shape. For HTML
cached outside the library, vary the cache on `Accept-Language` (or your service's selected
language) so one user's localized page is not served to another.