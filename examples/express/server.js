import express from 'express'
import nunjucks from 'nunjucks'
import {
  createGovUkAnalyticsConsent,
  googleAnalytics,
  registerGovUkAnalyticsConsent,
  govukAnalyticsConsentTemplatePath
} from '../../dist/index.js'
import { exampleLanguage, languageCookieName, languageReturnUrl, languageView } from '../language.js'

const app = express()
const port = Number(process.env.PORT ?? 3000)

nunjucks.configure(
  [govukAnalyticsConsentTemplatePath(), 'node_modules/govuk-frontend/dist', 'examples/views'],
  { express: app, autoescape: true }
)

// Reads GTM_CONTAINER_ID and GA_MEASUREMENT_ID from the environment; pass consent.helmetCsp(...) to Helmet if used.
const consent = createGovUkAnalyticsConsent({
  serviceName: 'Example service',
  cookiesPageUrl: '/cookies',
  categories: ['default', 'personalization'],
  tags: ['google-analytics'],
  gtmAllowlist: ['auto'],
  cookies: [
    { name: 'session_id', categoryId: 'essential', purpose: 'Keeps you signed in', expiry: 'Session' },
    { name: languageCookieName, categoryId: 'essential', purpose: 'Remembers your language choice', expiry: '1 year' },
    {
      name: 'example_preferences',
      categoryId: 'personalization',
      purpose: 'Remembers your display preferences',
      expiry: '1 year'
    }
  ],
  getLanguage: (request) => exampleLanguage(request.headers.cookie)
})

registerGovUkAnalyticsConsent(app, consent)

app.use((req, res, next) => {
  Object.assign(res.locals, languageView(req.headers.cookie, req.originalUrl))
  next()
})

app.use('/govuk-frontend', express.static('node_modules/govuk-frontend/dist/govuk'))

app.get('/language/:language', (req, res) => {
  const language = req.params.language

  if (language !== 'en' && language !== 'cy') {
    res.sendStatus(404)
    return
  }

  res.cookie(languageCookieName, language, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: 365 * 24 * 60 * 60 * 1000
  })
  res.redirect(303, languageReturnUrl(req.query.returnUrl))
})

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

app.listen(port, () => console.log(`Listening on http://localhost:${port}`))
