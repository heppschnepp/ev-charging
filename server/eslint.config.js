import js from '@eslint/js';
import globals from 'globals';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const tsParser = require('@typescript-eslint/parser');

export default [
  js.configs.recommended,
  {
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      'no-unused-vars': 'off',
    },
  },
];
