import express from 'express'
import { randomBytes } from 'node:crypto'
import helmet from 'helmet'
import session from 'express-session'
import { csrfSync } from 'csrf-sync'
import nunjucks from 'nunjucks'
import {
  createGovUkAnalyticsConsent,
  registerGovUkAnalyticsConsent,
  govukAnalyticsConsentTemplatePath
} from '../../dist/index.js'
import { exampleLanguage, languageCookieName, languageReturnUrl, languageView } from '../language.js'

// Standard Express setup: app and Nunjucks view engine.
const app = express()
const port = Number(process.env.PORT ?? 3000)

nunjucks.configure(
  [govukAnalyticsConsentTemplatePath(), 'node_modules/govuk-frontend/dist', 'examples/views'],
  { express: app, autoescape: true }
)

// Host CSRF middleware reads the field that the consent forms will render.
const { generateToken, csrfSynchronisedProtection } = csrfSync({
  getTokenFromRequest: (request) => request.body?._csrf
})

// Consent integration: declare categories and tags, then connect its nonce and form fields.
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
  getLanguage: (request) => exampleLanguage(request.headers.cookie),
  getNonce: (request) => request.res.locals.cspNonce,
  getCsrfFormFields: (request) => ({ _csrf: generateToken(request) })
})

// Host CSP, session, and CSRF middleware must run before consent mounts its routes.
app.use((request, response, next) => {
  response.locals.cspNonce = randomBytes(16).toString('base64')
  next()
})
app.use(helmet.contentSecurityPolicy({
  directives: consent.helmetCsp({
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", (_request, response) => `'nonce-${response.locals.cspNonce}'`],
    connectSrc: ["'self'"],
    imgSrc: ["'self'"]
  })
}))
app.use(session({
  secret: process.env.SESSION_SECRET ?? randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
}))
app.use(express.urlencoded({ extended: false }))
app.use('/govuk-analytics-consent/consent', csrfSynchronisedProtection)
// Consent installs request state, view locals, and its browser/form routes.
registerGovUkAnalyticsConsent(app, consent)

// Ordinary app middleware and routes provide language switching, assets, and pages.
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
  // Host code can use consent state when deciding what its own page displays.
  const consent = req.govukAnalyticsConsent
  const personalizationMessage = consent.isCategoryAccepted('personalization')
    ? 'Personalisation cookies are enabled. This page can use your saved display preferences.'
    : consent.hasChoice
      ? 'Personalisation cookies are disabled. This page is using the default display settings.'
      : 'You have not chosen your cookie preferences yet. This page is using the default display settings.'

  res.render('index.njk', { personalizationMessage })
})
// The host owns /cookies; consent supplies the fragment rendered by this view.
app.get('/cookies', (_req, res) => res.render('cookies.njk'))

app.listen(port, () => console.log(`Listening on http://localhost:${port}`))
