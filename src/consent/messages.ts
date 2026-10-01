import type { ConsentMessages } from './types.js'

export const defaultMessages = {
  en: {
    bannerTitle: 'Cookies on {serviceName}',
    bannerIntro: 'We use some essential cookies to make this service work.',
    bannerAdditional:
      "We'd also like to use additional cookies so we can understand how you use the service and make improvements.",
    acceptAll: 'Accept all cookies',
    rejectAll: 'Reject additional cookies',
    viewCookies: 'View cookies',
    accepted: "You've accepted additional cookies.",
    rejected: "You've rejected additional cookies.",
    changeSettings: 'Change your cookie settings',
    cookiesPageTitle: 'Cookies',
    cookiesPageIntro:
      "{serviceName} puts small files (known as 'cookies') onto your device to make the service work and to understand how it's used.",
    essentialCookies: 'These cookies always run.',
    categoryQuestion: 'Do you want to accept {label} cookies?',
    saveSettings: 'Save cookie settings',
    successBanner: "You've set your cookie preferences.",
    successBannerLink: 'Go back to the page you were looking at',
    essentialCategoryTitle: 'Strictly necessary cookies',
    essentialCategoryDescription:
      'These essential cookies do things like remember your progress through a form. They always need to be on.',
    analyticsCategoryTitle: 'Cookies that measure website use',
    analyticsCategoryDescription:
      'These cookies help us understand how the service is used so we can improve it.',
    gaTagDescription:
      'We use Google Analytics to measure how you use the service so we can improve it based on user needs. ' +
      'We do not allow Google to use or share the data about how you use this site.',
    advertisingCategoryTitle: 'Cookies that help with our communications and marketing',
    advertisingCategoryDescription:
      'These cookies help us understand how well our communications and marketing work and make them more relevant.',
    functionalityCategoryTitle: 'Cookies that enable additional functionality',
    functionalityCategoryDescription:
      'These cookies enable optional features that improve how the service works.',
    personalizationCategoryTitle: 'Cookies that remember your settings',
    personalizationCategoryDescription:
      'These cookies remember choices you make so the service can provide features and content suited to you.',
    defaultCookiePurpose: 'Saves your cookie consent settings',
    gaCookiePurpose: 'These help us count how many people visit the service by tracking if you’ve visited before',
    gaSessionCookiePurpose: 'Used by Google Analytics to find and track an individual session with your device',
    gaCookieProvider: 'Google Analytics',
    gaCookieExpiry: '2 years',
    hotjarTagDescription:
      'We use Hotjar to understand how people use the service, including which pages they visit and how they interact with them, so we can improve it.',
    hotjarSessionUserCookiePurpose: 'Used by Hotjar to recognise you when you return to the service',
    hotjarSessionCookiePurpose: 'Used by Hotjar to link together the pages you visit in a single session',
    hotjarCookiePurpose: 'Used by Hotjar to test browser support and store details about your session',
    hotjarCookieProvider: 'Hotjar',
    hotjarSessionUserCookieExpiry: '1 year',
    hotjarSessionCookieExpiry: '30 minutes',
    hotjarCookieExpiry: 'Up to 1 year',
    clarityUserCookiePurpose: 'Used by Microsoft Clarity to recognise you when you return to the service',
    claritySessionCookiePurpose: 'Used by Microsoft Clarity to link together the pages you visit in a single session',
    clarityClidCookiePurpose: 'Set by Microsoft Clarity to recognise your browser across sites that use Clarity',
    clarityMuidCookiePurpose: 'Set by Microsoft to recognise your browser across Microsoft sites',
    clarityCookieProvider: 'Microsoft Clarity',
    clarityUserCookieExpiry: '1 year',
    claritySessionCookieExpiry: '1 day',
    tableHeaderName: 'Name',
    tableHeaderPurpose: 'Purpose',
    tableHeaderExpiry: 'Expires',
    yesLabel: 'Yes',
    noLabel: 'No',
    hideMessage: 'Hide this message',
    successTitle: 'Success'
  },
  cy: {
    bannerTitle: 'Cwcis ar {serviceName}',
    bannerIntro: 'Rydym yn defnyddio rhai cwcis hanfodol i wneud i’r gwasanaeth hwn weithio.',
    bannerAdditional:
      'Hoffem hefyd ddefnyddio cwcis ychwanegol er mwyn deall sut rydych chi’n defnyddio’r gwasanaeth a gwella’r gwasanaeth.',
    acceptAll: 'Derbyn pob cwci',
    rejectAll: 'Gwrthod cwcis ychwanegol',
    viewCookies: 'Gweld cwcis',
    accepted: 'Rydych chi wedi derbyn cwcis ychwanegol.',
    rejected: 'Rydych chi wedi gwrthod cwcis ychwanegol.',
    changeSettings: 'Newid eich gosodiadau cwcis',
    cookiesPageTitle: 'Cwcis',
    cookiesPageIntro:
      "Mae {serviceName} yn rhoi ffeiliau bach (a elwir yn 'cwcis') ar eich dyfais i wneud i'r gwasanaeth weithio ac i ddeall sut mae'n cael ei ddefnyddio.",
    essentialCookies: 'Mae’r cwcis hyn bob amser yn rhedeg.',
    categoryQuestion: 'Ydych chi eisiau derbyn cwcis {label}?',
    saveSettings: 'Cadw gosodiadau cwcis',
    successBanner: 'Rydych chi wedi gosod eich dewisiadau cwcis.',
    successBannerLink: 'Ewch yn ôl i’r dudalen roeddech chi’n edrych arni',
    essentialCategoryTitle: 'Cwcis angenrheidiol',
    essentialCategoryDescription:
      'Mae’r cwcis hanfodol hyn yn gwneud pethau fel cofio eich cynnydd drwy ffurflen. Maent bob amser angen bod ymlaen.',
    analyticsCategoryTitle: 'Cwcis sy’n mesur defnydd o’r wefan',
    analyticsCategoryDescription:
      'Mae’r cwcis hyn yn ein helpu i ddeall sut mae’r gwasanaeth yn cael ei ddefnyddio er mwyn ei wella.',
    gaTagDescription:
      'Rydym yn defnyddio Google Analytics i fesur sut rydych chi’n defnyddio’r gwasanaeth fel y gallwn ei wella yn seiliedig ar anghenion defnyddwyr. ' +
      'Nid ydym yn caniatáu i Google ddefnyddio neu rannu’r data am sut rydych chi’n defnyddio’r safle.',
    advertisingCategoryTitle: 'Cwcis sy’n helpu gyda’n cyfathrebiadau a’n marchnata',
    advertisingCategoryDescription:
      'Mae’r cwcis hyn yn ein helpu i ddeall pa mor dda y mae ein cyfathrebiadau a’n marchnata yn gweithio ac i’w gwneud yn fwy perthnasol.',
    functionalityCategoryTitle: 'Cwcis sy’n galluogi swyddogaethau ychwanegol',
    functionalityCategoryDescription:
      'Mae’r cwcis hyn yn galluogi nodweddion dewisol sy’n gwella sut mae’r gwasanaeth yn gweithio.',
    personalizationCategoryTitle: 'Cwcis sy’n cofio eich gosodiadau',
    personalizationCategoryDescription:
      'Mae’r cwcis hyn yn cofio’r dewisiadau rydych yn eu gwneud fel y gall y gwasanaeth ddarparu nodweddion a chynnwys sy’n addas i chi.',
    defaultCookiePurpose: 'Yn cadw eich gosodiadau cwcis',
    gaCookiePurpose: 'Defnyddir i wahaniaethu defnyddwyr.',
    gaSessionCookiePurpose: 'Defnyddir i gadw cyflwr sesiwn ar gyfer Google Analytics.',
    gaCookieProvider: 'Google Analytics',
    gaCookieExpiry: '2 flynedd',
    hotjarTagDescription:
      'Rydym yn defnyddio Hotjar i ddeall sut mae pobl yn defnyddio’r gwasanaeth, gan gynnwys pa dudalennau maent yn ymweld â nhw a sut maent yn rhyngweithio â nhw, er mwyn i ni allu ei wella.',
    hotjarSessionUserCookiePurpose: 'Defnyddir gan Hotjar i’ch adnabod pan fyddwch yn dychwelyd i’r gwasanaeth',
    hotjarSessionCookiePurpose: 'Defnyddir gan Hotjar i gysylltu’r tudalennau rydych yn ymweld â nhw mewn un sesiwn',
    hotjarCookiePurpose: 'Defnyddir gan Hotjar i brofi cefnogaeth porwr a storio manylion am eich sesiwn',
    hotjarCookieProvider: 'Hotjar',
    hotjarSessionUserCookieExpiry: '1 flwyddyn',
    hotjarSessionCookieExpiry: '30 munud',
    hotjarCookieExpiry: 'Hyd at 1 flwyddyn',
    clarityUserCookiePurpose: 'Defnyddir gan Microsoft Clarity i’ch adnabod pan fyddwch yn dychwelyd i’r gwasanaeth',
    claritySessionCookiePurpose: 'Defnyddir gan Microsoft Clarity i gysylltu’r tudalennau rydych yn ymweld â nhw mewn un sesiwn',
    clarityClidCookiePurpose: 'Gosodir gan Microsoft Clarity i adnabod eich porwr ar draws gwefannau sy’n defnyddio Clarity',
    clarityMuidCookiePurpose: 'Gosodir gan Microsoft i adnabod eich porwr ar draws gwefannau Microsoft',
    clarityCookieProvider: 'Microsoft Clarity',
    clarityUserCookieExpiry: '1 flwyddyn',
    claritySessionCookieExpiry: '1 diwrnod',
    tableHeaderName: 'Enw',
    tableHeaderPurpose: 'Pwrpas',
    tableHeaderExpiry: 'Yn dod i ben',
    yesLabel: 'Ie',
    noLabel: 'Na',
    hideMessage: 'Cuddio’r neges hon',
    successTitle: 'Llwyddiant'
  }
} satisfies Record<'en' | 'cy', ConsentMessages>

export type LanguageCode = keyof typeof defaultMessages
export type LocalizedMessages = Partial<Record<LanguageCode, Partial<ConsentMessages>>>

export function selectLanguage(language: string): LanguageCode {
  const code = /^([a-z]{2})(?:-[a-z0-9]+)*$/i.exec(language)?.[1]?.toLowerCase()

  return code !== undefined && Object.hasOwn(defaultMessages, code) ? code as LanguageCode : 'en'
}

export function negotiateLanguage(acceptLanguage?: string): LanguageCode {
  let selected: LanguageCode | undefined
  let bestQuality = 0

  for (const range of acceptLanguage?.split(',') ?? []) {
    const match = /^\s*([a-z]{2})(?:-[a-z0-9]+)*(?:\s*;\s*q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?\s*$/i.exec(range)
    const code = match?.[1]?.toLowerCase()
    const quality = match?.[2] === undefined ? 1 : Number(match[2])

    if (code !== undefined && Object.hasOwn(defaultMessages, code) && quality > bestQuality) {
      selected = code as LanguageCode
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

export function resolveMessages(language: string = 'en', messages: LocalizedMessages = {}): ConsentMessages {
  const selectedLanguage: LanguageCode = Object.hasOwn(defaultMessages, language)
    ? language as LanguageCode
    : 'en'

  return { ...defaultMessages[selectedLanguage], ...messages[selectedLanguage] }
}