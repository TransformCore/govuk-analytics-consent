import {
  categoryQuestion,
  choices,
  consentCommands,
  cookieNames,
  expect,
  readConsent,
  readDataLayer,
  signals,
  test
} from './fixtures.js'
import type { BrowserContext } from '@playwright/test'
import { getDefaultMessages } from '../src/consent/messages.js'

async function seedCookies(context: BrowserContext, baseURL: string | undefined, names: string[]): Promise<void> {
  await context.addCookies(
    [...names, 'session_id'].map((name) => ({ name, value: 'seeded', url: baseURL! }))
  )
}

test.describe('first visit', () => {
  test('selects banner and cookies-page copy from each request language', async ({ browser, page, baseURL, scenario }) => {
    test.skip(scenario.language !== 'en')

    const welsh = getDefaultMessages('cy')
    const english = getDefaultMessages('en')

    const welshContext = await browser.newContext({ locale: 'cy-GB', baseURL })
    const welshPage = await welshContext.newPage()
    await welshPage.goto('/')
    await expect(welshPage.getByRole('button', { name: welsh.banner.acceptAll })).toBeVisible()
    await welshPage.goto('/cookies')
    await expect(welshPage.getByRole('heading', { level: 1, name: welsh.cookies.title })).toBeVisible()
    await expect(welshPage.getByText(welsh.categories.analytics.title)).toBeVisible()
    await welshContext.close()

    await page.goto('/')
    await expect(page.getByRole('button', { name: english.banner.acceptAll })).toBeVisible()
    await page.goto('/cookies')
    await expect(page.getByRole('heading', { level: 1, name: english.cookies.title })).toBeVisible()
  })

  test('shows the banner and denies optional consent by default', async ({ page, context, bannerTitle, messages, optionalCategories, serverMessage }) => {
    await page.goto('/')

    const banner = page.getByRole('region', { name: bannerTitle })
    await expect(banner).toBeVisible()
    await expect(banner.getByRole('button', { name: messages.banner.acceptAll })).toBeVisible()
    await expect(banner.getByRole('button', { name: messages.banner.rejectAll })).toBeVisible()
    await expect(page.getByText(serverMessage(null))).toBeVisible()
    expect(await readConsent(context)).toBeNull()

    const [defaults] = consentCommands(await readDataLayer(page), 'default')
    expect(defaults).toMatchObject({
      ...signals(optionalCategories, {}),
      ad_storage: 'denied',
      security_storage: 'granted'
    })
  })

  test('view cookies link opens the cookies page with a return URL', async ({ page, bannerTitle, messages }) => {
    await page.goto('/')
    await page.getByRole('region', { name: bannerTitle }).getByRole('link', { name: messages.banner.viewCookies }).click()

    await expect(page).toHaveURL('/cookies?returnUrl=%2F')
    await expect(page.getByRole('heading', { level: 1, name: messages.cookies.title })).toBeVisible()
  })
})

test.describe('banner with JavaScript', () => {
  test('accepting all cookies updates consent in place', async ({ page, context, bannerTitle, messages, optionalCategories, serverMessage }) => {
    const accepted = choices(optionalCategories, true)
    await page.goto('/')
    const banner = page.getByRole('region', { name: bannerTitle })

    await banner.getByRole('button', { name: messages.banner.acceptAll }).click()

    await expect(banner.getByText(messages.banner.accepted)).toBeVisible()
    await expect(banner.getByRole('button', { name: messages.banner.acceptAll })).toBeHidden()
    await expect(page).toHaveURL('/')
    expect(await readConsent(context)).toEqual(accepted)

    const dataLayer = await readDataLayer(page)
    expect(consentCommands(dataLayer, 'update').at(-1)).toMatchObject(signals(optionalCategories, accepted))
    expect(dataLayer).toContainEqual({ event: 'cookie_consent_update', analytics_consent: true })

    await banner.getByRole('button', { name: messages.banner.hide }).click()
    await expect(banner).toBeHidden()

    await page.reload()
    await expect(page.getByRole('region', { name: bannerTitle })).toHaveCount(0)
    await expect(page.getByText(serverMessage(true))).toBeVisible()
  })

  test('rejecting additional cookies removes non-essential cookies', async ({ page, context, baseURL, bannerTitle, messages, optionalCategories, serverMessage, nonEssentialCookies }) => {
    const rejected = choices(optionalCategories, false)
    await seedCookies(context, baseURL, nonEssentialCookies)
    await page.goto('/')
    const banner = page.getByRole('region', { name: bannerTitle })

    await banner.getByRole('button', { name: messages.banner.rejectAll }).click()

    await expect(banner.getByText(messages.banner.rejected)).toBeVisible()
    expect(await readConsent(context)).toEqual(rejected)

    const names = await cookieNames(context)
    expect(names).toContain('session_id')
    for (const name of nonEssentialCookies) {
      expect(names).not.toContain(name)
    }

    const dataLayer = await readDataLayer(page)
    expect(consentCommands(dataLayer, 'update').at(-1)).toMatchObject(signals(optionalCategories, rejected))
    expect(dataLayer).toContainEqual({ event: 'cookie_consent_update', analytics_consent: false })

    await page.reload()
    await expect(page.getByText(serverMessage(false))).toBeVisible()
  })
})

test.describe('banner without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('accepting all cookies posts the form and redirects back', async ({ page, context, bannerTitle, messages, optionalCategories, serverMessage }) => {
    await page.goto('/')
    await page.getByRole('region', { name: bannerTitle }).getByRole('button', { name: messages.banner.acceptAll }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('region', { name: bannerTitle })).toHaveCount(0)
    await expect(page.getByText(serverMessage(true))).toBeVisible()
    expect(await readConsent(context)).toEqual(choices(optionalCategories, true))
  })

  test('rejecting additional cookies expires them server-side', async ({ page, context, baseURL, bannerTitle, messages, optionalCategories, serverMessage, nonEssentialCookies }) => {
    await seedCookies(context, baseURL, nonEssentialCookies)
    await page.goto('/')
    await page.getByRole('region', { name: bannerTitle }).getByRole('button', { name: messages.banner.rejectAll }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByText(serverMessage(false))).toBeVisible()
    expect(await readConsent(context)).toEqual(choices(optionalCategories, false))

    const names = await cookieNames(context)
    expect(names).toContain('session_id')
    for (const name of nonEssentialCookies) {
      expect(names).not.toContain(name)
    }
  })
})

test.describe('cookies page', () => {
  test('offers a choice for every optional category', async ({ page, messages, optionalCategories }) => {
    await page.goto('/cookies')

    await expect(page.getByRole('group')).toHaveCount(optionalCategories.length)
    for (const category of optionalCategories) {
      await expect(page.getByRole('heading', { level: 2, name: category.title })).toBeVisible()
      await expect(page.getByRole('group', { name: categoryQuestion(messages, category) })).toBeVisible()
    }
  })

  test('saves granular settings and links back to the original page', async ({ page, context, bannerTitle, messages, optionalCategories, serverMessage }) => {
    // Alternate yes/no, starting with analytics accepted, so extra categories get a mix.
    const chosen = choices(optionalCategories, (category) => optionalCategories.indexOf(category) % 2 === 0)
    await page.goto('/cookies?returnUrl=/')

    for (const category of optionalCategories) {
      await page
        .getByRole('group', { name: categoryQuestion(messages, category) })
        .getByLabel(chosen[category.id] ? messages.cookies.yes : messages.cookies.no)
        .check()
    }
    await page.getByRole('button', { name: messages.cookies.saveSettings }).click()

    await expect(page).toHaveURL(/cookies-updated=true/)
    const notification = page.getByRole('alert').filter({ hasText: messages.cookies.successBanner })
    await expect(notification).toBeVisible()
    for (const category of optionalCategories) {
      await expect(
        page
          .getByRole('group', { name: categoryQuestion(messages, category) })
          .getByLabel(chosen[category.id] ? messages.cookies.yes : messages.cookies.no)
      ).toBeChecked()
    }
    await expect(page.getByRole('region', { name: bannerTitle })).toHaveCount(0)
    expect(await readConsent(context)).toEqual(chosen)

    await notification.getByRole('link', { name: messages.cookies.successBannerLink }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText(serverMessage(chosen.personalization === true))).toBeVisible()

    // The client script replays the stored choice to Consent Mode on every page load.
    expect(consentCommands(await readDataLayer(page), 'update').at(-1)).toMatchObject(signals(optionalCategories, chosen))
  })

  test('changing a previous choice overrides it', async ({ page, context, bannerTitle, messages, optionalCategories }) => {
    await page.goto('/')
    await page.getByRole('region', { name: bannerTitle }).getByRole('button', { name: messages.banner.acceptAll }).click()
    await expect(page.getByText(messages.banner.accepted)).toBeVisible()

    await page.goto('/cookies')
    const [analyticsCategory] = optionalCategories
    const analytics = page.getByRole('group', { name: categoryQuestion(messages, analyticsCategory!) })
    await expect(analytics.getByLabel(messages.cookies.yes)).toBeChecked()

    await analytics.getByLabel(messages.cookies.no).check()
    await page.getByRole('button', { name: messages.cookies.saveSettings }).click()

    await expect(page).toHaveURL(/cookies-updated=true/)
    expect(await readConsent(context)).toEqual(
      choices(optionalCategories, (category) => category.id !== 'analytics')
    )
  })
})

test.describe('Google Tag Manager', () => {
  test('loads GTM only when a container ID is configured', async ({ page, scenario, externalRequests }) => {
    await page.goto('/')

    const gtmLoads = externalRequests.filter((url) => url.startsWith('https://www.googletagmanager.com/gtm.js'))

    if (scenario.gtmContainerId === null) {
      expect(gtmLoads).toEqual([])
    } else {
      expect(gtmLoads).toEqual([`https://www.googletagmanager.com/gtm.js?id=${scenario.gtmContainerId}`])
    }
  })

  test('pushes consent defaults before the GTM start event', async ({ page, scenario }) => {
    test.skip(scenario.gtmContainerId === null, 'No GTM container configured')
    await page.goto('/')

    const dataLayer = await readDataLayer(page)
    const defaultIndex = dataLayer.findIndex(
      (entry) => Array.isArray(entry) && entry[0] === 'consent' && entry[1] === 'default'
    )
    const startIndex = dataLayer.findIndex(
      (entry) => typeof entry === 'object' && entry !== null && (entry as { event?: string }).event === 'gtm.js'
    )

    expect(defaultIndex).toBeGreaterThanOrEqual(0)
    expect(startIndex).toBeGreaterThan(defaultIndex)
  })

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    test('renders the GTM noscript iframe only when configured', async ({ page, scenario }) => {
      await page.goto('/')
      const iframe = page.locator('iframe[src^="https://www.googletagmanager.com/ns.html"]')

      if (scenario.gtmContainerId === null) {
        await expect(iframe).toHaveCount(0)
      } else {
        await expect(iframe).toHaveAttribute('src', `https://www.googletagmanager.com/ns.html?id=${scenario.gtmContainerId}`)
      }
    })
  })
})
