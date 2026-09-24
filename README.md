# @transform-uk/govuk-analytics-consent

Near zero-configuration GOV.UK cookie consent banner, Google Tag Manager loading and Google
Consent Mode integration for Node.js services. Built for Defra Hapi services, but
framework-agnostic with a first-class Express adapter.

Source: https://github.com/TransformCore/govuk-analytics-consent

- GOV.UK Frontend compatible cookie banner
- Consent stored in a `cookies_policy` cookie
- Consent Mode defaults to **denied** before GTM loads
- Consent Mode updated the moment a user accepts or rejects
- GTM loaded automatically from `GTM_CONTAINER_ID`

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
import { registerGovUkAnalyticsConsent, govukAnalyticsConsentTemplatePath } from '@transform-uk/govuk-analytics-consent'

// Add the package templates to your Nunjucks search paths.
const searchPaths = [govukAnalyticsConsentTemplatePath(), 'node_modules/govuk-frontend/dist', 'src/views']

registerGovUkAnalyticsConsent(server, { serviceName: 'Apply for a licence' })
```

### Express

```js
import { registerGovUkAnalyticsConsent, govukAnalyticsConsentTemplatePath } from '@transform-uk/govuk-analytics-consent'

nunjucks.configure([govukAnalyticsConsentTemplatePath(), 'node_modules/govuk-frontend/dist', 'views'], {
  express: app
})

registerGovUkAnalyticsConsent(app, { serviceName: 'Apply for a licence' })
```

### Layout

```njk
{% from "govuk-analytics-consent/macro.njk" import
   govukAnalyticsConsentHead, govukAnalyticsConsentNoscript,
   govukAnalyticsConsentBanner, govukAnalyticsConsentScripts %}

<head>
  {{ govukAnalyticsConsentHead(govukAnalyticsConsent) }}
</head>
<body>
  {{ govukAnalyticsConsentNoscript(govukAnalyticsConsent) }}
  {{ govukAnalyticsConsentBanner(govukAnalyticsConsent) }}
  ...
  {{ govukAnalyticsConsentScripts(govukAnalyticsConsent) }}
</body>
```

`govukAnalyticsConsent` is injected into the view context by `registerGovUkAnalyticsConsent`
(Hapi view responses, Express `res.locals`). Runnable examples are in [examples](examples).

Not using Nunjucks? The same HTML is available directly:

```js
const { head, noscript, banner, scripts } = res.locals.govukAnalyticsConsent
```

## Options

All optional.

| Option | Default | Notes |
| --- | --- | --- |
| `gtmContainerId` | `process.env.GTM_CONTAINER_ID` | Must match `GTM-XXXXXXX`; omitted means the service runs un-instrumented |
| `cookieName` | `cookies_policy` | |
| `cookieVersion` | `1` | Bumping it re-prompts every user |
| `routePrefix` | `/govuk-analytics-consent` | |
| `cookiesPageUrl` | none | Renders the banner's "View cookies" link; same-origin paths only |
| `consentWaitForUpdate` | `500` | Consent Mode `wait_for_update` in ms; `false` omits it |
| `serviceName` | `this service` | Used in the banner heading |
| `categories` | essential + analytics | `CookieCategory[]` metadata |
| `secureCookie` | `NODE_ENV === 'production'` | |
| `cookieMaxAge` | 1 year (seconds) | |
| `getNonce` | none | `(request) => string` — applied to every injected `<script>` for CSP |

## How it works

1. The head snippet initialises `dataLayer`, calls `gtag('consent', 'default', …)` with every
   signal denied plus `wait_for_update`, then loads the GTM container.
2. The deferred client script reads `cookies_policy`. If a choice exists it immediately calls
   `gtag('consent', 'update', { analytics_storage: … })`, and also pushes a
   `cookie_consent_update` dataLayer event so GTM tags can trigger on it.
3. If no choice exists the banner is shown. Accept/reject writes the cookie, updates Consent
   Mode and swaps in the confirmation message.
4. Without JavaScript the banner form posts to `{routePrefix}/consent`, which sets the cookie
   and redirects back. Return paths are validated as same-origin, so it cannot be used as an
   open redirect.

The cookie is deliberately **not** `httpOnly` — the browser must read it to decide whether to
show the banner without a server round-trip.

### Consent state

```ts
interface ConsentState {
  version: number
  analytics: boolean | null // null = no choice made
  updatedAt: string
}
```

Any malformed, tampered or out-of-date cookie degrades to "no choice made" and re-prompts.

## Routes

| Route | Purpose |
| --- | --- |
| `GET {routePrefix}/consent.js` | Browser consent manager (ETag, 1 hour cache) |
| `POST {routePrefix}/consent` | No-JavaScript fallback |

## Adding a /cookies page later

`CookieCategory[]` metadata already drives the banner and is exposed on the view context, so a
preferences page can be added without a breaking change: build the page from
`govukAnalyticsConsent.categories`, post to the existing consent route, and set
`cookiesPageUrl` to make the banner link to it.

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
