module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/cli'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    'cli/**/*.ts',
    '!src/**/*.d.ts',
    '!cli/**/*.d.ts',
    '!src/**/__tests__/**',
    '!cli/**/__tests__/**'
  ]
};
