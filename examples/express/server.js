import express from 'express'
import nunjucks from 'nunjucks'
import { registerGovUkAnalyticsConsent, govukAnalyticsConsentTemplatePath } from '../../dist/index.js'

const app = express()

nunjucks.configure(
  [govukAnalyticsConsentTemplatePath(), 'node_modules/govuk-frontend/dist', 'examples/express/views'],
  { express: app, autoescape: true }
)

// Reads GTM_CONTAINER_ID from the environment; everything else is optional.
registerGovUkAnalyticsConsent(app, { serviceName: 'Example service' })

app.use('/govuk-frontend', express.static('node_modules/govuk-frontend/dist/govuk'))

app.get('/', (_req, res) => res.render('index.njk'))

app.listen(3000, () => console.log('Listening on http://localhost:3000'))
