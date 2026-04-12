import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import type { R2StorageConfig } from './types'

export async function uploadToR2(
  buffer: Buffer,
  key: string,
  config: R2StorageConfig & { contentType?: string }
): Promise<string> {
  const s3 = new S3Client({
    endpoint: config.endpoint,
    region: 'auto',
    credentials: config.credentials,
  })

  await s3.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: config.contentType || 'image/avif',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  )

  // Return public URL
  // key = 'prod/images/abc123-1200w.avif'
  return `${config.publicUrl}/${key}`
}
