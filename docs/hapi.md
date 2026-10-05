# Hapi integration

Install the [package](../README.md#install), set `GTM_CONTAINER_ID=GTM-XXXXXXX`, and add the
package templates to your Nunjucks search paths:

```js
import consentPlugin from '@transform-uk/govuk-analytics-consent/hapi'
import { govukAnalyticsConsentTemplatePath } from '@transform-uk/govuk-analytics-consent'

const searchPaths = [govukAnalyticsConsentTemplatePath(), 'node_modules/govuk-frontend/dist', 'src/views']

await server.register({
  plugin: consentPlugin,
  options: { serviceName: 'Apply for a licence', tags: ['google-analytics'] }
})
```

The plugin registers the consent routes and injects `govukAnalyticsConsent` into Hapi view
responses. Extend `govuk-analytics-consent/template.njk` instead of `govuk/template.njk` to add
the consent head markup, noscript fallback, banner, and browser script automatically:

```njk
{% extends "govuk-analytics-consent/template.njk" %}
{% block pageTitle %}Apply for a licence{% endblock %}
{% block content %}<h1 class="govuk-heading-xl">Apply for a licence</h1>{% endblock %}
```

If your view overrides `head`, `bodyStart`, or `bodyEnd`, call `super()` to retain the consent
markup. Replace any existing cookie banner rather than rendering two. For a custom GOV.UK layout,
import the macros from `govuk-analytics-consent/macro.njk`: add `govukAnalyticsConsentHead` to
`head` before analytics scripts, `govukAnalyticsConsentNoscript` and
`govukAnalyticsConsentBanner` to `bodyStart`, and `govukAnalyticsConsentScripts` to `bodyEnd`.
Use the same macros directly in a standalone Nunjucks layout. See the
[template guide](templates.md) for full block and macro examples, plus the
[example views](../examples/views/index.njk) and [Hapi server](../examples/hapi/server.js).

## Content Security Policy

Create one configuration object before registering CSP middleware, then pass it to the plugin.
The package does not set CSP headers itself; `consent.blankieCsp` merges GTM and configured
[tag](../README.md#tags) origins without removing your existing sources:

```js
import Blankie from 'blankie'
import Scooter from '@hapi/scooter'
import consentPlugin from '@transform-uk/govuk-analytics-consent/hapi'
import { createGovUkAnalyticsConsent } from '@transform-uk/govuk-analytics-consent'

const consent = createGovUkAnalyticsConsent({ tags: ['google-analytics'] })

await server.register(Scooter)
await server.register({
  plugin: Blankie,
  options: consent.blankieCsp({
    generateNonces: true,
    scriptSrc: ['self'],
    connectSrc: ['self'],
    imgSrc: ['self'],
    fontSrc: ['self']
  })
})

await server.register({ plugin: consentPlugin, options: consent })
```

The plugin uses `request.plugins.blankie.nonces.script` automatically. Set `getNonce` to override
this when your service obtains its nonce elsewhere. Pass the nonce used by your CSP policy as
`cspNonce` to `h.view()` for GOV.UK Frontend's inline script; the host template does not need to
read it back from the consent context. Nonces avoid `'unsafe-inline'`; the GTM bootstrap
propagates its nonce to the remote script. Blankie users may also need GOV.UK Frontend's
published script hash in `scriptSrc`. For other CSP libraries, use `consent.csp`
directly or the exported `mergeCspDirectives`, `toBlankieCsp`, and `toHelmetCsp` helpers.
Tags configured only in GTM may require further origins.

## CSRF protection

The consent POST is not protected automatically. Register CSRF protection before this plugin
and cover `POST {routePrefix}/consent`. With [`@hapi/crumb`](https://github.com/hapijs/crumb),
provide the generated crumb to both consent forms:

```js
import Crumb from '@hapi/crumb'
import consentPlugin from '@transform-uk/govuk-analytics-consent/hapi'

await server.register({
  plugin: Crumb,
  options: { cookieOptions: { isSecure: process.env.NODE_ENV === 'production' } }
})
await server.register({
  plugin: consentPlugin,
  options: {
    getCsrfFormFields: (request) => ({ crumb: request.plugins.crumb })
  }
})
```

Crumb validates the POST before the package handler runs, so no
`verifyCsrfFormSubmission` callback is needed. Keep Crumb enabled for this route, use its
configured field name, and set its cookie `secure` option in production. Alternatively, supply
`verifyCsrfFormSubmission(request, body)` to validate the submitted form yourself; returning
`false` sends a `403`. Do not shared-cache HTML containing request-specific tokens.

## Rate limiting

Rate limiting complements CSRF protection but does not replace it. Install
[`hapi-rate-limit`](https://github.com/wraithgar/hapi-rate-limit) and register it before the
consent plugin. This example limits unauthenticated users by remote address to 120 requests per
route per minute:

```js
import rateLimit from 'hapi-rate-limit'
import consentPlugin from '@transform-uk/govuk-analytics-consent/hapi'

await server.register({
  plugin: rateLimit,
  options: { userLimit: false, pathLimit: false, userPathLimit: 120 }
})
await server.register(consentPlugin)
```

The default `userPathCache.expiresIn` is one minute. Configure `trustProxy` only when a trusted
proxy strips incoming forwarding headers and supplies the client address itself. Use a shared
store or an edge limit if you run multiple processes.

## Consent state and cookies page

Handlers can read `request.app.govukAnalyticsConsent` after registration. It exposes `state`,
`hasChoice`, and `isCategoryAccepted(categoryId)`:

```js
server.route({
  method: 'GET', path: '/recommendations',
  handler: (request, h) => request.app.govukAnalyticsConsent.isCategoryAccepted('personalization')
    ? h.view('recommendations.njk')
    : h.view('recommendations-without-personalization.njk')
})
```

Mount your own cookies-page route and render
`govukAnalyticsConsentCookiesPage(govukAnalyticsConsent)` in its content block. Configure
`cookiesPageUrl: '/cookies'` to link to that route from the banner. See the
[cookies-page example](../examples/views/cookies.njk) and [cookie configuration](../README.md#cookies-page).
For language selection and a per-request host translator, see [Localisation](localisation.md).