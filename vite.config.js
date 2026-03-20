import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))
const buildNumber = process.env.VITE_BUILD_NUMBER
const appVersion = buildNumber ? `${pkg.version}+${buildNumber}` : pkg.version

export default defineConfig({
  plugins: [react()],
  base: '/taxi-teoriapp/',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
})
