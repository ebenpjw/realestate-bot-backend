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
    'no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }],
    'no-undef': 'error',
    'no-unreachable': 'error',
    'no-duplicate-imports': 'error',

    // Best practices
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-destructuring': ['error', {
      array: true,
      object: true
    }, {
      enforceForRenamedProperties: false
    }],
    'no-magic-numbers': ['warn', {
      ignore: [-1, 0, 1, 2],
      ignoreArrayIndexes: true,
      enforceConst: true,
      detectObjects: false
    }],

    // Node.js specific
    'node/no-unpublished-require': 'off',
    'node/no-missing-require': 'error',
    'node/no-extraneous-require': 'error',
    'node/prefer-global/process': 'error',
    'node/prefer-global/buffer': 'error',

    // Security
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-proto': 'error',

    // Modern Node.js 20+ best practices
    'prefer-promise-reject-errors': 'error',
    'require-await': 'error',
    'no-return-await': 'error',
    'no-async-promise-executor': 'error',
    'no-await-in-loop': 'warn',
    'prefer-regex-literals': 'error',

    // Consistent error handling
    'handle-callback-err': 'error',
    'no-throw-literal': 'error',

    // Code quality
    'complexity': ['warn', 10],
    'max-depth': ['warn', 4],
    'max-lines-per-function': ['warn', {
      max: 50,
      skipBlankLines: true,
      skipComments: true
    }],
    'max-params': ['warn', 4],
    'no-nested-ternary': 'error',
    'no-unneeded-ternary': 'error',
    'yoda': 'error',

    // Import/Export organization
    'sort-imports': ['error', {
      ignoreCase: false,
      ignoreDeclarationSort: true,
      ignoreMemberSort: false,
      memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
      allowSeparatedGroups: false
    }],

    // Database service architecture enforcement
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['**/supabaseClient'],
        message: 'Use databaseService instead of direct supabaseClient imports for better abstraction'
      }]
    }],

    // Performance
    'no-loop-func': 'error',
    'no-caller': 'error',
    'no-extend-native': 'error',
  },
  overrides: [
    // Test files
    {
      files: ['**/*.test.js', '**/*.spec.js', 'tests/**/*.js'],
      env: {
        jest: true,
      },
      rules: {
        'node/no-unpublished-require': 'off',
        'max-lines-per-function': 'off',
        'max-params': 'off',
        'no-magic-numbers': 'off',
        'require-await': 'off',
        'complexity': 'off'
      },
    },
    // Scripts directory
    {
      files: ['scripts/**/*.js'],
      rules: {
        'no-console': 'off',
        'node/no-unpublished-require': 'off',
        'max-lines-per-function': 'off'
      }
    },
    // Configuration files
    {
      files: ['*.config.js', '.eslintrc.js', 'next.config.js'],
      rules: {
        'no-magic-numbers': 'off',
        'node/no-unpublished-require': 'off'
      }
    },
    // Development environment
    {
      files: ['**/*.js'],
      env: {
        'node': true
      },
      rules: {
        'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn'
      }
    }
  ],
};
