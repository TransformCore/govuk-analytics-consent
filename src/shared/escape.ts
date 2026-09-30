const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

const SAFE_HTML_ATTRIBUTE_PATTERN = /^[A-Za-z0-9_./:@%?&=+#\-\[\]{}(),!~' *]*$/

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] as string)
}

export function safeHtmlAttribute(value: string): string {
  return SAFE_HTML_ATTRIBUTE_PATTERN.test(value) ? value : ''
}
