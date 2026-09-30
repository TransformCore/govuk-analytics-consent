import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert'
import Vision from '@hapi/vision'
import nunjucks from 'nunjucks'
import { gaCookies, govukAnalyticsConsentPlugin, govukAnalyticsConsentTemplatePath } from '../../dist/index.js'

const port = Number(process.env.PORT ?? 3000)
const extraCategories = (process.env.EXTRA_COOKIE_CATEGORIES ?? '').split(',').map((id) => id.trim()).filter(Boolean)
const categories = ['default', ...extraCategories]
const usesPersonalization = extraCategories.includes('personalization')
const server = Hapi.server({ port, host: 'localhost' })
await server.register([Inert, Vision])

const env = new nunjucks.Environment(new nunjucks.FileSystemLoader([
  govukAnalyticsConsentTemplatePath(),
  'node_modules/govuk-frontend/dist',
  'examples/views'
]))
server.views({
  engines: { njk: { compile: (src, opts) => {
    const template = new nunjucks.Template(src, env, opts.filename, true)
    return (context) => template.render(context)
  } } },
  relativeTo: process.cwd(),
  path: 'examples/views'
})

await server.register({
  plugin: govukAnalyticsConsentPlugin,
  options: {
    serviceName: 'Example service',
    cookiesPageUrl: '/cookies',
    categories,
    cookies: [
      gaCookies(),
      { name: 'session_id', categoryId: 'essential', purpose: 'Keeps you signed in', expiry: 'Session' },
      ...(usesPersonalization ? [{ name: 'example_preferences', categoryId: 'personalization', purpose: 'Remembers your display preferences', expiry: '1 year' }] : []),
      ...(extraCategories.includes('advertising') ? [{ name: 'example_advertising', categoryId: 'advertising', purpose: 'Tests advertising cookie removal', expiry: '1 year' }] : []),
      ...(extraCategories.includes('functionality') ? [{ name: 'example_functionality', categoryId: 'functionality', purpose: 'Tests functionality cookie removal', expiry: '1 year' }] : [])
    ],
    getLanguage: () => 'cy'
  }
})
server.route({ method: 'GET', path: '/govuk-frontend/{param*}', options: { auth: false }, handler: { directory: { path: 'node_modules/govuk-frontend/dist/govuk', index: false } } })
server.route({ method: 'GET', path: '/', handler: (request, h) => {
  const consent = request.app.govukAnalyticsConsent
  const personalizationMessage = !usesPersonalization
    ? 'This service does not use personalisation cookies.'
    : consent.isCategoryAccepted('personalization')
      ? 'Personalisation cookies are enabled. This page can use your saved display preferences.'
      : consent.hasChoice
        ? 'Personalisation cookies are disabled. This page is using the default display settings.'
        : 'You have not chosen your cookie preferences yet. This page is using the default display settings.'
  return h.view('index.njk', { personalizationMessage })
} })
server.route({ method: 'GET', path: '/cookies', handler: (_request, h) => h.view('cookies.njk') })
await server.start()
console.log(`Listening on ${server.info.uri}`)