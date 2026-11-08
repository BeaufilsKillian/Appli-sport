const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**', '.expo/**', 'assets/**', 'public/**', 'scripts/**', 'tests/**', 'src/catalogue.ts', 'src/exerciseDemos.ts'] },
]);
