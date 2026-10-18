import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Short commit hash for the version label: GITHUB_SHA in CI, git locally.
function commitHash(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Served from https://m-e-7.github.io/JopaQuizProject/ (GitHub Pages project site).
  // Used in dev and preview too, so local URLs match production.
  base: '/JopaQuizProject/',
  // Version label shown in the footer, to see which build a device is running.
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    __COMMIT__: JSON.stringify(commitHash()),
  },
  plugins: [
    react(),
    VitePWA({
      // New versions activate on the next page load. Switch to 'prompt' when
      // the "new version available" notice is built (todo.md, Phase 4).
      registerType: 'autoUpdate',
      // Icons are already precached by globPatterns below.
      includeManifestIcons: false,
      manifest: {
        name: 'JopaQuiz',
        short_name: 'JopaQuiz',
        description: 'Multiple-choice quizzes generated from your own documents.',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the whole app shell so it works fully offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
    }),
  ],
})
