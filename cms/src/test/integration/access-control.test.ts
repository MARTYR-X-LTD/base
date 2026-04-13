// cms/src/test/integration/access-control.test.ts
// Tests access control on the Users and Media collections using a real Payload
// instance backed by an ephemeral Postgres container (see global-setup.ts).
import type { Payload } from 'payload'
import config from '@/payload.config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

let payload: Payload

beforeAll(async () => {
  payload = await getPayload({ config })
})

afterAll(async () => {
  await payload.destroy()
})

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createAdminUser() {
  return payload.create({
    collection: 'users',
    data: {
      email: `admin-${Date.now()}@test.local`,
      password: 'password',
      role: 'admin',
    },
    overrideAccess: true,
  })
}

async function createApiKeyUser() {
  return payload.create({
    collection: 'users',
    data: {
      email: `api-${Date.now()}@test.local`,
      password: 'password',
      role: 'api-key',
    },
    overrideAccess: true,
  })
}

// ── Users ─────────────────────────────────────────────────────────────────────

describe('Users collection', () => {
  test('unauthenticated cannot create a user', async () => {
    console.log('[access] unauthenticated → create user → expect forbidden')
    await expect(
      payload.create({
        collection: 'users',
        data: { email: 'anon@test.local', password: 'password', role: 'admin' },
        overrideAccess: false,
        draft: false,
      }),
    ).rejects.toThrow()
    console.log('[access] ✓ rejected as expected')
  })

  test('admin can create a user', async () => {
    console.log('[access] admin → create user → expect success')
    const admin = await createAdminUser()
    const user = await payload.create({
      collection: 'users',
      data: { email: `new-${Date.now()}@test.local`, password: 'password', role: 'admin' },
      overrideAccess: false,
      draft: false,
      user: admin,
    })
    expect(user.id).toBeDefined()
    console.log(`[access] ✓ created user ${user.id}`)
  })

  test('api-key role cannot create a user', async () => {
    console.log('[access] api-key role → create user → expect forbidden')
    const apiUser = await createApiKeyUser()
    await expect(
      payload.create({
        collection: 'users',
        data: { email: `blocked-${Date.now()}@test.local`, password: 'password', role: 'admin' },
        overrideAccess: false,
        draft: false,
        user: apiUser,
      }),
    ).rejects.toThrow()
    console.log('[access] ✓ rejected as expected')
  })
})

// ── Media ─────────────────────────────────────────────────────────────────────

describe('Media collection', () => {
  test('unauthenticated cannot read media', async () => {
    console.log('[access] unauthenticated → find media → expect forbidden')
    await expect(
      payload.find({
        collection: 'media',
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    console.log('[access] ✓ rejected as expected')
  })

  test('authenticated (api-key role) can read media', async () => {
    console.log('[access] api-key role → find media → expect success')
    const apiUser = await createApiKeyUser()
    const result = await payload.find({
      collection: 'media',
      overrideAccess: false,
      user: apiUser,
    })
    expect(result.docs).toBeDefined()
    console.log(`[access] ✓ got ${result.docs.length} docs`)
  })

  test('api-key role cannot delete media', async () => {
    // Access control runs before the find — a forbidden error is thrown even with a fake ID
    console.log('[access] api-key role → delete media → expect 403')
    const apiUser = await createApiKeyUser()
    await expect(
      payload.delete({
        collection: 'media',
        id: 'fake-id',
        overrideAccess: false,
        user: apiUser,
      }),
    ).rejects.toMatchObject({ status: 403 })
    console.log('[access] ✓ got 403 as expected')
  })

  test('admin passes delete access check on media', async () => {
    // Admin has delete access — error will be 404 (doc not found), not 403
    console.log('[access] admin → delete non-existent media → expect 404 (not 403)')
    const admin = await createAdminUser()
    await expect(
      payload.delete({
        collection: 'media',
        id: 'fake-id-that-does-not-exist',
        overrideAccess: false,
        user: admin,
      }),
    ).rejects.toMatchObject({ status: 404 })
    console.log('[access] ✓ got 404 (access check passed, doc not found)')
  })
})
