import type { SvgProcessorOptions, SvgDimensions } from './types'

/**
 * Validate SVG file meets requirements
 * Throws error if validation fails
 */
export async function validateSvg(
  fileData: Buffer,
  fileName: string,
  options: SvgProcessorOptions['validation'],
): Promise<void> {
  // 1. Check file size
  const fileSizeMB = fileData.length / (1024 * 1024)
  if (fileSizeMB > options.maxFileSizeMB) {
    throw new Error(
      `SVG file too large: ${fileSizeMB.toFixed(2)}MB (max: ${options.maxFileSizeMB}MB)`,
    )
  }

  // 2. Convert to string and check it's valid text
  let svgContent: string
  try {
    svgContent = fileData.toString('utf8')
  } catch (_ignoreDecodeError) {
    throw new Error('Invalid SVG: Could not decode as UTF-8 text')
  }

  // 3. Basic SVG validation - must contain <svg tag
  if (!svgContent.includes('<svg')) {
    throw new Error('Invalid SVG: No <svg> tag found')
  }

  // 4. Check for basic XML structure (opening and closing tags)
  const svgOpenMatch = svgContent.match(/<svg[^>]*>/i)
  if (!svgOpenMatch) {
    throw new Error('Invalid SVG: Malformed <svg> opening tag')
  }

  if (!svgContent.includes('</svg>')) {
    throw new Error('Invalid SVG: Missing </svg> closing tag')
  }

  console.log(`[SVG] Validation passed: ${fileName} (${fileSizeMB.toFixed(2)}MB)`)
}

/**
 * Extract dimensions from SVG content
 * Robust implementation based on probe-image-size library logic
 *
 * Priority:
 * 1. Both width and height attributes → use directly
 * 2. ViewBox only → use viewBox dimensions
 * 3. Width + viewBox → calculate height from aspect ratio
 * 4. Height + viewBox → calculate width from aspect ratio
 *
 * @see https://github.com/nodeca/probe-image-size/blob/master/lib/parse_sync/svg.js
 */
export function extractDimensions(svgContent: string): SvgDimensions {
  // Helper: Check if value is finite positive number
  const isFinitePositive = (val: number): boolean => {
    return typeof val === 'number' && isFinite(val) && val > 0
  }

  // Extract width, height, and viewBox from SVG tag
  // Note: [^-] prefix prevents matching negative values, [^%] prevents percentages
  const widthMatch = svgContent.match(/[^-]\bwidth=["']([^%"']+?)["']|[^-]\bwidth=["']([^%"']+?)["']/i)
  const heightMatch = svgContent.match(/\bheight=["']([^%"']+?)["']|\bheight=["']([^%"']+?)["']/i)
  const viewBoxMatch = svgContent.match(/\bview[bB]ox=["'](.+?)["']|\bview[bB]ox=["'](.+?)["']/i)

  const widthAttr = widthMatch && (widthMatch[1] || widthMatch[2])
  const heightAttr = heightMatch && (heightMatch[1] || heightMatch[2])
  const viewBoxAttr = viewBoxMatch && (viewBoxMatch[1] || viewBoxMatch[2])

  const width = widthAttr ? parseFloat(widthAttr) : NaN
  const height = heightAttr ? parseFloat(heightAttr) : NaN

  // Priority 1: Both width AND height exist
  if (widthAttr && heightAttr) {
    if (isFinitePositive(width) && isFinitePositive(height)) {
      console.log(`[SVG] Extracted dimensions from width/height attributes: ${width}x${height}`)
      return { width: Math.round(width), height: Math.round(height) }
    }
  }

  // Parse viewBox if available
  if (viewBoxAttr) {
    // viewBox format: "minX minY width height"
    const parts = viewBoxAttr.split(/\s+/)
    const vbWidth = parseFloat(parts[2])
    const vbHeight = parseFloat(parts[3])

    if (isFinitePositive(vbWidth) && isFinitePositive(vbHeight)) {
      const ratio = vbWidth / vbHeight

      // Priority 2: Width + viewBox → calculate height from aspect ratio
      if (widthAttr && isFinitePositive(width)) {
        const calculatedHeight = width / ratio
        console.log(
          `[SVG] Calculated dimensions from width + viewBox: ${width}x${calculatedHeight.toFixed(1)}`,
        )
        return { width: Math.round(width), height: Math.round(calculatedHeight) }
      }

      // Priority 3: Height + viewBox → calculate width from aspect ratio
      if (heightAttr && isFinitePositive(height)) {
        const calculatedWidth = height * ratio
        console.log(
          `[SVG] Calculated dimensions from height + viewBox: ${calculatedWidth.toFixed(1)}x${height}`,
        )
        return { width: Math.round(calculatedWidth), height: Math.round(height) }
      }

      // Priority 4: ViewBox only → use viewBox dimensions
      console.log(`[SVG] Extracted dimensions from viewBox: ${vbWidth}x${vbHeight}`)
      return { width: Math.round(vbWidth), height: Math.round(vbHeight) }
    }
  }

  // Fallback: No valid dimensions found
  console.log(`[SVG] No valid dimensions found, returning null (prevents layout shift on frontend)`)
  return { width: null, height: null }
}

/**
 * Strip XML declaration for inline HTML use
 * Keeps original content intact otherwise
 */
export function stripXmlDeclaration(svgContent: string): string {
  return svgContent.replace(/<\?xml[^?]*\?>\s*/g, '').trim()
}
