# Auditing deployed cookies

Use `govuk-analytics-consent-audit` to check cookies observed on your service against its
declared cookies. The audit visits selected pages in fresh Chromium sessions before a consent
choice, after rejecting optional cookies and after accepting them. Cookies must be declared
even after acceptance.

This is a regression check, not certification of legal compliance.

## Quick start

Requires Node.js 20 or newer.

Add `auditEnabled: true` to your server's existing consent options. For Hapi and Fastify, add
it to the plugin options. See the [Express example](../examples/express/server.js).

This enables `GET /govuk-analytics-consent/audit.json`, which publishes the service's resolved
cookie declarations, including tag presets and generated definitions. It is disabled by
default and does not expose cookie values, tokens or callbacks. Existing host access controls
still apply. The CLI requests the endpoint anonymously, so it must be reachable without
credentials.

Install the matching browser, then run the audit without installing the tool locally:

```sh
npx --package=govuk-analytics-consent-audit playwright install chromium
npx govuk-analytics-consent-audit --url https://service.example.gov.uk --output report.json
```

Chromium binaries are cached separately from npm packages. Repeat browser setup when a tool
upgrade requires a new browser revision. Browsers are never downloaded automatically; missing
binaries produce installation guidance and exit code `2`.

## Options

```sh
npx govuk-analytics-consent-audit --url https://service.example.gov.uk \
  --page / --page /start --categories --output report.json
```

| Option | Purpose |
| --- | --- |
| `--url <origin>` | Service origin, such as `https://service.example.gov.uk`; no credentials, path, query or fragment |
| `--page <path>` | Page to visit; repeatable, defaults to `/` |
| `--categories` | Also check individual categories and withdrawal of consent |
| `--cookies-page <path>` | Override `cookiesPageUrl` for category checks; requires `--categories` |
| `--audit-path <path>` | Override the endpoint path when using a custom `routePrefix` |
| `--ignore-cookie <glob>` | Explicit exception for undeclared cookies; repeatable |
| `--observation-ms <number>` | Observation window per page/stage; defaults to `2000`, accepts `100`-`60000` |
| `--timeout-ms <number>` | Timeout per operation; defaults to `30000`, accepts `100`-`120000` |
| `--output <file>` | Write a JSON report in addition to terminal output |
| `--config <file>` | Use a standalone JSON policy instead of the deployed endpoint |
| `--help` | Show command usage |

Page, settings-page and endpoint paths must be same-origin paths. For example, a server with
`routePrefix: '/consent-tools'` needs `--audit-path /consent-tools/audit.json`.

### Category checks

With `--categories`, the audit checks each optional category individually and tests accepting
then withdrawing consent through the cookies-page form. Set `cookiesPageUrl` on the server or
supply `--cookies-page`. The real forms are used without bypassing CSRF protection.

Declared cookies must not appear while their category is denied. Essential cookies remain
allowed. A cookie is not required to appear merely because its category was accepted.

## Results

The CLI prints live progress, then a cookie table, findings and a final summary. The table
shows names, category IDs, matching declarations, scopes and whether cookies were stored,
seen only in response headers or not observed. Categories are shown even without `--categories`.

- `FAILURE`: an undeclared stored cookie or a declared cookie violating an enabled category check.
- `WARNING`: an undeclared `Set-Cookie` attempt; the browser may have blocked or deleted it.
- `INFO`: a declared cookie was not observed during a completed audit, or an undeclared cookie matched an explicit ignore rule.
- `ERROR`: a setup or execution problem prevented a complete audit.

"Not observed" describes this audit only; it does not prove the cookie is never set.
Incomplete audits mark the table as partial and do not report declarations as unobserved.

| Exit code | Meaning |
| --- | --- |
| `0` | Audit completed without failures; warnings and information may still be present |
| `1` | Cookie-policy failures were observed |
| `2` | Invalid configuration, missing browser, report-write failure or incomplete audit |

Incomplete results take precedence over failures. Do not treat exit `2` as a pass.

Reports omit cookie values and page URL queries/fragments, but cookie names and paths can
still contain identifiers. Protect report artifacts accordingly. Output files are written
atomically with private permissions; symbolic links and aliases of the input configuration
are rejected.

## Cookie exceptions

For reviewed exceptions, repeat `--ignore-cookie` with an exact name or a glob:

```sh
npx govuk-analytics-consent-audit --url https://service.example.gov.uk \
  --ignore-cookie 'AWSALB*' --ignore-cookie 'edge_session'
```

Quote patterns to prevent shell expansion. Matching is case-sensitive and covers the whole
cookie name; only `*` is special. Name exceptions apply across all domains, paths and partitions.
Use narrow patterns: `'*'` suppresses every undeclared-cookie failure.

Exceptions only affect undeclared cookies, not category checks for declared cookies or audit
errors. Ignored cookies remain visible in the table and JSON report, along with the matching
pattern. Rules are supplied by the caller, not the deployed endpoint. Prefer declaring cookies
in the service configuration when appropriate.

## JSON policy

Use `--config` for a separate policy, for example to constrain cookie domains or paths:

```sh
npx govuk-analytics-consent-audit --config consent-audit.json --output report.json
```

```json
{
  "url": "https://service.example.gov.uk",
  "pages": ["/"],
  "cookies": [
    { "name": "connect.sid", "categoryId": "essential", "domain": "service.example.gov.uk", "path": "/" },
    { "name": "_ga_<id>", "match": "_ga_*", "categoryId": "analytics" }
  ],
  "ignoreCookies": ["AWSALB*"]
}
```

`cookies` is required and may be empty. Names match exactly unless `match` supplies a star-only
glob. Domains match exactly, ignoring case and a leading dot; paths match exactly. Omitted
domain/path constraints allow any scope. The deployed endpoint uses name-based declarations.
The mode defaults to `library`, which audits the GOV.UK Analytics Consent integration and
recognizes its discovered consent cookie as essential at the target hostname and `/`. Set
`"mode": "custom"` to audit another banner. Other session, infrastructure and third-party
cookies must be declared or explicitly ignored.

Optional fields include `observationMs`, `timeoutMs`, `cookieName` and `cookieVersion`. Add
`categories` (objects containing `id` and optional `essential`) plus `cookiesPage` to enable
category checks. Unknown fields are rejected.

JSON mode cannot be combined with remote endpoint flags. `--ignore-cookie` can be used in
either mode; its patterns are appended to JSON `ignoreCookies`, with duplicates removed.

### Other GOV.UK cookie banners

For a service with its own banner implementation, set `mode` to `custom` in a JSON policy. No
library integration, metadata script or audit endpoint is needed, and the service does not need
changes:

```json
{
  "mode": "custom",
  "url": "https://service.example.gov.uk",
  "pages": ["/", "/start"],
  "cookies": [
    { "name": "cookie_preferences", "categoryId": "essential" },
    { "name": "_ga", "categoryId": "analytics" },
    { "name": "_ga_<id>", "match": "_ga_*", "categoryId": "analytics" }
  ]
}
```

The `mode` defaults to `library`; set it to `custom` to audit another banner. `banner` is only
needed when overriding a control locator; otherwise the audit uses its default selectors. Run
the policy with `--config` as above. By default, the audit looks inside `.govuk-cookie-banner`
for buttons whose accessible names start with “Accept” and “Reject”. To use different controls,
provide `acceptSelector` and/or `rejectSelector` inside `banner`, for example:

```json
{
  "mode": "custom",
  "url": "https://service.example.gov.uk",
  "cookies": [],
  "banner": {
    "acceptSelector": "#accept-cookies",
    "rejectSelector": "#reject-cookies"
  }
}
```

Each configured selector must identify one visible button. JavaScript controls and
server-rendered form submissions are supported; host CSRF protection is not bypassed.

The tool clicks each configured control and observes cookies before and after the click, including
on configured page revisits. Missing or ambiguous controls produce an incomplete audit. It does
not verify that a click saved or enforced consent: a no-op click or nonpersistent choice can still
complete if no other audit error occurs. Treat these as cookie-observation journeys, not proof
that consent behavior is correct.

Declare all cookies, including the site's consent cookie: custom mode has no automatic
exemptions. It checks for undeclared cookies before choice, after attempting rejection and after
attempting acceptance. Category IDs are labels only in this mode; category enforcement, granular
choices and withdrawal are not checked. Omit `categories`, `cookiesPage`, `cookieName` and
`cookieVersion`.

## Scheduled CI checks

Use the same `npx` commands in a scheduled job, adding `--yes` to avoid installation prompts:

```sh
npx --yes --package=govuk-analytics-consent-audit playwright install chromium
npx --yes govuk-analytics-consent-audit --url https://service.example.gov.uk --output report.json
```

Pin the same published package version in both commands for repeatable runs, and retain the
report even when the command fails. Choose representative pages and an observation window
appropriate for the service.

Chromium runs with sandboxing enabled. Containers and CI need a non-root user, sandbox support
and the browser's system dependencies. On suitably provisioned Linux runners, install these
with `npx --package=govuk-analytics-consent-audit playwright install --with-deps chromium`.
Use a low-privilege environment with appropriate network access: live pages execute third-party
JavaScript.

For lockfile-managed tooling, local installation is an alternative:

```sh
npm install --save-dev govuk-analytics-consent-audit
npx playwright install chromium
```

Then run the CLI through an npm script. CI should use `npm ci` including development dependencies.

## Coverage limits

Results cover only the selected pages, anonymous journeys, Chromium and the observation windows.
Short-lived cookies, delayed scripts, browser blocking, service workers, geography and conditional
journeys can affect what is observed. An observed `Set-Cookie` header is not proof of storage.

The audit does not crawl, log in, exercise other application forms, inspect local/session storage,
classify tracking requests or validate Consent Mode signals. It uses live third-party scripts
and may generate real analytics events; agree suitable targets with the service owner.

Keep declarations and reviewed exceptions current when the service changes. Do not automatically
approve newly discovered cookies just to obtain a pass.