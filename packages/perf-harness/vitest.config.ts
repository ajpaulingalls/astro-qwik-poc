import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*_test.ts'],
    typecheck: {
      enabled: true,
      include: ['tests/**/*_types_test.ts'],
      tsconfig: './tsconfig.json',
    },
  },
});
