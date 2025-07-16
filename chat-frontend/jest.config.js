module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
        },
      },
    ],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  testMatch: ['**/__tests__/**/*.(ts|tsx|js)', '**/*.(test|spec).(ts|tsx|js)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components$': '<rootDir>/src/components',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@types$': '<rootDir>/src/types',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@context/(.*)$': '<rootDir>/src/context/$1',
    '^@chat-types$': '<rootDir>/../chat-types/src',
    'react-native': 'react-native-web',
    'expo-audio': '<rootDir>/src/__mocks__/expo-audio.js',
    'expo-file-system': '<rootDir>/src/__mocks__/expo-file-system.js',
    'expo-image-picker': '<rootDir>/src/__mocks__/expo-image-picker.js',
    'expo-av': '<rootDir>/src/__mocks__/expo-av.js',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/**/index.ts',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@expo|expo|expo-audio|expo-file-system|expo-image-picker|expo-av|expo-modules-core|@react-navigation|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context))',
  ],
}
