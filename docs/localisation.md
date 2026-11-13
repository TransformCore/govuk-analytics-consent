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
import { registerGovUkAnalyticsConsent } from 'govuk-analytics-consent'

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
built-in translations. For example, in the [Express example](../examples/express/server.js), add `messages`
alongside `serviceName` in the `createGovUkAnalyticsConsent` options:

```js
const consent = createGovUkAnalyticsConsent({
  serviceName: 'Example service',
  messages: {
    en: {
      govukAnalyticsConsent: {
        banner: { acceptAll: 'Accept cookies' }
      }
    },
    cy: {
      govukAnalyticsConsent: {
        banner: { acceptAll: 'Derbyn cwcis' }
      }
    }
  }
})
```

This changes only the accept-all button in English and Welsh; all other messages keep their
defaults. You can override either language independently. The same `messages` option works
with the Hapi and Fastify integrations.

The built-in message structure is available as `ConsentMessages` and `defaultMessages`. It covers
banner text, cookies-page text, category titles/descriptions, table headings, radio labels, and
notification copy. `getDefaultMessages('cy')` returns the complete Welsh catalogue.

### Built-in key reference

Every key below has the prefix `govukAnalyticsConsent.` for host translator lookups.
For `messages` overrides, nest each dotted segment beneath
`messages.<language>.govukAnalyticsConsent`, as above; do not use flat dotted keys.
English defaults are shown below; the same keys are available in Welsh.

#### Session cookies

| Key (after prefix) | English default |
| --- | --- |
| `cookies.session.expiry` | Session |
| `cookies.session.purpose` | Remembers your session as you move between pages |

Use these keys to localize a session cookie's display copy:

```js
{
  name: 'session_id',
  categoryId: 'essential',
  purposeKey: 'govukAnalyticsConsent.cookies.session.purpose',
  expiryKey: 'govukAnalyticsConsent.cookies.session.expiry'
}
```

The expiry is "Session" in English or "Sesiwn" in Welsh. These keys only change display copy;
the host application still configures the cookie's actual lifetime.

#### Other common cookies

| Key (after prefix) | English default |
| --- | --- |
| `cookies.csrf.purpose` | Protects forms against cross-site request forgery |
| `cookies.language.purpose` | Remembers your language choice |

Session-lifetime CSRF cookies can also use `govukAnalyticsConsent.cookies.session.expiry`.

#### Banner

| Key (after prefix) | English default |
| --- | --- |
| `banner.title` | Cookies on {serviceName} |
| `banner.intro` | We use some essential cookies to make this service work. |
| `banner.additional` | We'd also like to use additional cookies so we can understand how you use the service and make improvements. |
| `banner.acceptAll` | Accept all cookies |
| `banner.rejectAll` | Reject additional cookies |
| `banner.viewCookies` | View cookies |
| `banner.accepted` | You've accepted additional cookies. |
| `banner.rejected` | You've rejected additional cookies. |
| `banner.hide` | Hide this message |

#### Cookies page and consent cookie

| Key (after prefix) | English default |
| --- | --- |
| `cookies.title` | Cookies |
| `cookies.intro` | {serviceName} puts small files (known as 'cookies') onto your device to make the service work and to understand how it's used. |
| `cookies.essential` | These cookies always run. |
| `cookies.categoryQuestion` | Do you want to accept {label} cookies? |
| `cookies.changeSettings` | Change your cookie settings |
| `cookies.saveSettings` | Save cookie settings |
| `cookies.successBanner` | You've set your cookie preferences. |
| `cookies.successBannerLink` | Go back to the page you were looking at |
| `cookies.successTitle` | Success |
| `cookies.yes` | Yes |
| `cookies.no` | No |
| `cookies.consent.purpose` | Saves your cookie consent settings |
| `cookies.table.name` | Name |
| `cookies.table.purpose` | Purpose |
| `cookies.table.expiry` | Expires |

`{serviceName}` is the configured service name; `{label}` is the category title used in the
preference question. Preserve these placeholders where you want the dynamic value to appear.

#### Category presets

These keys apply to built-in presets, not the literal text of custom category objects.
Keep IDs such as `personalization` unchanged even when translating their display copy.

| Key (after prefix) | English default |
| --- | --- |
| `categories.essential.title` | Strictly necessary cookies |
| `categories.essential.description` | These essential cookies do things like remember your progress through a form. They always need to be on. |
| `categories.analytics.title` | Cookies that measure website use |
| `categories.analytics.description` | These cookies help us understand how the service is used so we can improve it. |
| `categories.advertising.title` | Cookies that help with our communications and marketing |
| `categories.advertising.description` | These cookies help us understand how well our communications and marketing work and make them more relevant. |
| `categories.functionality.title` | Cookies that enable additional functionality |
| `categories.functionality.description` | These cookies enable optional features that improve how the service works. |
| `categories.personalization.title` | Cookies that remember your settings |
| `categories.personalization.description` | These cookies remember choices you make so the service can provide features and content suited to you. |

#### Built-in tags

These keys supply display copy when the corresponding tag is configured. Segments such as
`ga` and `sessionUser` identify catalogue entries, not literal cookie names.

| Key (after prefix) | English default |
| --- | --- |
| `tags.google-analytics.description` | We use Google Analytics to measure how you use the service so we can improve it based on user needs. We do not allow Google to use or share the data about how you use this site. |
| `tags.google-analytics.provider` | Google Analytics |
| `tags.google-analytics.expiry` | 2 years |
| `tags.google-analytics.cookies.ga.purpose` | These help us count how many people visit the service by tracking if you’ve visited before |
| `tags.google-analytics.cookies.session.purpose` | Used by Google Analytics to find and track an individual session with your device |
| `tags.hotjar.description` | We use Hotjar to understand how people use the service, including which pages they visit and how they interact with them, so we can improve it. |
| `tags.hotjar.provider` | Hotjar |
| `tags.hotjar.cookies.sessionUser.purpose` | Used by Hotjar to recognise you when you return to the service |
| `tags.hotjar.cookies.sessionUser.expiry` | 1 year |
| `tags.hotjar.cookies.session.purpose` | Used by Hotjar to link together the pages you visit in a single session |
| `tags.hotjar.cookies.session.expiry` | 30 minutes |
| `tags.hotjar.cookies.other.purpose` | Used by Hotjar to test browser support and store details about your session |
| `tags.hotjar.cookies.other.expiry` | Up to 1 year |
| `tags.microsoft-clarity.provider` | Microsoft Clarity |
| `tags.microsoft-clarity.cookies.user.purpose` | Used by Microsoft Clarity to recognise you when you return to the service |
| `tags.microsoft-clarity.cookies.user.expiry` | 1 year |
| `tags.microsoft-clarity.cookies.session.purpose` | Used by Microsoft Clarity to link together the pages you visit in a single session |
| `tags.microsoft-clarity.cookies.session.expiry` | 1 day |
| `tags.microsoft-clarity.cookies.clid.purpose` | Set by Microsoft Clarity to recognise your browser across sites that use Clarity |
| `tags.microsoft-clarity.cookies.muid.purpose` | Set by Microsoft to recognise your browser across Microsoft sites |

## Using a host translator

Hierarchical keys can instead be kept in the service's message catalogue. The package looks up
`govukAnalyticsConsent.*` keys first and uses its built-in English/Welsh copy when a key is
absent. No host translator is required. For example, an Express service using request-bound
i18next can register its i18n middleware **before** the consent middleware:

This recipe assumes that middleware already attaches `request.language`, `request.i18n`, and
`request.t`, and that `appLogger` implements the standard logger interface (`debug`, `info`,
`warn`, and `error`). Structured loggers such as Pino can be passed directly. It does not
initialize i18next or load translation resources. Configure i18next's key/namespace separators
to match your catalogue.

```js
import { registerGovUkAnalyticsConsent } from 'govuk-analytics-consent'

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
`govukAnalyticsConsent.tags.google-analytics.description`. Custom tag factories receive a
translator scoped to `govukAnalyticsConsent.tags.<tag.id>`; calling `translate('description',
'Fallback')` from a tag with ID `my-tag` looks up `govukAnalyticsConsent.tags.my-tag.description`.
Custom cookie factories receive a translator accepting full keys and a literal fallback.
Plain custom cookies can localize their display copy directly:

This is the `cookies` property of a registration options object, not a standalone program:

```js
cookies: [{
  name: 'custom_id', categoryId: 'analytics',
  purpose: 'Counts visits', purposeKey: 'govukAnalyticsConsent.cookies.custom.purpose',
  expiry: '1 day', expiryKey: 'govukAnalyticsConsent.cookies.custom.expiry'
}]
```

For purpose and expiry, a literal value or a key is required; when both are supplied, the literal
is a fallback. Key-only custom values must have a built-in or configured English translation at
registration, when the request-bound host translator is unavailable. `providerKey` works the
same way as before. For custom keys, also supply translations for each selected language or
provide a literal fallback. Structural fields such as cookie names and category IDs never vary by language. A
custom factory using a key not in the built-in catalogue must provide a fallback or a configured
translation. The optional standard logger receives package diagnostics and defaults to `console`.
Invalid configuration throws.

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
