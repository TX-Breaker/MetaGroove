module.exports = {
  env: {
    browser: true,
    es2022: true,
    node: true,
    jest: true,
    webextensions: true
  },
  extends: [
    'eslint:recommended',
    'prettier'
  ],
  plugins: [
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    'prettier/prettier': 'error',
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_' 
    }],
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-arrow-callback': 'error',
    'arrow-spacing': 'error',
    'no-duplicate-imports': 'error',
    'no-useless-constructor': 'error',
    'prefer-template': 'error',
    'template-curly-spacing': 'error',
    'yield-star-spacing': 'error',
    'prefer-rest-params': 'error',
    'no-useless-escape': 'error',
    'no-useless-return': 'error',
    'require-await': 'error',
    'no-return-await': 'error',
    'prefer-promise-reject-errors': 'error'
  },
  globals: {
    chrome: 'readonly',
    browser: 'readonly'
  }
};