import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert'
import Vision from '@hapi/vision'
import nunjucks from 'nunjucks'
import { registerGovUkAnalyticsConsent, govukAnalyticsConsentTemplatePath } from '../../dist/index.js'

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

// Reads GTM_CONTAINER_ID from the environment; the consent cookie and GA rows are
// documented automatically, so only the service's own session cookie needs adding.
registerGovUkAnalyticsConsent(server, {
  serviceName: 'Example service',
  cookiesPageUrl: '/cookies',
  cookies: [
    { name: 'session_id', categoryId: 'essential', purpose: 'Keeps you signed in', expiry: 'Session' }
  ],
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
  handler: (_request, h) => h.view('index.njk')
})

server.route({
  method: 'GET',
  path: '/cookies',
  handler: (_request, h) => h.view('cookies.njk')
})

await server.start()
console.log(`Listening on ${server.info.uri}`)
