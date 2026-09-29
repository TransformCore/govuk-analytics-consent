import express from 'express'
import nunjucks from 'nunjucks'
import {
  defaultCategories,
  gaCookies,
  registerGovUkAnalyticsConsent,
  govukAnalyticsConsentTemplatePath
} from '../../dist/index.js'

const port = Number(process.env.PORT ?? 3000)
const extraCategories = (process.env.EXTRA_COOKIE_CATEGORIES ?? '').split(',').map((id) => id.trim()).filter(Boolean)
const categories = ['default', ...extraCategories]
const usesPersonalization = extraCategories.includes('personalization')
const app = express()

nunjucks.configure(
  [govukAnalyticsConsentTemplatePath(), 'node_modules/govuk-frontend/dist', 'examples/views'],
  { express: app, autoescape: true }
)

registerGovUkAnalyticsConsent(app, {
  serviceName: 'Example service',
  cookiesPageUrl: '/cookies',
  categories,
  cookies: [
    gaCookies(),
    { name: 'session_id', categoryId: 'essential', purpose: 'Keeps you signed in', expiry: 'Session' },
    ...(usesPersonalization ? [{ name: 'example_preferences', categoryId: 'personalization', purpose: 'Remembers your display preferences', expiry: '1 year' }] : []),
    ...(extraCategories.includes('advertising') ? [{ name: 'example_advertising', categoryId: 'advertising', purpose: 'Tests advertising cookie removal', expiry: '1 year' }] : []),
    ...(extraCategories.includes('functionality') ? [{ name: 'example_functionality', categoryId: 'functionality', purpose: 'Tests functionality cookie removal', expiry: '1 year' }] : [])
  ]
})

app.use('/govuk-frontend', express.static('node_modules/govuk-frontend/dist/govuk'))
app.get('/', (req, res) => {
  const consent = req.govukAnalyticsConsent
  const personalizationMessage = !usesPersonalization
    ? 'This service does not use personalisation cookies.'
    : consent.isCategoryAccepted('personalization')
      ? 'Personalisation cookies are enabled. This page can use your saved display preferences.'
      : consent.hasChoice
        ? 'Personalisation cookies are disabled. This page is using the default display settings.'
        : 'You have not chosen your cookie preferences yet. This page is using the default display settings.'
  res.render('index.njk', { personalizationMessage })
})
app.get('/cookies', (_req, res) => res.render('cookies.njk'))
app.listen(port, () => console.log(`Listening on http://localhost:${port}`))