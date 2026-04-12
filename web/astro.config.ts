import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import svelte from '@astrojs/svelte'
import Icons from 'unplugin-icons/vite'

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [svelte()],
  vite: {
    plugins: [
      Icons({
        compiler: 'svelte',
        autoInstall: true,
      }),
    ],
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use "@styles/mixins" as *; @use "@styles/vars" as *;`,
        },
      },
    },
  },
})
