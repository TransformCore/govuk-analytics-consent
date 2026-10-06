import fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import helmet from '@fastify/helmet'
import cookie from '@fastify/cookie'
import csrfProtection from '@fastify/csrf-protection'
import nunjucks from 'nunjucks'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import {
  createGovUkAnalyticsConsent,
  govukAnalyticsConsentTemplatePath
} from '../../dist/index.js'
import govukAnalyticsConsentFastifyPlugin from '../../dist/integrations/fastify.js'
import { exampleLanguage, languageCookieName, languageReturnUrl, languageView } from '../language.js'

// Standard Fastify setup: app, Nunjucks views, and GOV.UK static assets.
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

// Consent integration: declare categories, tags, and the CSRF field for its forms.
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
  getCsrfFormFields: async (_request, reply) => ({ _csrf: await reply.generateCsrf() })
})

// Host security plugins share consent's CSP sources and protect its form route.
await app.register(helmet, {
  enableCSPNonces: true,
  contentSecurityPolicy: {
    directives: consent.helmetCsp({
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'"],
      frameSrc: ["'self'"]
    })
  }
})
await app.register(cookie, { secret: process.env.COOKIE_SECRET ?? randomBytes(32).toString('hex') })
await app.register(csrfProtection, {
  cookieOpts: { signed: true, path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
})
// Validate after form parsing; GET pages must remain free to generate CSRF tokens.
app.addHook('preValidation', (request, reply, done) => {
  if (request.method === 'POST' && request.url.split('?')[0] === '/govuk-analytics-consent/consent') {
    app.csrfProtection(request, reply, done)
  } else {
    done()
  }
})
// Consent installs its routes and request-scoped view context.
await app.register(govukAnalyticsConsentFastifyPlugin, consent)

// Ordinary service routes handle the language switch and render the example pages.
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
  // The host may inspect consent state to decide what its own page displays.
  const consent = request.govukAnalyticsConsent
  const personalizationMessage = consent.isCategoryAccepted('personalization')
    ? 'Personalisation cookies are enabled. This page can use your saved display preferences.'
    : consent.hasChoice
      ? 'Personalisation cookies are disabled. This page is using the default display settings.'
      : 'You have not chosen your cookie preferences yet. This page is using the default display settings.'

  return reply.type('text/html').send(env.render('index.njk', {
    cspNonce: reply.cspNonce.script,
    govukAnalyticsConsent: request.govukAnalyticsConsentContext,
    personalizationMessage,
    ...languageView(request.headers.cookie, request.raw.url)
  }))
})

// The host owns /cookies; consent provides the fragment via the view context.
app.get('/cookies', (request, reply) => reply.type('text/html').send(env.render('cookies.njk', {
  cspNonce: reply.cspNonce.script,
  govukAnalyticsConsent: request.govukAnalyticsConsentContext,
  ...languageView(request.headers.cookie, request.raw.url)
})))

await app.listen({ port, host: 'localhost' })
