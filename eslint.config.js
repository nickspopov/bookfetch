const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', 'coverage/*', 'legacy/*', 'expo-env.d.ts'],
  },
  {
    files: ['jest.setup.js', '**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
    languageOptions: { globals: { jest: 'readonly' } },
  },
]);
