# Localisation

## Scope and prerequisites

No i18n package or host translator is required. The examples below are registration recipes for
an existing Hapi server or Express app, not complete applications. For Fastify, pass the same
options to its consent plugin. Register consent once with the combined options you need; see
the [framework guides](../README.md#documentation-index) for setup and middleware ordering.

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

`getLanguage(request, response?)` may be synchronous or asynchronous. Without a host translator,
only English and Welsh are selected. With one, a well-formed host-only language can be selected
by this callback or the highest-quality browser language preference; configure `getLanguage`
from the host's selected locale if its language policy differs. Callback errors are propagated,
not silently converted into an English page.

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

This recipe assumes that middleware already attaches `request.language`, `request.i18n`, and
`request.t`, and that `appLogger` implements the standard logger interface (`debug`, `info`,
`warn`, and `error`). Structured loggers such as Pino can be passed directly. It does not
initialize i18next or load translation resources. Configure i18next's key/namespace separators
to match your catalogue.

```js
import { registerGovUkAnalyticsConsent } from '@transform-uk/govuk-analytics-consent'

registerGovUkAnalyticsConsent(app, {
  getLanguage: (request) => request.language,
  translate: (key, { request, language, values }) =>
    request.i18n?.exists(key, { lng: language })
      ? request.t(key, { lng: language, ...values })
      : undefined,
  logger: appLogger
})
```

For node-i18n, an adapter can similarly call the translator attached to the **current** request
or response, returning `undefined` when a key is missing (some libraries return the key itself).
The callback receives `{ language, request, response, values }`; it must return a string or
`undefined`, and must not change a global locale. The translator also receives the reply/response
on Fastify, Express and Hapi. Host-only languages can be selected by `getLanguage` or
`Accept-Language` when a translator is configured; otherwise only English and Welsh are selected.

### Lookup and fallback contract

For each key, resolution uses:

1. The current request's synchronous host `translate` callback, if configured.
2. Nested `messages` overrides for the exact selected locale, then its base language (for example,
   `cy-GB`, then `cy`). For a language without built-in copy, configured English messages are
   also checked.
3. The built-in translation for built-in keys: Welsh when the selected base language is `cy`,
   otherwise English. Custom factory keys instead use the literal fallback passed to `translate`.

An English override does not replace an absent Welsh override: built-in Welsh is retained.
`undefined` or a returned key string means missing; an empty string is a translation rather
than a missing key. A custom key with no configured translation or literal fallback throws.
Host translator exceptions propagate. Do not return promises or mutate a global locale. The host
translator is request-scoped and is not called during registration, when the library builds its
canonical cookie names and category IDs.

Interpolation values such as `serviceName` and `label` are supplied as `values`. Adapters can
interpolate them; the library also replaces `{name}` and `{{name}}` placeholders when values
are available. Rendered copy is HTML-escaped, so return plain text, not HTML or pre-escaped text.

## Custom tags and cookies

Keys for tags use their definition IDs, for example
`govuk-analytics-consent.tags.google-analytics.description`. Custom tag factories receive a
translator scoped to `govuk-analytics-consent.tags.<tag.id>`; calling `translate('description',
'Fallback')` from a tag with ID `my-tag` looks up `govuk-analytics-consent.tags.my-tag.description`.
Custom cookie factories receive a translator accepting full keys and a literal fallback.
Plain custom cookies can localize their display copy directly:

This is the `cookies` property of a registration options object, not a standalone program:

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
provide a fallback or a configured translation. The optional standard logger receives package
diagnostics and defaults to `console`; the package currently uses `warn` for an unsupported
message-locale configuration. Invalid configuration still throws.

Factories receive `(messages, translate)`, where `messages` is the resolved nested built-in
catalogue. They run during registration to establish canonical cookie identifiers and again for
per-request display localization. The registration call has no request-bound host translator, so
every custom factory key needs a literal fallback or configured English message. Keep cookie names
and category IDs independent of translated display copy; the package preserves those canonical
identifiers when applying per-request translations.

## Verification

Check the same page with English and Welsh requests, and with a host-only language if configured.
An absent host translation must retain readable fallback copy rather than a key name. Verify a
custom cookie purpose changes with language while its name and category stay unchanged, and
interleave requests in different languages to catch shared-locale leakage. Without host i18n,
registration and rendering must still work using built-in messages and custom literal defaults.

## Upgrading

Move flat `messages` overrides into the nested `govuk-analytics-consent` tree as shown above.
Custom cookie and tag factories now receive that same nested `ConsentMessages` shape. For HTML
cached outside the library, vary the cache on `Accept-Language` (or your service's selected
language) so one user's localized page is not served to another.