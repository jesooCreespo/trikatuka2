/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Connect, type Plugin } from 'vite'

/** Serves the OAuth callback at `/afterLogin` like Firebase's rewrite does in production. */
function afterLoginRewrite(): Plugin {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    if (req.url?.startsWith('/afterLogin') && !req.url.startsWith('/afterLogin.html')) {
      req.url = req.url.replace('/afterLogin', '/afterLogin.html')
    }
    next()
  }
  return {
    name: 'after-login-rewrite',
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite),
  }
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

export default defineConfig({
  plugins: [react(), tailwindcss(), afterLoginRewrite()],
  // `public/` is Firebase's deploy dir (gitignored), so static assets live in `static/`.
  publicDir: 'static',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Spotify accepts http redirect URIs only on loopback IPs, not "localhost".
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: {
    outDir: 'dist',
    // The main chunk is ~190 kB gzipped, almost all react-dom, react-router and TanStack Query.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        afterLogin: fileURLToPath(new URL('./afterLogin.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    unstubGlobals: true,
  },
})
