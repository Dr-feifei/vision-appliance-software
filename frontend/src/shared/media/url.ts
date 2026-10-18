export function safeMediaUrl(url: string | null): string | null {
  if (!url || !url.startsWith('/api/v1/') || url.includes('..') || url.includes('\\') || /%2e|%2f|%5c/i.test(url)) return null
  return url
}
