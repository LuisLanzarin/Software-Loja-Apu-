module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { allowJs: true, isolatedModules: true } }] },
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.(ts|js)$': '$1' },
};
