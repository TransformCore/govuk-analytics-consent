# Express integration

## Prerequisites and scope

These snippets modify an existing Express `app`; they are not complete server programs. They
assume the referenced view files exist. Security snippets are alternatives or additions to
registration, not commands to register consent repeatedly. Combine selected options and register
consent once. Use the [Express example](../examples/express/server.js) for a runnable application,
and the [options reference](../README.md#options) for callback contracts.

```sh
npm install @transform-uk/govuk-analytics-consent express nunjucks govuk-frontend
# Optional security middleware; choose one CSRF recipe:
npm install helmet express-session csrf-sync express-rate-limit
# For the alternative double-submit recipe:
npm install csrf-csrf cookie-parser
```

## Registration and views

Install the [package](../README.md#install), set `GTM_CONTAINER_ID=GTM-XXXXXXX`, and register
the Nunjucks templates and consent middleware:

```js
import nunjucks from 'nunjucks'
import {
  registerGovUkAnalyticsConsent,
  govukAnalyticsConsentTemplatePath
} from '@transform-uk/govuk-analytics-consent'

nunjucks.configure([govukAnalyticsConsentTemplatePath(), 'node_modules/govuk-frontend/dist', 'views'], {
  express: app
})

registerGovUkAnalyticsConsent(app, {
  serviceName: 'Apply for a licence',
  tags: ['google-analytics']
})
```

Express has no plugin contract: `registerGovUkAnalyticsConsent(app, options)` installs its
middleware and routes. It puts the context in `res.locals.govukAnalyticsConsent` for subsequent
views. Extend `govuk-analytics-consent/template.njk` instead of `govuk/template.njk` to add the
head markup, noscript fallback, banner, and browser script automatically:

```njk
{% extends "govuk-analytics-consent/template.njk" %}
{% block pageTitle %}Apply for a licence{% endblock %}
{% block content %}<h1 class="govuk-heading-xl">Apply for a licence</h1>{% endblock %}
```

If your view overrides `head`, `bodyStart`, or `bodyEnd`, call `super()` to retain the consent
content. Replace an existing banner rather than displaying two. In a custom GOV.UK template,
import the macros from `govuk-analytics-consent/macro.njk`: add `govukAnalyticsConsentHead` to
`head` before analytics scripts, `govukAnalyticsConsentNoscript` and
`govukAnalyticsConsentBanner` to `bodyStart`, and `govukAnalyticsConsentScripts` to `bodyEnd`.
Use them directly in a standalone Nunjucks layout. Without Nunjucks, read `head`, `noscript`,
`banner`, `cookiesPage`, and `scripts` from `res.locals.govukAnalyticsConsent`. See the
[template guide](templates.md) for full block and macro examples, plus the
[example views](../examples/views/index.njk) and [Express server](../examples/express/server.js).

## Content Security Policy

Create the consent object before registering CSP middleware, then pass the same object to
Express. `consent.helmetCsp` merges GTM and declared [tag](../README.md#tags) origins without
removing existing directives. Generate a nonce per response and share it with Helmet and the
consent scripts:

```js
import crypto from 'node:crypto'
import helmet from 'helmet'
import {
  createGovUkAnalyticsConsent,
  registerGovUkAnalyticsConsent
} from '@transform-uk/govuk-analytics-consent'

const consent = createGovUkAnalyticsConsent({
  tags: ['google-analytics'],
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

Express makes `res.locals.cspNonce` available to Nunjucks directly; the consent callback reads
the same host-generated value for its scripts. The template does not need to obtain it from the
consent context. The package does not set CSP headers itself. For other CSP libraries, read
`consent.csp` or use the exported `mergeCspDirectives`, `toBlankieCsp`, and `toHelmetCsp` helpers. Tags configured
only in GTM may require more origins. Nonces avoid `'unsafe-inline'`; the GTM bootstrap propagates
its nonce to the remote script. GOV.UK Frontend's published script hash, if required, belongs in
your own CSP configuration.

## CSRF protection

The consent POST is not protected automatically. Register session middleware, a URL-encoded body
parser, and CSRF middleware before consent registration. Cover `POST {routePrefix}/consent` and
provide its token in both generated forms. For [`csrf-sync`](https://github.com/Psifi-Solutions/csrf-sync):

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

Alternatively, [`csrf-csrf`](https://github.com/Psifi-Solutions/csrf-csrf) uses a signed
double-submit cookie. Use one recipe, not both:

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

These middleware validate the POST before the package handler; do not also set
`verifyCsrfFormSubmission`. For application-specific validation, use that callback instead;
returning `false` sends a `403`. The browser-enhanced banner currently records its choice
client-side, so these recipes protect the cookies-page POST and the banner's native no-JavaScript
form. Configure `sessionMiddleware` yourself, register `cookie-parser` after `express-session`
when both are used, keep secrets outside source control, and never shared-cache token-bearing
HTML.

`sessionMiddleware` in these recipes is your configured `express-session` middleware; it is
not exported by this package. `config.csrfSecret` is a host-provided secret, not a literal value
to copy. Configure a production session store and HTTPS cookie settings; the runnable example's
in-memory store and generated startup secret are only suitable for local development.

## Rate limiting

Rate limiting complements CSRF protection but does not replace it. Install
[`express-rate-limit`](https://github.com/express-rate-limit/express-rate-limit), mount it on the
consent route, then register consent:

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

Adjust the route when you change `routePrefix`. Use a shared store or edge limit when running
multiple processes.

## Consent state and cookies page

Handlers registered after consent middleware can use `req.govukAnalyticsConsent`, which exposes
`state`, `hasChoice`, and `isCategoryAccepted(categoryId)`:

```js
app.get('/recommendations', (req, res) => {
  if (!req.govukAnalyticsConsent.isCategoryAccepted('personalization')) {
    return res.render('recommendations-without-personalization.njk')
  }
  return res.render('recommendations.njk')
})
```

Mount your own cookies-page route and render
`govukAnalyticsConsentCookiesPage(govukAnalyticsConsent)` in its content block. Configure
`cookiesPageUrl: '/cookies'` to link to it from the banner. See the
[cookies-page example](../examples/views/cookies.njk) and [cookie configuration](../README.md#cookies-page).
For per-request language selection and host translators, see [Localisation](localisation.md).

## Integration checklist

1. Configure Nunjucks search paths and static GOV.UK assets. Choose CSP and one CSRF strategy.
2. Generate the host nonce before Helmet and consent. Configure session middleware, form parsing,
  CSRF validation, and any rate limiter before consent registration. Host i18n also runs first.
3. Register consent once, then application routes. Consent supplies `req.govukAnalyticsConsent`
  and `res.locals.govukAnalyticsConsent`; the host supplies `res.locals.cspNonce` independently.
4. Extend the package template or add its macros without rendering a duplicate banner. Mount
  `/cookies` and set `cookiesPageUrl` if needed.
5. With CSRF enabled, verify a missing-token consent POST returns `403` and a valid form POST
  returns `303` with a consent cookie. With CSP enabled, every script nonce must match the
  response header and browser tools must show no CSP violations.
6. Test JavaScript-disabled form submission and concurrent requests in different languages.
  Do not shared-cache nonce- or token-bearing HTML. See [Development](../README.md#development).