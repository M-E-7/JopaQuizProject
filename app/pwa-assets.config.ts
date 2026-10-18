import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

// Generates the PWA icons in public/ from public/favicon.svg.
// Run `npm run generate-pwa-assets` after changing the SVG.
const brandBlue = '#2563eb'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: brandBlue },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: brandBlue },
    },
  },
  images: ['public/favicon.svg'],
})
