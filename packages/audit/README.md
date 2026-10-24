# govuk-analytics-consent-audit

Development tooling to check cookies observed on a deployed service against the same consent
configuration used by its web server. Supports optional per-category and withdrawal checks.

Requires Node.js 20 or newer. The default workflow uses a deployed consent integration with
`auditEnabled: true`; independent banners can use a local JSON policy instead.

Run directly with `npx`; no local or global package installation or service source code is needed:

```sh
npx --package=govuk-analytics-consent-audit playwright install chromium
npx govuk-analytics-consent-audit --url https://service.example.gov.uk --output cookie-audit-report.json
```

The first command installs matching Chromium binaries using the Playwright included with this
tool. Binaries are cached separately; repeat setup when a tool upgrade requires a new browser
revision. Pin the same published package version in both commands for reproducible runs, and
add `--yes` to `npx` in unattended CI jobs.

Chromium runs with its sandbox enabled and is never retried without it. Containers and CI must
provide sandbox support, browser system dependencies and a non-root user. Missing binaries or
launch failures produce a setup error with exit code `2`; no browser is downloaded automatically.

Set `auditEnabled: true` in the server's existing consent options. The tool reads resolved
declarations from `/govuk-analytics-consent/audit.json`; no local application configuration
or duplicate cookie inventory is needed. For a custom route prefix, use
`--audit-path /your-prefix/audit.json`. The endpoint is disabled by default and publishes no
cookie values, tokens or callbacks. Keep any host access policy in place.

Add `--categories` to derive the category scenarios and cookies-page path from that configuration.
`--page` is repeatable; `--help` lists the remaining options. Advanced JSON policies remain
available with `--config`.

For another GOV.UK cookie banner implementation, use `--config` with `"mode": "custom"`. By default
it finds buttons starting with “Accept” and “Reject” inside `.govuk-cookie-banner`; set
`banner.acceptSelector` and/or `banner.rejectSelector` in the JSON policy to override either
locator. The `banner` object is optional when the defaults work. This requires no library
integration or site changes. The audit observes cookies before and after clicking the controls
and revisiting pages, but does not verify that consent was saved or enforced. All cookies must be
declared, including the consent cookie. Custom mode checks undeclared cookies, not granular
categories or withdrawal.
See the [custom banner example](https://github.com/TransformCore/govuk-analytics-consent/blob/main/docs/auditing.md#other-govuk-cookie-banners).

For explicit undeclared-cookie exceptions, repeat `--ignore-cookie 'AWSALB*'` or supply
`ignoreCookies` in JSON configuration. Quote globs; only `*` is special. Ignored cookies remain
visible in the table and JSON report as informational findings, with the matching pattern.
These local rules do not bypass category checks for declared cookies. Prefer narrow patterns
or declaring the cookies properly; see the full guide for details.

Progress is printed by default as each scenario runs, including navigation, observation and
consent changes. After a complete audit, declarations not observed in browser storage produce
`INFO` findings. These are informational only, not proof that a cookie is never set, and do not
change the exit code. Wildcard and domain/path matching apply across all scenarios.

Before the final summary, a cookie table lists declarations and observations with category IDs,
matching patterns, scopes and stored/header-only/not-observed status. Categories are shown even
without `--categories`. Repeated observations are combined; undeclared cookies and incomplete
coverage are clearly labelled. Cookie values are never displayed.

Exit codes are `0` for completed checks without failures, `1` for observed cookie-policy failures,
and `2` for invalid configuration or incomplete checks. Unconfirmed `Set-Cookie` attempts warn;
stored undeclared cookies fail. Cookie values and URL query strings are not included in reports.
Results are bounded observations, not legal certification.

JSON reports are written atomically with private permissions. Output files must not be
symbolic links or aliases of the input configuration.

See the [full auditing guide](https://github.com/TransformCore/govuk-analytics-consent/blob/main/docs/auditing.md)
for endpoint configuration, CI scheduling and coverage limits.

The web library does not ship this CLI or depend on browser tooling. Local installation as a
development dependency remains an alternative for lockfile-managed CI; see the full guide.