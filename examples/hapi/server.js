import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert'
import Vision from '@hapi/vision'
import Crumb from '@hapi/crumb'
import Scooter from '@hapi/scooter'
import Blankie from 'blankie'
import nunjucks from 'nunjucks'
import {
  createGovUkAnalyticsConsent,
  govukAnalyticsConsentPlugin,
  govukAnalyticsConsentTemplatePath
} from '../../dist/index.js'
import { exampleLanguage, languageCookieName, languageReturnUrl, languageView } from '../language.js'

// Standard Hapi setup: server, static files, and Nunjucks views.
const server = Hapi.server({ port: Number(process.env.PORT ?? 3000), host: 'localhost' })

await server.register([Inert, Vision, Scooter])

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

// Consent integration: describe the categories, tags, and cookies this service uses.
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
  getCsrfFormFields: (request) => ({ crumb: request.plugins.crumb })
})

// Host security middleware: merge consent's CSP sources and issue CSRF tokens before registration.
await server.register({
  plugin: Blankie,
  options: consent.blankieCsp({
    generateNonces: true,
    scriptSrc: ['self'],
    connectSrc: ['self'],
    imgSrc: ['self'],
    fontSrc: ['self']
  })
})
await server.register({
  plugin: Crumb,
  options: { cookieOptions: { isSecure: process.env.NODE_ENV === 'production' } }
})
// The consent plugin installs its routes and injects context into Hapi views.
await server.register({ plugin: govukAnalyticsConsentPlugin, options: consent })

// Ordinary service routes: language switching and GOV.UK assets belong to the host application.
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
    // Host handlers can use the request's consent state to select their own content.
    const consent = request.app.govukAnalyticsConsent
    const personalizationMessage = consent.isCategoryAccepted('personalization')
      ? 'Personalisation cookies are enabled. This page can use your saved display preferences.'
      : consent.hasChoice
        ? 'Personalisation cookies are disabled. This page is using the default display settings.'
        : 'You have not chosen your cookie preferences yet. This page is using the default display settings.'

    return h.view('index.njk', {
      cspNonce: request.plugins.blankie.nonces.script,
      personalizationMessage,
      ...languageView(request.headers.cookie, `${request.url.pathname}${request.url.search}`)
    })
  }
})

server.route({
  method: 'GET',
  path: '/cookies',
  // The host owns this route; the template renders the consent-provided cookies fragment.
  handler: (request, h) => h.view('cookies.njk', {
    cspNonce: request.plugins.blankie.nonces.script,
    ...languageView(request.headers.cookie, `${request.url.pathname}${request.url.search}`)
  })
})

await server.start()
console.log(`Listening on ${server.info.uri}`)
