// cms/src/instrumentation.ts
import type { Payload } from 'payload'

export async function onInit(payload: Payload) {
  // NEXT_RUNTIME is inlined at build time — this branch is dead-code-eliminated
  // in edge bundles, keeping all Node.js-only imports out of the edge bundle.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { bootCleanup } = await import('./instrumentation.node')
    bootCleanup(payload)
  }
}
