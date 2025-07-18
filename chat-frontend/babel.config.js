module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@chat-types': '../chat-types/src',
            '@': './src',
            '@components': './src/components',
            '@config': './src/config',
            '@hooks': './src/hooks',
            '@screens': './src/screens',
            '@store': './src/store',
            '@services': './src/services',
            '@types': './src/types',
            '@api': './src/api',
            '@context': './src/context',
            '@theme': './src/theme',
          },
        },
      ],
    ],
  };
};