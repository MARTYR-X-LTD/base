// cms/src/test/integration/media-processing.test.ts
// Full end-to-end test: image file → AVIF conversion → R2 upload → DB record.
// Uses the production Payload config (with mediaProcessor plugin) and real R2 credentials.
// Skipped automatically if R2 credentials are not configured.
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import path from 'path'
import { fileURLToPath } from 'url'
import { getR2Config } from '@/lib/r2-config'

// Use @/payload.config (full production config), not @payload-config (lean test config)
import config from '@/payload.config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const TEST_IMAGE_PATH = path.resolve(__dirname, '../fixtures/fragments-1.webp')

const hasRealR2 = Boolean(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCOUNT_ID !== 'dummy' &&
  process.env.R2_ACCESS_KEY_ID !== 'dummy',
)

/**
 * Delete every object under the test/ prefix in R2.
 * Runs before and after the suite to prevent orphan accumulation from crashed runs.
 */
async function purgeTestPrefix(): Promise<void> {
  const imageStorage = getR2Config('images')
  const videoStorage = getR2Config('videos')

  for (const storage of [imageStorage, videoStorage]) {
    const s3 = new S3Client({
      endpoint: storage.endpoint,
      region: 'auto',
      credentials: storage.credentials,
    })

    let continuationToken: string | undefined

    do {
      const list = await s3.send(
        new ListObjectsV2Command({
          Bucket: storage.bucket,
          Prefix: 'vitest/', // isolated prefix, never overlaps with local/ prod/ or monk-test
          ContinuationToken: continuationToken,
        }),
      )

      const keys = list.Contents?.map((o) => ({ Key: o.Key! })) ?? []

      if (keys.length > 0) {
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: storage.bucket,
            Delete: { Objects: keys, Quiet: true },
          }),
        )
        console.log(`[test] Purged ${keys.length} objects from R2 ${storage.prefix}`)
      }

      continuationToken = list.NextContinuationToken
    } while (continuationToken)
  }
}

let payload: Payload

beforeAll(async () => {
  payload = await getPayload({ config })
  if (hasRealR2) await purgeTestPrefix() // wipe any orphans from previous crashed runs
})

afterAll(async () => {
  if (hasRealR2) await purgeTestPrefix() // wipe everything regardless of test outcome
  await payload.destroy()
})

describe.skipIf(!hasRealR2)('Media processing pipeline (real R2)', () => {
  test('processes webp → AVIF variants and uploads to R2', async () => {
    const doc = await payload.create({
      collection: 'media',
      data: { alt: 'Test — fragments-1.webp (automated test, safe to delete)' },
      filePath: TEST_IMAGE_PATH,
      overrideAccess: true,
    })

    // Document was created
    expect(doc.id).toBeDefined()
    expect(doc.filename).toContain('fragments-1')
    expect(doc.mimeType).toBe('image/avif') // input webp is converted to AVIF by mediaProcessor

    // Variants were generated
    const variants = (doc as any).variants as Array<{
      url: string
      width: number
      height: number
      fileSize: number
    }>

    expect(Array.isArray(variants)).toBe(true)
    expect(variants.length).toBeGreaterThan(0)

    // Each variant is a real R2 URL with expected shape
    for (const variant of variants) {
      expect(variant.url).toMatch(/^https?:\/\//)
      expect(variant.url).toContain('vitest/images') // PAYLOAD_ENV=test → vitest/ prefix
      expect(variant.width).toBeGreaterThan(0)
      expect(variant.height).toBeGreaterThan(0)
      expect(variant.fileSize).toBeGreaterThan(0)
    }

    // At minimum we expect 600w and 1200w variants
    const widths = variants.map((v) => v.width)
    expect(widths).toContain(600)
    expect(widths).toContain(1200)

    console.log(`[test] Created doc ${doc.id} with ${variants.length} variants:`)
    for (const v of variants) {
      console.log(`  ${v.width}w → ${(v.fileSize / 1024).toFixed(1)}KB — ${v.url}`)
    }
  }, 120_000) // AVIF conversion can take time
})

