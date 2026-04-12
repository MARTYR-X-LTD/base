# Media & SVG Processors Port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `media-processor` and `svg-processor` plugins from `~/martyr/martyrio/cms/` to `monk/cms/`, rewrite the `Media` collection to match, and wire everything into `payload.config.ts`.

**Architecture:** Two plugin factories injected into Payload config hook into the `media` collection via `beforeChange` / `afterRead` / `afterDelete`. Images → AVIF variants via `sharp` + `avifenc` CLI → R2. Videos → metadata + thumbnail via `node-av` → R2 (no re-encoding). SVGs → sanitize + dimensions → R2. A shared `r2-config.ts` builds typed R2 configs from env vars.

**Tech Stack:** `node-av` (video metadata + thumbnail), `@aws-sdk/client-s3` (R2 ops), `sharp` (image resize, already installed), `avifenc` CLI (already compiled in Dockerfile).

---

## File Structure

**Create:**
- `cms/src/lib/r2-config.ts` — builds `R2StorageConfig` from env vars per media type
- `cms/src/plugins/media-processor/types.ts` — `R2StorageConfig`, `MediaProcessorOptions`, `ImageVariant`
- `cms/src/plugins/media-processor/cleanup.ts` — R2 batch delete, temp file cleanup
- `cms/src/plugins/media-processor/uploader.ts` — `uploadToR2`
- `cms/src/plugins/media-processor/processor.ts` — `resizeImage`, `encodeAvif`, `validateUpload`
- `cms/src/plugins/media-processor/handler.ts` — file handler (redirects to R2)
- `cms/src/plugins/media-processor/index.ts` — plugin factory with image + video pipelines
- `cms/src/plugins/svg-processor/types.ts` — `SvgProcessorOptions`, `SvgDimensions`
- `cms/src/plugins/svg-processor/sanitizer.ts` — `sanitizeSvg`
- `cms/src/plugins/svg-processor/validator.ts` — `validateSvg`, `extractDimensions`, `stripXmlDeclaration`
- `cms/src/plugins/svg-processor/uploader.ts` — `uploadSvgToR2`
- `cms/src/plugins/svg-processor/cleanup.ts` — `getR2KeyFromUrl`
- `cms/src/plugins/svg-processor/index.ts` — plugin factory

**Modify:**
- `cms/package.json` — add `node-av`, `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`; add `pnpm.onlyBuiltDependencies`
- `cms/src/collections/Media.ts` — full rewrite with all fields, `disableLocalStorage`, `adminThumbnail`
- `cms/src/payload.config.ts` — call plugin factories with options
- `cms/src/instrumentation.ts` — update `cleanupOrphanedMedia` to use real implementation

---

## Task 1: Add npm dependencies

**Files:**
- Modify: `cms/package.json`

- [ ] **Step 1: Add deps and pnpm native binary config**

Edit `cms/package.json` — add three deps and `pnpm.onlyBuiltDependencies`:

```json
{
  "name": "monk-cms",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.30.3",
  "scripts": {
    "dev": "payload dev",
    "build": "payload build",
    "serve": "payload serve",
    "migrate": "payload migrate",
    "migrate:create": "payload migrate:create",
    "migrate:status": "payload migrate:status",
    "db:clone-prod": "./scripts/clone-prod-db.sh",
    "approve-builds": "pnpm approve-builds"
  },
  "dependencies": {
    "payload": "3.82.1",
    "@payloadcms/db-postgres": "3.82.1",
    "@payloadcms/richtext-lexical": "3.82.1",
    "@payloadcms/storage-s3": "3.82.1",
    "@aws-sdk/client-s3": "^3.1001.0",
    "@aws-sdk/lib-storage": "^3.1001.0",
    "node-av": "^5.2.2",
    "sharp": "0.34.5",
    "nanoid": "5.1.7"
  },
  "pnpm": {
    "onlyBuiltDependencies": [
      "sharp",
      "node-av"
    ]
  }
}
```

- [ ] **Step 2: Instruct user to install**

Tell the user: run `pnpm install` inside `cms/` in a separate terminal. This will download `node-av` native binaries (arm64/x64) and build `sharp`. It may take a minute.

- [ ] **Step 3: Verify TypeScript can find the new packages**

```bash
cd cms && pnpm exec tsc --noEmit 2>&1 | head -20
```

Expected: only existing errors (missing env vars etc), no `Cannot find module '@aws-sdk/client-s3'` or `node-av`.

- [ ] **Step 4: Commit**

```bash
git add cms/package.json cms/pnpm-lock.yaml
git commit -m "[cms] Deps: add node-av, @aws-sdk/client-s3, @aws-sdk/lib-storage"
```

---

## Task 2: Add `r2-config.ts` and update `.env.example`

**Files:**
- Create: `cms/src/lib/r2-config.ts`

- [ ] **Step 1: Create `r2-config.ts`**

```typescript
// cms/src/lib/r2-config.ts
import type { R2StorageConfig } from '@/plugins/media-processor/types'

type StorageType = 'images' | 'videos' | 'svg'

/**
 * Build an R2StorageConfig for a given media type.
 * Uses environment-aware prefixes: prod/images, prod/videos, prod/svg in production;
 * local/images, local/videos, local/svg otherwise.
 */
export function getR2Config(type: StorageType): R2StorageConfig {
  const env = process.env.NODE_ENV === 'production' ? 'prod' : 'local'
  return {
    bucket: process.env.R2_BUCKET!,
    prefix: `${env}/${type}`,
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    publicUrl: process.env.R2_PUBLIC_URL!,
  }
}
```

- [ ] **Step 2: Add `R2_PUBLIC_URL` and `NODE_ENV` to `.env.example`**

This file cannot be written by Claude (`.env*` is permission-blocked). Instruct user to add to `cms/.env.example` and `cms/.env`:

```
# Public URL for R2 media (custom domain or r2.dev URL)
R2_PUBLIC_URL=https://pub-xxxxxxxxxxxxxxxx.r2.dev

NODE_ENV=development
```

- [ ] **Step 3: Commit**

```bash
git add cms/src/lib/r2-config.ts
git commit -m "[cms] r2-config: add R2StorageConfig builder helper"
```

---

## Task 3: Port `media-processor` utility files

**Files:**
- Create: `cms/src/plugins/media-processor/types.ts`
- Create: `cms/src/plugins/media-processor/cleanup.ts`
- Create: `cms/src/plugins/media-processor/uploader.ts`
- Create: `cms/src/plugins/media-processor/handler.ts`

- [ ] **Step 1: Write `types.ts`**

```typescript
// cms/src/plugins/media-processor/types.ts

export interface R2StorageConfig {
  bucket: string
  prefix: string       // e.g. 'prod/images', 'local/videos'
  endpoint: string     // R2 S3-compatible endpoint
  credentials: {
    accessKeyId: string
    secretAccessKey: string
  }
  publicUrl: string    // Custom domain, e.g. https://media.monk.studio
}

export interface MediaProcessorOptions {
  sizes: Array<number | 'full'>   // e.g. [600, 1200, 3000, 'full']

  avifSettings: {
    colorQuality: number          // 0-100
    alphaQuality: number          // 0-100
    bitDepth: 8 | 10 | 12
    speed: number                 // 0-10, 6 is avifenc default
  }

  validation: {
    maxMegapixels: {
      soft: number                // auto-resize above this (e.g. 20)
      hard: number                // reject above this (e.g. 40)
    }
    maxFileSizeMB: number         // hard reject (e.g. 60)
    allowedFormats: string[]      // e.g. ['png', 'jpg', 'jpeg', 'webp']
  }

  timeout: number                 // ms per image encode (e.g. 120_000)

  imageStorage: R2StorageConfig   // for AVIF variants
  videoStorage: R2StorageConfig   // for original video + thumbnail
}

export interface ImageVariant {
  url: string
  width: number
  height: number
  fileSize: number
}
```

- [ ] **Step 2: Write `cleanup.ts`**

```typescript
// cms/src/plugins/media-processor/cleanup.ts
import {
  S3Client,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3'
import fs from 'fs/promises'
import type { R2StorageConfig } from './types'

export async function deleteFromR2(key: string, config: R2StorageConfig): Promise<void> {
  const s3 = new S3Client({
    endpoint: config.endpoint,
    region: 'auto',
    credentials: config.credentials,
  })
  await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
  console.log(`[R2] Deleted: ${key}`)
}

export async function deleteMultipleFromR2(
  keys: string[],
  config: R2StorageConfig,
): Promise<void> {
  if (keys.length === 0) return

  const s3 = new S3Client({
    endpoint: config.endpoint,
    region: 'auto',
    credentials: config.credentials,
  })

  // Batch in chunks of 1000 (S3 API limit)
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000)
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: config.bucket,
        Delete: {
          Objects: chunk.map((key) => ({ Key: key })),
          Quiet: true,
        },
      }),
    )
    console.log(`[R2] Deleted ${chunk.length} files`)
  }
}

/**
 * Extract R2 key from a full public URL.
 * e.g. https://media.monk.studio/prod/images/abc-1200w.avif → prod/images/abc-1200w.avif
 * Always extract from URL pathname — never reconstruct from config prefix,
 * so cleanup still works if prefix changes.
 */
export function getR2KeysFromVariants(variants: Array<{ url: string }>): string[] {
  return variants.map((v) => new URL(v.url).pathname.substring(1))
}

export async function deleteTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
    console.log(`[AVIF] Deleted temp file: ${filePath}`)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`[AVIF] Failed to delete temp file ${filePath}:`, err)
    }
  }
}

/**
 * Clean up orphaned temp files matching `*-original.*` in /tmp.
 * Called on CMS boot via instrumentation.ts.
 */
export async function cleanupOrphanedTempFiles(): Promise<void> {
  try {
    const files = await fs.readdir('/tmp')
    const orphaned = files.filter((f) => /-original\./.test(f))
    for (const file of orphaned) {
      await deleteTempFile(`/tmp/${file}`)
    }
    if (orphaned.length > 0) {
      console.log(`[AVIF] Cleaned up ${orphaned.length} orphaned temp files from /tmp`)
    }
  } catch (err) {
    console.error('[AVIF] Temp file cleanup failed:', err)
  }
}

/**
 * Clean up any leftover avifenc output files (.avif) from /tmp.
 */
export async function cleanupAvifencTempFiles(): Promise<void> {
  try {
    const files = await fs.readdir('/tmp')
    const avifFiles = files.filter((f) => f.endsWith('.avif') || (f.endsWith('.png') && f.includes('-')))
    for (const file of avifFiles) {
      await deleteTempFile(`/tmp/${file}`)
    }
  } catch {
    // Non-fatal
  }
}
```

- [ ] **Step 3: Write `uploader.ts`**

```typescript
// cms/src/plugins/media-processor/uploader.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import type { R2StorageConfig } from './types'

export async function uploadToR2(
  buffer: Buffer,
  key: string,
  config: R2StorageConfig,
  contentType?: string,
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
      ContentType: contentType ?? 'application/octet-stream',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  return `${config.publicUrl}/${key}`
}
```

- [ ] **Step 4: Write `handler.ts`**

```typescript
// cms/src/plugins/media-processor/handler.ts
import type { PayloadRequest, TypeWithID } from 'payload'

/**
 * Minimal file handler — since disableLocalStorage is true, redirect direct
 * file requests to the R2 public URL rather than trying to read from disk.
 */
export const createFileHandler = () => {
  return async (
    _req: PayloadRequest,
    { doc }: { doc: TypeWithID },
  ): Promise<Response> => {
    const mediaDoc = doc as TypeWithID & { url?: string }
    if (!mediaDoc?.url) {
      return new Response('File not found', { status: 404 })
    }
    return Response.redirect(mediaDoc.url, 302)
  }
}
```

- [ ] **Step 5: Type-check**

```bash
cd cms && pnpm exec tsc --noEmit 2>&1 | grep -E "media-processor/(types|cleanup|uploader|handler)"
```

Expected: no errors from these files.

- [ ] **Step 6: Commit**

```bash
git add cms/src/plugins/media-processor/types.ts \
        cms/src/plugins/media-processor/cleanup.ts \
        cms/src/plugins/media-processor/uploader.ts \
        cms/src/plugins/media-processor/handler.ts
git commit -m "[cms] media-processor: add types, cleanup, uploader, handler"
```

---

## Task 4: Port `media-processor/processor.ts`

**Files:**
- Create: `cms/src/plugins/media-processor/processor.ts`

- [ ] **Step 1: Write `processor.ts`**

```typescript
// cms/src/plugins/media-processor/processor.ts
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

  // Normalize to PNG (avifenc accepts PNG and JPG)
  let pngBuffer = buffer
  if (format !== 'png' && format !== 'jpeg') {
    pngBuffer = await sharp(buffer).png().toBuffer()
  }

  if (targetSize === 'full') {
    const megapixels = (width * height) / 1_000_000
    if (megapixels > softMegapixelLimit) {
      const scale = Math.sqrt(softMegapixelLimit / megapixels)
      const newWidth = Math.round(width * scale)
      return sharp(pngBuffer)
        .resize(newWidth, null, { kernel: 'mks2021', withoutEnlargement: true })
        .png()
        .toBuffer()
    }
    return pngBuffer
  }

  return sharp(pngBuffer)
    .resize(targetSize, null, { kernel: 'mks2021', withoutEnlargement: true })
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
    await fs.writeFile(tmpInput, pngBuffer)

    await execFileAsync(
      'avifenc',
      [
        '--qcolor', settings.colorQuality.toString(),
        '--qalpha', settings.alphaQuality.toString(),
        '--depth', settings.bitDepth.toString(),
        '--speed', settings.speed.toString(),
        tmpInput,
        tmpOutput,
      ],
      { timeout },
    )

    const avifBuffer = await fs.readFile(tmpOutput)
    return avifBuffer
  } finally {
    await fs.unlink(tmpInput).catch(() => {})
    await fs.unlink(tmpOutput).catch(() => {})
  }
}

export async function validateUpload(
  file: { data: Buffer; name: string; mimetype: string },
  validation: MediaProcessorOptions['validation'],
): Promise<void> {
  const fileSizeMB = file.data.length / (1024 * 1024)
  if (fileSizeMB > validation.maxFileSizeMB) {
    throw new Error(
      `File size ${fileSizeMB.toFixed(1)}MB exceeds limit of ${validation.maxFileSizeMB}MB`,
    )
  }

  const { format, width, height } = await sharp(file.data).metadata()

  if (!format || !validation.allowedFormats.includes(format)) {
    throw new Error(`Invalid format: ${format}. Allowed: ${validation.allowedFormats.join(', ')}`)
  }

  if (width && height) {
    const megapixels = (width * height) / 1_000_000
    if (megapixels > validation.maxMegapixels.hard) {
      throw new Error(
        `Image ${megapixels.toFixed(1)}MP exceeds hard limit of ${validation.maxMegapixels.hard}MP`,
      )
    }
  }
}

export function deduplicateSizes(sizes: Array<number | 'full'>): Array<number | 'full'> {
  return [...new Set(sizes)]
}

/**
 * Resize a JPEG buffer to max 1 megapixel (for video thumbnails).
 */
export async function resizeThumbnail(
  buffer: Buffer,
  originalWidth: number,
  originalHeight: number,
): Promise<Buffer> {
  const currentPixels = originalWidth * originalHeight
  const MAX_PIXELS = 1_000_000

  if (currentPixels <= MAX_PIXELS) return buffer

  const scale = Math.sqrt(MAX_PIXELS / currentPixels)
  const newWidth = Math.round(originalWidth * scale)
  const newHeight = Math.round(originalHeight * scale)

  console.log(
    `[VIDEO] Resizing thumbnail ${originalWidth}x${originalHeight} → ${newWidth}x${newHeight}`,
  )

  return sharp(buffer).resize(newWidth, newHeight, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer()
}

/**
 * Smart thumbnail frame selection — deterministic, avoids intro/outro.
 */
export function pickThumbnailTimestamp(duration: number): number {
  if (duration <= 0) return 0

  const MIN_SKIP = 0.3
  const MAX_SKIP = 1.0
  const END_MARGIN = 0.2
  const EARLY_BIAS = 0.15
  const MAX_EARLY_WINDOW = 30.0

  const skip = Math.min(MAX_SKIP, Math.max(MIN_SKIP, duration * 0.1))
  const start = skip
  const end = Math.min(start + MAX_EARLY_WINDOW, duration - END_MARGIN)

  if (start >= end) return Math.max(0, duration * 0.1)

  return start + (end - start) * EARLY_BIAS
}
```

- [ ] **Step 2: Verify avifenc is available in Docker**

The monk `cms/Dockerfile` already compiles `avifenc` from source (Stage 1: libavif builder). No Dockerfile changes needed. For local dev, `avifenc` must be installed separately. Check:

```bash
which avifenc || echo "avifenc not found — install it for local image uploads"
```

On macOS: `brew install libavif`

- [ ] **Step 3: Type-check**

```bash
cd cms && pnpm exec tsc --noEmit 2>&1 | grep "processor.ts"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add cms/src/plugins/media-processor/processor.ts
git commit -m "[cms] media-processor: add processor (resize, AVIF encode, validate)"
```

---

## Task 5: Port `media-processor/index.ts` — the full plugin

**Files:**
- Modify: `cms/src/plugins/media-processor/index.ts`

- [ ] **Step 1: Write the full plugin factory**

```typescript
// cms/src/plugins/media-processor/index.ts
import type { Config, Field } from 'payload'
import type { MediaProcessorOptions, ImageVariant } from './types'
import {
  validateUpload,
  deduplicateSizes,
  resizeImage,
  encodeAvif,
  resizeThumbnail,
  pickThumbnailTimestamp,
  cleanupAvifencTempFiles,
} from './processor'
import { deleteTempFile, deleteMultipleFromR2, deleteFromR2, getR2KeysFromVariants } from './cleanup'
import { uploadToR2 } from './uploader'
import { nanoid } from 'nanoid'
import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'
import { Demuxer, Decoder, Encoder, FF_ENCODER_MJPEG } from 'node-av'

// ─── Admin UI fields ──────────────────────────────────────────────────────────

function createMediaProcessorFields(opts: MediaProcessorOptions): Field[] {
  return [
    {
      name: 'avifQuality',
      type: 'group',
      admin: {
        position: 'sidebar',
        condition: (data) => !data.id,
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
                  admin: { width: '50%' },
                },
                {
                  name: 'alphaQuality',
                  type: 'number',
                  label: 'Alpha Q',
                  defaultValue: opts.avifSettings.alphaQuality,
                  min: 0,
                  max: 100,
                  admin: { width: '50%' },
                },
              ],
            },
            ...opts.sizes.map((size) => {
              const label = size === 'full' ? 'Full Size' : `${size}w`
              const key = size === 'full' ? 'full' : size.toString()
              return {
                type: 'row' as const,
                admin: {
                  condition: (data: Record<string, unknown>) =>
                    (data.avifQuality as Record<string, unknown>)?.usePerVariantQuality === true,
                },
                fields: [
                  {
                    name: `colorQuality_${key}`,
                    type: 'number' as const,
                    label: `${label} Color Q`,
                    defaultValue: opts.avifSettings.colorQuality,
                    min: 0,
                    max: 100,
                    admin: { width: '50%' },
                  },
                  {
                    name: `alphaQuality_${key}`,
                    type: 'number' as const,
                    label: `${label} Alpha Q`,
                    defaultValue: opts.avifSettings.alphaQuality,
                    min: 0,
                    max: 100,
                    admin: { width: '50%' },
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

// ─── Plugin factory ───────────────────────────────────────────────────────────

export const mediaProcessor = (opts: MediaProcessorOptions) => {
  return (config: Config): Config => {
    config.collections = config.collections?.map((collection) => {
      if (collection.slug !== 'media') return collection

      return {
        ...collection,
        fields: [...(collection.fields || []), ...createMediaProcessorFields(opts)],
        upload: {
          ...(typeof collection.upload === 'object' ? collection.upload : {}),
        },
        hooks: {
          ...collection.hooks,

          // ── afterRead: restore R2 URLs that Payload reconstructed from filename ──
          afterRead: [
            ...(collection.hooks?.afterRead || []),
            async ({ doc }) => {
              // Videos
              if (doc.mimeType?.startsWith('video/')) {
                if (doc.r2Url && doc.url && !doc.url.startsWith('http')) {
                  doc.url = doc.r2Url
                }
                delete doc.variants
                delete doc.processingMetadata
                delete doc.avifQuality
                delete doc.svgContent
                delete doc.r2Url
                return doc
              }

              // AVIF images
              if (Array.isArray(doc.variants) && doc.variants.length > 0) {
                if (doc.url && !doc.url.startsWith('http')) {
                  const largest = [...doc.variants].sort(
                    (a, b) => (b.width || 0) - (a.width || 0),
                  )[0]
                  if (largest?.url) doc.url = largest.url
                }
                delete doc.processingMetadata
                delete doc.avifQuality
                delete doc.r2Url
                delete doc.svgContent
                return doc
              }

              return doc
            },
          ],

          // ── beforeChange: process image or video on create ────────────────────
          beforeChange: [
            ...(collection.hooks?.beforeChange || []),
            async ({ data, req, operation }) => {
              if (operation !== 'create') return data
              if (!req.file) return data
              if (req.file.mimetype === 'image/svg+xml') return data // SVG processor handles this

              // ── VIDEO ────────────────────────────────────────────────────────
              if (req.file.mimetype.startsWith('video/')) {
                const docId = nanoid()
                const uploadedKeys: string[] = []
                console.log(`[VIDEO] Processing ${req.file.name} (ID: ${docId})`)

                try {
                  await using input = await Demuxer.open(req.file.data)
                  const videoStream = input.streams.find((s) => s.type === 'video')
                  if (!videoStream) throw new Error('No video stream found')

                  const width = videoStream.width ?? null
                  const height = videoStream.height ?? null
                  const durationRaw = input.duration ? Number(input.duration) : 0
                  const duration = Math.round(durationRaw * 100) / 100
                  const fpsRaw = videoStream.avgFrameRate
                    ? videoStream.avgFrameRate.num / videoStream.avgFrameRate.den
                    : null
                  const fps = fpsRaw !== null ? Math.round(fpsRaw * 100) / 100 : null

                  console.log(`[VIDEO] ${width}x${height}, ${duration}s, ${fps ?? '?'} fps`)

                  const ext = path.extname(req.file.name)
                  const videoFilename = `${docId}-original${ext}`
                  const videoKey = `${opts.videoStorage.prefix}/${videoFilename}`

                  const videoUrl = await uploadToR2(
                    req.file.data,
                    videoKey,
                    opts.videoStorage,
                    req.file.mimetype,
                  )
                  uploadedKeys.push(videoKey)
                  console.log(`[VIDEO] Uploaded: ${videoUrl}`)

                  // Thumbnail
                  let thumbnailUrl: string | null = null
                  try {
                    const ts = pickThumbnailTimestamp(duration)
                    console.log(`[VIDEO] Thumbnail at ${ts.toFixed(2)}s`)

                    await using decoder = await Decoder.create(videoStream)
                    await using jpegEncoder = await Encoder.create(FF_ENCODER_MJPEG, {
                      decoder,
                      bitrate: '2M',
                      options: { strict: 'experimental' },
                    })

                    outer: for await (using packet of input.packets(videoStream)) {
                      for await (using frame of decoder.frames(packet)) {
                        const frameTs = frame.pts ? Number(frame.pts) * Number(videoStream.timeBase?.den ? 1 / videoStream.timeBase.den : 1) : 0
                        if (frameTs < ts) continue

                        for await (using jpegPacket of jpegEncoder.packets(frame)) {
                          if (jpegPacket?.data) {
                            const resized = await resizeThumbnail(
                              jpegPacket.data,
                              frame.width,
                              frame.height,
                            )
                            const thumbFilename = `${docId}-thumbnail.jpg`
                            const thumbKey = `${opts.videoStorage.prefix}/${thumbFilename}`
                            thumbnailUrl = await uploadToR2(resized, thumbKey, opts.videoStorage, 'image/jpeg')
                            uploadedKeys.push(thumbKey)
                            console.log(`[VIDEO] Thumbnail uploaded: ${thumbnailUrl}`)
                            break outer
                          }
                        }
                      }
                    }
                  } catch (thumbErr) {
                    console.error('[VIDEO] Thumbnail generation failed (non-fatal):', thumbErr)
                  }

                  return {
                    ...data,
                    id: docId,
                    filename: req.file.name,
                    mimeType: req.file.mimetype,
                    filesize: req.file.data.length,
                    width,
                    height,
                    url: videoUrl,
                    r2Url: videoUrl,
                    mediaType: 'video',
                    thumbnailURL: thumbnailUrl ?? undefined,
                    videoMetadata: { duration, fps, width, height },
                  }
                } catch (err) {
                  if (uploadedKeys.length > 0) {
                    await deleteMultipleFromR2(uploadedKeys, opts.videoStorage).catch(() => {})
                  }
                  throw new Error(`Video processing failed: ${err instanceof Error ? err.message : err}`)
                }
              }

              // ── IMAGE (PNG / JPG / WebP) ─────────────────────────────────────
              const docId = nanoid()
              const ext = path.extname(req.file.name)
              const tempFilePath = `/tmp/${docId}-original${ext}`
              const uploadedKeys: string[] = []

              try {
                console.log(`[AVIF] Processing ${req.file.name} (ID: ${docId})`)
                await validateUpload(req.file, opts.validation)

                const { width, height } = await sharp(req.file.data).metadata()
                console.log(`[AVIF] Dimensions: ${width}x${height}`)

                await fs.writeFile(tempFilePath, req.file.data)

                const sizes = deduplicateSizes(opts.sizes)
                const variants: Array<ImageVariant & { buffer: Buffer }> = []

                // Per-variant quality helper
                const getQuality = (size: number | 'full') => {
                  const avifQ = (data as any).avifQuality
                  if (!avifQ?.usePerVariantQuality) {
                    return {
                      colorQuality: avifQ?.colorQuality ?? opts.avifSettings.colorQuality,
                      alphaQuality: avifQ?.alphaQuality ?? opts.avifSettings.alphaQuality,
                    }
                  }
                  const key = size === 'full' ? 'full' : size.toString()
                  return {
                    colorQuality: avifQ?.[`colorQuality_${key}`] ?? opts.avifSettings.colorQuality,
                    alphaQuality: avifQ?.[`alphaQuality_${key}`] ?? opts.avifSettings.alphaQuality,
                  }
                }

                for (const size of sizes) {
                  const sizeLabel = size === 'full' ? 'full' : `${size}w`
                  const quality = getQuality(size)
                  console.log(`[AVIF] Variant ${sizeLabel} (cq=${quality.colorQuality} aq=${quality.alphaQuality})`)

                  const resized = await resizeImage(req.file.data, size, opts.validation.maxMegapixels.soft)
                  const avifBuffer = await encodeAvif(resized, {
                    ...quality,
                    bitDepth: opts.avifSettings.bitDepth,
                    speed: opts.avifSettings.speed,
                  }, opts.timeout)

                  const { width: vw, height: vh } = await sharp(avifBuffer).metadata()
                  if (!vw || !vh) throw new Error('Could not read AVIF dimensions')

                  console.log(`[AVIF] ${sizeLabel}: ${(avifBuffer.length / 1024 / 1024).toFixed(2)}MB`)
                  variants.push({ buffer: avifBuffer, url: '', width: vw, height: vh, fileSize: avifBuffer.length })
                }

                // Upload all variants
                const uploadedVariants: ImageVariant[] = []
                for (const v of variants) {
                  const filename = `${docId}-${v.width}w.avif`
                  const key = `${opts.imageStorage.prefix}/${filename}`
                  const url = await uploadToR2(v.buffer, key, opts.imageStorage, 'image/avif')
                  uploadedKeys.push(key)
                  uploadedVariants.push({ url, width: v.width, height: v.height, fileSize: v.fileSize })
                  console.log(`[AVIF] Uploaded ${v.width}w`)
                }

                await deleteTempFile(tempFilePath)
                await cleanupAvifencTempFiles()

                const largest = [...uploadedVariants].sort((a, b) => (b.width || 0) - (a.width || 0))[0]
                const totalMB = (uploadedVariants.reduce((s, v) => s + v.fileSize, 0) / 1024 / 1024).toFixed(2)
                console.log(`[AVIF] Done: ${uploadedVariants.length} variants, ${totalMB}MB total`)

                return {
                  ...data,
                  id: docId,
                  filename: req.file.name,
                  mimeType: req.file.mimetype,
                  filesize: req.file.data.length,
                  width: width ?? null,
                  height: height ?? null,
                  url: largest.url,
                  mediaType: 'image',
                  variants: uploadedVariants,
                  processingMetadata: {
                    originalSize: req.file.data.length,
                    variantCount: uploadedVariants.length,
                  },
                }
              } catch (err) {
                await deleteTempFile(tempFilePath)
                await cleanupAvifencTempFiles()
                if (uploadedKeys.length > 0) {
                  await deleteMultipleFromR2(uploadedKeys, opts.imageStorage).catch(() => {})
                }
                throw new Error(`Image processing failed: ${err instanceof Error ? err.message : err}`)
              }
            },
          ],

          // ── afterDelete: clean up R2 files ───────────────────────────────────
          afterDelete: [
            ...(collection.hooks?.afterDelete || []),
            async ({ doc }) => {
              // AVIF variants
              if (Array.isArray(doc.variants) && doc.variants.length > 0) {
                try {
                  const keys = getR2KeysFromVariants(doc.variants)
                  await deleteMultipleFromR2(keys, opts.imageStorage)
                  console.log(`[AVIF] Deleted ${keys.length} R2 variants for ${doc.id}`)
                } catch (err) {
                  console.error(`[AVIF] R2 cleanup failed for ${doc.id}:`, err)
                }
              }
              // Video + thumbnail
              if (doc.mimeType?.startsWith('video/') && doc.r2Url) {
                try {
                  const key = new URL(doc.r2Url).pathname.substring(1)
                  await deleteFromR2(key, opts.videoStorage)
                  if (doc.thumbnailURL) {
                    const thumbKey = new URL(doc.thumbnailURL).pathname.substring(1)
                    await deleteFromR2(thumbKey, opts.videoStorage)
                  }
                  console.log(`[VIDEO] Deleted R2 files for ${doc.id}`)
                } catch (err) {
                  console.error(`[VIDEO] R2 cleanup failed for ${doc.id}:`, err)
                }
              }
            },
          ],
        },
      }
    })

    return config
  }
}
```

- [ ] **Step 2: Type-check**

```bash
cd cms && pnpm exec tsc --noEmit 2>&1 | grep "media-processor/index"
```

Expected: no errors (or only payload-types missing, which is generated later).

- [ ] **Step 3: Commit**

```bash
git add cms/src/plugins/media-processor/index.ts
git commit -m "[cms] media-processor: add full plugin (image AVIF + video pipeline)"
```

---

## Task 6: Port all `svg-processor` files

**Files:**
- Create: `cms/src/plugins/svg-processor/types.ts`
- Create: `cms/src/plugins/svg-processor/sanitizer.ts`
- Create: `cms/src/plugins/svg-processor/validator.ts`
- Create: `cms/src/plugins/svg-processor/uploader.ts`
- Create: `cms/src/plugins/svg-processor/cleanup.ts`
- Modify: `cms/src/plugins/svg-processor/index.ts`

- [ ] **Step 1: Write `types.ts`**

```typescript
// cms/src/plugins/svg-processor/types.ts

export interface SvgProcessorOptions {
  validation: {
    maxFileSizeMB: number // 0.5 recommended
  }
  storage: {
    bucket: string
    prefix: string        // e.g. 'prod/svg'
    endpoint: string
    credentials: {
      accessKeyId: string
      secretAccessKey: string
    }
    publicUrl: string
  }
}

export interface SvgDimensions {
  width: number | null
  height: number | null
}
```

- [ ] **Step 2: Write `sanitizer.ts`**

```typescript
// cms/src/plugins/svg-processor/sanitizer.ts

const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /\s+on\w+\s*=\s*["'][^"']*["']/gi,
  /javascript:/gi,
  /data:text\/html/gi,
]

const SUSPICIOUS_TAGS = ['script', 'iframe', 'object', 'embed', 'link', 'style']

export function sanitizeSvg(content: string, filename: string): string {
  let sanitized = content

  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '')
  }

  for (const tag of SUSPICIOUS_TAGS) {
    const tagPattern = new RegExp(`<${tag}[^>]*>.*?<\/${tag}>`, 'gi')
    sanitized = sanitized.replace(tagPattern, '')
    const selfClosing = new RegExp(`<${tag}[^>]*\/>`, 'gi')
    sanitized = sanitized.replace(selfClosing, '')
  }

  if (sanitized !== content) {
    console.log(`[SVG] Sanitized dangerous content from ${filename}`)
  }

  return sanitized
}
```

- [ ] **Step 3: Write `validator.ts`**

```typescript
// cms/src/plugins/svg-processor/validator.ts
import type { SvgDimensions, SvgProcessorOptions } from './types'

export async function validateSvg(
  data: Buffer,
  filename: string,
  validation: SvgProcessorOptions['validation'],
): Promise<void> {
  const sizeMB = data.length / (1024 * 1024)
  if (sizeMB > validation.maxFileSizeMB) {
    throw new Error(
      `SVG file ${sizeMB.toFixed(2)}MB exceeds limit of ${validation.maxFileSizeMB}MB`,
    )
  }

  const content = data.toString('utf8')
  if (!content.includes('<svg') && !content.includes('<SVG')) {
    throw new Error(`${filename} does not appear to be a valid SVG file`)
  }
}

/**
 * Extract width/height from SVG attributes or viewBox.
 * Returns null dimensions if not determinable (safe for frontend — avoids layout shift).
 */
export function extractDimensions(svgContent: string): SvgDimensions {
  const widthMatch = svgContent.match(/\bwidth\s*=\s*["']?\s*([\d.]+)(px)?\s*["']?/)
  const heightMatch = svgContent.match(/\bheight\s*=\s*["']?\s*([\d.]+)(px)?\s*["']?/)
  const viewBoxMatch = svgContent.match(/viewBox\s*=\s*["']\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*["']/)

  const width = widthMatch ? parseFloat(widthMatch[1]) : null
  const height = heightMatch ? parseFloat(heightMatch[1]) : null

  const isFinitePositive = (n: number | null): n is number =>
    n !== null && isFinite(n) && n > 0

  // Priority 1: explicit width + height
  if (isFinitePositive(width) && isFinitePositive(height)) {
    return { width: Math.round(width), height: Math.round(height) }
  }

  // Priority 2: viewBox dimensions
  if (viewBoxMatch) {
    const vbWidth = parseFloat(viewBoxMatch[3])
    const vbHeight = parseFloat(viewBoxMatch[4])
    const ratio = vbWidth / vbHeight

    if (isFinitePositive(vbWidth) && isFinitePositive(vbHeight)) {
      // Priority 3: width + viewBox → calculate height
      if (isFinitePositive(width)) {
        return { width: Math.round(width), height: Math.round(width / ratio) }
      }
      // Priority 4: height + viewBox → calculate width
      if (isFinitePositive(height)) {
        return { width: Math.round(height * ratio), height: Math.round(height) }
      }
      // Priority 5: viewBox only
      return { width: Math.round(vbWidth), height: Math.round(vbHeight) }
    }
  }

  console.log(`[SVG] No valid dimensions found, returning null`)
  return { width: null, height: null }
}

export function stripXmlDeclaration(content: string): string {
  return content.replace(/<\?xml[^?]*\?>\s*/g, '').trim()
}
```

- [ ] **Step 4: Write `uploader.ts`**

```typescript
// cms/src/plugins/svg-processor/uploader.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import type { SvgProcessorOptions } from './types'

export async function uploadSvgToR2(
  buffer: Buffer,
  key: string,
  config: SvgProcessorOptions['storage'],
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
      ContentType: 'image/svg+xml',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  return `${config.publicUrl}/${key}`
}
```

- [ ] **Step 5: Write `cleanup.ts`**

```typescript
// cms/src/plugins/svg-processor/cleanup.ts

/**
 * Extract R2 key from a full public URL.
 * e.g. https://media.monk.studio/prod/svg/abc123.svg → prod/svg/abc123.svg
 */
export function getR2KeyFromUrl(url: string): string {
  return new URL(url).pathname.substring(1)
}
```

- [ ] **Step 6: Write `index.ts`**

```typescript
// cms/src/plugins/svg-processor/index.ts
import type { Config } from 'payload'
import type { SvgProcessorOptions } from './types'
import { validateSvg, extractDimensions, stripXmlDeclaration } from './validator'
import { sanitizeSvg } from './sanitizer'
import { uploadSvgToR2 } from './uploader'
import { getR2KeyFromUrl } from './cleanup'
import { deleteFromR2 } from '@/plugins/media-processor/cleanup'
import { nanoid } from 'nanoid'

export const svgProcessor = (opts: SvgProcessorOptions) => {
  return (config: Config): Config => {
    config.collections = config.collections?.map((collection) => {
      if (collection.slug !== 'media') return collection

      return {
        ...collection,
        hooks: {
          ...collection.hooks,

          afterRead: [
            ...(collection.hooks?.afterRead || []),
            async ({ doc }) => {
              if (doc.mimeType !== 'image/svg+xml') return doc

              if (doc.url && !doc.url.startsWith('http') && doc.r2Url) {
                doc.url = doc.r2Url
              }

              delete doc.variants
              delete doc.processingMetadata
              delete doc.avifQuality
              delete doc.thumbnailURL
              delete doc.r2Url

              return doc
            },
          ],

          beforeChange: [
            ...(collection.hooks?.beforeChange || []),
            async ({ data, req, operation }) => {
              if (operation !== 'create') return data
              if (!req.file) return data
              if (req.file.mimetype !== 'image/svg+xml') return data

              console.log(`[SVG] Processing ${req.file.name}`)
              const docId = nanoid()

              try {
                await validateSvg(req.file.data, req.file.name, opts.validation)

                const original = req.file.data.toString('utf8')
                const sanitized = sanitizeSvg(original, req.file.name)
                const { width, height } = extractDimensions(sanitized)
                const svgContent = stripXmlDeclaration(sanitized)

                const key = `${opts.storage.prefix}/${docId}.svg`
                const url = await uploadSvgToR2(Buffer.from(sanitized, 'utf8'), key, opts.storage)

                const sizeMB = (req.file.data.length / 1024 / 1024).toFixed(2)
                console.log(`[SVG] Uploaded ${req.file.name} (${width ?? '?'}x${height ?? '?'}, ${sizeMB}MB)`)

                return {
                  ...data,
                  id: docId,
                  filename: req.file.name,
                  mimeType: 'image/svg+xml',
                  filesize: req.file.data.length,
                  width,
                  height,
                  url,
                  r2Url: url,
                  svgContent,
                  mediaType: 'svg',
                }
              } catch (err) {
                console.error(`[SVG] Failed to process ${req.file.name}:`, err)
                throw err
              }
            },
          ],

          afterDelete: [
            ...(collection.hooks?.afterDelete || []),
            async ({ doc }) => {
              if (doc.mimeType !== 'image/svg+xml') return
              if (!doc.url) return

              try {
                const key = getR2KeyFromUrl(doc.url)
                await deleteFromR2(key, opts.storage)
                console.log(`[SVG] Deleted R2 file for ${doc.id}`)
              } catch (err) {
                console.error(`[SVG] R2 delete failed for ${doc.id}:`, err)
              }
            },
          ],
        },
      }
    })

    return config
  }
}

export type { SvgProcessorOptions } from './types'
```

- [ ] **Step 7: Type-check**

```bash
cd cms && pnpm exec tsc --noEmit 2>&1 | grep "svg-processor"
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add cms/src/plugins/svg-processor/
git commit -m "[cms] svg-processor: add full plugin (sanitize, validate, R2 upload)"
```

---

## Task 7: Rewrite `Media.ts` collection

**Files:**
- Modify: `cms/src/collections/Media.ts`

- [ ] **Step 1: Rewrite the Media collection**

```typescript
// cms/src/collections/Media.ts
import type { CollectionConfig } from 'payload'
import { nanoid } from 'nanoid'
import { isAdmin, isAuthenticated } from '../lib/access-control'

export const Media: CollectionConfig = {
  slug: 'media',

  // Exclude internal processing fields from relationship populations
  // (e.g. when Works fetches media with depth >= 1).
  // Direct /api/media/{id} queries and admin panel always return all fields.
  defaultPopulate: {
    processingMetadata: false,
    avifQuality: false,
    r2Url: false,
  },

  upload: {
    disableLocalStorage: true, // All files go to R2 via processors
    mimeTypes: [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/svg+xml',
      'image/avif',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'model/gltf-binary',  // 3D assets (no processing, manual upload)
    ],
    focalPoint: false,
    crop: false,
    adminThumbnail: ({ doc }) => {
      // Videos: use generated thumbnail
      if (doc.mimeType?.startsWith('video/') && doc.thumbnailURL) {
        return doc.thumbnailURL as string
      }
      // SVGs: use R2 URL directly
      if (doc.mimeType === 'image/svg+xml' && doc.url) {
        return doc.url as string
      }
      // AVIF images: smallest variant for fast admin preview
      if (Array.isArray(doc.variants) && (doc.variants as Array<{ url: string; width: number }>).length > 0) {
        const sorted = [...(doc.variants as Array<{ url: string; width: number }>)].sort(
          (a, b) => (a.width || 0) - (b.width || 0),
        )
        return sorted[0]?.url || null
      }
      return null
    },
  },

  access: {
    create: isAdmin,
    read: isAuthenticated,
    update: isAdmin,
    delete: isAdmin,
  },

  fields: [
    {
      name: 'filename',
      type: 'text',
      unique: false,
      index: true,
      admin: { readOnly: true },
    },
    {
      // Overrides Payload's auto-generated ID so we control the value used in R2 filenames
      name: 'id',
      type: 'text',
      hooks: {
        beforeValidate: [({ value }) => value || nanoid()],
      },
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Auto-generated. Used as prefix for R2 filenames.',
      },
    },
    {
      name: 'alt',
      type: 'text',
    },
    {
      // Internal: generated video thumbnail URL. Cleaned from API response by plugin.
      name: 'thumbnailURL',
      type: 'text',
      admin: { readOnly: true, hidden: true },
    },
    {
      name: 'mediaType',
      type: 'select',
      options: [
        { label: 'Image', value: 'image' },
        { label: 'SVG', value: 'svg' },
        { label: 'Video', value: 'video' },
        { label: '3D', value: '3d' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'videoMetadata',
      type: 'group',
      admin: {
        condition: (data) => Boolean(data.mimeType?.startsWith('video/')),
        position: 'sidebar',
        description: 'Extracted automatically on upload',
      },
      fields: [
        { name: 'duration', type: 'number', admin: { readOnly: true, description: 'seconds' } },
        { name: 'fps', type: 'number', admin: { readOnly: true } },
        { name: 'width', type: 'number', admin: { readOnly: true } },
        { name: 'height', type: 'number', admin: { readOnly: true } },
      ],
    },
    {
      // AVIF variants generated by media-processor. Cleaned from SVG/video API responses by plugins.
      name: 'variants',
      type: 'array',
      admin: {
        readOnly: true,
        description: 'Auto-generated AVIF variants',
        condition: (data) =>
          Boolean(data.id) &&
          data.mimeType !== 'image/svg+xml' &&
          !data.mimeType?.startsWith('video/'),
      },
      fields: [
        { name: 'url', type: 'text', required: true, admin: { readOnly: true } },
        { name: 'width', type: 'number', admin: { readOnly: true } },
        { name: 'height', type: 'number', admin: { readOnly: true } },
        { name: 'fileSize', type: 'number', admin: { readOnly: true } },
      ],
    },
    {
      // Inline SVG content for direct HTML embedding (e.g. hero icons, cover images).
      // Only present for SVG files. Stripped from non-SVG API responses by svg-processor.
      name: 'svgContent',
      type: 'textarea',
      admin: { readOnly: true, hidden: true },
    },
    {
      // The actual R2 URL, stored so we can restore it after Payload reconstructs it from filename.
      // Stripped from API responses by processors after restoration.
      name: 'r2Url',
      type: 'text',
      admin: { readOnly: true, hidden: true },
    },
    {
      // Internal processing metadata (timing, sizes, etc.). Never exposed in API.
      name: 'processingMetadata',
      type: 'json',
      admin: { readOnly: true, hidden: true },
    },
    {
      // Legacy / manual override field kept for compatibility. Read-only.
      name: 'customUrl',
      type: 'text',
      admin: { readOnly: true },
    },
  ],

  hooks: {
    beforeDelete: [
      // Placeholder for future cascade cleanup (e.g. remove media refs from Works/StoreProducts).
      // R2 file deletion is handled by media-processor/afterDelete and svg-processor/afterDelete.
    ],
  },
}
```

- [ ] **Step 2: Type-check**

```bash
cd cms && pnpm exec tsc --noEmit 2>&1 | grep "collections/Media"
```

Expected: no errors (or only `payload-types` not found, which is generated after first run).

- [ ] **Step 3: Commit**

```bash
git add cms/src/collections/Media.ts
git commit -m "[cms] Media: rewrite with disableLocalStorage, all processor fields, adminThumbnail"
```

---

## Task 8: Wire `payload.config.ts` and update `instrumentation.ts`

**Files:**
- Modify: `cms/src/payload.config.ts`
- Modify: `cms/src/instrumentation.ts`

- [ ] **Step 1: Update `payload.config.ts`**

```typescript
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
import { getStoragePlugin } from './lib/storage'
import { getR2Config } from './lib/r2-config'
import { mediaProcessor } from './plugins/media-processor'
import { svgProcessor } from './plugins/svg-processor'
import { onInit } from './instrumentation'
import { SITE_NAME, SITE_DESCRIPTION } from './lib/constants'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const storagePlugin = getStoragePlugin()
const imagesR2 = getR2Config('images')
const videosR2 = getR2Config('videos')
const svgR2 = getR2Config('svg')

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
    ...(storagePlugin ? [storagePlugin] : []),
    mediaProcessor({
      sizes: [600, 1200, 3000, 'full'],
      avifSettings: {
        colorQuality: 40,
        alphaQuality: 40,
        bitDepth: 10,
        speed: 6,
      },
      validation: {
        maxMegapixels: { soft: 20, hard: 40 },
        maxFileSizeMB: 60,
        allowedFormats: ['png', 'jpg', 'jpeg', 'webp'],
      },
      timeout: 120_000,
      imageStorage: imagesR2,
      videoStorage: videosR2,
    }),
    svgProcessor({
      validation: { maxFileSizeMB: 0.5 },
      storage: svgR2,
    }),
  ],
  onInit,
  typescript: {
    // Outputs to cms/src/payload-types.ts — matches web's @cms/* path alias
    outputFile: path.resolve(__dirname, 'payload-types.ts'),
  },
})
```

- [ ] **Step 2: Update `instrumentation.ts`**

```typescript
// cms/src/instrumentation.ts
import type { Payload } from 'payload'
import { cleanupOrphanedTempFiles } from './plugins/media-processor/cleanup'

export async function onInit(payload: Payload) {
  payload.logger.info('Running boot-time cleanup...')

  try {
    await cleanupOrphanedTempFiles()
    payload.logger.info('Temp file cleanup complete.')
  } catch (error) {
    payload.logger.error(`Temp file cleanup failed: ${error}`)
  }
}
```

- [ ] **Step 3: Full type-check**

```bash
cd cms && pnpm exec tsc --noEmit 2>&1 | head -40
```

Expected: no errors, or only `Cannot find module './migrations'` (normal — no migrations yet) and `payload-types.ts` not found (generated on first `pnpm dev`).

- [ ] **Step 4: Commit**

```bash
git add cms/src/payload.config.ts cms/src/instrumentation.ts
git commit -m "[cms] Config: wire mediaProcessor and svgProcessor with R2 options"
```

---

## Task 9: Integration test — first CMS boot

- [ ] **Step 1: Verify Docker is running**

In a separate terminal: `docker compose up` inside `cms/`.

Expected: PostgreSQL 18 starts on port 5432.

- [ ] **Step 2: Boot the CMS**

In a separate terminal: `pnpm dev` inside `cms/`.

Expected output (in order):
```
[Payload] Starting Payload...
[Payload] Connected to Postgres
[Payload] Running boot-time cleanup...
[Payload] Temp file cleanup complete.
[Payload] Server listening on http://localhost:3000
```

No `Cannot find module` errors, no unhandled TypeScript errors at runtime.

- [ ] **Step 3: Run initial migration**

On first boot, Payload auto-generates tables. If it asks to migrate:

```bash
cd cms && pnpm migrate
```

- [ ] **Step 4: Create admin user and test media upload**

1. Open `http://localhost:3000/admin`
2. Create first admin user
3. Go to **Media** → upload a PNG image
   - Expected: no error, `variants` array populated with AVIF URLs, `url` field is an R2 URL
   - If `STORAGE_ADAPTER=local`: processing runs locally, R2 upload is skipped (no `R2_PUBLIC_URL` set)
   - If R2 is configured: verify AVIF URLs are accessible in browser
4. Upload an SVG file
   - Expected: `svgContent` populated, `url` is R2 URL
5. Upload an MP4 video
   - Expected: `videoMetadata` populated (duration, fps, dimensions), `thumbnailURL` set

- [ ] **Step 5: Verify Works collection still loads**

Go to **Works** → create a test entry → add a gallery block. Confirm the Media picker shows uploaded files with thumbnails.

- [ ] **Step 6: Commit if any last fixups were needed**

```bash
git add -A && git commit -m "[cms] Integration: fix boot issues discovered during first run"
```

---

## Notes

### avifenc (local dev)

`avifenc` is compiled into the Docker image but not available locally by default.

- macOS: `brew install libavif`
- Without `avifenc`, image uploads will fail with "spawn avifenc ENOENT"
- Videos and SVGs work without it

### STORAGE_ADAPTER=local

When `STORAGE_ADAPTER=local`, `getStoragePlugin()` returns `undefined` and no `@payloadcms/storage-s3` plugin is loaded. The media-processor and svg-processor plugins are independent — they do their own R2 uploads via `@aws-sdk/client-s3`. Set R2 credentials in `.env` even in dev if you want to test media uploads end-to-end.

### payload-types.ts

Running `pnpm dev` (or `pnpm build`) auto-generates `cms/src/payload-types.ts`. The web project imports from it via `@cms/payload-types`. Until it's generated, web TypeScript checks for CMS types will fail.

### 3D assets (.glb)

3D files have no processing pipeline yet. They can be uploaded to Media manually, but the `model/gltf-binary` mimeType is accepted, and `mediaType: '3d'` should be set manually in the admin. A future task can add a `3d-processor` if needed.
