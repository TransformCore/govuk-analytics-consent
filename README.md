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

### Hapi

```js
import govukAnalyticsConsent from '@transform-uk/govuk-analytics-consent/hapi'
import { googleAnalytics, govukAnalyticsConsentTemplatePath } from '@transform-uk/govuk-analytics-consent'

// Add the package templates to your Nunjucks search paths.
const searchPaths = [govukAnalyticsConsentTemplatePath(), 'node_modules/govuk-frontend/dist', 'src/views']

await server.register({
  plugin: govukAnalyticsConsent,
  options: {
    serviceName: 'Apply for a licence',
    tags: [googleAnalytics()]
  }
})
```

### Express

```js
import {
  googleAnalytics,
  registerGovUkAnalyticsConsent,
  govukAnalyticsConsentTemplatePath
} from '@transform-uk/govuk-analytics-consent'

nunjucks.configure([govukAnalyticsConsentTemplatePath(), 'node_modules/govuk-frontend/dist', 'views'], {
  express: app
})

registerGovUkAnalyticsConsent(app, {
  serviceName: 'Apply for a licence',
  tags: [googleAnalytics()]
})
```

### Fastify

Install the adapter's optional Fastify dependencies:

```sh
npm install --save fastify fastify-plugin
```

```js
import Fastify from 'fastify'
import govukAnalyticsConsent from '@transform-uk/govuk-analytics-consent/fastify'
import { googleAnalytics } from '@transform-uk/govuk-analytics-consent'

const app = Fastify()

await app.register(govukAnalyticsConsent, {
  serviceName: 'Apply for a licence',
  tags: [googleAnalytics()]
})

app.get('/', (request, reply) => reply.view('index.njk', {
  govukAnalyticsConsent: request.govukAnalyticsConsentContext
}))
```

Fastify's view plugins do not provide a universal locals object, so pass
`request.govukAnalyticsConsentContext` to each rendered view. The request also exposes
`request.govukAnalyticsConsent` for server-side category checks. The plugin registers the consent
routes and parses URL-encoded consent forms; if a form parser is already registered, it reuses it.

Hapi has a native plugin contract, so its adapter can be passed directly to `server.register()`.
Express has no equivalent plugin contract; `registerGovUkAnalyticsConsent(app, options)` is the
equivalent one-call integration and installs its middleware and routes on the application.
Fastify has a native plugin contract and can be registered with `app.register()`.

### Content Security Policy

CSP middleware is usually registered before this package, so create the consent configuration
first with `createGovUkAnalyticsConsent(options)`. The returned object resolves the options once and
exposes:

- `csp`: the GTM sources merged with the sources of every configured [tag](#tags), keyed by
  directive name (`script-src`, `connect-src`, `img-src`, `frame-src`, `style-src`, `font-src`)
- `blankieCsp(options)` and `helmetCsp(directives)`: merge those sources into Blankie options or
  Helmet directives without mutating the input or removing existing sources

Pass the same object to the Hapi plugin, the Fastify plugin or `registerGovUkAnalyticsConsent`.
The package does not replace or mutate CSP headers itself. Tags configured in GTM that are not
declared through `tags` may need further origins.

For Hapi services using [Blankie](https://github.com/nlf/blankie):

```js
import Blankie from 'blankie'
import consentPlugin from '@transform-uk/govuk-analytics-consent/hapi'
import { createGovUkAnalyticsConsent, googleAnalytics } from '@transform-uk/govuk-analytics-consent'

const consent = createGovUkAnalyticsConsent({ tags: [googleAnalytics()] })

await server.register({
  plugin: Blankie,
  options: consent.blankieCsp({
    generateNonces: true,
    scriptSrc: ['self'],
    connectSrc: ['self'],
    imgSrc: ['self']
  })
})

await server.register({ plugin: consentPlugin, options: consent })
```

The Hapi plugin automatically uses `request.plugins.blankie.nonces.script`. An explicit `getNonce`
option takes precedence if your service obtains its nonce another way.

For Express or Fastify with Helmet, `consent.helmetCsp` merges the extra sources into
Helmet's directives. Generate one nonce per response and share it with Helmet and this package.
For Fastify, register `@fastify/helmet` before the consent plugin; the adapter automatically reads
`reply.cspNonce.script` when Helmet's CSP nonce generation is enabled:

```js
import Fastify from 'fastify'
import helmet from '@fastify/helmet'
import consentPlugin from '@transform-uk/govuk-analytics-consent/fastify'
import { createGovUkAnalyticsConsent, googleAnalytics } from '@transform-uk/govuk-analytics-consent'

const app = Fastify()
const consent = createGovUkAnalyticsConsent({ tags: [googleAnalytics()] })

await app.register(helmet, {
  enableCSPNonces: true,
  contentSecurityPolicy: {
    directives: consent.helmetCsp({
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'"],
      frameSrc: ["'self'"]
    })
  }
})

await app.register(consentPlugin, consent)
```

To provide your own Fastify nonce source instead, set `getNonce: (request) => ...`. An explicit
callback takes precedence over the automatic `@fastify/helmet` nonce.

For Express with Helmet, generate one nonce per response and share it with Helmet and this package:

```js
import crypto from 'node:crypto'
import helmet from 'helmet'
import {
  createGovUkAnalyticsConsent,
  googleAnalytics,
  registerGovUkAnalyticsConsent
} from '@transform-uk/govuk-analytics-consent'

const consent = createGovUkAnalyticsConsent({
  tags: [googleAnalytics()],
  getNonce: (req) => req.res.locals.cspNonce
})

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64')
  next()
})

app.use(helmet.contentSecurityPolicy({
  directives: consent.helmetCsp({
    scriptSrc: ["'self'", (_req, res) => `'nonce-${res.locals.cspNonce}'`],
    connectSrc: ["'self'"],
    imgSrc: ["'self'"]
  })
}))

registerGovUkAnalyticsConsent(app, consent)
```

For other CSP libraries, read `consent.csp` directly, or use the standalone `mergeCspDirectives`,
`toBlankieCsp` and `toHelmetCsp` helpers with `gtmCspDirectives` and tag `csp` values.

Nonce support avoids `'unsafe-inline'`. The generated GTM bootstrap also propagates the nonce to
the remote script it creates, following Google's CSP guidance. Blankie users may still need the
published GOV.UK Frontend script hash in `scriptSrc`; that hash belongs to GOV.UK Frontend rather
than this package.

### GOV.UK page template

If your views use the GOV.UK Frontend page template, extend the package template instead of
`govuk/template.njk`:

```njk
{% extends "govuk-analytics-consent/template.njk" %}

{% block pageTitle %}Apply for a licence{% endblock %}

{% block content %}
  <h1 class="govuk-heading-xl">Apply for a licence</h1>
{% endblock %}
```

The package template extends `govuk/template.njk` and automatically adds the consent head markup,
noscript fallback, cookie banner and browser script to the appropriate GOV.UK template blocks.

If your view overrides `head`, `bodyStart` or `bodyEnd`, call `super()` to retain the automatically
added consent content. For example:

```njk
{% extends "govuk-analytics-consent/template.njk" %}

{% block head %}
  {{ super() }}
  <link rel="stylesheet" href="/stylesheets/application.css">
{% endblock %}

{% block bodyStart %}
  {{ super() }}
  {# Other content at the start of the body #}
{% endblock %}

{% block bodyEnd %}
  {{ super() }}
  <script type="module" src="/javascripts/application.js"></script>
{% endblock %}
```

Remove any cookie banner already rendered in `bodyStart`; the package template supplies it.

### Update your own GOV.UK template

If you want to keep extending `govuk/template.njk` directly, add the existing macros to these
blocks:

| GOV.UK block | Consent content |
| --- | --- |
| `head` | `govukAnalyticsConsentHead` |
| `bodyStart` | `govukAnalyticsConsentNoscript`, then `govukAnalyticsConsentBanner` |
| `bodyEnd` | `govukAnalyticsConsentScripts` |

For example, a customised GOV.UK page template should include:

```njk
{% extends "govuk/template.njk" %}
{% from "govuk-analytics-consent/macro.njk" import
   govukAnalyticsConsentHead, govukAnalyticsConsentNoscript,
   govukAnalyticsConsentBanner, govukAnalyticsConsentScripts %}

{% block head %}
  {{ super() }}
  {{ govukAnalyticsConsentHead(govukAnalyticsConsent) }}
  <link rel="stylesheet" href="/stylesheets/application.css">
{% endblock %}

{% block bodyStart %}
  {{ govukAnalyticsConsentNoscript(govukAnalyticsConsent) }}
  {{ govukAnalyticsConsentBanner(govukAnalyticsConsent) }}
  {{ super() }}
{% endblock %}

{% block bodyEnd %}
  {{ super() }}
  {{ govukAnalyticsConsentScripts(govukAnalyticsConsent) }}
  <script type="module" src="/javascripts/application.js"></script>
{% endblock %}
```

Calling `super()` preserves content supplied by the parent template. Keep the head macro before any
analytics scripts that depend on consent defaults. As with the package template, replace an existing
cookie banner in `bodyStart` rather than rendering both banners.

`govukAnalyticsConsent` is injected into the view context by `registerGovUkAnalyticsConsent`
(Hapi view responses, Express `res.locals`). Runnable examples are in [examples](examples).

For a standalone Nunjucks layout that does not extend the GOV.UK page template, use the same macros
directly in its `<head>` and `<body>` elements. Not using Nunjucks? The same HTML is available
directly:

```js
const { head, noscript, banner, cookiesPage, scripts } = res.locals.govukAnalyticsConsent
```

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
| `tags` | none | [Tags](#tags) loaded through GTM, such as `googleAnalytics()`; each adds its cookie rows and CSP origins |
| `cookies` | none | Cookie definitions or factories for the cookies page; factories receive the resolved `messages` object. Entries merge with (and can override by `name`) the built-in consent-cookie row and tag cookies. `match` and `removeOnReject` control [removal on rejection](#removing-cookies-on-rejection) |
| `includeDefaultCookies` | `true` | Set to `false` to omit the built-in consent-cookie row |
| `secureCookie` | `NODE_ENV === 'production'` | |
| `cookieMaxAge` | 1 year (seconds) | |
| `getNonce` | Blankie's script nonce in Hapi, or `@fastify/helmet`'s script nonce in Fastify; otherwise none | `(request) => string` — applied to every injected `<script>` for CSP; an explicit callback overrides automatic nonce detection |
| `getCsrfFormFields` | none | `(request, response?) => fields` — sync or async map of CSRF hidden field names to string values; rendered, HTML-escaped, in both consent forms |
| `verifyCsrfFormSubmission` | none | `(request, body) => boolean` — sync or async callback for validating a parsed consent POST; returning `false` responds with `403` |

## CSRF protection

The consent POST route is not protected automatically. Use your framework's CSRF middleware to
validate the route, or provide `verifyCsrfFormSubmission`; returning `false` responds with `403`.
When middleware handles validation, omit the verifier callback. `getCsrfFormFields` supplies
request-specific hidden fields; names and values are HTML-escaped. Both callbacks may be sync or
async.

Register the CSRF middleware before `registerGovUkAnalyticsConsent` (or before registering the
Hapi plugin), and make sure it protects `POST {routePrefix}/consent`. Do not shared-cache HTML
containing request-specific tokens.

### Rate limiting the consent endpoint

Rate limiting complements CSRF protection but does not replace it. The package does not impose a
limit because applications may already enforce one at a reverse proxy, API gateway, or shared
middleware layer. The examples below allow 120 requests per client per minute. Adjust the path if
you change `routePrefix`, and use a shared store or edge limit when running more than one process.

#### Express

Install [`express-rate-limit`](https://github.com/express-rate-limit/express-rate-limit), mount it
on the consent path, then register the integration:

```js
import { rateLimit } from 'express-rate-limit'
import { registerGovUkAnalyticsConsent } from '@transform-uk/govuk-analytics-consent'

app.use('/govuk-analytics-consent/consent', rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false
}))

registerGovUkAnalyticsConsent(app)
```

#### Hapi

Install [`hapi-rate-limit`](https://github.com/wraithgar/hapi-rate-limit) and register it before
the consent plugin. Unauthenticated users are identified by their remote address:

```js
import rateLimit from 'hapi-rate-limit'
import consentPlugin from '@transform-uk/govuk-analytics-consent/hapi'

await server.register({
  plugin: rateLimit,
  options: {
    userLimit: false,
    pathLimit: false,
    userPathLimit: 120
  }
})
await server.register(consentPlugin)
```

The default `userPathCache.expiresIn` window is one minute. Configure `trustProxy` only when a
trusted proxy strips incoming forwarding headers and supplies the client address itself.

#### Fastify

Install [`@fastify/rate-limit`](https://github.com/fastify/fastify-rate-limit) and register it
before the consent plugin:

```js
import rateLimit from '@fastify/rate-limit'
import consentPlugin from '@transform-uk/govuk-analytics-consent/fastify'

await app.register(rateLimit, {
  max: 120,
  timeWindow: '1 minute'
})
await app.register(consentPlugin)
```

This applies the same per-client limit to routes registered after the limiter. Use its route
configuration or a shared Redis store when the wider application needs a different policy.

### Hapi with Crumb

[`@hapi/crumb`](https://github.com/hapijs/crumb) generates a crumb for each request, exposes it as
`request.plugins.crumb`, and validates the `crumb` payload field on protected POST routes. Register
Crumb first, then provide that value to the generated forms:

```js
import Crumb from '@hapi/crumb'
import consentPlugin from '@transform-uk/govuk-analytics-consent/hapi'

await server.register(Crumb)
await server.register({
  plugin: consentPlugin,
  options: {
    getCsrfFormFields: (request) => ({ crumb: request.plugins.crumb })
  }
})
```

Crumb validates the consent POST before the package handler runs, so `verifyCsrfFormSubmission` is
not needed. Keep Crumb enabled for the consent route, and set Crumb's cookie `secure` option to
`true` in production. If you customize Crumb's key, use that key for the generated hidden field.

### Express with csrf-sync

[`csrf-sync`](https://github.com/Psifi-Solutions/csrf-sync) uses a session-backed synchronizer
token. Install session middleware and URL-encoded body parsing before its protection middleware;
configure it to read the same field the package renders:

```js
import express from 'express'
import { csrfSync } from 'csrf-sync'
import { registerGovUkAnalyticsConsent } from '@transform-uk/govuk-analytics-consent'

const { generateToken, csrfSynchronisedProtection } = csrfSync({
  getTokenFromRequest: (req) => req.body?._csrf
})

app.use(sessionMiddleware)
app.use(express.urlencoded({ extended: false }))
app.use(csrfSynchronisedProtection)
registerGovUkAnalyticsConsent(app, {
  getCsrfFormFields: (request) => ({ _csrf: generateToken(request) })
})
```

### Fastify with @fastify/csrf-protection

[`@fastify/csrf-protection`](https://github.com/fastify/csrf-protection) provides a Fastify hook for
validating tokens and `reply.generateCsrf()` for generating them. Register the cookie and CSRF
plugins first. Since the form token is in the parsed request body, use `preValidation` rather than
`onRequest` for the protection hook:

```js
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import csrfProtection from '@fastify/csrf-protection'
import consentPlugin from '@transform-uk/govuk-analytics-consent/fastify'

const app = Fastify()

await app.register(cookie, { secret: process.env.COOKIE_SECRET })
await app.register(csrfProtection, { cookieOpts: { signed: true } })
app.addHook('preValidation', app.csrfProtection)

await app.register(consentPlugin, {
  getCsrfFormFields: async (_request, reply) => ({
    _csrf: await reply.generateCsrf()
  })
})
```

The global hook validates unsafe requests, including the consent POST, before its handler runs. If
you prefer route-specific protection, use `verifyCsrfFormSubmission` with your application's token
verification function instead. Keep the cookie signing secret outside source control and use HTTPS
in production.

### Express with csrf-csrf

[`csrf-csrf`](https://github.com/Psifi-Solutions/csrf-csrf) uses a signed double-submit cookie.
Configure a strong secret and a stable session identifier, parse form bodies before protection,
and render the token exposed by its middleware:

```js
import express from 'express'
import cookieParser from 'cookie-parser'
import { doubleCsrf } from 'csrf-csrf'
import { registerGovUkAnalyticsConsent } from '@transform-uk/govuk-analytics-consent'

const { doubleCsrfProtection } = doubleCsrf({
  getSecret: () => config.csrfSecret,
  getSessionIdentifier: (req) => req.session.id,
  getCsrfTokenFromRequest: (req) => req.body?._csrf
})

app.use(sessionMiddleware)
app.use(cookieParser())
app.use(express.urlencoded({ extended: false }))
app.use(doubleCsrfProtection)
registerGovUkAnalyticsConsent(app, {
  getCsrfFormFields: (request) => ({ _csrf: request.csrfToken() })
})
```

Use either Express middleware recipe, not both. In both cases the middleware validates the
consent route, so the package verifier callback is unnecessary. The browser-enhanced banner
currently records its choice client-side; these recipes protect the cookies-page POST and the
banner's native no-JavaScript form submission. The examples assume `sessionMiddleware` is already
configured; with `csrf-csrf`, register `cookie-parser` after `express-session` when both are used.
Keep the `csrf-csrf` secret in secure runtime configuration, not source control.

## Tags

GTM loads from `GTM_CONTAINER_ID`. Each tag you run through GTM can be declared in `tags`; a tag
adds its cookie rows to the cookies page, removes those cookies when its category is rejected,
and contributes its origins to [`consent.csp`](#content-security-policy). Tags are opt-in; with
no `tags`, only the GTM sources and the consent-cookie row are included.

```js
import {
  createGovUkAnalyticsConsent,
  googleAnalytics,
  hotjar,
  microsoftClarity
} from '@transform-uk/govuk-analytics-consent'

const consent = createGovUkAnalyticsConsent({
  tags: [googleAnalytics(), hotjar({ siteId: 1234567 }), microsoftClarity()]
})
```

| Preset | Options | Cookies | CSP origins |
| --- | --- | --- | --- |
| `googleAnalytics()` | `measurementId` (defaults to `GA_MEASUREMENT_ID`) | `_ga`, `_ga_<id>` | `*.google-analytics.com`, `*.analytics.google.com`, `www.google.com` |
| `hotjar()` | `siteId` (defaults to `HOTJAR_SITE_ID`) | `_hjSessionUser_<id>`, `_hjSession_<id>`, other `_hj*` | `*.hotjar.com`, `*.hotjar.io`, `wss://*.hotjar.com` |
| `microsoftClarity()` | none | `_clck`, `_clsk`, `CLID`, `MUID` | `*.clarity.ms`, `c.bing.com` |

Every preset also accepts `categoryId` (default `'analytics'`), which must match a configured
category. Without a measurement or site ID, the cookies page uses a generic `<id>` name; matching
for removal uses wildcards either way. Cookie copy comes from the resolved messages, so it is
localised and can be overridden.

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
  cookies: () => [
    { name: 'mp_<token>_mixpanel', match: 'mp_*_mixpanel', categoryId: 'analytics', purpose: 'Mixpanel analytics', expiry: '1 year' }
  ],
  csp: {
    'script-src': ['https://cdn.mxpnl.com'],
    'connect-src': ['https://api-js.mixpanel.com']
  }
}

const consent = createGovUkAnalyticsConsent({ tags: [googleAnalytics(), mixpanel] })
```

`cookies` receives the resolved messages for the request language. Tag ids must be unique. An
entry in `cookies` with the same `name` as a tag cookie overrides it.

### Migrating from 0.2

| 0.2 | 0.3 |
| --- | --- |
| `cookies: [gaCookies(id)]` | `tags: [googleAnalytics({ measurementId: id })]` |
| `googleAnalyticsCspDirectives` | `consent.csp` |
| `withGoogleAnalyticsBlankieCsp(options)` | `consent.blankieCsp(options)` |
| `withGoogleAnalyticsHelmetCsp(directives)` | `consent.helmetCsp(directives)` |

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

Built-in English and Welsh messages are selected for each request from the browser's `Accept-Language` header. Regional codes such as `cy-GB` are supported; missing or unsupported preferences fall back to English. The same language is used for the banner, cookies page, category presets, and built-in cookie descriptions:

```js
import { registerGovUkAnalyticsConsent } from '@transform-uk/govuk-analytics-consent'

registerGovUkAnalyticsConsent(server, {
  serviceName: 'Example service',
  categories: ['default', 'personalization']
})
```

If your service selects a language through its own route or session, use `getLanguage` to take priority over the browser preference. Returning `undefined` uses `Accept-Language` instead:

```js
registerGovUkAnalyticsConsent(server, {
  getLanguage: (request) => request.params.language
})
```

Use `messages` to override individual strings for each language. Overrides for one language do not affect the other, and unspecified strings retain their built-in translations:

```js
registerGovUkAnalyticsConsent(server, {
  messages: {
    en: { acceptAll: 'Accept cookies' },
    cy: { acceptAll: 'Derbyn cwcis', analyticsCategoryTitle: 'Cwcis dadansoddi' }
  }
})
```

An unsupported language falls back to English, including any `messages.en` overrides. Cookie factories receive the selected, overridden messages. For a fixed Welsh service, use `getLanguage: () => 'cy'`; `getDefaultMessages('cy')` is available when a complete message object is needed outside the registration options.

If upgrading from an earlier version, move flat `messages` overrides under their language code. For HTML cached outside the library, vary the cache on `Accept-Language` (or your service's selected language) so one user's localized page is not served to another.

The full message structure is available as `ConsentMessages`, and it supports banner text, cookies-page text, category titles/descriptions, table headings, radio labels, and notification copy.

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
on `req.govukAnalyticsConsent` for middleware and routes registered after
`registerGovUkAnalyticsConsent`:

```js
app.get('/recommendations', (req, res) => {
  const consent = req.govukAnalyticsConsent

  if (!consent.isCategoryAccepted('personalization')) {
    return res.render('recommendations-without-personalization.njk')
  }

  return res.render('recommendations.njk')
})
```

Hapi exposes the same object through `request.app.govukAnalyticsConsent`:

```js
server.route({
  method: 'GET',
  path: '/recommendations',
  handler: (request, h) => {
    const consent = request.app.govukAnalyticsConsent

    return consent.isCategoryAccepted('personalization')
      ? h.view('recommendations.njk')
      : h.view('recommendations-without-personalization.njk')
  }
})
```

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

## Development

```sh
npm install
npm test        # builds the browser bundle, then runs Vitest
npm run build
```

## Publishing

The package is published as a public scoped npm package. The `prepack` script builds `dist`,
and `prepublishOnly` runs type checking and tests before publishing.

```sh
npm publish --access public
```

Tests cover the pure consent/cookie logic, Consent Mode snippet generation and injection
safety, the Nunjucks macros against the shared HTML builders, the browser manager under jsdom,
and both integrations end to end.
