const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const target = env.target || 'chrome'; // chrome o firefox
  
  const config = {
    entry: {
      'background/service-worker': './src/background/service-worker-simple.js',
      'content/youtube-music': './src/content/youtube-music.js',
      'content/youtube': './src/content/youtube-minimal.js',
      'content/soundcloud': './src/content/soundcloud-minimal.js',
      'popup/popup': './src/popup/popup.js',
      'options/options': './src/options/options.js'
    },
    
    output: {
      path: path.resolve(__dirname, `dist/${target}`),
      filename: '[name].js',
      clean: true
    },
    
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', {
                  targets: target === 'firefox' ? 'Firefox >= 78' : 'Chrome >= 88'
                }]
              ]
            }
          }
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader'
          ]
        },
        {
          test: /\.(png|jpg|jpeg|gif|svg)$/,
          type: 'asset/resource',
          generator: {
            filename: 'assets/images/[name][ext]'
          }
        }
      ]
    },
    
    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name].css'
      }),
      
      new HtmlWebpackPlugin({
        template: './src/popup/popup.html',
        filename: 'popup/popup.html',
        chunks: ['popup/popup']
      }),
      
      new HtmlWebpackPlugin({
        template: './src/options/options.html',
        filename: 'options/options.html',
        chunks: ['options/options']
      }),
      
      new CopyWebpackPlugin({
        patterns: [
          {
            from: './src/assets/manifest.json',
            to: 'manifest.json',
            transform(content) {
              const manifest = JSON.parse(content.toString());
              
              // Adattamenti specifici per Firefox
              if (target === 'firefox') {
                manifest.manifest_version = 2;
                manifest.background = {
                  scripts: ['background/service-worker.js'],
                  persistent: false
                };
                delete manifest.service_worker;
                
                // Firefox-specific settings
                manifest.browser_specific_settings = {
                  gecko: {
                    id: '{44df8213-a17e-4915-a006-187d6d34bd95}',
                    strict_min_version: "109.0",
                    data_collection_permissions: {
                        required: ["none"]
                    }
                  }
                };
                if (manifest.key) delete manifest.key;

                // Trasforma web_accessible_resources per V2 (array di stringhe)
                if (Array.isArray(manifest.web_accessible_resources)) {
                  const v2Resources = [];
                  manifest.web_accessible_resources.forEach(entry => {
                    if (typeof entry === 'string') {
                      v2Resources.push(entry);
                    } else if (entry.resources) {
                      v2Resources.push(...entry.resources);
                    }
                  });
                  manifest.web_accessible_resources = v2Resources;
                }
                
                // MV3 'action' -> MV2 'browser_action'
                if (manifest.action) {
                  manifest.browser_action = manifest.action;
                  delete manifest.action;
                }

                // MV3 'host_permissions' -> MV2 'permissions'
                if (manifest.host_permissions) {
                  if (!manifest.permissions) manifest.permissions = [];
                  manifest.permissions.push(...manifest.host_permissions);
                  delete manifest.host_permissions;
                }

                // MV3 CSP object -> MV2 CSP string
                if (manifest.content_security_policy && typeof manifest.content_security_policy === 'object') {
                  manifest.content_security_policy = manifest.content_security_policy.extension_pages || "script-src 'self'; object-src 'self';";
                }
              }
              
              return JSON.stringify(manifest, null, 2);
            }
          },
          {
            from: './src/assets/icons/',
            to: 'assets/icons/'
          },
          {
            from: './src/about/',
            to: 'about/'
          },
          {
            from: './src/_locales/',
            to: '_locales/'
          }
        ]
      })
    ],
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@modules': path.resolve(__dirname, 'src/modules'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@assets': path.resolve(__dirname, 'src/assets')
      }
    },
    
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all'
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            enforce: true
          }
        }
      }
    },
    
    devtool: isProduction ? false : 'cheap-module-source-map',
    
    stats: {
      colors: true,
      modules: false,
      children: false,
      chunks: false,
      chunkModules: false
    }
  };
  
  return config;
};
