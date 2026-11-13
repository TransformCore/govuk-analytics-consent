# govuk-analytics-consent-audit

Audit cookies observed on a deployed service against its consent configuration. Optional checks
cover individual categories and consent withdrawal. Requires Node.js 20 or newer.

## Quick start

```sh
npx --package=govuk-analytics-consent-audit playwright install chromium
npx govuk-analytics-consent-audit --url https://service.example.gov.uk --output report.json
```

Pin the same package version for both commands in repeatable or unattended runs. Browser binaries
are cached separately and are not downloaded automatically.

The browser always runs with its sandbox enabled. On Ubuntu, the audit tries installed Chrome
Stable if bundled Chromium is unavailable or cannot start its sandbox. For CI, install Chrome with
`npx --package=govuk-analytics-consent-audit playwright install --with-deps chrome`. See the
[full guide](https://github.com/TransformCore/govuk-analytics-consent/blob/main/docs/auditing.md#scheduled-ci-checks)
for setup details.

## Configuration

For the library integration, set `auditEnabled: true`; the CLI reads resolved declarations from
`/govuk-analytics-consent/audit.json`. For another banner, supply a local JSON policy with
`"mode": "custom"`. Use `--categories` for category and withdrawal checks, and repeat
`--ignore-cookie` only for reviewed undeclared-cookie exceptions.

## Results

Undeclared cookies found in browser storage are failures. Undeclared `Set-Cookie` headers are
warnings because the browser may block them. Reports omit cookie values. Exit codes are `0` for
completed checks without failures, `1` for cookie-policy failures and `2` for incomplete audits
or invalid setup. Results are bounded observations, not legal certification.

See the [full auditing guide](https://github.com/TransformCore/govuk-analytics-consent/blob/main/docs/auditing.md)
for options, JSON policies, coverage limits and security considerations.