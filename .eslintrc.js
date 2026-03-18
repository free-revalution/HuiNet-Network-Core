module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: true, // Auto-find tsconfig.json
    tsconfigRootDir: __dirname
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  env: {
    node: true,
    es6: true
  },
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    '@typescript-eslint/no-var-requires': 'off',
    'no-case-declarations': 'off',
    'no-console': 'off'
  },
  ignorePatterns: [
    'dist/**',
    'dist',
    'node_modules/**',
    'node_modules',
    '*.js',
    '**/*.js',
    'proxy/**',
    'proxy',
    '.worktrees/**',
    '.worktrees'
  ]
};
