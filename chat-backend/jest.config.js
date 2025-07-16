module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: ['**/*.js', '!**/node_modules/**', '!**/coverage/**', '!jest.config.js'],
  verbose: true,
}
