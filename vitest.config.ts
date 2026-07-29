import { defineConfig } from 'vitest/config';

// Отдельный конфиг: тестам не нужен плагин сборки данных — они обращаются
// к загрузчику напрямую и подкладывают ему фикстуры.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
