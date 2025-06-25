module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:node/recommended',
    'prettier'
  ],
  plugins: ['node'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    // Error prevention
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-undef': 'error',
    
    // Best practices
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error',
    'prefer-arrow-callback': 'error',
    
    // Node.js specific
    'node/no-unpublished-require': 'off',
    'node/no-missing-require': 'error',
    'node/no-extraneous-require': 'error',
    
    // Security
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js'],
      env: {
        jest: true,
      },
      rules: {
        'node/no-unpublished-require': 'off',
      },
    },
  ],
};
