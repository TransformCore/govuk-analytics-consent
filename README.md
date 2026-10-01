# @transform-uk/govuk-analytics-consent

Near zero-configuration GOV.UK cookie consent banner, including Google Tag Manager loading and Google
Consent Mode integration for Node.js services. Built for Defra Hapi services, with first-class
Hapi, Express and Fastify integrations.

Source: https://github.com/TransformCore/govuk-analytics-consent

- GOV.UK Frontend compatible cookie banner
- Optional GOV.UK cookies-page fragment for granular per-category preferences
- Consent stored in a `govuk_analytics_consent` cookie
- Consent Mode defaults to **denied** before GTM loads
- Consent Mode updated the moment a user accepts or rejects
- GTM loaded automatically from `GTM_CONTAINER_ID`
- Tag presets (Google Analytics, Hotjar, Microsoft Clarity) that document their cookies, remove
  them on rejection and supply their CSP sources

## Install

```sh
npm install --save @transform-uk/govuk-analytics-consent
```

## Quick start

Set the container ID:

```sh
GTM_CONTAINER_ID=GTM-XXXXXXX
```

Choose your framework for registration, view setup, CSP, CSRF, and rate-limiting examples:

- [Hapi guide](docs/hapi.md) — register the plugin and inject consent into Hapi views.
- [Express guide](docs/express.md) — register middleware and use `res.locals` in views.
- [Fastify guide](docs/fastify.md) — register the plugin and pass its request context to views.

All three integrations register the consent routes. Set `serviceName` and opt into the tags your
service uses; without a configured GTM container ID, it runs un-instrumented.

### Content Security Policy

CSP middleware usually runs before consent registration. Create one configuration with
`createGovUkAnalyticsConsent(options)`, use `consent.csp` or merge its sources with
`consent.blankieCsp(options)` / `consent.helmetCsp(directives)`, and pass the same object to the
integration. The package does not set CSP headers. For nonce and middleware-ordering examples,
see [Hapi with Blankie](docs/hapi.md#content-security-policy),
[Express with Helmet](docs/express.md#content-security-policy), or
[Fastify with Helmet](docs/fastify.md#content-security-policy).

### GOV.UK page template

Extend `govuk-analytics-consent/template.njk` to add the consent banner and scripts to a GOV.UK
page. For custom layouts, manual macros, and block override examples, see the
[template guide](docs/templates.md) and your framework's integration guide above.

## CSRF protection

The consent POST route is not protected automatically. Use your framework's CSRF middleware to
validate the route, or provide `verifyCsrfFormSubmission`; returning `false` responds with `403`.
When middleware handles validation, omit the verifier callback. `getCsrfFormFields` supplies
request-specific hidden fields; names and values are HTML-escaped. Both callbacks may be sync or
async.

Register the CSRF middleware before `registerGovUkAnalyticsConsent` (or before registering the
Hapi plugin), and make sure it protects `POST {routePrefix}/consent`. Do not shared-cache HTML
containing request-specific tokens. Follow the [Hapi](docs/hapi.md#csrf-protection),
[Express](docs/express.md#csrf-protection), or [Fastify](docs/fastify.md#csrf-protection) guide
for middleware recipes and registration order.

### Rate limiting the consent endpoint

Rate limiting complements CSRF protection but does not replace it. The package does not impose a
limit because applications may already enforce one at a reverse proxy, API gateway, or shared
middleware layer. See the [Hapi](docs/hapi.md#rate-limiting),
[Express](docs/express.md#rate-limiting), or [Fastify](docs/fastify.md#rate-limiting) guide for
registration order and examples.

## Tags

GTM loads from `GTM_CONTAINER_ID`. Each tag you run through GTM can be declared in `tags`; a tag
adds its cookie rows to the cookies page, removes those cookies when its category is rejected,
and contributes its origins to [`consent.csp`](#content-security-policy). Tags are opt-in; with
no `tags`, only the GTM sources and the consent-cookie row are included.

```js
import {
  createGovUkAnalyticsConsent,
  hotjar
} from '@transform-uk/govuk-analytics-consent'

const consent = createGovUkAnalyticsConsent({
  tags: ['google-analytics', hotjar({ siteId: 1234567 }), 'microsoft-clarity']
})
```

As with `categories`, each entry is either a preset name, which uses the preset's defaults, or a
tag object. Call the preset function to pass options.

| Preset name | Function | Options | Cookies | CSP origins |
| --- | --- | --- | --- | --- |
| `'google-analytics'` | `googleAnalytics()` | `measurementId` (defaults to `GA_MEASUREMENT_ID`) | `_ga`, `_ga_<id>` | `*.google-analytics.com`, `*.analytics.google.com`, `www.google.com` |
| `'hotjar'` | `hotjar()` | `siteId` (defaults to `HOTJAR_SITE_ID`) | `_hjSessionUser_<id>`, `_hjSession_<id>`, other `_hj*` | `*.hotjar.com`, `*.hotjar.io`, `wss://*.hotjar.com` |
| `'microsoft-clarity'` | `microsoftClarity()` | none | `_clck`, `_clsk`, `CLID`, `MUID` | `*.clarity.ms`, `c.bing.com` |

Every preset function also accepts `categoryId` (default `'analytics'`), which must match a configured
category. Without a measurement or site ID, the cookies page uses a generic `<id>` name; matching
for removal uses wildcards either way. Cookie copy comes from the resolved messages, so it is
localised and can be overridden. The Google Analytics explanation appears only when its tag is
configured; the analytics category description stays provider-neutral.

First-party tag cookies use `'host-and-parents'` removal, because these tools set cookies on the
broadest domain they can (for example `.defra.gov.uk` rather than `payments.defra.gov.uk`). As a
result, rejecting on one service also removes those cookies for other services on the same parent
domain, which will then see the user as new. Clarity's `CLID` and `MUID` are set on Microsoft's
domains, so they are listed but never removed.

Hotjar's documentation also recommends `style-src 'unsafe-inline'`. It is not included; add it
yourself only if Hotjar's on-page widgets need it.

### Custom tags

A tag is a plain object, so adding another tool needs no changes to this package:

```js
const mixpanel = {
  id: 'mixpanel',
  description: 'We use Mixpanel to understand how people use the service.',
  cookies: () => [
    { name: 'mp_<token>_mixpanel', match: 'mp_*_mixpanel', categoryId: 'analytics', purpose: 'Mixpanel analytics', expiry: '1 year' }
  ],
  csp: {
    'script-src': ['https://cdn.mxpnl.com'],
    'connect-src': ['https://api-js.mixpanel.com']
  }
}

const consent = createGovUkAnalyticsConsent({ tags: ['google-analytics', mixpanel] })
```

`description` is optional plain text rendered above the tag's cookie table in its first cookie's
category. It can also be a function receiving the resolved messages for language-specific copy.
`cookies` receives those messages too. Tag ids must be unique. An
entry in `cookies` with the same `name` as a tag cookie overrides it.

### Restricting what GTM can run

Anyone with publish access to the GTM container can add tags to your service. To limit that, the
head snippet can push GTM's [`gtm.allowlist` and `gtm.blocklist`](https://developers.google.com/tag-platform/tag-manager/restrict)
after the consent defaults and before the container loads. Entries are GTM tag, trigger or
variable type IDs (for example `hjtc`) or classes (for example `customScripts`):

```js
createGovUkAnalyticsConsent({
  tags: ['google-analytics'],
  gtmBlocklist: ['customScripts', 'nonGoogleIframes']
})
```

The blocklist takes precedence over the allowlist. An empty `gtmAllowlist` blocks every tag.

Set `gtmAllowlist: 'auto'` to generate the allowlist from `tags`, so the container can run only
the tag types you have declared:

```js
createGovUkAnalyticsConsent({
  gtmAllowlist: 'auto',
  tags: ['google-analytics', hotjar({ siteId: 1234567 })]
})
```

The generated allowlist contains:

- each tag's `gtmTypes`: `googtag`, `gaawc` and `gaawe` for `googleAnalytics()`, and `hjtc` for
  `hotjar()`
- `gtmBaseAllowlist`, the built-in trigger and variable types, so existing triggers keep
  working. It excludes Custom JavaScript variables (`jsm`)

To allow further types as well, use `'auto'` as one entry in the array, for example
`gtmAllowlist: ['auto', 'awct']`. Custom HTML tags, Custom JavaScript variables and tag types you
have not declared are blocked.

Microsoft Clarity has no built-in GTM tag type, so `microsoftClarity()` declares no `gtmTypes`.
Pass them explicitly when using `'auto'`; otherwise it is an error. Gallery templates run as
`sandboxedScripts`, and allowlisting that class permits every custom template in the container:

```js
microsoftClarity({ gtmTypes: ['sandboxedScripts'] })
```

Custom tags declare their types the same way, with `gtmTypes: ['...']`. After enabling the
allowlist, test the container in GTM Preview mode; tags whose types are not allowlisted are
reported as blocked.

### Additional Consent Mode categories

The default categories are strictly necessary cookies and cookies that measure website use. The
strictly necessary category grants `security_storage`; the analytics category controls
`analytics_storage`.

Three additional category presets are available for services that use the corresponding Google
Consent Mode signals. They are not enabled by default:

| Preset | Cookies-page title | Consent Mode signals |
| --- | --- | --- |
| `advertising` | Cookies that help with our communications and marketing | `ad_storage`, `ad_user_data`, `ad_personalization` |
| `functionality` | Cookies that enable additional functionality | `functionality_storage` |
| `personalization` | Cookies that remember your settings | `personalization_storage` |

Enable all three alongside the defaults:

```js
import { registerGovUkAnalyticsConsent } from '@transform-uk/govuk-analytics-consent'

registerGovUkAnalyticsConsent(app, {
  categories: ['default', 'advertising', 'functionality', 'personalization']
})
```

Include only the category presets the service needs. Presets use the selected request language;
custom category objects retain their own text. Tags should require the signals associated
with their category in GTM so each preference actually controls whether those tags can run.

## Localised copy

Built-in English and Welsh copy works without an i18n library. Use `getLanguage` to select a
service language, `messages` for nested overrides, or a request-bound `translate` callback to use
your host project's i18n catalogue. See the [localisation guide](docs/localisation.md) for
configuration, fallback behaviour, and custom tag and cookie messages.

## How it works

1. The head snippet initialises `dataLayer`, calls `gtag('consent', 'default', …)` with every
   signal denied plus `wait_for_update`, then loads the GTM container.
2. The deferred client script reads the consent cookie. If a choice exists it immediately calls
   `gtag('consent', 'update', …)`, and also pushes a `cookie_consent_update` dataLayer event so
   GTM tags can trigger on it.
3. If no choice exists the banner is shown. Accept all/reject additional writes the cookie,
   updates Consent Mode and swaps in the confirmation message.
4. Without JavaScript the banner form posts to `{routePrefix}/consent`, which sets the cookie
   and redirects back. Return paths are validated as same-origin, so it cannot be used as an
   open redirect.

The cookie is deliberately **not** `httpOnly` — the browser must read it to decide whether to
show the banner without a server round-trip.

### Consent state

```ts
interface ConsentState {
  version: number
  categories: Record<string, boolean> | null // null = no choice made; keyed by non-essential category id
  updatedAt: string
}
```

Any malformed, tampered or out-of-date cookie degrades to "no choice made" and re-prompts.

### Server-side consent state

Registration exposes the parsed consent state to application handlers. In Express it is available
on `req.govukAnalyticsConsent`, in Hapi on `request.app.govukAnalyticsConsent`, and in Fastify on
`request.govukAnalyticsConsent`. Each [Hapi](docs/hapi.md#consent-state-and-cookies-page),
[Express](docs/express.md#consent-state-and-cookies-page), and
[Fastify](docs/fastify.md#consent-state-and-cookies-page) guide shows handler usage.

The request value is a `ConsentRequestState`:

```ts
interface ConsentRequestState {
  state: ConsentState
  hasChoice: boolean
  isCategoryAccepted(categoryId: string): boolean
}
```

`hasChoice` distinguishes a user who has submitted preferences from one who has not. The category
helper returns `true` for an accepted category and for strictly necessary categories, and `false`
for rejected, undecided or unknown categories. `ConsentRequestState` is exported for TypeScript
applications that augment their framework request type.

## Routes

| Route | Purpose |
| --- | --- |
| `GET {routePrefix}/consent.js` | Browser consent manager (ETag, 1 hour cache) |
| `POST {routePrefix}/consent` | No-JavaScript fallback for both the banner and the cookies page |

## Cookies page

The [GOV.UK cookies-page pattern](https://design-system.service.gov.uk/patterns/cookies-page/)
is available as a fragment, the same way the banner is — mount your own route/view and embed it
in the `content` block of your view:

```njk
{% extends "govuk-analytics-consent/template.njk" %}
{% from "govuk-analytics-consent/macro.njk" import govukAnalyticsConsentCookiesPage %}

{% block content %}
  {{ govukAnalyticsConsentCookiesPage(govukAnalyticsConsent) }}
{% endblock %}
```

It lists every configured category with a table of its cookies and, under a "Change your cookie
settings" heading, a Yes/No radios group per non-essential category — matching the markup a real
`govukRadios`/`govukButton` component call would produce (`cookies[{categoryId}]`, values `yes`/
`no`). Sensible defaults mean most services need no extra config: the consent cookie itself and
the cookies of any configured [tags](#tags) are documented automatically. Add entries
for your own cookies (a session cookie, for example) via `cookies`, and set `cookiesPageUrl` so
the banner links to it:

```js
registerGovUkAnalyticsConsent(app, {
  cookiesPageUrl: '/cookies',
  cookies: [
    { name: 'session_id', categoryId: 'essential', purpose: 'Keeps you signed in', expiry: 'Session' }
  ]
})
```

Saving stays on the cookies page (the hidden `returnUrl` field points back to itself) and shows a
success notification banner — matching a real `govukNotificationBanner({ type: "success" })` call
— with a "Go back to the page you were looking at" link pointing to wherever the user came from.
No extra markup is needed in your main layout; it's all part of `govukAnalyticsConsentCookiesPage`.

See [examples/views/cookies.njk](examples/views/cookies.njk) and
[examples/views/index.njk](examples/views/index.njk) for a full example.

## Removing cookies on rejection

Consent Mode stops GTM from setting new cookies, but it does not remove cookies that are already
set. When a user rejects a category, or withdraws consent they gave earlier, the cookies documented
for that category are expired:

- **In the browser**, straight after a banner choice and on every page load once a choice exists.
- **On the server**, in the consent `POST` response and on any later response to a request that
  still sends a rejected cookie. This covers users without JavaScript and `HttpOnly` cookies.

Nothing is removed before the user has made a choice. Each `cookies` entry controls this with
`removeOnReject`:

| `removeOnReject` | Behaviour |
| --- | --- |
| `'never'` | Leave the cookie alone (always the case for essential categories) |
| `'host-only'` | Expire it on the current host (default for non-essential categories) |
| `'host-and-parents'` | Expire it on the current host and every parent domain |

Use `match` to match cookies whose names vary. It's a glob-style where only `*` is a wildcard (for
example `_hj*` or `mp_*_mixpanel`); without it, `name` must match exactly. Mark cookies to keep
with `'never'`:

```js
registerGovUkAnalyticsConsent(app, {
  cookies: [
    { name: '_hj<id>', match: '_hj*', categoryId: 'analytics', purpose: 'Hotjar', expiry: '1 year' },
    { name: 'feedback_seen', categoryId: 'analytics', purpose: 'Survey', expiry: '1 year', removeOnReject: 'never' }
  ]
})
```

A user-supplied entry replaces a built-in one with the same `name`, including its `removeOnReject`
and `match`. Only cookies set on `Path=/` are expired.

## Options

All optional.

| Option | Default | Notes |
| --- | --- | --- |
| `gtmContainerId` | `process.env.GTM_CONTAINER_ID` | Must match `GTM-XXXXXXX`; omitted means the service runs un-instrumented |
| `cookieName` | `govuk_analytics_consent` | |
| `cookieVersion` | `1` | Bumping it re-prompts every user. Use this if you need to ask for new consent. Details for when you might need to trigger this are in the [Cookies page design pattern](https://design-system.service.gov.uk/patterns/cookies-page/#keeping-your-cookies-page-up-to-date-and-asking-for-new-consent) |
| `routePrefix` | `/govuk-analytics-consent` | |
| `cookiesPageUrl` | none | Renders the banner's "View cookies" link; same-origin paths only |
| `consentWaitForUpdate` | `500` | Consent Mode `wait_for_update` in ms; `false` omits it |
| `serviceName` | `this service` | Used in the banner heading |
| `messages` | English defaults | Partial message override set for banner, page copy, category labels, table headers and other user-facing strings |
| `categories` | essential + analytics | Built-in preset names or custom category objects; presets use the resolved messages. Add `essential: true` for always-on custom categories and `gtagSignals` for the Consent Mode signals they control |
| `tags` | none | [Tags](#tags) loaded through GTM, as preset names such as `'google-analytics'` or tag objects; each adds its cookie rows and CSP origins |
| `gtmAllowlist` | none | GTM type IDs or classes pushed as `gtm.allowlist`, or `'auto'` to generate it from `tags`; see [restricting GTM](#restricting-what-gtm-can-run) |
| `gtmBlocklist` | none | GTM type IDs or classes pushed as `gtm.blocklist`; takes precedence over the allowlist |
| `cookies` | none | Cookie definitions or factories for the cookies page; factories receive the resolved `messages` object. Entries merge with (and can override by `name`) the built-in consent-cookie row and tag cookies. `match` and `removeOnReject` control [removal on rejection](#removing-cookies-on-rejection) |
| `includeDefaultCookies` | `true` | Set to `false` to omit the built-in consent-cookie row |
| `secureCookie` | `NODE_ENV === 'production'` | |
| `cookieMaxAge` | 1 year (seconds) | |
| `getNonce` | Blankie's script nonce in Hapi, or `@fastify/helmet`'s script nonce in Fastify; otherwise none | `(request) => string` — applied to every injected `<script>` for CSP; an explicit callback overrides automatic nonce detection |
| `getCsrfFormFields` | none | `(request, response?) => fields` — sync or async map of CSRF hidden field names to string values; rendered, HTML-escaped, in both consent forms |
| `verifyCsrfFormSubmission` | none | `(request, body) => boolean` — sync or async callback for validating a parsed consent POST; returning `false` responds with `403` |

## Development

Install dependencies once:

```sh
npm install
```

### Example servers

Run one framework example at a time:

```sh
npm run example:hapi
npm run example:express
npm run example:fastify
```

Each command builds the package and serves the example at `http://localhost:3000` by default.
Set `PORT=3001` to run another example alongside it. To try GTM and Google Analytics, set
`GTM_CONTAINER_ID` and `GA_MEASUREMENT_ID` before starting an example; without them the example
still runs without loading GTM.

### Tests

```sh
npm run typecheck     # TypeScript checks
npm test              # builds the browser bundle, then runs Vitest
npm run test:watch    # Vitest watch mode
npm run test:e2e      # builds the package, starts test servers, and runs Playwright
npm run build         # production server and client bundles
```

For a first Playwright run, install its browser with `npx playwright install chromium`. The E2E
command manages its own servers; you do not need to start an example server first. To run one
Vitest file, use `npx vitest run test/html.test.ts`.

## Publishing

The package is published as a public scoped npm package. The `prepack` script builds `dist`,
and `prepublishOnly` runs type checking and tests before publishing.

```sh
npm publish --access public
```

Tests cover the pure consent/cookie logic, Consent Mode snippet generation and injection
safety, the Nunjucks macros against the shared HTML builders, the browser manager under jsdom,
and all three framework integrations end to end.
