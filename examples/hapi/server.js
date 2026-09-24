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

// Reads GTM_CONTAINER_ID from the environment; everything else is optional.
registerGovUkAnalyticsConsent(server, { serviceName: 'Example service' })

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

await server.start()
console.log(`Listening on ${server.info.uri}`)
