import { join } from 'node:path'
import { packageRoot } from '../shared/package-root.js'

/** Add this to your Nunjucks search paths to make the consent templates available. */
export function govukAnalyticsConsentTemplatePath(): string {
  return join(packageRoot(), 'src', 'ui', 'templates')
}

export const MACRO_IMPORT_PATH = 'govuk-analytics-consent/macro.njk'
export const PAGE_TEMPLATE_IMPORT_PATH = 'govuk-analytics-consent/template.njk'
