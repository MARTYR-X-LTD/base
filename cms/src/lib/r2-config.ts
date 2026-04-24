// cms/src/lib/r2-config.ts
import type { R2StorageConfig } from '@/plugins/media-processor/types'

type StorageType = 'images' | 'videos' | 'svg'

/**
 * Build an R2StorageConfig for a given media type.
 * Uses environment-aware prefixes: prod/images, prod/videos, prod/svg when PAYLOAD_ENV=production;
 * local/images, local/videos, local/svg otherwise.
 */
export function getR2Config(type: StorageType): R2StorageConfig {
  const prefix =
    process.env.PAYLOAD_ENV === 'test'
      ? 'vitest'
      : (process.env.R2_PREFIX || 'local')
  return {
    bucket: process.env.R2_BUCKET!,
    prefix: `${prefix}/${type}`,
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    publicUrl: process.env.R2_PUBLIC_URL!,
  }
}
