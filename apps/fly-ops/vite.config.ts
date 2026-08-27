import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // appType 'spa' faz o dev server e o preview devolverem index.html em
  // /health, sem precisar de router nesta fase.
  appType: 'spa',
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
