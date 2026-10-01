# Fastify integration

Install the [package](../README.md#install) and the adapter's optional dependencies, then set
`GTM_CONTAINER_ID=GTM-XXXXXXX`:

```sh
npm install --save fastify fastify-plugin
```

```js
import Fastify from 'fastify'
import consentPlugin from '@transform-uk/govuk-analytics-consent/fastify'

const app = Fastify()

await app.register(consentPlugin, {
  serviceName: 'Apply for a licence',
  tags: ['google-analytics']
})

app.get('/', (request, reply) => reply.view('index.njk', {
  govukAnalyticsConsent: request.govukAnalyticsConsentContext
}))
```

Fastify view plugins do not provide universal locals, so pass
`request.govukAnalyticsConsentContext` to each view. The plugin registers the consent routes and
parses URL-encoded consent forms; if a form parser is already registered, it reuses it.
Configure your view plugin with `govukAnalyticsConsentTemplatePath()` and GOV.UK Frontend's
templates in the Nunjucks search paths. Extend `govuk-analytics-consent/template.njk` instead of
`govuk/template.njk` for automatic head markup, noscript fallback, banner, and browser script:

```njk
{% extends "govuk-analytics-consent/template.njk" %}
{% block pageTitle %}Apply for a licence{% endblock %}
{% block content %}<h1 class="govuk-heading-xl">Apply for a licence</h1>{% endblock %}
```

If your view overrides `head`, `bodyStart`, or `bodyEnd`, call `super()` to retain consent
content. In a custom GOV.UK template, import the macros from
`govuk-analytics-consent/macro.njk`: add `govukAnalyticsConsentHead` to `head` before analytics
scripts, `govukAnalyticsConsentNoscript` and `govukAnalyticsConsentBanner` to `bodyStart`, and
`govukAnalyticsConsentScripts` to `bodyEnd`. Replace an existing cookie banner instead of
rendering two. See the [Fastify server](../examples/fastify/server.js) and
[example views](../examples/views/index.njk), or the [template guide](templates.md) for full
block and macro examples.

## Content Security Policy

Create the consent object before CSP registration and pass the same object to both plugins.
Register `@fastify/helmet` before consent. `consent.helmetCsp` merges GTM and configured
[tag](../README.md#tags) sources into your Helmet directives:

```js
import Fastify from 'fastify'
import helmet from '@fastify/helmet'
import consentPlugin from '@transform-uk/govuk-analytics-consent/fastify'
import { createGovUkAnalyticsConsent } from '@transform-uk/govuk-analytics-consent'

const app = Fastify()
const consent = createGovUkAnalyticsConsent({ tags: ['google-analytics'] })

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

The adapter reads `reply.cspNonce.script` when Helmet's nonce generation is enabled. To provide
your own nonce source, set `getNonce: (request) => ...`; that callback takes precedence. The
package does not set CSP headers itself. For other CSP libraries, use `consent.csp` or the
exported `mergeCspDirectives`, `toBlankieCsp`, and `toHelmetCsp` helpers. Tags configured only
in GTM may need additional sources. Nonces avoid `'unsafe-inline'`, and the GTM bootstrap
propagates its nonce to the remote script.

## CSRF protection

The consent POST is not protected automatically. Register the cookie and
[`@fastify/csrf-protection`](https://github.com/fastify/csrf-protection) plugins before consent.
The form token is in the parsed request body, so validate in `preValidation`, not `onRequest`:

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

The global hook validates unsafe requests, including the consent POST, before the package
handler. For route-specific protection, use `verifyCsrfFormSubmission` with your own token
verification function; returning `false` sends a `403`. Do not shared-cache HTML with
request-specific tokens. Keep the signing secret outside source control and use HTTPS in
production.

## Rate limiting

Rate limiting complements CSRF protection but does not replace it. Install
[`@fastify/rate-limit`](https://github.com/fastify/fastify-rate-limit) and register it before
consent:

```js
import rateLimit from '@fastify/rate-limit'
import consentPlugin from '@transform-uk/govuk-analytics-consent/fastify'

await app.register(rateLimit, { max: 120, timeWindow: '1 minute' })
await app.register(consentPlugin)
```

This sets a per-client limit on routes registered after the limiter. Use route-specific
configuration or a shared Redis store when the wider app needs a different policy. The package
itself does not impose a limit.

## Consent state and cookies page

Handlers can read `request.govukAnalyticsConsent`, which exposes `state`, `hasChoice`, and
`isCategoryAccepted(categoryId)`. `request.govukAnalyticsConsentContext` holds the view model:

```js
app.get('/recommendations', (request, reply) => {
  const template = request.govukAnalyticsConsent.isCategoryAccepted('personalization')
    ? 'recommendations.njk'
    : 'recommendations-without-personalization.njk'
  return reply.view(template, { govukAnalyticsConsent: request.govukAnalyticsConsentContext })
})
```

Mount a cookies-page route and render
`govukAnalyticsConsentCookiesPage(govukAnalyticsConsent)` in its content block. Set
`cookiesPageUrl: '/cookies'` to link to it from the banner. See the
[cookies-page example](../examples/views/cookies.njk) and [cookie configuration](../README.md#cookies-page).
For per-request language selection and host translators, see [Localisation](localisation.md).