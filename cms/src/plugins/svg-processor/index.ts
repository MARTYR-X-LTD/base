import type { Config } from 'payload'
import type { SvgProcessorOptions } from './types'
import { validateSvg, extractDimensions, stripXmlDeclaration } from './validator'
import { sanitizeSvg } from './sanitizer'
import { uploadSvgToR2 } from './uploader'
import { getR2KeyFromUrl } from './cleanup'
import { deleteFromR2 } from '@/plugins/media-processor/cleanup'
import { nanoid } from 'nanoid'

/**
 * SVG Processor Plugin
 *
 * Note: SVG fields (svgContent, r2Url) are now defined directly in Media.ts
 * for consistency with other media type fields. This plugin only handles
 * processing logic via hooks.
 */
export const svgProcessor = (opts: SvgProcessorOptions) => {
  return (config: Config): Config => {
    // Hook into Media collection
    config.collections = config.collections?.map((collection) => {
      if (collection.slug !== 'media') return collection

      return {
        ...collection,
        hooks: {
          ...collection.hooks,
          // Restore R2 URLs after PayloadCMS reconstructs them
          afterRead: [
            ...(collection.hooks?.afterRead || []),
            async ({ doc }) => {
              // Only process SVG files
              if (doc.mimeType !== 'image/svg+xml') return doc

              // If URL was reconstructed by PayloadCMS to a local path, restore from r2Url
              if (
                doc.url &&
                !doc.url.startsWith('http://') &&
                !doc.url.startsWith('https://') &&
                doc.r2Url
              ) {
                // Copy stored R2 URL (same pattern as AVIF processor)
                doc.url = doc.r2Url
              }

              // Clean up internal/non-SVG fields from API response
              delete doc.variants
              delete doc.processingMetadata
              delete doc.avifQuality
              delete doc.thumbnailURL
              delete doc.r2Url // Internal field, no longer needed after URL restoration

              return doc
            },
          ],
          // Process SVG uploads in beforeChange
          beforeChange: [
            ...(collection.hooks?.beforeChange || []),
            async ({ data, req, operation }) => {
              // Only process on create (new uploads)
              if (operation !== 'create') return data
              if (!req.file) return data

              // Only process SVG files
              if (req.file.mimetype !== 'image/svg+xml') return data

              console.log(`[SVG] Starting processing for ${req.file.name}`)

              // Generate unique ID (same as AVIF processor)
              const docId = nanoid() // 21 chars: collision resistance

              try {
                // STEP 1: Validate SVG
                await validateSvg(req.file.data, req.file.name, opts.validation)

                // STEP 2: Convert to string
                const originalSvg = req.file.data.toString('utf8')

                // STEP 3: Sanitize (remove dangerous content)
                const sanitized = sanitizeSvg(originalSvg, req.file.name)

                // STEP 4: Extract dimensions
                const { width, height } = extractDimensions(sanitized)

                // STEP 5: Upload original file to R2 (keep as-is, including XML declaration if present)
                const filename = `${docId}.svg`
                const key = `${opts.storage.prefix}/${filename}`
                const url = await uploadSvgToR2(req.file.data, key, opts.storage)
                console.log(`[SVG] Uploaded to R2: ${url}`)

                // STEP 6: Strip XML declaration for database storage (inline HTML use)
                const svgContent = stripXmlDeclaration(sanitized)

                // STEP 7: Return complete data
                const sizeMB = (req.file.data.length / (1024 * 1024)).toFixed(2)
                const dimensions =
                  width !== null && height !== null
                    ? `${width}x${height}`
                    : 'dimensions unknown'
                console.log(`[SVG] Processing complete: ${req.file.name} (${dimensions}, ${sizeMB}MB)`)

                return {
                  ...data,
                  id: docId,
                  filename: req.file.name,
                  mimeType: 'image/svg+xml',
                  filesize: req.file.data.length,
                  width,
                  height,
                  url, // R2 URL for file reference (PayloadCMS will reconstruct this)
                  r2Url: url, // Store R2 URL here (won't be touched by PayloadCMS)
                  svgContent, // Inline content for HTML use (e.g., cover images)
                }
              } catch (err) {
                console.error(`[SVG] Failed to process ${req.file.name}:`, err)
                throw err // Payload won't create document
              }
            },
          ],
          // Cleanup R2 file when document is deleted
          afterDelete: [
            ...(collection.hooks?.afterDelete || []),
            async ({ doc }) => {
              // Only cleanup SVG files
              if (doc.mimeType !== 'image/svg+xml') return
              if (!doc.url) return

              try {
                // Extract R2 key from URL
                const key = getR2KeyFromUrl(doc.url)

                // Delete from R2 (reuse AVIF cleanup function)
                await deleteFromR2(key, opts.storage)

                console.log(`[SVG] Deleted R2 file for document ${doc.id}`)
              } catch (err) {
                console.error(`[SVG] Failed to delete R2 file for document ${doc.id}:`, err)
                // Don't throw - document is already deleted from database
              }
            },
          ],
        },
      }
    })

    return config
  }
}

// Re-export types for convenience
export type { SvgProcessorOptions } from './types'
