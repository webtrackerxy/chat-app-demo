const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add alias resolver for path mappings
config.resolver.alias = {
  '@chat-types': path.resolve(__dirname, '../chat-types/src'),
  '@': path.resolve(__dirname, 'src'),
  '@components': path.resolve(__dirname, 'src/components'),
  '@config': path.resolve(__dirname, 'src/config'),
  '@hooks': path.resolve(__dirname, 'src/hooks'),
  '@screens': path.resolve(__dirname, 'src/screens'),
  '@store': path.resolve(__dirname, 'src/store'),
  '@services': path.resolve(__dirname, 'src/services'),
  '@types': path.resolve(__dirname, 'src/types'),
  '@api': path.resolve(__dirname, 'src/api'),
  '@context': path.resolve(__dirname, 'src/context'),
  '@utils': path.resolve(__dirname, 'src/utils'),
  '@theme': path.resolve(__dirname, 'src/theme'),
};

// Add resolver for react-native-quick-crypto
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Add the chat-types directory to the watchFolders
config.watchFolders = [
  path.resolve(__dirname, '../chat-types'),
];

module.exports = config;