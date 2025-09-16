# 🚀 Image Converter Service - Deployment Guide

## 📋 Overview
This is a Node.js-based image conversion service that supports multiple formats including HEIC, PNG, WebP, TIFF, SVG, and RAW camera formats (CR2, CR3, NEF, ARW, RAF, ORF, PEF, RW2, 3FR, IIQ).

## 🔧 System Requirements
- **Node.js**: Version 16 or higher
- **npm**: Version 8 or higher
- **Platform**: Any platform that supports Node.js (Linux, Windows, macOS, Cloud platforms)

## 📦 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/nerdykeeda/heic-to-jpg.git
cd heic-to-jpg
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Build CSS (Optional)
```bash
npm run build:css
```

## 🚀 Running the Service

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The service will start on port 3000 by default.

## 🌐 Production Deployment

### Environment Variables
- **PORT**: Server port (default: 3000)
- **NODE_ENV**: Set to 'production' for production deployments

### Process Manager (PM2) - Recommended
```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start server.js --name "image-converter"

# Save PM2 configuration
pm2 save

# Set PM2 to start on system boot
pm2 startup
```

### Docker Deployment
```dockerfile
FROM node:20-bullseye
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production
EXPOSE 3000
CMD ["npm", "start"]
```

### Cloud Platform Deployment

#### Heroku
```bash
# Create Heroku app
heroku create your-app-name

# Set buildpack
heroku buildpacks:set heroku/nodejs

# Deploy
git push heroku main
```

#### Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

#### Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway up
```

## 🔍 Key Features

### Supported Input Formats
- **HEIC/HEIF**: iPhone photos
- **PNG**: Transparent images
- **WebP**: Web-optimized images
- **TIFF**: High-quality images
- **SVG**: Vector graphics
- **RAW**: Professional camera formats (CR2, CR3, NEF, ARW, RAF, ORF, PEF, RW2, 3FR, IIQ)

### Supported Output Formats
- **JPG/JPEG**: Web-friendly format
- **PNG**: Lossless with transparency
- **WebP**: Modern web format
- **TIFF**: High-quality format
- **PSD**: Photoshop format (placeholder)
- **SVG**: Vector format (placeholder)

## 🛠️ Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Check what's using the port
lsof -i :3000

# Kill the process
kill -9 <PID>
```

#### 2. Memory Issues with Large Files
- Increase Node.js memory limit: `node --max-old-space-size=4096 server.js`
- Use PM2 with memory limits: `pm2 start server.js --max-memory-restart 1G`

#### 3. File Upload Failures
- Check file size limits (default: 100MB)
- Verify uploads directory permissions
- Ensure sufficient disk space

### Logs
```bash
# View PM2 logs
pm2 logs image-converter

# View real-time logs
pm2 logs image-converter --lines 100 --follow
```

## 📊 Performance Optimization

### 1. Enable Compression
```javascript
const compression = require('compression');
app.use(compression());
```

### 2. Use CDN for Static Files
- Serve static assets through CDN
- Enable browser caching

### 3. Database Integration (Optional)
- Store conversion history
- User authentication
- Rate limiting

## 🔒 Security Considerations

### 1. File Upload Security
- File type validation
- File size limits
- Virus scanning (optional)

### 2. Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/convert', limiter);
```

### 3. CORS Configuration
```javascript
const cors = require('cors');
app.use(cors({
  origin: ['https://yourdomain.com'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
```

## 📈 Monitoring

### Health Check Endpoint
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

### Metrics Collection
- Request count
- Conversion success rate
- File size distribution
- Response times

## 🔄 Updates and Maintenance

### 1. Regular Updates
```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Restart service
pm2 restart image-converter
```

### 2. Backup Strategy
- Regular database backups (if applicable)
- Configuration file backups
- Log rotation

## 📞 Support

For technical support or questions:
- **Repository**: https://github.com/nerdykeeda/heic-to-jpg
- **Issues**: Create an issue on GitHub
- **Documentation**: Check the README.md file

## 📄 License

This project is open source and available under the MIT License.

---

**Last Updated**: January 27, 2025
**Version**: 1.2.0
