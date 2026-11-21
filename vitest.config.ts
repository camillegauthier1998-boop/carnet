import { defineConfig } from 'vitest/config';

// Tests unitaires des fonctions pures (mots de passe, sessions, validation, import Firebase) sous Node.
export default defineConfig({
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});
