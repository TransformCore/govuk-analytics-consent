import fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import nunjucks from 'nunjucks'
import { resolve } from 'node:path'
import { gaCookies, govukAnalyticsConsentTemplatePath } from '../../dist/index.js'
import govukAnalyticsConsentFastifyPlugin from '../../dist/integrations/fastify.js'
import { exampleLanguage, languageCookieName, languageReturnUrl, languageView } from '../language.js'

const app = fastify({ logger: true })
const port = Number(process.env.PORT ?? 3000)
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader([
  govukAnalyticsConsentTemplatePath(),
  'node_modules/govuk-frontend/dist',
  'examples/views'
]), { autoescape: true })

await app.register(fastifyStatic, {
  root: resolve('node_modules/govuk-frontend/dist/govuk'),
  prefix: '/govuk-frontend/'
})

await app.register(govukAnalyticsConsentFastifyPlugin, {
  serviceName: 'Example service',
  cookiesPageUrl: '/cookies',
  categories: ['default', 'personalization'],
  cookies: [
    gaCookies(),
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

app.get('/language/:language', (request, reply) => {
  const language = request.params.language

  if (language !== 'en' && language !== 'cy') {
    return reply.code(404).send()
  }

  const secure = request.protocol === 'https' ? '; Secure' : ''
  reply.header('set-cookie', `${languageCookieName}=${language}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`)

  return reply.code(303).redirect(languageReturnUrl(request.query.returnUrl))
})

app.get('/', (request, reply) => {
  const consent = request.govukAnalyticsConsent
  const personalizationMessage = consent.isCategoryAccepted('personalization')
    ? 'Personalisation cookies are enabled. This page can use your saved display preferences.'
    : consent.hasChoice
      ? 'Personalisation cookies are disabled. This page is using the default display settings.'
      : 'You have not chosen your cookie preferences yet. This page is using the default display settings.'

  return reply.type('text/html').send(env.render('index.njk', {
    govukAnalyticsConsent: request.govukAnalyticsConsentContext,
    personalizationMessage,
    ...languageView(request.headers.cookie, request.raw.url)
  }))
})

app.get('/cookies', (request, reply) => reply.type('text/html').send(env.render('cookies.njk', {
  govukAnalyticsConsent: request.govukAnalyticsConsentContext,
  ...languageView(request.headers.cookie, request.raw.url)
})))

await app.listen({ port, host: 'localhost' })
