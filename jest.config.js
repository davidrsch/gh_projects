module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/integration/'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};
