/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub project pages serves this site under /swedomainmap/. Production
// builds are only consumed by Pages (see .github/workflows/deploy-pages.yml),
// so they always get the project-pages base; dev and tests run at the root.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/swedomainmap/' : '/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
}));
