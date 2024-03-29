const path = require("path");
const webpack = require("webpack");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = {
  devtool: false,
  mode: "production",
  entry: ["./src/index.ts"],
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "wallet-adapter-lib.js",
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
    }),
    new webpack.ProvidePlugin({
      process: "process/browser",
    }),
    new NodePolyfillPlugin(),
  ],
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: "ts-loader",
        exclude: /(node_modules|bower_components)/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {
      buffer: require.resolve("buffer/"),
      assert: require.resolve("assert/"),
    },
  },
  optimization: {
    minimize: true,
  },
};
