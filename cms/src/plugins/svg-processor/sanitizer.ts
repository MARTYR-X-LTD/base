/**
 * Basic SVG sanitization to remove potentially dangerous content
 * Removes script tags, event handlers, and external resource references
 *
 * Note: This is basic sanitization. For production with untrusted user uploads,
 * consider using a library like isomorphic-dompurify for more comprehensive security.
 */

const DANGEROUS_PATTERNS = [
  // Script tags
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,

  // Event handlers (onclick, onload, etc.)
  /\s+on\w+\s*=\s*["'][^"']*["']/gi,

  // javascript: protocol
  /javascript:/gi,

  // data: URIs (can contain scripts)
  /data:text\/html/gi,
]

const SUSPICIOUS_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'link', // External stylesheets can load scripts
  'style', // Inline styles can have javascript: urls
]

/**
 * Sanitize SVG content by removing dangerous patterns
 * Returns sanitized SVG and logs any removals
 */
export function sanitizeSvg(svgContent: string, fileName: string): string {
  let sanitized = svgContent
  const removals: string[] = []

  // Remove dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    const matches = sanitized.match(pattern)
    if (matches) {
      removals.push(`${matches.length} instances of pattern: ${pattern.source}`)
      sanitized = sanitized.replace(pattern, '')
    }
  }

  // Check for suspicious tags (don't auto-remove, just warn)
  for (const tag of SUSPICIOUS_TAGS) {
    const regex = new RegExp(`<${tag}[^>]*>`, 'gi')
    if (regex.test(sanitized)) {
      console.warn(`[SVG] Warning: ${fileName} contains <${tag}> tag (potential security risk)`)
    }
  }

  // Log if anything was sanitized
  if (removals.length > 0) {
    console.log(`[SVG] Sanitized ${fileName}: ${removals.join(', ')}`)
  }

  return sanitized
}
