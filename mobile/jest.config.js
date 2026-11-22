/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  forceExit: true,
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|webp)$': '<rootDir>/test/fileMock.js',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
    '!src/app/**',
    '!src/payments/**',
    '!src/**/*.web.tsx',
    '!src/**/*.native.tsx',
  ],
  coverageThreshold: {
    global: { lines: 80, branches: 75 },
  },
};
