# Repository guidance

## Architecture

- Do not add a production/runtime dependency without explicit user approval. Prefer Node.js built-ins and existing package capabilities.
- Packages used only by tests, examples, linting, or builds belong in `devDependencies`.
- Keep framework-neutral consent, cookie, and message behavior in `src/consent` or shared modules. Put framework-specific request/response wiring in `src/integrations`.
- Keep framework integrations optional. Do not make Hapi, Express, Fastify, GOV.UK Frontend, or security middleware a required runtime dependency.
- Built-in messages and overrides use the hierarchical `govuk-analytics-consent` catalogue. Do not reintroduce flat message aliases.
- Consent category IDs, cookie names, and other persisted consent identifiers must not vary with request language or translated display copy.
- The host application owns CSP policy, nonce generation, session configuration, and CSRF policy. Integrations may consume host-provided values and expose callbacks, but must not silently replace host policy.

## Changes and verification

- Keep changes focused; avoid editing generated `dist` output directly.
- Add or update tests for behavioral changes and keep documentation aligned with the public types and runtime behavior.
- Run `npm run typecheck` and the narrowest relevant tests after changes. Before completion, run `npm test` and `git diff --check` when feasible.
- For changes to examples, run the relevant `npm run example:*` command and verify security-sensitive behavior such as nonce/header agreement and CSRF rejection/acceptance.
