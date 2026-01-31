module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          chrome: '88',
          firefox: '78'
        },
        useBuiltIns: 'usage',
        corejs: 3,
        modules: false
      }
    ]
  ],
  env: {
    test: {
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              node: 'current'
            }
          }
        ]
      ]
    }
  }
};