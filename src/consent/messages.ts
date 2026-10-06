import type { ConsentMessages } from './types.js'

export const defaultMessages = {
  en: {
    banner: {
      title: 'Cookies on {serviceName}',
      intro: 'We use some essential cookies to make this service work.',
      additional: "We'd also like to use additional cookies so we can understand how you use the service and make improvements.",
      acceptAll: 'Accept all cookies',
      rejectAll: 'Reject additional cookies',
      viewCookies: 'View cookies',
      accepted: "You've accepted additional cookies.",
      rejected: "You've rejected additional cookies.",
      hide: 'Hide this message'
    },
    cookies: {
      title: 'Cookies',
      intro: "{serviceName} puts small files (known as 'cookies') onto your device to make the service work and to understand how it's used.",
      essential: 'These cookies always run.',
      categoryQuestion: 'Do you want to accept {label} cookies?',
      changeSettings: 'Change your cookie settings',
      saveSettings: 'Save cookie settings',
      successBanner: "You've set your cookie preferences.",
      successBannerLink: 'Go back to the page you were looking at',
      successTitle: 'Success',
      yes: 'Yes',
      no: 'No',
      consent: { purpose: 'Saves your cookie consent settings' },
      table: { name: 'Name', purpose: 'Purpose', expiry: 'Expires' }
    },
    categories: {
      essential: {
        title: 'Strictly necessary cookies',
        description: 'These essential cookies do things like remember your progress through a form. They always need to be on.'
      },
      analytics: {
        title: 'Cookies that measure website use',
        description: 'These cookies help us understand how the service is used so we can improve it.'
      },
      advertising: {
        title: 'Cookies that help with our communications and marketing',
        description: 'These cookies help us understand how well our communications and marketing work and make them more relevant.'
      },
      functionality: {
        title: 'Cookies that enable additional functionality',
        description: 'These cookies enable optional features that improve how the service works.'
      },
      personalization: {
        title: 'Cookies that remember your settings',
        description: 'These cookies remember choices you make so the service can provide features and content suited to you.'
      }
    },
    tags: {
      'google-analytics': {
        description: 'We use Google Analytics to measure how you use the service so we can improve it based on user needs. ' +
          'We do not allow Google to use or share the data about how you use this site.',
        provider: 'Google Analytics',
        expiry: '2 years',
        cookies: {
          ga: { purpose: 'These help us count how many people visit the service by tracking if you’ve visited before' },
          session: { purpose: 'Used by Google Analytics to find and track an individual session with your device' }
        }
      },
      hotjar: {
        description: 'We use Hotjar to understand how people use the service, including which pages they visit and how they interact with them, so we can improve it.',
        provider: 'Hotjar',
        cookies: {
          sessionUser: { purpose: 'Used by Hotjar to recognise you when you return to the service', expiry: '1 year' },
          session: { purpose: 'Used by Hotjar to link together the pages you visit in a single session', expiry: '30 minutes' },
          other: { purpose: 'Used by Hotjar to test browser support and store details about your session', expiry: 'Up to 1 year' }
        }
      },
      'microsoft-clarity': {
        provider: 'Microsoft Clarity',
        cookies: {
          user: { purpose: 'Used by Microsoft Clarity to recognise you when you return to the service', expiry: '1 year' },
          session: { purpose: 'Used by Microsoft Clarity to link together the pages you visit in a single session', expiry: '1 day' },
          clid: { purpose: 'Set by Microsoft Clarity to recognise your browser across sites that use Clarity' },
          muid: { purpose: 'Set by Microsoft to recognise your browser across Microsoft sites' }
        }
      }
    }
  },
  cy: {
    banner: {
      title: 'Cwcis ar {serviceName}',
      intro: 'Rydym yn defnyddio rhai cwcis hanfodol i wneud i’r gwasanaeth hwn weithio.',
      additional: 'Hoffem hefyd ddefnyddio cwcis ychwanegol er mwyn deall sut rydych chi’n defnyddio’r gwasanaeth a gwella’r gwasanaeth.',
      acceptAll: 'Derbyn pob cwci',
      rejectAll: 'Gwrthod cwcis ychwanegol',
      viewCookies: 'Gweld cwcis',
      accepted: 'Rydych chi wedi derbyn cwcis ychwanegol.',
      rejected: 'Rydych chi wedi gwrthod cwcis ychwanegol.',
      hide: 'Cuddio’r neges hon'
    },
    cookies: {
      title: 'Cwcis',
      intro: "Mae {serviceName} yn rhoi ffeiliau bach (a elwir yn 'cwcis') ar eich dyfais i wneud i'r gwasanaeth weithio ac i ddeall sut mae'n cael ei ddefnyddio.",
      essential: 'Mae’r cwcis hyn bob amser yn rhedeg.',
      categoryQuestion: 'Ydych chi eisiau derbyn cwcis {label}?',
      changeSettings: 'Newid eich gosodiadau cwcis',
      saveSettings: 'Cadw gosodiadau cwcis',
      successBanner: 'Rydych chi wedi gosod eich dewisiadau cwcis.',
      successBannerLink: 'Ewch yn ôl i’r dudalen roeddech chi’n edrych arni',
      successTitle: 'Llwyddiant',
      yes: 'Ie',
      no: 'Na',
      consent: { purpose: 'Yn cadw eich gosodiadau cwcis' },
      table: { name: 'Enw', purpose: 'Pwrpas', expiry: 'Yn dod i ben' }
    },
    categories: {
      essential: {
        title: 'Cwcis angenrheidiol',
        description: 'Mae’r cwcis hanfodol hyn yn gwneud pethau fel cofio eich cynnydd drwy ffurflen. Maent bob amser angen bod ymlaen.'
      },
      analytics: {
        title: 'Cwcis sy’n mesur defnydd o’r wefan',
        description: 'Mae’r cwcis hyn yn ein helpu i ddeall sut mae’r gwasanaeth yn cael ei ddefnyddio er mwyn ei wella.'
      },
      advertising: {
        title: 'Cwcis sy’n helpu gyda’n cyfathrebiadau a’n marchnata',
        description: 'Mae’r cwcis hyn yn ein helpu i ddeall pa mor dda y mae ein cyfathrebiadau a’n marchnata yn gweithio ac i’w gwneud yn fwy perthnasol.'
      },
      functionality: {
        title: 'Cwcis sy’n galluogi swyddogaethau ychwanegol',
        description: 'Mae’r cwcis hyn yn galluogi nodweddion dewisol sy’n gwella sut mae’r gwasanaeth yn gweithio.'
      },
      personalization: {
        title: 'Cwcis sy’n cofio eich gosodiadau',
        description: 'Mae’r cwcis hyn yn cofio’r dewisiadau rydych yn eu gwneud fel y gall y gwasanaeth ddarparu nodweddion a chynnwys sy’n addas i chi.'
      }
    },
    tags: {
      'google-analytics': {
        description: 'Rydym yn defnyddio Google Analytics i fesur sut rydych chi’n defnyddio’r gwasanaeth fel y gallwn ei wella yn seiliedig ar anghenion defnyddwyr. ' +
          'Nid ydym yn caniatáu i Google ddefnyddio neu rannu’r data am sut rydych chi’n defnyddio’r safle.',
        provider: 'Google Analytics',
        expiry: '2 flynedd',
        cookies: {
          ga: { purpose: 'Defnyddir i wahaniaethu defnyddwyr.' },
          session: { purpose: 'Defnyddir i gadw cyflwr sesiwn ar gyfer Google Analytics.' }
        }
      },
      hotjar: {
        description: 'Rydym yn defnyddio Hotjar i ddeall sut mae pobl yn defnyddio’r gwasanaeth, gan gynnwys pa dudalennau maent yn ymweld â nhw a sut maent yn rhyngweithio â nhw, er mwyn i ni allu ei wella.',
        provider: 'Hotjar',
        cookies: {
          sessionUser: { purpose: 'Defnyddir gan Hotjar i’ch adnabod pan fyddwch yn dychwelyd i’r gwasanaeth', expiry: '1 flwyddyn' },
          session: { purpose: 'Defnyddir gan Hotjar i gysylltu’r tudalennau rydych yn ymweld â nhw mewn un sesiwn', expiry: '30 munud' },
          other: { purpose: 'Defnyddir gan Hotjar i brofi cefnogaeth porwr a storio manylion am eich sesiwn', expiry: 'Hyd at 1 flwyddyn' }
        }
      },
      'microsoft-clarity': {
        provider: 'Microsoft Clarity',
        cookies: {
          user: { purpose: 'Defnyddir gan Microsoft Clarity i’ch adnabod pan fyddwch yn dychwelyd i’r gwasanaeth', expiry: '1 flwyddyn' },
          session: { purpose: 'Defnyddir gan Microsoft Clarity i gysylltu’r tudalennau rydych yn ymweld â nhw mewn un sesiwn', expiry: '1 diwrnod' },
          clid: { purpose: 'Gosodir gan Microsoft Clarity i adnabod eich porwr ar draws gwefannau sy’n defnyddio Clarity' },
          muid: { purpose: 'Gosodir gan Microsoft i adnabod eich porwr ar draws gwefannau Microsoft' }
        }
      }
    }
  }
} satisfies Record<'en' | 'cy', ConsentMessages>

export type LanguageCode = keyof typeof defaultMessages
export type MessageTree = { [key: string]: string | MessageTree }
export type LocalizedMessages = Partial<Record<string, { 'govuk-analytics-consent'?: MessageTree }>>

export const MESSAGE_PREFIX = 'govuk-analytics-consent.'

export interface TranslationContext {
  language: string
  request?: unknown
  response?: unknown
  values?: Record<string, string>
}

export type MessageTranslator = (key: string, context: TranslationContext) => string | undefined

export function createMessageResolver(
  language: string,
  messages: LocalizedMessages = {},
  translate?: MessageTranslator,
  request?: unknown,
  response?: unknown
): (key: string, fallback?: string, values?: Record<string, string>) => string {
  return (key, fallback, values) => {
    const translated = translate?.(key, { language, request, response, values })
    const parts = key.startsWith(MESSAGE_PREFIX) ? key.slice(MESSAGE_PREFIX.length).split('.') : []
    const baseLanguage = language.split('-')[0] ?? 'en'
    const locales = [language, baseLanguage]

    if (!Object.hasOwn(defaultMessages, baseLanguage)) {
      locales.push('en')
    }
    let entry: string | MessageTree | undefined

    for (const locale of locales) {
      entry = messages[locale]?.['govuk-analytics-consent']

      for (const part of parts) {
        entry = entry !== undefined && typeof entry !== 'string' && Object.hasOwn(entry, part)
          ? entry[part] : undefined
      }

      if (typeof entry === 'string') break
    }

    const selected = translated === undefined || translated === key
      ? typeof entry === 'string' ? entry : fallback
      : translated

    if (selected === undefined) {
      throw new Error(`Missing translation for "${key}" (${language})`)
    }

    return selected.replace(/\{\{?(\w+)\}?\}/g, (placeholder, name: string) => values?.[name] ?? placeholder)
  }
}

export function selectLanguage(language: string, allowHostLanguage = false): string {
  const normalized = language.trim().toLowerCase()
  const code = /^([a-z]{2})(?:-[a-z0-9]+)*$/i.exec(normalized)?.[1]

  return allowHostLanguage && code !== undefined ? normalized
    : code !== undefined && Object.hasOwn(defaultMessages, code) ? code : 'en'
}

export function negotiateLanguage(acceptLanguage?: string, allowHostLanguage = false): string {
  let selected: string | undefined
  let bestQuality = 0

  for (const range of acceptLanguage?.split(',') ?? []) {
    const match = /^\s*([a-z]{2})(?:-[a-z0-9]+)*(?:\s*;\s*q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?\s*$/i.exec(range)
    const code = match?.[1]?.toLowerCase()
    const quality = match?.[2] === undefined ? 1 : Number(match[2])

    if (code !== undefined && (allowHostLanguage || Object.hasOwn(defaultMessages, code)) && quality > bestQuality) {
      selected = allowHostLanguage ? match?.[0]?.trim().split(';')[0]?.toLowerCase() : code
      bestQuality = quality
    }
  }

  return selected ?? 'en'
}

export function getDefaultMessages(language: string): ConsentMessages {
  return Object.hasOwn(defaultMessages, language)
    ? defaultMessages[language as keyof typeof defaultMessages]
    : defaultMessages.en
}

export function resolveMessages(
  language: string = 'en', messages: LocalizedMessages = {}, translate?: MessageTranslator,
  request?: unknown, response?: unknown
): ConsentMessages {
  const baseLanguage = language.split('-')[0] ?? 'en'
  const selectedLanguage: LanguageCode = Object.hasOwn(defaultMessages, baseLanguage)
    ? baseLanguage as LanguageCode
    : 'en'

  const resolve = createMessageResolver(language, messages, translate, request, response)

  const resolveTree = (tree: MessageTree, path: string): MessageTree => Object.fromEntries(
    Object.entries(tree).map(([key, value]) => {
      const childPath = path === '' ? key : `${path}.${key}`
      return [key, typeof value === 'string'
        ? resolve(`${MESSAGE_PREFIX}${childPath}`, value)
        : resolveTree(value, childPath)]
    })
  )

  return resolveTree(defaultMessages[selectedLanguage], '') as unknown as ConsentMessages
}