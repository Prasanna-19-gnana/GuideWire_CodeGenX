import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  server: {
    port: 4174,
    strictPort: true,
  },
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
  },
});