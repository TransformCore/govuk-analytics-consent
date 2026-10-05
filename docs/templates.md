# GOV.UK page templates

## Required inputs

This guide contains Nunjucks template files, not server setup. Configure a view engine, template
search paths, and static asset routes using your framework guide first. Consent does not install
GOV.UK Frontend assets or create your cookies-page route.

| Input | Owner | Contract |
| --- | --- | --- |
| `govukAnalyticsConsent` | Consent integration | Request-specific view context; injected into Hapi views and Express locals, passed explicitly in Fastify |
| `cspNonce` | Host CSP middleware | When using nonce-based CSP, pass the same per-response script nonce authorized by the header; consent consumes it separately |
| GOV.UK template and assets | Host application | Make `govuk/template.njk` resolvable and serve the CSS, JavaScript, fonts, and images your layout references |
| `/cookies` page | Host application | Render the consent cookies-page macro and configure `cookiesPageUrl` to match your route |

## Package template

Add `govukAnalyticsConsentTemplatePath()` to your Nunjucks search paths as described in the
[Hapi](hapi.md), [Express](express.md), or [Fastify](fastify.md) guide. If your views use the
GOV.UK Frontend page template, extend the package template instead of `govuk/template.njk`:

```njk
{% extends "govuk-analytics-consent/template.njk" %}

{% block pageTitle %}Apply for a licence{% endblock %}

{% block content %}
  <h1 class="govuk-heading-xl">Apply for a licence</h1>
{% endblock %}
```

The package template extends `govuk/template.njk` and adds consent head markup, the noscript
fallback, cookie banner, and browser script to the appropriate GOV.UK blocks.

When CSP uses script nonces, the host application passes its per-response nonce as the
`cspNonce` view local. GOV.UK Frontend uses it for its inline feature-detection script; use the
same value for any inline scripts you add. Consent separately reads that nonce from the host's
CSP integration for its own scripts. The [Hapi](hapi.md), [Express](express.md), and
[Fastify](fastify.md) examples show how each framework supplies the view local.

If your view overrides `head`, `bodyStart`, or `bodyEnd`, call `super()` to retain the consent
content:

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

## Custom GOV.UK template

If you keep extending `govuk/template.njk` directly, add the existing macros to these blocks:

| GOV.UK block | Consent content |
| --- | --- |
| `head` | `govukAnalyticsConsentHead` |
| `bodyStart` | `govukAnalyticsConsentNoscript`, then `govukAnalyticsConsentBanner` |
| `bodyEnd` | `govukAnalyticsConsentScripts` |

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

Calling `super()` retains content from the parent template. Keep the head macro before analytics
scripts that depend on consent defaults and replace an existing banner rather than rendering
both. Use the same macros directly in standalone Nunjucks layouts that do not extend the GOV.UK
page template. Runnable layouts are in [examples/views](../examples/views/index.njk).

Without Nunjucks, the rendered `head`, `noscript`, `banner`, `cookiesPage`, and `scripts` are
available on the consent context. Express exposes it as `res.locals.govukAnalyticsConsent`,
Hapi injects it into view responses, and Fastify exposes it as
`request.govukAnalyticsConsentContext`.

## Verification

Confirm the page renders exactly one banner before a choice and no prompt after a stored choice.
Under nonce-based CSP, GOV.UK Frontend's feature-detection script, your inline scripts, and
consent scripts must use the nonce in that response's header. Check the browser console for CSP
violations and the network panel for missing assets. A cookies-page form must still submit with
JavaScript disabled, including the host's CSRF token when protection is enabled.