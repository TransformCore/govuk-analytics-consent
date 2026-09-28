import express from 'express'
import nunjucks from 'nunjucks'
import {
  defaultCategories,
  gaCookies,
  personalizationCategory,
  registerGovUkAnalyticsConsent,
  govukAnalyticsConsentTemplatePath
} from '../../dist/index.js'

const app = express()

nunjucks.configure(
  [govukAnalyticsConsentTemplatePath(), 'node_modules/govuk-frontend/dist', 'examples/express/views'],
  { express: app, autoescape: true }
)

// Reads GTM_CONTAINER_ID and GA_MEASUREMENT_ID from the environment; gaCookies()
// uses the measurement ID when set, otherwise documents the generic GA4 row.
registerGovUkAnalyticsConsent(app, {
  serviceName: 'Example service',
  cookiesPageUrl: '/cookies',
  categories: [...defaultCategories, personalizationCategory],
  cookies: [
    gaCookies(),
    { name: 'session_id', categoryId: 'essential', purpose: 'Keeps you signed in', expiry: 'Session' },
    {
      name: 'example_preferences',
      categoryId: 'personalization',
      purpose: 'Remembers your display preferences',
      expiry: '1 year'
    }
  ]
})

app.use('/govuk-frontend', express.static('node_modules/govuk-frontend/dist/govuk'))

app.get('/', (req, res) => {
  const consent = req.govukAnalyticsConsent
  const personalizationMessage = consent.isCategoryAccepted('personalization')
    ? 'Personalisation cookies are enabled. This page can use your saved display preferences.'
    : consent.hasChoice
      ? 'Personalisation cookies are disabled. This page is using the default display settings.'
      : 'You have not chosen your cookie preferences yet. This page is using the default display settings.'

  res.render('index.njk', { personalizationMessage })
})
app.get('/cookies', (_req, res) => res.render('cookies.njk'))

app.listen(3000, () => console.log('Listening on http://localhost:3000'))
