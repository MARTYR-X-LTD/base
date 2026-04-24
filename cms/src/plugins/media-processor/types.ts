/**
 * R2 Storage Configuration
 */
export interface R2StorageConfig {
  bucket: string // R2 bucket name
  prefix: string // 'prod/images', 'prod/videos', etc.
  endpoint: string // R2 S3-compatible endpoint
  credentials: {
    accessKeyId: string
    secretAccessKey: string
  }
  publicUrl: string // Custom domain (https://media.martyr.shop)
}

/**
 * Media Processor Plugin Options
 *
 * Configuration for processing different media types:
 * - Images (PNG/JPG/WebP): Use avifSettings for AVIF conversion
 * - Videos (MP4/WebM/MOV): Metadata extraction and thumbnail generation
 * - SVG: No processing, direct upload
 */
export interface MediaProcessorOptions {
  sizes: Array<number | 'full'> // [1200, 3000, 'full'] - for image variants

  avifSettings: {
    colorQuality: number // 0-100
    alphaQuality: number // 0-100
    bitDepth: 8 | 10 | 12 // Always 10 in our case
    speed: number // 0-10, fixed at 6
  }

  validation: {
    maxMegapixels: {
      soft: number // 20 - auto-resize if exceeded
      hard: number // 40 - reject if exceeded (protect server)
    }
    maxFileSizeMB: number // 60 - hard reject
    allowedFormats: string[] // ['png', 'jpg', 'jpeg', 'webp']
  }

  timeout: number // 120000 (2 minutes per image)

  // Separate storage configs for different media types
  imageStorage: R2StorageConfig // For AVIF images
  videoStorage: R2StorageConfig // For videos + thumbnails

  // Admin UI thumbnail preference (tries each in order until found)
  adminThumbnailPriority?: string[] // Default: ['1200w', '3000w', 'original']
}


export interface ImageVariant {
  url: string
  width: number
  height: number
  fileSize: number
  colorQuality: number
  alphaQuality: number
}
