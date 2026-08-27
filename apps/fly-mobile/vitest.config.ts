import { defineConfig } from 'vitest/config';

/**
 * Fase 0: apenas modulos puros (sem import de react-native) sao testados aqui.
 * Testes de componente entram na Fase 1 com jest-expo, que e o runner oficial
 * do Expo — ver docs/quality/TEST_MATRIX.md.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
