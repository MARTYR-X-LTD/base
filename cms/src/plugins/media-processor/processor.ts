import sharp from 'sharp'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import type { MediaProcessorOptions } from './types'

const execFileAsync = promisify(execFile)

export async function resizeImage(
  buffer: Buffer,
  targetSize: number | 'full',
  softMegapixelLimit: number,
): Promise<Buffer> {
  const image = sharp(buffer)
  const { width, height, format } = await image.metadata()

  if (!width || !height) {
    throw new Error('Could not read image dimensions')
  }

  // Convert to PNG if not already (avifenc accepts only PNG/JPG)
  let pngBuffer = buffer
  if (format !== 'png' && format !== 'jpeg') {
    pngBuffer = await image.png().toBuffer()
  }

  if (targetSize === 'full') {
    const megapixels = (width * height) / 1_000_000

    // Auto-resize if exceeds soft limit (eg. 20MP)
    // Hard limit (eg. 40MP) already checked in validateUpload()
    if (megapixels > softMegapixelLimit) {
      const scale = Math.sqrt(softMegapixelLimit / megapixels)
      const newWidth = Math.round(width * scale)

      return sharp(pngBuffer)
        .resize(newWidth, null, {
          kernel: 'mks2021',
          withoutEnlargement: true,
        })
        .png()
        .toBuffer()
    }

    // Keep as-is if ≤ soft limit (eg. 20MP)
    return pngBuffer
  }

  // Resize to target width (eg. 1200, 3000)
  return sharp(pngBuffer)
    .resize(targetSize, null, {
      kernel: 'mks2021',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer()
}

export async function encodeAvif(
  pngBuffer: Buffer,
  settings: {
    colorQuality: number
    alphaQuality: number
    bitDepth: number
    speed: number
  },
  timeout: number,
): Promise<Buffer> {
  const tmpInput = `/tmp/${randomUUID()}.png`
  const tmpOutput = `/tmp/${randomUUID()}.avif`

  try {
    // Write input
    await fs.writeFile(tmpInput, pngBuffer)

    // Encode with avifenc
    await execFileAsync(
      'avifenc',
      [
        '--qcolor',
        settings.colorQuality.toString(),
        '--qalpha',
        settings.alphaQuality.toString(),
        '--depth',
        settings.bitDepth.toString(),
        '--speed',
        settings.speed.toString(),
        '-a',
        'tune=iq', // Always use perceptual quality tuning (hardcoded)
        tmpInput,
        tmpOutput,
      ],
      {
        timeout,
      },
    )

    // Read output
    return await fs.readFile(tmpOutput)
  } finally {
    // Cleanup
    await fs.unlink(tmpInput).catch(() => {})
    await fs.unlink(tmpOutput).catch(() => {})
  }
}

export async function validateUpload(
  file: { data: Buffer; name: string },
  validation: MediaProcessorOptions['validation'],
) {
  // Hard limit: File size
  const fileSizeMB = file.data.length / (1024 * 1024)
  if (fileSizeMB > validation.maxFileSizeMB) {
    throw new Error(
      `File size exceeds ${validation.maxFileSizeMB}MB. ` +
        `Your file is ${fileSizeMB.toFixed(1)}MB. Please compress before uploading.`,
    )
  }

  const { format, width, height } = await sharp(file.data).metadata()

  // Check format
  if (!format || !validation.allowedFormats.includes(format)) {
    throw new Error(`Invalid format: ${format}. Allowed: ${validation.allowedFormats.join(', ')}`)
  }

  // Hard limit: Megapixels (protect server from huge images)
  if (width && height) {
    const megapixels = (width * height) / 1_000_000
    if (megapixels > validation.maxMegapixels.hard) {
      throw new Error(
        `Image exceeds ${validation.maxMegapixels.hard} megapixels (${megapixels.toFixed(1)}MP). ` +
          `This would overload the server. Please resize before uploading.`,
      )
    }
    // Note: Soft limit (20MP) handled in resizeImage() - auto-resizes instead of rejecting
  }
}

/**
 * Deduplicate sizes: Skip sizes that would produce duplicate dimensions
 *
 * Example: Original is 2400px
 * - 1200: Would resize to 1200px
 * - 3000: Would stay at 2400px (withoutEnlargement)
 * - full: Would stay at 2400px
 * Result: Skip 3000 (duplicate of full)
 */
export async function deduplicateSizes(
  buffer: Buffer,
  sizes: Array<number | 'full'>,
  softMegapixelLimit: number,
): Promise<Array<{ size: number | 'full'; targetWidth: number }>> {
  const { width: originalWidth, height: originalHeight } = await sharp(buffer).metadata()

  if (!originalWidth || !originalHeight) {
    throw new Error('Could not read original image dimensions')
  }

  // Calculate what dimensions each size would produce
  const sizeCalculations: Array<{ size: number | 'full'; targetWidth: number }> = []

  for (const size of sizes) {
    if (size === 'full') {
      // Full size with soft limit applied
      const megapixels = (originalWidth * originalHeight) / 1_000_000

      if (megapixels > softMegapixelLimit) {
        // Would auto-resize to soft limit
        const scale = Math.sqrt(softMegapixelLimit / megapixels)
        const targetWidth = Math.round(originalWidth * scale)
        sizeCalculations.push({ size, targetWidth })
      } else {
        // Would stay at original size
        sizeCalculations.push({ size, targetWidth: originalWidth })
      }
    } else {
      // Numbered size (e.g., 1200, 3000)
      // withoutEnlargement means it can't go bigger than original
      const targetWidth = Math.min(size, originalWidth)
      sizeCalculations.push({ size, targetWidth })
    }
  }

  // Deduplicate: Keep only unique target widths
  const seen = new Set<number>()
  const unique: Array<{ size: number | 'full'; targetWidth: number }> = []

  for (const calc of sizeCalculations) {
    if (!seen.has(calc.targetWidth)) {
      seen.add(calc.targetWidth)
      unique.push(calc)
    } else {
      console.log(
        `[AVIF] Skipping size ${calc.size} (would produce duplicate ${calc.targetWidth}px variant)`,
      )
    }
  }

  return unique
}

/**
 * Clean up temporary avifenc files (*.png and *.avif with UUID patterns)
 */
export async function cleanupAvifencTempFiles(): Promise<void> {
  try {
    const files = await fs.readdir('/tmp')
    const avifencFiles = files.filter(
      (file) =>
        (/\.avif$/.test(file) || /\.png$/.test(file)) && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(file),
    )

    for (const file of avifencFiles) {
      await fs.unlink(`/tmp/${file}`).catch(() => {})
    }

    if (avifencFiles.length > 0) {
      console.log(`[AVIF] Cleaned up ${avifencFiles.length} avifenc temp files`)
    }
  } catch (err) {
    console.warn('[AVIF] Failed to cleanup avifenc temp files:', err)
  }
}
