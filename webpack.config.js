import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  // entry point ชี้ไปที่ src/index.js ตามโครงสร้างโฟลเดอร์ใหม่
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/', // สำคัญมากสำหรับ routing และ asset loading (เช่น CSS)
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'images/[name][ext]',
        },
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      // template ชี้ไปที่ public/index.html ที่ย้ายไปแล้ว
      template: './public/index.html',
      filename: 'index.html',
    }),
  ],
  devServer: {
    // Dev Server ต้อง Serve static files จากโฟลเดอร์ public/
    static: {
      directory: path.join(__dirname, 'public'), // **นี่คือจุดที่สำคัญ**
      publicPath: '/',
    },
    compress: true,
    port: 3000,
    open: true,
    historyApiFallback: true,
    // --- เพิ่มส่วน Proxy ที่นี่ ---
    proxy: {
      '/api': { // ทุก request ที่ขึ้นต้นด้วย /api
        target: 'http://localhost:3001', // จะถูกส่งต่อไปยัง backend server ที่นี่
        changeOrigin: true, // จำเป็นสำหรับการทำ proxy ข้าม origin
      },
    },
  },
  mode: 'development',
};