import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import svelte from '@astrojs/svelte'
import Icons from 'unplugin-icons/vite'
import { fileURLToPath } from 'url'
import sitemap from "@astrojs/sitemap"


export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [
    svelte(),
    ...(process.env.PUBLIC_SITE_URL === "https://example.com" ? [sitemap()] : []),
  ],
  experimental: {
    cache: {
      provider: {
        entrypoint: fileURLToPath(new URL('./src/lib/cache/cloudflare-provider.ts', import.meta.url)),
      },
    },
  },
  vite: {
    plugins: [
      Icons({
        compiler: 'svelte',
        autoInstall: true,
      }),
    ],
    esbuild: {
      drop: ['console', 'debugger'],
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use "mixins" as *; @use "vars" as *;`,
          loadPaths: [fileURLToPath(new URL('./src/styles', import.meta.url))],
        },
      },
    },
  },
})
