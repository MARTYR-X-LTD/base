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
  findByID?: (args: { id: string }) => Promise<unknown>
}) {
  return {
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
    findByID: vi.fn(overrides?.findByID ?? (() => Promise.resolve({ id: 'x' }))),
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('runBootCleanup', () => {
  test('no-op when /tmp is empty', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([])
    const payload = makePayload()

    await runBootCleanup(payload)

    expect(payload.findByID).not.toHaveBeenCalled()
    expect(deleteTempFile).not.toHaveBeenCalled()
    expect(deleteMultipleFromR2).not.toHaveBeenCalled()
    expect(payload.logger.info).toHaveBeenCalledWith(expect.stringContaining('Found 0'))
    expect(payload.logger.info).toHaveBeenCalledWith(expect.stringContaining('Cleanup complete'))
  })

  test('doc exists → deletes temp file, no R2 cleanup', async () => {
    vi.mocked(fs.readdir).mockResolvedValue(['abc123-original.jpg'] as any)
    vi.mocked(listR2Objects).mockResolvedValue([])
    const payload = makePayload({
      findByID: () => Promise.resolve({ id: 'abc123' }),
    })

    await runBootCleanup(payload)

    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'abc123', collection: 'media' }),
    )
    expect(deleteTempFile).toHaveBeenCalledWith('/tmp/abc123-original.*')
    expect(listR2Objects).not.toHaveBeenCalled()
    expect(deleteMultipleFromR2).not.toHaveBeenCalled()
  })

  test('doc missing (404) → cleans R2 orphans + temp file', async () => {
    vi.mocked(fs.readdir).mockResolvedValue(['abc123-original.png'] as any)
    vi.mocked(listR2Objects)
      .mockResolvedValueOnce(['local/images/abc123-600w.avif', 'local/images/abc123-1200w.avif']) // image keys
      .mockResolvedValueOnce([]) // video keys
    const payload = makePayload({
      findByID: () => Promise.reject({ status: 404 }),
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
  })

  test('doc missing (404) with no R2 orphans → skips deleteMultipleFromR2', async () => {
    vi.mocked(fs.readdir).mockResolvedValue(['abc123-original.jpg'] as any)
    vi.mocked(listR2Objects).mockResolvedValue([])
    const payload = makePayload({
      findByID: () => Promise.reject({ status: 404 }),
    })

    await runBootCleanup(payload)

    expect(deleteMultipleFromR2).not.toHaveBeenCalled()
    expect(deleteTempFile).toHaveBeenCalledWith('/tmp/abc123-original.*')
  })

  test('findByID throws non-404 error → logs error, no cleanup', async () => {
    vi.mocked(fs.readdir).mockResolvedValue(['abc123-original.jpg'] as any)
    const payload = makePayload({
      findByID: () => Promise.reject({ status: 500 }),
    })

    await runBootCleanup(payload)

    expect(payload.logger.error).toHaveBeenCalledWith(expect.stringContaining('Error checking doc abc123'))
    expect(deleteTempFile).not.toHaveBeenCalled()
    expect(deleteMultipleFromR2).not.toHaveBeenCalled()
  })

  test('avifenc leftover files are unlinked', async () => {
    // UUID-prefixed .avif/.png files from interrupted avifenc runs
    const avifencFile = 'a1b2c3d4-1234-5678-abcd-ef0123456789.avif'
    const avifencPng = 'a1b2c3d4-1234-5678-abcd-ef0123456789.png'
    vi.mocked(fs.readdir).mockResolvedValue([avifencFile, avifencPng] as any)

    const payload = makePayload()

    await runBootCleanup(payload)

    expect(fs.unlink).toHaveBeenCalledWith(`/tmp/${avifencFile}`)
    expect(fs.unlink).toHaveBeenCalledWith(`/tmp/${avifencPng}`)
    expect(payload.logger.info).toHaveBeenCalledWith(expect.stringContaining('Cleaned up 2 avifenc'))
  })

  test('non-matching /tmp files are ignored', async () => {
    // These should not trigger any cleanup
    vi.mocked(fs.readdir).mockResolvedValue([
      'somefile.txt',
      'next-server.js',
      'payload.log',          // no '-original.' pattern
      'originalfile.txt',     // 'original' without leading dash
    ] as any)
    const payload = makePayload()

    await runBootCleanup(payload)

    expect(payload.findByID).not.toHaveBeenCalled()
    expect(fs.unlink).not.toHaveBeenCalled()
    expect(deleteTempFile).not.toHaveBeenCalled()
  })
})
