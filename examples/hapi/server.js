import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert'
import Vision from '@hapi/vision'
import nunjucks from 'nunjucks'
import {
  gaCookies,
  govukAnalyticsConsentPlugin,
  govukAnalyticsConsentTemplatePath
} from '../../dist/index.js'

const server = Hapi.server({ port: 3000, host: 'localhost' })

await server.register([Inert, Vision])

const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader([
    govukAnalyticsConsentTemplatePath(),
    'node_modules/govuk-frontend/dist',
    'examples/hapi/views'
  ])
)

server.views({
  engines: {
    njk: {
      compile: (src, opts) => {
        const template = new nunjucks.Template(src, env, opts.filename, true)
        return (context) => template.render(context)
      }
    }
  },
  relativeTo: process.cwd(),
  path: 'examples/hapi/views'
})

// Reads GTM_CONTAINER_ID and GA_MEASUREMENT_ID from the environment; gaCookies()
// uses the measurement ID when set, otherwise documents the generic GA4 row.
await server.register({
  plugin: govukAnalyticsConsentPlugin,
  options: {
    serviceName: 'Example service',
    cookiesPageUrl: '/cookies',
    categories: ['default', 'personalization'],
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
  }
})

server.route({
  method: 'GET',
  path: '/govuk-frontend/{param*}',
  options: { auth: false },
  handler: {
    directory: {
      path: 'node_modules/govuk-frontend/dist/govuk',
      index: false
    }
  }
})

server.route({
  method: 'GET',
  path: '/',
  handler: (request, h) => {
    const consent = request.app.govukAnalyticsConsent
    const personalizationMessage = consent.isCategoryAccepted('personalization')
      ? 'Personalisation cookies are enabled. This page can use your saved display preferences.'
      : consent.hasChoice
        ? 'Personalisation cookies are disabled. This page is using the default display settings.'
        : 'You have not chosen your cookie preferences yet. This page is using the default display settings.'

    return h.view('index.njk', { personalizationMessage })
  }
})

server.route({
  method: 'GET',
  path: '/cookies',
  handler: (_request, h) => h.view('cookies.njk')
})

await server.start()
console.log(`Listening on ${server.info.uri}`)
