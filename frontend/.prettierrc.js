/** @type {import('prettier').Config} */
module.exports = {
  // Core formatting
  semi: false,
  singleQuote: true,
  quoteProps: 'as-needed',
  trailingComma: 'es5',
  tabWidth: 2,
  useTabs: false,
  
  // Line formatting
  printWidth: 100,
  endOfLine: 'lf',
  
  // JSX formatting
  jsxSingleQuote: false,
  jsxBracketSameLine: false,
  
  // Object formatting
  bracketSpacing: true,
  bracketSameLine: false,
  
  // Arrow function formatting
  arrowParens: 'avoid',
  
  // Plugin configurations
  plugins: [
    'prettier-plugin-tailwindcss',
  ],
  
  // File-specific overrides
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 80,
      },
    },
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'always',
      },
    },
    {
      files: '*.yml',
      options: {
        singleQuote: false,
      },
    },
  ],
  
  // Tailwind CSS plugin configuration
  tailwindConfig: './tailwind.config.ts',
  tailwindFunctions: ['clsx', 'cn', 'cva'],
}
