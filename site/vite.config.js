import { defineConfig } from 'vite';
import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [{
    name: 'original-static-assets',
    async closeBundle() {
      for (const name of ['assets', 'fonts', 'music', 'whisper.config', 'robots.txt', '.nojekyll']) {
        await cp(resolve('site', name), resolve('dist', name), { recursive: true });
      }
    }
  }]
});
