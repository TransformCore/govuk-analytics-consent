# @transform-uk/govuk-analytics-consent

Near zero-configuration GOV.UK cookie consent banner, Google Tag Manager loading and Google
Consent Mode integration for Node.js services. Built for Defra Hapi services, but
framework-agnostic with a first-class Express adapter.

Source: https://github.com/TransformCore/govuk-analytics-consent

- GOV.UK Frontend compatible cookie banner
- Optional GOV.UK cookies-page fragment for granular per-category preferences
- Consent stored in a `govuk_analytics_consent` cookie
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
| `cookieVersion` | `1` | Bumping it re-prompts every user. Use this if you need to ask for new consent. Details are in the [Cookies page design pattern](https://design-system.service.gov.uk/patterns/cookies-page/#keeping-your-cookies-page-up-to-date-and-asking-for-new-consent) |
| `routePrefix` | `/govuk-analytics-consent` | |
| `cookiesPageUrl` | none | Renders the banner's "View cookies" link; same-origin paths only |
| `consentWaitForUpdate` | `500` | Consent Mode `wait_for_update` in ms; `false` omits it |
| `serviceName` | `this service` | Used in the banner heading |
| `messages` | English defaults | Partial message override set for banner, page copy, category labels, table headers and other user-facing strings |
| `categories` | essential + analytics | `CookieCategory[]` metadata; add `essential: true` for always-on categories and `gtagSignals` for the Consent Mode signals a category controls |
| `cookies` | none | `CookieDefinition[]` documenting cookies for the cookies page; merges with (and can override by `name`) the built-in defaults below |
| `includeDefaultCookies` | `true` | Set to `false` to omit the built-in consent-cookie and GA rows entirely |
| `secureCookie` | `NODE_ENV === 'production'` | |
| `cookieMaxAge` | 1 year (seconds) | |
| `getNonce` | none | `(request) => string` — applied to every injected `<script>` for CSP |

### Additional Consent Mode categories

The default categories are strictly necessary cookies and cookies that measure website use. The
strictly necessary category grants `security_storage`; the analytics category controls
`analytics_storage`.

Three additional category presets are exported for services that use the corresponding Google
Consent Mode signals. They are not enabled by default:

| Export | Cookies-page title | Consent Mode signals |
| --- | --- | --- |
| `advertisingCategory` | Cookies that help with our communications and marketing | `ad_storage`, `ad_user_data`, `ad_personalization` |
| `functionalityCategory` | Cookies that enable additional functionality | `functionality_storage` |
| `personalizationCategory` | Cookies that remember your settings | `personalization_storage` |

Enable all three alongside the defaults:

```js
import {
  additionalConsentModeCategories,
  defaultCategories,
  registerGovUkAnalyticsConsent
} from '@transform-uk/govuk-analytics-consent'

registerGovUkAnalyticsConsent(app, {
  categories: [...defaultCategories, ...additionalConsentModeCategories]
})
```

Or import only the category presets the service needs. Tags should require the signals associated
with their category in GTM so each preference actually controls whether those tags can run.

## Localised copy

The library includes sensible English defaults, and you can override the copy for any locale. For a built-in Welsh set, import `welshMessages`:

```js
import { registerGovUkAnalyticsConsent, welshMessages } from '@transform-uk/govuk-analytics-consent'

registerGovUkAnalyticsConsent(server, {
  serviceName: 'Gwasanaeth',
  messages: welshMessages
})
```

You can also provide a partial object to override only the strings you need:

```js
registerGovUkAnalyticsConsent(app, {
  serviceName: 'Apply for a licence',
  messages: {
    acceptAll: 'Derbyn pob cwci',
    rejectAll: 'Gwrthod cwcis ychwanegol',
    changeSettings: 'Newid eich gosodiadau cwcis'
  }
})
```

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
the standard GA cookies (once `gtmContainerId` is set) are documented automatically. Add entries
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

See [examples/express/views/cookies.njk](examples/express/views/cookies.njk) and
[examples/express/views/index.njk](examples/express/views/index.njk) for a full example.

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
