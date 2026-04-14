import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import svelte from '@astrojs/svelte'
import Icons from 'unplugin-icons/vite'
import path from 'path'
import { fileURLToPath } from 'url'

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [svelte()],
  experimental: {
    cache: {
      provider: {
        entrypoint: fileURLToPath(new URL('./src/lib/cache/cloudflare-provider.ts', import.meta.url)),
      },
    },
  },
  vite: {
    resolve: {
      alias: {
        '@styles': path.resolve('./src/styles'),
      },
    },
    plugins: [
      Icons({
        compiler: 'svelte',
        autoInstall: true,
      }),
    ],
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          loadPaths: [path.resolve('./src/styles')],
          additionalData: `@use "mixins" as *; @use "vars" as *;`,
        },
      },
    },
  },
})
