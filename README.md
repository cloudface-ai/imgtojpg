# HEIC to JPG Converter

A free, fast, and secure online image converter that supports multiple formats including HEIC, PNG, WebP, and TIFF.

## 🚀 Features

- **Multiple Format Support**: Convert from HEIC, PNG, WebP, TIFF to JPG, PNG, WebP, TIFF
- **Batch Processing**: Convert multiple images simultaneously
- **High Quality**: Maintains image quality during conversion
- **Secure**: Files are processed locally and automatically deleted
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **No Registration**: Completely free with no signup required

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd heic-to-jpg
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build CSS for production**
   ```bash
   npm run build
   ```

4. **Start the server**
   ```bash
   npm start
   ```

## 🎨 Development

### CSS Development
- **Watch mode**: Automatically rebuilds CSS when source files change
  ```bash
  npm run watch:css
  ```
- **Build once**: Build CSS once
  ```bash
  npm run build:css
  ```
- **Production build**: Build minified CSS for production
  ```bash
  npm run build:css:prod
  ```

### Development Server
- **Development mode**: Builds CSS and starts server
  ```bash
  npm run dev
  ```

## 📁 Project Structure

```
heic-to-jpg/
├── src/
│   └── input.css          # Tailwind CSS source file
├── public/
│   ├── style.css          # Compiled CSS (generated)
│   ├── index.html         # Main application page
│   ├── converted/         # Converted images storage
│   └── ...                # Other static assets
├── jobs/
│   └── convert.js         # Image conversion worker
├── uploads/               # Temporary upload storage
├── server.js              # Express server
├── tailwind.config.js     # Tailwind CSS configuration
├── postcss.config.js      # PostCSS configuration
└── package.json           # Dependencies and scripts
```

## 🔧 Configuration

### Tailwind CSS
The project uses Tailwind CSS v3 with custom component classes. All styles are defined in `src/input.css` and compiled to `public/style.css`.

### Server Configuration
- **Port**: 3000 (configurable in `server.js`)
- **File size limit**: 50MB per file
- **Session cleanup**: Automatic cleanup every 5 minutes
- **Session expiry**: 15 minutes

## 📱 Usage

1. **Upload Images**: Drag and drop or click to browse
2. **Select Format**: Choose your desired output format
3. **Convert**: Click "Convert Files" to start processing
4. **Download**: Get individual files or download all as ZIP

## 🚀 Production Deployment

1. **Build assets**
   ```bash
   npm run build
   ```

2. **Set environment variables** (if needed)
   - `PORT`: Server port (default: 3000)
   - `NODE_ENV`: Environment (production/development)

3. **Start server**
   ```bash
   npm start
   ```

## 🔒 Security Features

- File type validation
- File size limits
- Automatic cleanup of uploaded files
- Session-based file storage
- No persistent storage of user files

## 📊 Performance

- Worker thread-based image processing
- Efficient memory management
- Automatic cleanup of temporary files
- Optimized image conversion algorithms

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## ☕ Support

If you find this project helpful, consider buying me a coffee! ☕

---

**Built with ❤️ using Node.js, Express, Tailwind CSS, and Sharp**
