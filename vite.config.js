import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))
const appVersion = pkg.version

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'mobile' ? './' : '/taxi-teoriapp/',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  // Dev-server settings for `npm run dev:mobile` (and ignored by vite build).
  // Fixed port + strictPort so cap-sync-dev always knows where to point the WebView.
  ...(mode === 'mobile' ? {
    server: {
      host: '0.0.0.0',  // listen on all interfaces (emulator + real device)
      port: 5173,        // fixed — must match the URL used in cap-sync-dev.mjs
      strictPort: true,  // fail immediately if 5173 is busy instead of silently shifting
    },
  } : {}),
}))
