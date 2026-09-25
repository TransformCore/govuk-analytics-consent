import express from 'express'
import nunjucks from 'nunjucks'
import { registerGovUkAnalyticsConsent, govukAnalyticsConsentTemplatePath } from '../../dist/index.js'

const app = express()

nunjucks.configure(
  [govukAnalyticsConsentTemplatePath(), 'node_modules/govuk-frontend/dist', 'examples/express/views'],
  { express: app, autoescape: true }
)

// Reads GTM_CONTAINER_ID from the environment; the consent cookie and GA rows are
// documented automatically, so only the service's own session cookie needs adding.
registerGovUkAnalyticsConsent(app, {
  serviceName: 'Example service',
  cookiesPageUrl: '/cookies',
  cookies: [
    { name: 'session_id', categoryId: 'essential', purpose: 'Keeps you signed in', expiry: 'Session' }
  ]
})

app.use('/govuk-frontend', express.static('node_modules/govuk-frontend/dist/govuk'))

app.get('/', (_req, res) => res.render('index.njk'))
app.get('/cookies', (_req, res) => res.render('cookies.njk'))

app.listen(3000, () => console.log('Listening on http://localhost:3000'))
