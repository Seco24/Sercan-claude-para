import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Tek dosyalık derleme: `npm run build` sonrası dist/index.html doğrudan
// tarayıcıda açılabilir (sunucu gerekmez) veya herhangi bir statik hostinge konabilir.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
});
