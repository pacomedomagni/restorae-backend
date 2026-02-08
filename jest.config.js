module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/modules/**/**.service.ts',
    '!src/**/*.spec.ts',
    '!src/**/dto/**',
  ],
  coverageThreshold: {
    'src/modules/auth/auth.service.ts': { branches: 50, functions: 60, lines: 60 },
    'src/modules/mood/mood.service.ts': { branches: 50, functions: 60, lines: 60 },
    'src/modules/subscriptions/subscriptions.service.ts': { branches: 50, functions: 60, lines: 60 },
  },
};
