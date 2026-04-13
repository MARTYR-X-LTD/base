// cms/src/test/global-setup.ts
// Runs once in the main process before any test files are loaded.
// Starts a throwaway Postgres container and injects the connection URI into env.
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { config as loadDotenv } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

declare global {
  // eslint-disable-next-line no-var
  var __pg_container__: StartedPostgreSqlContainer
}

export async function setup() {
  // Load .env from cms/ root — real R2 credentials override the fallbacks below
  loadDotenv({ path: path.resolve(__dirname, '../../.env') })

  console.log('\n[test] Starting Postgres container...')
  const container = await new PostgreSqlContainer('postgres:18').start()
  globalThis.__pg_container__ = container

  // Always use the ephemeral test DB, never the real one
  process.env.DATABASE_URI = container.getConnectionUri()

  // Fallbacks for suites that don't need real R2 (access-control, unit tests)
  process.env.R2_ACCOUNT_ID ??= 'dummy'
  process.env.R2_ACCESS_KEY_ID ??= 'dummy'
  process.env.R2_SECRET_ACCESS_KEY ??= 'dummy'
  process.env.R2_BUCKET ??= 'dummy'
  process.env.R2_PUBLIC_URL ??= 'https://dummy.example.com'
  process.env.PAYLOAD_SECRET ??= 'test-secret-do-not-use-in-production'
  // Use 'test' prefix in R2 so test uploads never land in local/ or prod/
  process.env.PAYLOAD_ENV = 'test'

  console.log(`[test] Postgres ready at ${container.getConnectionUri()}`)
}

export async function teardown() {
  await globalThis.__pg_container__?.stop()
  console.log('\n[test] Postgres container stopped')
}
