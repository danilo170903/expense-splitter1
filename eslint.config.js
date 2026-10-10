import js from '@eslint/js'
import globals from 'globals'

export default [
  { ignores: ['dist/', 'node_modules/', 'server/data/'] },
  {
    files: ['**/*.{js,jsx}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
]
