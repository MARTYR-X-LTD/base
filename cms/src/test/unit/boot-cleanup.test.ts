// cms/src/test/unit/boot-cleanup.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest'

// ── Mocks (hoisted before imports) ──────────────────────────────────────────

vi.mock('fs/promises', () => ({
  default: {
    readdir: vi.fn<() => Promise<string[]>>().mockResolvedValue([]),
    unlink: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  },
}))

vi.mock('@/plugins/media-processor/cleanup', () => ({
  deleteTempFile: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  deleteMultipleFromR2: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  listR2Objects: vi.fn<() => Promise<string[]>>().mockResolvedValue([]),
}))

vi.mock('@/lib/r2-config', () => ({
  getR2Config: vi.fn().mockReturnValue({
    bucket: 'test-bucket',
    prefix: 'local/images',
    endpoint: 'https://test.r2.cloudflarestorage.com',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    publicUrl: 'https://test.example.com',
  }),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import fs from 'fs/promises'
import { deleteTempFile, deleteMultipleFromR2, listR2Objects } from '@/plugins/media-processor/cleanup'
import { runBootCleanup } from '@/instrumentation.node'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePayload(overrides?: {
  find?: (args: unknown) => Promise<unknown>
}) {
  return {
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
    find: vi.fn(overrides?.find ?? (() => Promise.resolve({ docs: [{ id: 1 }] }))),
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('runBootCleanup', () => {
  test('no-op when /tmp is empty', async () => {
    console.log('[boot-cleanup] /tmp empty → no cleanup expected')
    vi.mocked(fs.readdir).mockResolvedValue([])
    const payload = makePayload()

    await runBootCleanup(payload)

    expect(payload.find).not.toHaveBeenCalled()
    expect(deleteTempFile).not.toHaveBeenCalled()
    expect(deleteMultipleFromR2).not.toHaveBeenCalled()
    expect(payload.logger.info).toHaveBeenCalledWith(expect.stringContaining('Found 0'))
    expect(payload.logger.info).toHaveBeenCalledWith(expect.stringContaining('Cleanup complete'))
    console.log('[boot-cleanup] ✓ no-op confirmed')
  })

  test('doc exists → deletes temp file, no R2 cleanup', async () => {
    console.log('[boot-cleanup] /tmp has abc123-original.jpg, doc exists in DB → temp file deleted, R2 untouched')
    vi.mocked(fs.readdir).mockResolvedValue(['abc123-original.jpg'] as any)
    vi.mocked(listR2Objects).mockResolvedValue([])
    const payload = makePayload({
      find: () => Promise.resolve({ docs: [{ id: 1 }] }),
    })

    await runBootCleanup(payload)

    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storageKey: { equals: 'abc123' } }, collection: 'media' }),
    )
    expect(deleteTempFile).toHaveBeenCalledWith('/tmp/abc123-original.*')
    expect(listR2Objects).not.toHaveBeenCalled()
    expect(deleteMultipleFromR2).not.toHaveBeenCalled()
    console.log('[boot-cleanup] ✓ temp file deleted, R2 untouched')
  })

  test('doc missing (404) → cleans R2 orphans + temp file', async () => {
    console.log('[boot-cleanup] /tmp has abc123-original.png, doc is 404 → purge 2 R2 orphans + temp file')
    vi.mocked(fs.readdir).mockResolvedValue(['abc123-original.png'] as any)
    vi.mocked(listR2Objects)
      .mockResolvedValueOnce(['local/images/abc123-600w.avif', 'local/images/abc123-1200w.avif']) // image keys
      .mockResolvedValueOnce([]) // video keys
    const payload = makePayload({
      find: () => Promise.resolve({ docs: [] }),
    })

    await runBootCleanup(payload)

    expect(listR2Objects).toHaveBeenCalledTimes(2)
    // deleteMultipleFromR2 is called for both image and video keys — the empty-array
    // guard lives inside the real function, not in runBootCleanup
    expect(deleteMultipleFromR2).toHaveBeenCalledTimes(2)
    expect(deleteMultipleFromR2).toHaveBeenCalledWith(
      ['local/images/abc123-600w.avif', 'local/images/abc123-1200w.avif'],
      expect.any(Object),
    )
    expect(deleteMultipleFromR2).toHaveBeenCalledWith([], expect.any(Object))
    expect(deleteTempFile).toHaveBeenCalledWith('/tmp/abc123-original.*')
    console.log('[boot-cleanup] ✓ 2 R2 orphans purged, temp file deleted')
  })

  test('doc missing (404) with no R2 orphans → skips deleteMultipleFromR2', async () => {
    console.log('[boot-cleanup] doc is 404 but no R2 orphans → only temp file deleted')
    vi.mocked(fs.readdir).mockResolvedValue(['abc123-original.jpg'] as any)
    vi.mocked(listR2Objects).mockResolvedValue([])
    const payload = makePayload({
      find: () => Promise.resolve({ docs: [] }),
    })

    await runBootCleanup(payload)

    expect(deleteMultipleFromR2).not.toHaveBeenCalled()
    expect(deleteTempFile).toHaveBeenCalledWith('/tmp/abc123-original.*')
    console.log('[boot-cleanup] ✓ R2 delete skipped, temp file deleted')
  })

  test('findByID throws non-404 error → logs error, no cleanup', async () => {
    console.log('[boot-cleanup] findByID throws 500 → log error, no cleanup')
    vi.mocked(fs.readdir).mockResolvedValue(['abc123-original.jpg'] as any)
    const payload = makePayload({
      find: () => Promise.reject(new Error('DB connection failed')),
    })

    await runBootCleanup(payload)

    expect(payload.logger.error).toHaveBeenCalledWith(expect.stringContaining('Error checking doc abc123'))
    expect(deleteTempFile).not.toHaveBeenCalled()
    expect(deleteMultipleFromR2).not.toHaveBeenCalled()
    console.log('[boot-cleanup] ✓ error logged, nothing cleaned up')
  })

  test('avifenc leftover files are unlinked', async () => {
    // UUID-prefixed .avif/.png files from interrupted avifenc runs
    console.log('[boot-cleanup] 2 UUID-prefixed avifenc leftovers in /tmp → unlinked directly')
    const avifencFile = 'a1b2c3d4-1234-5678-abcd-ef0123456789.avif'
    const avifencPng = 'a1b2c3d4-1234-5678-abcd-ef0123456789.png'
    vi.mocked(fs.readdir).mockResolvedValue([avifencFile, avifencPng] as any)

    const payload = makePayload()

    await runBootCleanup(payload)

    expect(fs.unlink).toHaveBeenCalledWith(`/tmp/${avifencFile}`)
    expect(fs.unlink).toHaveBeenCalledWith(`/tmp/${avifencPng}`)
    expect(payload.logger.info).toHaveBeenCalledWith(expect.stringContaining('Cleaned up 2 avifenc'))
    console.log('[boot-cleanup] ✓ both avifenc leftovers unlinked')
  })

  test('non-matching /tmp files are ignored', async () => {
    // These should not trigger any cleanup
    console.log('[boot-cleanup] /tmp has 4 unrelated files → all ignored')
    vi.mocked(fs.readdir).mockResolvedValue([
      'somefile.txt',
      'next-server.js',
      'payload.log',          // no '-original.' pattern
      'originalfile.txt',     // 'original' without leading dash
    ] as any)
    const payload = makePayload()

    await runBootCleanup(payload)

    expect(payload.find).not.toHaveBeenCalled()
    expect(fs.unlink).not.toHaveBeenCalled()
    expect(deleteTempFile).not.toHaveBeenCalled()
    console.log('[boot-cleanup] ✓ no cleanup triggered')
  })
})
