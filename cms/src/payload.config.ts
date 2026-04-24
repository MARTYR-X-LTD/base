// cms/src/payload.config.ts
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Works } from './collections/Works'
import { StoreProducts } from './collections/StoreProducts'
import { Categories } from './collections/Categories'
import { TagRegistry } from './collections/TagRegistry'
import { getR2Config } from './lib/r2-config'
import { mediaProcessor } from './plugins/media-processor'
import { svgProcessor } from './plugins/svg-processor'
import { onInit } from './instrumentation'
import { SITE_NAME, SITE_DESCRIPTION } from './lib/constants'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const imagesR2 = getR2Config('images') // For AVIF images
const videosR2 = getR2Config('videos') // For videos + thumbnails
const svgR2 = getR2Config('svg') // For SVG files (separate subfolder)

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET!,
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL ?? 'http://localhost:3000',
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(__dirname),
    },
    meta: {
      title: 'Dashboard',
      titleSuffix: `~ ${SITE_NAME}`,
      description: SITE_DESCRIPTION,
      robots: 'noindex, nofollow',
    },
  },
  folders: { browseByFolder: false },
  collections: [Users, Media, Works, StoreProducts, Categories, TagRegistry],
  endpoints: [
    {
      path: '/health',
      method: 'get',
      handler: (_req) => Response.json({ status: 'ok' }),
    },
  ],
  editor: lexicalEditor(),
  sharp,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI!,
    },
  }),
  plugins: [
    mediaProcessor({
      sizes: [600, 1200, 3000, 'full'],

      avifSettings: {
        colorQuality: 40,
        alphaQuality: 40,
        bitDepth: 10,
        speed: 6, // 6 is AVIFENC default
      },

      validation: {
        maxMegapixels: { soft: 20, hard: 40 },
        maxFileSizeMB: 60,
        allowedFormats: ['png', 'jpg', 'jpeg', 'webp'],
      },

      timeout: 120_000, // 2 minutes per image

      // Separate storage for images and videos
      imageStorage: imagesR2, // prod/images or local/images
      videoStorage: videosR2, // prod/videos or local/videos

      // Admin UI thumbnail priority (tries each in order)
      adminThumbnailPriority: ['600w', '1200w', '3000w', 'full'],
    }),
    svgProcessor({
      validation: {
        maxFileSizeMB: 0.5, // 500KB limit for SVG files
      },

      // SVG files stored in separate 'svg' subfolder
      storage: svgR2,
    }),
  ],
  onInit,
  typescript: {
    // Outputs to cms/src/payload-types.ts — matches web's @cms/* path alias
    outputFile: path.resolve(__dirname, 'payload-types.ts'),
  },
})
