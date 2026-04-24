import type { Config, Field } from 'payload'
import type { MediaProcessorOptions, ImageVariant } from './types'
import {
  validateUpload,
  deduplicateSizes,
  resizeImage,
  encodeAvif,
  cleanupAvifencTempFiles,
} from './processor'
import { deleteTempFile, deleteMultipleFromR2, getR2KeysFromVariants } from './cleanup'
import { uploadToR2 } from './uploader'
import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'
// Import from root 'node-av' package (not 'node-av/api') - official examples use root
import { Demuxer, Decoder, Encoder, FF_ENCODER_MJPEG } from 'node-av'

/**
 * Create media processor fields that will be injected into Media collection
 *
 * Only includes dynamically-generated fields (avifQuality with per-variant controls).
 * Static fields (variants, svgContent, r2Url) are defined
 * directly in Media.ts for consistency with videoMetadata.
 */
function createMediaProcessorFields(opts: MediaProcessorOptions): Field[] {
  return [
    {
      name: 'avifQuality',
      type: 'group',
      admin: {
        position: 'sidebar',
        condition: (data) => !data.id, // Only show on upload (can't check mimeType yet)
      },
      fields: [
        {
          type: 'collapsible',
          label: 'Advanced AVIF Settings',
          admin: { initCollapsed: true },
          fields: [
            {
              name: 'usePerVariantQuality',
              type: 'checkbox',
              label: 'Per Variant Qualities',
              defaultValue: false,
            },
            {
              type: 'row',
              admin: {
                condition: (data) => !data.avifQuality?.usePerVariantQuality,
              },
              fields: [
                {
                  name: 'colorQuality',
                  type: 'number',
                  label: 'Color Q',
                  defaultValue: opts.avifSettings.colorQuality,
                  min: 0,
                  max: 100,
                  admin: {
                    width: '50%',
                  },
                },
                {
                  name: 'alphaQuality',
                  type: 'number',
                  label: 'Alpha Q',
                  defaultValue: opts.avifSettings.alphaQuality,
                  min: 0,
                  max: 100,
                  admin: {
                    width: '50%',
                  },
                },
              ],
            },
            // Per-variant quality settings
            ...opts.sizes.map((size) => {
              const sizeLabel = size === 'full' ? 'Full Size' : `${size}w`
              const sizeKey = size === 'full' ? 'full' : size.toString()

              return {
                type: 'row' as const,
                admin: {
                  condition: (data: Record<string, unknown>) =>
                    (data.avifQuality as Record<string, unknown>)?.usePerVariantQuality === true,
                },
                fields: [
                  {
                    name: `colorQuality_${sizeKey}`,
                    type: 'number' as const,
                    label: `${sizeLabel} Color Q`,
                    defaultValue: opts.avifSettings.colorQuality,
                    min: 0,
                    max: 100,
                    admin: {
                      width: '50%',
                    },
                  },
                  {
                    name: `alphaQuality_${sizeKey}`,
                    type: 'number' as const,
                    label: `${sizeLabel} Alpha Q`,
                    defaultValue: opts.avifSettings.alphaQuality,
                    min: 0,
                    max: 100,
                    admin: {
                      width: '50%',
                    },
                  },
                ],
              }
            }),
          ],
        },
      ],
    },
  ]
}

// Extend ImageVariant temporarily for internal processing (includes buffer)
interface ImageVariantWithBuffer extends ImageVariant {
  buffer: Buffer
}

/**
 * Smart Thumbnail Frame Selection
 *
 * Picks the optimal frame for video thumbnails using deterministic logic:
 * - Never frame 0 (unstable: fade-in, black frame, camera settle)
 * - Never last frames (often fade-out or credits)
 * - Early bias for short videos (hook is usually in first 30s)
 * - Hard cap for long intros (viewers expect thumbnails from the hook, not the body)
 *
 * Design guarantees:
 * - One single rule for all durations
 * - Deterministic (same video = same frame every time)
 * - Duration-safe (handles edge cases gracefully)
 *
 * @param duration - Video duration in seconds
 * @returns Timestamp in seconds for thumbnail frame
 */
function pickThumbnailTimestamp(duration: number): number {
  if (duration <= 0) return 0

  // Tunables
  const MIN_SKIP = 0.3 // seconds - skip unstable intro
  const MAX_SKIP = 1.0 // seconds - cap intro skip
  const END_MARGIN = 0.2 // seconds - avoid fade-out/credits
  const EARLY_BIAS = 0.15 // 15% into window (early hook)
  const MAX_EARLY_WINDOW = 30.0 // seconds - hard cap for long intros

  // 1. Skip unstable intro (fade-in, black frame, camera settle)
  const skip = Math.min(MAX_SKIP, Math.max(MIN_SKIP, duration * 0.1))

  // 2. Define candidate window (early, but capped)
  const start = skip
  const end = Math.min(duration - END_MARGIN, start + MAX_EARLY_WINDOW)

  // 3. Fallback for ultra-short clips
  if (end <= start) {
    return duration / 2
  }

  // 4. Pick early-biased frame
  return start + (end - start) * EARLY_BIAS
}

/**
 * Resize thumbnail to max 1 megapixel while preserving aspect ratio
 *
 * @param buffer - JPEG buffer from encoder
 * @param originalWidth - Original frame width
 * @param originalHeight - Original frame height
 * @returns Resized JPEG buffer
 */
async function resizeThumbnail(
  buffer: Buffer,
  originalWidth: number,
  originalHeight: number,
): Promise<Buffer> {
  const MAX_MEGAPIXELS = 1_000_000
  const currentPixels = originalWidth * originalHeight

  // Already under limit, return as-is
  if (currentPixels <= MAX_MEGAPIXELS) {
    return buffer
  }

  // Calculate scale factor to reach 1 megapixel
  const scaleFactor = Math.sqrt(MAX_MEGAPIXELS / currentPixels)
  const newWidth = Math.round(originalWidth * scaleFactor)
  const newHeight = Math.round(originalHeight * scaleFactor)

  console.log(
    `[VIDEO] Resizing thumbnail: ${originalWidth}x${originalHeight} (${(currentPixels / 1000000).toFixed(2)}MP) → ${newWidth}x${newHeight} (${((newWidth * newHeight) / 1000000).toFixed(2)}MP)`,
  )

  return await sharp(buffer)
    .resize(newWidth, newHeight, { fit: 'inside' })
    .jpeg({ quality: 85 })
    .toBuffer()
}

/**
 * Media Processor Plugin
 *
 * Handles processing for different media types:
 * - Images (PNG/JPG/WebP): AVIF conversion with multiple variants
 * - SVG: Direct R2 upload (no processing)
 * - Videos (MP4/WebM/MOV): Metadata extraction, thumbnail generation, R2 upload
 */
export const mediaProcessor = (opts: MediaProcessorOptions) => {
  return (config: Config): Config => {
    // Hook into Media collection
    config.collections = config.collections?.map((collection) => {
      if (collection.slug !== 'media') return collection

      return {
        ...collection,
        // Inject media processor fields
        fields: [...(collection.fields || []), ...createMediaProcessorFields(opts)],
        upload: {
          ...(typeof collection.upload === 'object' ? collection.upload : {}),
        },
        hooks: {
          ...collection.hooks,
          // STEP 0: Fix URL after PayloadCMS reconstructs it from filename
          afterRead: [
            ...(collection.hooks?.afterRead || []),
            async ({ doc }) => {
              // Handle videos: restore URL from r2Url if PayloadCMS reconstructed it
              if (doc.mimeType?.startsWith('video/')) {
                // If URL was reconstructed by PayloadCMS to a local path, restore from r2Url
                if (
                  doc.url &&
                  !doc.url.startsWith('http://') &&
                  !doc.url.startsWith('https://') &&
                  doc.r2Url
                ) {
                  doc.url = doc.r2Url
                }

                // Clean up irrelevant fields from API response
                delete doc.variants
                delete doc.avifQuality
                delete doc.svgContent
                delete doc.r2Url

                return doc
              }

              // Handle AVIF images: restore URL from largest variant
              if (Array.isArray(doc.variants) && doc.variants.length > 0) {
                // If URL was reconstructed by PayloadCMS to a local path, restore the R2 URL
                if (doc.url && !doc.url.startsWith('http://') && !doc.url.startsWith('https://')) {
                  // Get largest variant URL (which is the correct R2 URL)
                  const largestVariant = [...doc.variants].sort(
                    (a, b) => (b.width || 0) - (a.width || 0),
                  )[0]

                  if (largestVariant?.url) {
                    doc.url = largestVariant.url
                  }
                }

                // Clean up internal fields from API response
                delete doc.videoMetadata
                delete doc.avifQuality
                delete doc.thumbnailURL
                delete doc.svgContent
                delete doc.r2Url

                return doc
              }

              // For other types, just return as-is
              return doc
            },
          ],
          // STEP 1: Process everything synchronously in beforeChange
          beforeChange: [
            ...(collection.hooks?.beforeChange || []),
            async ({ data, req, operation }) => {
              if (operation !== 'create') return data
              if (!req.file) return data

              // Skip SVG files (handled by SVG processor)
              if (req.file.mimetype === 'image/svg+xml') return data

              // Handle video uploads (no processing, just metadata extraction + R2 upload + thumbnail generation)
              if (req.file.mimetype.startsWith('video/')) {
                const docId = data.storageKey
                console.log(`[VIDEO] Processing ${req.file.name} (storageKey: ${docId})`)

                const uploadedKeys: string[] = [] // Track uploaded files for cleanup on error

                try {
                  // Extract video metadata using node-av Demuxer
                  // Based on official examples: ffprobe-metadata.ts and api-frame-extract.ts
                  await using input = await Demuxer.open(req.file.data)
                  const videoStream = input.video()

                  if (!videoStream) {
                    throw new Error('No video stream found in file')
                  }

                  // Access codec parameters properly (see ffprobe-metadata.ts example)
                  const codecParams = videoStream.codecpar
                  const width = codecParams.width ?? null
                  const height = codecParams.height ?? null

                  // Duration from Demuxer.open(buffer)
                  // Note: When opening from Buffer (not file path), duration is already in seconds
                  // Round to 2 decimal places for clean display in UI and API
                  const durationRaw = input.duration ? Number(input.duration) : 0
                  const duration = Math.round(durationRaw * 100) / 100 // e.g., 30.34s

                  // Additional useful metadata for frontend
                  // Round FPS to 2 decimal places (e.g., 29.97fps instead of 29.97002997)
                  const fpsRaw = videoStream.avgFrameRate
                    ? videoStream.avgFrameRate.num / videoStream.avgFrameRate.den
                    : null
                  const fps = fpsRaw !== null ? Math.round(fpsRaw * 100) / 100 : null

                  console.log(
                    `[VIDEO] Metadata: ${width}x${height}, ${duration}s, ${fps ?? 'N/A'} fps`,
                  )
                  console.log(`[VIDEO] Using R2 prefix: ${opts.videoStorage.prefix}`)

                  // Upload original video to R2 (no processing)
                  const ext = path.extname(req.file.name)
                  const videoFilename = `${docId}-original${ext}`
                  const videoKey = `${opts.videoStorage.prefix}/${videoFilename}`

                  const videoUrl = await uploadToR2(req.file.data, videoKey, {
                    ...opts.videoStorage,
                    contentType: req.file.mimetype,
                  })
                  uploadedKeys.push(videoKey)

                  console.log(`[VIDEO] Uploaded video to R2: ${videoUrl}`)

                  // Generate thumbnail using smart frame selection
                  // Based on official example: api-frame-extract.ts (extractFramesAtInterval)
                  console.log(`[VIDEO] Generating thumbnail...`)
                  let thumbnailUrl: string | null = null

                  try {
                    // Calculate optimal thumbnail timestamp (deterministic, avoids intro/outro)
                    const thumbnailTimestamp = pickThumbnailTimestamp(duration)
                    console.log(
                      `[VIDEO] Target thumbnail at ${thumbnailTimestamp.toFixed(2)}s (${((thumbnailTimestamp / duration) * 100).toFixed(1)}% into video)`,
                    )

                    // Create decoder from video stream
                    await using decoder = await Decoder.create(videoStream)

                    // Create JPEG encoder (node-av handles pixel format conversion internally)
                    await using jpegEncoder = await Encoder.create(FF_ENCODER_MJPEG, {
                      decoder,
                      bitrate: '2M',
                      options: {
                        strict: 'experimental',
                      },
                    })

                    console.log(
                      `[VIDEO] Decoder and JPEG encoder created, seeking to thumbnail frame...`,
                    )

                    // Iterate through packets and decode frames until we reach target timestamp
                    for await (using packet of input.packets(videoStream.index)) {
                      for await (using frame of decoder.frames(packet)) {
                        if (frame) {
                          // Calculate frame timestamp in seconds
                          // frame.pts is a BigInt in stream time_base units, convert to seconds
                          const frameTimeSeconds = frame.pts
                            ? (Number(frame.pts) * videoStream.timeBase.num) /
                              videoStream.timeBase.den
                            : 0

                          // Skip frames before target timestamp
                          if (frameTimeSeconds < thumbnailTimestamp) {
                            continue
                          }

                          console.log(
                            `[VIDEO] Found thumbnail frame at ${frameTimeSeconds.toFixed(2)}s: ${frame.width}x${frame.height}, format: ${frame.format}`,
                          )

                          // Encode frame as JPEG using node-av encoder
                          for await (using jpegPacket of jpegEncoder.packets(frame)) {
                            if (jpegPacket?.data) {
                              console.log(
                                `[VIDEO] Encoded JPEG: ${jpegPacket.data.length} bytes (${frame.width}x${frame.height})`,
                              )

                              // Resize thumbnail to max 1 megapixel (preserving aspect ratio)
                              const resizedJpeg = await resizeThumbnail(
                                jpegPacket.data,
                                frame.width,
                                frame.height,
                              )

                              console.log(
                                `[VIDEO] Final thumbnail size: ${resizedJpeg.length} bytes`,
                              )

                              // Upload thumbnail to R2 (same folder as video)
                              const thumbnailFilename = `${docId}-thumbnail.jpg`
                              const thumbnailKey = `${opts.videoStorage.prefix}/${thumbnailFilename}`

                              thumbnailUrl = await uploadToR2(resizedJpeg, thumbnailKey, {
                                ...opts.videoStorage,
                                contentType: 'image/jpeg',
                              })
                              uploadedKeys.push(thumbnailKey)

                              console.log(`[VIDEO] Generated thumbnail: ${thumbnailUrl}`)
                              break // Only first JPEG packet
                            }
                          }

                          break // Found our frame, exit
                        }
                      }
                      if (thumbnailUrl) break // Exit after successful thumbnail
                    }
                  } catch (thumbErr) {
                    console.error(`[VIDEO] Failed to generate thumbnail:`, thumbErr)
                    // Non-fatal - continue without thumbnail
                  }

                  const sizeMB = (req.file.data.length / (1024 * 1024)).toFixed(2)
                  console.log(
                    `[VIDEO] Processing complete: ${width}x${height}, ${duration.toFixed(2)}s, ${sizeMB}MB`,
                  )

                  // Return document data with video metadata (same pattern as SVG)
                  return {
                    ...data,
                    filename: req.file.name,
                    mimeType: req.file.mimetype,
                    filesize: req.file.data.length,
                    width,
                    height,
                    url: videoUrl, // R2 URL for file reference (PayloadCMS may reconstruct this)
                    r2Url: videoUrl, // Store R2 URL here (won't be touched by PayloadCMS, same as SVG)
                    thumbnailURL: thumbnailUrl, // Thumbnail for admin UI
                    videoMetadata: {
                      duration,
                      fps,
                      // Preserve user settings or use defaults
                      autoplay: data.videoMetadata?.autoplay ?? true,
                      muted: data.videoMetadata?.muted ?? true,
                      loop: data.videoMetadata?.loop ?? true,
                      controls: data.videoMetadata?.controls ?? true,
                      playsinline: data.videoMetadata?.playsinline ?? true,
                    },
                  }
                } catch (err) {
                  console.error(`[VIDEO] Failed to process ${req.file.name}:`, err)

                  // Cleanup uploaded R2 files on error
                  if (uploadedKeys.length > 0) {
                    try {
                      await deleteMultipleFromR2(uploadedKeys, opts.videoStorage)
                      console.log(`[VIDEO] Cleaned up ${uploadedKeys.length} R2 files after error`)
                    } catch (deleteErr) {
                      console.error(`[VIDEO] Failed to cleanup R2 files:`, deleteErr)
                    }
                  }

                  throw new Error(
                    `Video processing failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
                  )
                }
              }

              const docId = data.storageKey

              const ext = path.extname(req.file.name)
              const tempFilePath = `/tmp/${docId}-original${ext}`
              const uploadedKeys: string[] = [] // Track uploaded files for cleanup on error

              try {
                console.log(`[AVIF] Starting processing for ${req.file.name} (ID: ${docId})`)

                // Validate upload (throws error if invalid)
                await validateUpload(req.file, opts.validation)

                // Get image dimensions for metadata
                const { width, height } = await sharp(req.file.data).metadata()
                console.log(`[AVIF] Original dimensions: ${width}x${height}`)

                // Write to temp file
                await fs.writeFile(tempFilePath, req.file.data)
                console.log(`[AVIF] Wrote temp file: ${tempFilePath}`)

                // Helper: Get quality settings for a specific variant
                const getQualityForVariant = (size: number | 'full') => {
                  const avifQuality = data.avifQuality || {}

                  // Check if per-variant quality is enabled
                  if (avifQuality.usePerVariantQuality) {
                    const sizeKey = size === 'full' ? 'full' : size.toString()
                    // Per-variant setting → Plugin default
                    const colorQuality =
                      avifQuality[`colorQuality_${sizeKey}`] ?? opts.avifSettings.colorQuality
                    const alphaQuality =
                      avifQuality[`alphaQuality_${sizeKey}`] ?? opts.avifSettings.alphaQuality

                    return { colorQuality, alphaQuality }
                  }

                  // Use global settings → Plugin default
                  const colorQuality = avifQuality.colorQuality ?? opts.avifSettings.colorQuality
                  const alphaQuality = avifQuality.alphaQuality ?? opts.avifSettings.alphaQuality

                  return { colorQuality, alphaQuality }
                }

                const qualityMode = data.avifQuality?.usePerVariantQuality
                  ? 'per-variant'
                  : 'global'
                console.log(`[AVIF] Quality mode: ${qualityMode}`)

                // STEP 1: Deduplicate variants (skip sizes that would produce duplicate dimensions)
                const sizesToProcess = await deduplicateSizes(
                  req.file.data,
                  opts.sizes,
                  opts.validation.maxMegapixels.soft,
                )

                if (sizesToProcess.length === 0) {
                  throw new Error('No variants to generate (all sizes would be duplicates)')
                }

                console.log(
                  `[AVIF] Will generate ${sizesToProcess.length} variants: ${sizesToProcess.map((s) => s.targetWidth + 'w').join(', ')}`,
                )

                // STEP 2: Process each unique size
                const variants: ImageVariantWithBuffer[] = []
                const variantQualityMap: Record<number, { color: number; alpha: number }> = {}

                for (const { size } of sizesToProcess) {
                  const sizeLabel = size === 'full' ? 'full' : `${size}w`

                  // Get quality settings for this specific variant
                  const variantQuality = getQualityForVariant(size)
                  console.log(
                    `[AVIF] Generating variant: ${sizeLabel} (quality: color=${variantQuality.colorQuality}, alpha=${variantQuality.alphaQuality})`,
                  )

                  // 2.1. Resize with Sharp
                  const resizedBuffer = await resizeImage(
                    req.file.data,
                    size,
                    opts.validation.maxMegapixels.soft,
                  )

                  // 2.2. Encode with avifenc CLI
                  const startEncode = Date.now()
                  const avifBuffer = await encodeAvif(
                    resizedBuffer,
                    {
                      colorQuality: variantQuality.colorQuality,
                      alphaQuality: variantQuality.alphaQuality,
                      bitDepth: opts.avifSettings.bitDepth,
                      speed: opts.avifSettings.speed,
                    },
                    opts.timeout,
                  )
                  const encodeTime = Date.now() - startEncode

                  // 2.3. Get actual dimensions
                  const { width: variantWidth, height: variantHeight } =
                    await sharp(avifBuffer).metadata()

                  if (!variantWidth || !variantHeight) {
                    throw new Error('Could not read AVIF dimensions')
                  }

                  // Track quality used for this variant (by width for metadata storage)
                  variantQualityMap[variantWidth] = {
                    color: variantQuality.colorQuality,
                    alpha: variantQuality.alphaQuality,
                  }

                  const sizeMB = (avifBuffer.length / (1024 * 1024)).toFixed(2)
                  console.log(`[AVIF] Generated ${variantWidth}w: ${sizeMB}MB in ${encodeTime}ms`)

                  variants.push({
                    buffer: avifBuffer,
                    url: '', // Will be set after upload
                    width: variantWidth,
                    height: variantHeight,
                    fileSize: avifBuffer.length,
                  })
                }

                // STEP 3: Upload all variants to R2
                console.log(`[AVIF] Uploading ${variants.length} variants to R2...`)
                const uploadedVariants: ImageVariant[] = []

                for (const variant of variants) {
                  const filename = `${docId}-${variant.width}w.avif`
                  const key = `${opts.imageStorage.prefix}/${filename}`

                  const url = await uploadToR2(variant.buffer, key, opts.imageStorage)
                  uploadedKeys.push(key) // Track for potential cleanup

                  console.log(`[AVIF] Uploaded ${variant.width}w to R2`)

                  const q = variantQualityMap[variant.width!]
                  uploadedVariants.push({
                    url,
                    width: variant.width,
                    height: variant.height,
                    fileSize: variant.fileSize,
                    colorQuality: q?.color ?? opts.avifSettings.colorQuality,
                    alphaQuality: q?.alpha ?? opts.avifSettings.alphaQuality,
                  })
                }

                // STEP 4: Cleanup temp files
                console.log(`[AVIF] Cleaning up temp files...`)
                await deleteTempFile(tempFilePath)
                await cleanupAvifencTempFiles()

                // STEP 5: Return complete data
                // Set url to largest variant - users will fetch directly from R2
                const largestVariant = [...uploadedVariants].sort(
                  (a, b) => (b.width || 0) - (a.width || 0),
                )[0]

                // Calculate total size for logging
                const totalSizeBytes = uploadedVariants.reduce(
                  (sum, v) => sum + (v.fileSize || 0),
                  0,
                )
                const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2)
                console.log(
                  `[AVIF] Processing complete: ${uploadedVariants.length} variants, ${totalSizeMB}MB total`,
                )

                // Verify we have valid dimensions and filesize
                if (!width || !height) {
                  throw new Error('Could not read original image dimensions')
                }
                if (!largestVariant.fileSize || largestVariant.fileSize === 0) {
                  throw new Error('No valid file size for largest variant')
                }

                return {
                  ...data,
                  avifQuality: undefined,
                  filename: req.file.name,
                  mimeType: 'image/avif', // Update to AVIF since we converted it
                  filesize: largestVariant.fileSize, // Show size of largest variant (most representative)
                  width,
                  height,
                  url: largestVariant.url, // Point directly to R2
                  variants: uploadedVariants,
                }
              } catch (err) {
                console.error(`[AVIF] Failed to process image ${req.file.name}:`, err)

                // Cleanup temp file
                await deleteTempFile(tempFilePath)
                await cleanupAvifencTempFiles()

                // Cleanup uploaded R2 files on error
                if (uploadedKeys.length > 0) {
                  try {
                    await deleteMultipleFromR2(uploadedKeys, opts.imageStorage)
                    console.log(`[AVIF] Cleaned up ${uploadedKeys.length} R2 files after error`)
                  } catch (deleteErr) {
                    console.error(`[AVIF] Failed to cleanup R2 files:`, deleteErr)
                  }
                }

                // Re-throw - Payload won't create document
                throw err
              }
            },
          ],
          // STEP 2: Cleanup R2 files when document is deleted
          afterDelete: [
            ...(collection.hooks?.afterDelete || []),
            async ({ doc }) => {
              // Handle video cleanup
              if (doc.mimeType?.startsWith('video/')) {
                if (!doc.url) return

                try {
                  const keysToDelete: string[] = []

                  // Extract video key from URL
                  const videoUrl = new URL(doc.r2Url || doc.url)
                  const videoKey = videoUrl.pathname.substring(1) // Remove leading slash
                  keysToDelete.push(videoKey)

                  // Extract thumbnail key if exists
                  if (doc.thumbnailURL) {
                    const thumbnailUrl = new URL(doc.thumbnailURL)
                    const thumbnailKey = thumbnailUrl.pathname.substring(1)
                    keysToDelete.push(thumbnailKey)
                  }

                  // Delete video and thumbnail from R2
                  await deleteMultipleFromR2(keysToDelete, opts.videoStorage)

                  console.log(
                    `[VIDEO] Deleted ${keysToDelete.length} R2 files for document ${doc.id}`,
                  )
                } catch (err) {
                  console.error(`[VIDEO] Failed to delete R2 files for document ${doc.id}:`, err)
                  // Don't throw - document is already deleted from database
                }

                return
              }

              // Handle AVIF image cleanup
              // Only cleanup if document has variants (was successfully processed)
              if (!doc.variants?.length) return

              try {
                // Extract R2 keys from variant URLs (uses actual stored URLs)
                const keys = getR2KeysFromVariants(doc.variants)

                // Delete all variants from R2
                await deleteMultipleFromR2(keys, opts.imageStorage)

                console.log(`[AVIF] Deleted ${keys.length} R2 files for document ${doc.id}`)
              } catch (err) {
                console.error(`[AVIF] Failed to delete R2 files for document ${doc.id}:`, err)
                // Don't throw - document is already deleted from database
                // R2 files will become orphaned but won't break anything
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
export type { MediaProcessorOptions } from './types'
