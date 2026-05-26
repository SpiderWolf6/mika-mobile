module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@connectors': './src/connectors',
          '@slm': './src/slm',
          '@wiki': './src/wiki',
          '@ui': './src/ui',
          '@utils': './src/utils',
          '@config': './src/config',
        },
      },
    ],
  ],
};
