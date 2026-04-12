/**
 * Extract R2 key from SVG URL
 * URL format: https://media.martyr.shop/prod/svg/abc123.svg
 * Key format: prod/svg/abc123.svg
 *
 * IMPORTANT: Extract the ACTUAL key from the URL pathname, don't reconstruct it.
 * This ensures we delete the correct file even if the prefix config changes.
 */
export function getR2KeyFromUrl(url: string): string {
  const urlObj = new URL(url)
  // pathname = '/prod/svg/abc123.svg'
  // Remove leading slash to get R2 key: 'prod/svg/abc123.svg'
  return urlObj.pathname.substring(1)
}
