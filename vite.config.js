import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/taxi-teoriapp/',
  define: {'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version)},
});
