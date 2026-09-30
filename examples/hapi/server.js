import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert'
import Vision from '@hapi/vision'
import nunjucks from 'nunjucks'
import {
  createGovUkAnalyticsConsent,
  googleAnalytics,
  govukAnalyticsConsentPlugin,
  govukAnalyticsConsentTemplatePath
} from '../../dist/index.js'
import { exampleLanguage, languageCookieName, languageReturnUrl, languageView } from '../language.js'

const server = Hapi.server({ port: Number(process.env.PORT ?? 3000), host: 'localhost' })

await server.register([Inert, Vision])

const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader([
    govukAnalyticsConsentTemplatePath(),
    'node_modules/govuk-frontend/dist',
    'examples/views'
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
  path: 'examples/views'
})

// Reads GTM_CONTAINER_ID and GA_MEASUREMENT_ID from the environment; pass consent.blankieCsp(...) to Blankie if used.
const consent = createGovUkAnalyticsConsent({
  serviceName: 'Example service',
  cookiesPageUrl: '/cookies',
  categories: ['default', 'personalization'],
  tags: [googleAnalytics()],
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

await server.register({ plugin: govukAnalyticsConsentPlugin, options: consent })

server.route({
  method: 'GET',
  path: '/language/{language}',
  handler: (request, h) => {
    const language = request.params.language

    if (language !== 'en' && language !== 'cy') {
      return h.response().code(404)
    }

    return h.redirect(languageReturnUrl(request.query.returnUrl)).code(303).state(languageCookieName, language, {
      path: '/',
      isHttpOnly: true,
      isSameSite: 'Lax',
      isSecure: request.server.info.protocol === 'https',
      ttl: 365 * 24 * 60 * 60 * 1000
    })
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

    return h.view('index.njk', {
      personalizationMessage,
      ...languageView(request.headers.cookie, `${request.url.pathname}${request.url.search}`)
    })
  }
})

server.route({
  method: 'GET',
  path: '/cookies',
  handler: (request, h) => h.view('cookies.njk',
    languageView(request.headers.cookie, `${request.url.pathname}${request.url.search}`))
})

await server.start()
console.log(`Listening on ${server.info.uri}`)
