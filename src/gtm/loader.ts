import { GTM_CONTAINER_ID_PATTERN } from '../consent/options.js'

/** Returns an empty string when no container is configured, so services run un-instrumented. */
export function gtmLoaderSnippet(containerId: string | null): string {
  if (containerId === null) {
    return ''
  }

  if (!GTM_CONTAINER_ID_PATTERN.test(containerId)) {
    throw new Error(`Refusing to render an invalid GTM container ID: "${containerId}"`)
  }

  return [
    "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});",
    "var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';",
    "j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;",
    `f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${containerId}');`
  ].join('')
}

export function gtmNoscriptSnippet(containerId: string | null): string {
  if (containerId === null) {
    return ''
  }

  if (!GTM_CONTAINER_ID_PATTERN.test(containerId)) {
    throw new Error(`Refusing to render an invalid GTM container ID: "${containerId}"`)
  }

  return (
    `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${containerId}" ` +
    'height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>'
  )
}
