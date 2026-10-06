import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const ACCENT = '#1F5FAD';

/**
 * Byggnummer i index.html (`<meta name="smartnotes-build">`). Serveren sender det med API-svarene, og appen ser
 * dermed at en nyere versjon finnes, også når service workeren ikke sa fra i tide (se src/lib/pwa.ts).
 * Nummeret er en hash av index.html med de ferdige filnavnene, så det endres bare når appen endres.
 */
function buildVersion(): Plugin {
  return {
    name: 'smartnotes-build-version',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const build = createHash('sha256').update(html).digest('hex').slice(0, 16);
        return html.replace('</head>', `  <meta name="smartnotes-build" content="${build}" />\n  </head>`);
      },
    },
  };
}

export default defineConfig({
  // Egen cache per utviklingsserver når flere kjører samtidig (f.eks. VITE_CACHE_DIR=node_modules/.vite-5311).
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
  plugins: [
    react(),
    buildVersion(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      // Vi registrerer selv via `virtual:pwa-register` (src/lib/pwa.ts).
      injectRegister: false,
      // Ikoner og manifest fanges av globPatterns nedenfor (unngår doble precache-oppføringer).
      includeManifestIcons: false,
      manifest: {
        id: '/',
        name: 'SmartNotes',
        short_name: 'SmartNotes',
        description: 'Håndskrevne notater i fysikk, kjemi og biologi som pene LaTeX-PDF-er, sortert etter kapittel.',
        lang: 'nb',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: ACCENT,
        background_color: '#F5F6F8',
        categories: ['education', 'productivity'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // .mjs er med slik at pdf.js-workeren blir precachet.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,woff2}'],
        // pdf.js-workeren er ~1,3 MB.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // Originalbilder av sidene endres aldri for et gitt notat.
            urlPattern: /\/api\/notes\/[^/]+\/pages\/\d+$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'note-pages',
              expiration: { maxEntries: 300, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Sidelisten (dimensjoner) – fersk når vi er på nett, cachet ellers.
            urlPattern: /\/api\/notes\/[^/]+\/pages$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'note-page-lists',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 300, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: false },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});
