import type { ConsentMessages } from './types.js'

export const defaultMessages: ConsentMessages = {
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
    'We use Google Analytics to measure how you use the service so we can improve it based on user needs. ' +
    'We do not allow Google to use or share the data about how you use this site.',
  defaultCookiePurpose: 'Saves your cookie consent settings.',
  gaCookiePurpose: 'These help us count how many people visit the service by tracking if you’ve visited before',
  gaSessionCookiePurpose: 'Used by Google Analytics to find and track an individual session with your device',
  tableHeaderName: 'Name',
  tableHeaderPurpose: 'Purpose',
  tableHeaderExpiry: 'Expires',
  yesLabel: 'Yes',
  noLabel: 'No',
  hideMessage: 'Hide this message',
  successTitle: 'Success'
}

export const welshMessages: ConsentMessages = {
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
    'Rydym yn defnyddio Google Analytics i fesur sut rydych chi’n defnyddio’r gwasanaeth fel y gallwn ei wella yn seiliedig ar anghenion defnyddwyr. ' +
    'Nid ydym yn caniatáu i Google ddefnyddio neu rannu’r data am sut rydych chi’n defnyddio’r safle.',
  defaultCookiePurpose: 'Yn cadw eich gosodiadau cwcis.',
  gaCookiePurpose: 'Defnyddir i wahaniaethu defnyddwyr.',
  gaSessionCookiePurpose: 'Defnyddir i gadw cyflwr sesiwn ar gyfer Google Analytics.',
  tableHeaderName: 'Enw',
  tableHeaderPurpose: 'Pwrpas',
  tableHeaderExpiry: 'Yn dod i ben',
  yesLabel: 'Ie',
  noLabel: 'Na',
  hideMessage: 'Cuddio’r neges hon',
  successTitle: 'Llwyddiant'
}

export function resolveMessages(messages: Partial<ConsentMessages> = {}): ConsentMessages {
  return { ...defaultMessages, ...messages }
}