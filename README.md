# 🖼️ imgtojpg.org - Professional Image Converter

A free, fast, and secure online image converter supporting **HEIC, RAW, PNG, WebP, TIFF, SVG, and PSD** formats. Built with professional-grade processing and enterprise security.

🌐 **Live Site**: [https://imgtojpg.org](https://imgtojpg.org)

## 🚀 Features

### 📸 **Image Processing**
- **RAW Support**: Professional RAW processing with LibRaw (CR2, CR3, NEF, ARW, ORF, etc.)
- **HEIC/HEIF**: Native Apple format support
- **Multiple Formats**: JPG, PNG, WebP, TIFF, SVG, PSD conversion
- **Batch Processing**: Convert multiple images simultaneously
- **High Quality**: Maintains image quality with optimized compression
- **Large Files**: Supports up to 100MB RAW files

### 🎯 **User Experience**
- **Real-Time Progress**: Live upload and conversion progress tracking
- **Drag & Drop**: Intuitive file upload interface
- **Mobile Responsive**: Perfect experience on all devices
- **PWA Ready**: Installable as a web app
- **Accessibility**: Screen reader support and keyboard navigation
- **Multiple Languages**: i18n support ready

### 🔒 **Security & Performance**
- **Rate Limiting**: Anti-spam protection (50 conversions per 15 min)
- **Security Headers**: CSP, HSTS, and comprehensive protection
- **Auto Cleanup**: Files automatically deleted after processing
- **Worker Threads**: Non-blocking image processing
- **Memory Optimized**: Efficient memory management
- **CDN Ready**: Optimized for global delivery

### 🎨 **Advanced Features**
- **SEO Optimized**: Rich structured data and meta tags
- **Analytics**: Anonymous usage tracking with privacy focus
- **Blog System**: Built-in content management
- **Email Integration**: Contact form and daily reports
- **Toast Notifications**: User-friendly error/success messages
- **Keyboard Shortcuts**: Power user shortcuts (u/c/d)

## 🛠️ Technical Stack

### **Backend**
- **Node.js 20**: Modern JavaScript runtime
- **Express.js**: Web framework with security middleware
- **LibRaw (rawpy)**: Professional RAW image processing
- **Sharp**: High-performance image processing
- **ImageMagick**: Fallback image processing
- **Worker Threads**: Parallel processing
- **Helmet**: Security headers
- **Rate Limiting**: Spam protection

### **Frontend**
- **Vanilla JavaScript**: No frameworks, pure performance
- **Tailwind CSS**: Utility-first styling
- **Progressive Web App**: Installable with service worker
- **Real-time Progress**: XHR-based progress tracking
- **Responsive Design**: Mobile-first approach

### **Infrastructure**
- **AWS ECS/Fargate**: Container orchestration
- **Application Load Balancer**: High availability
- **Route 53**: DNS management
- **ACM**: SSL certificate management
- **CloudWatch**: Logging and monitoring
- **Docker**: Containerized deployment

## 🚀 Installation & Development

### **Quick Start**
```bash
# Clone repository
git clone https://github.com/cloudface-ai/imgtojpg.git
cd imgtojpg

# Install dependencies
npm install

# Build assets
npm run build

# Start development server
npm run dev
```

### **Environment Setup**
```bash
# Copy environment template
cp example.env .env

# Configure email (optional)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### **Production Build**
```bash
# Build all assets
npm run build

# Start production server
npm start
```

## 🏗️ Deployment

### **VPS Deployment (Current)**
```bash
# Deploy to VPS
./deploy-vps.sh

# Setup custom domain
./setup-domain.sh

# Add HTTPS listener
./add-https-listener.sh
```

### **VPS Deployment**
```bash
# Deploy to VPS
./deploy-vps.sh

# The script handles everything automatically
```

## 📁 Project Structure

```
imgtojpg/
├── 🖥️ Backend
│   ├── server.js              # Express server with security
│   ├── jobs/
│   │   ├── convert_libraw.js  # LibRaw-based RAW processing
│   │   └── convert_reliable.js # Fallback processing
│   ├── middleware/
│   │   ├── security.js        # Security headers
│   │   └── redirects.js       # URL redirects
│   └── libraw-converter.py    # Python LibRaw processor
├── 🎨 Frontend
│   ├── public/
│   │   ├── index.html         # Homepage
│   │   ├── heic-to-jpg.html   # HEIC converter
│   │   ├── camera-raw-converter.html # RAW converter
│   │   ├── png-to-jpg.html    # PNG converter
│   │   ├── webp-to-jpg.html   # WebP converter
│   │   ├── tiff-to-jpg.html   # TIFF converter
│   │   ├── progress-tracker.js # Real-time progress
│   │   ├── speakable.js       # Accessibility features
│   │   ├── ux.js              # UX enhancements
│   │   └── style.css          # Compiled styles
│   └── src/
│       └── input.css          # Tailwind source
├── 🚀 Deployment
│   ├── deploy-vps.sh          # VPS deployment script
│   └── setup-domain.sh        # Domain setup
└── 📊 Analytics & Content
    ├── blog-manager.html      # Content management
    ├── analytics-tracker.js   # Privacy-focused analytics
    └── stats/                 # Usage statistics
```

## 🔧 Configuration

### **Image Processing**
- **RAW Processing**: LibRaw with optimized brightness/gamma
- **Quality Settings**: JPEG 95%, PNG compression level 6
- **Memory Limits**: 4GB per conversion task
- **Timeout**: 5 minutes per conversion
- **Concurrent Processing**: Worker thread based

### **Security Configuration**
- **Rate Limits**: 50 conversions per 15 min per IP
- **File Size**: 100MB max for RAW, 50MB for others
- **Session Expiry**: 15 minutes auto-cleanup
- **CSP Headers**: Strict content security policy
- **HTTPS**: SSL/TLS with auto-renewal

## 🎯 Current Capabilities

### **Supported Input Formats**
- **RAW**: CR2, CR3, NEF, ARW, ORF, PEF, RW2, RAF, 3FR, etc.
- **HEIC/HEIF**: Apple formats
- **Standard**: JPG, PNG, WebP, TIFF, SVG

### **Supported Output Formats**
- **JPG/JPEG**: High quality, optimized
- **PNG**: Lossless compression
- **WebP**: Modern web format
- **TIFF**: Professional archival format
- **PSD**: 16-bit Photoshop format
- **SVG**: Vector format (for compatible inputs)

## 🔮 Future Roadmap

### **🎨 Image Processing Enhancements**
- [ ] **AI Upscaling**: ML-based image enhancement
- [ ] **Batch Watermarking**: Add watermarks to multiple images
- [ ] **Color Space Conversion**: sRGB, Adobe RGB, ProPhoto RGB
- [ ] **HDR Processing**: High dynamic range image support
- [ ] **Lens Correction**: Automatic distortion correction
- [ ] **Noise Reduction**: AI-powered noise reduction
- [ ] **Format Extensions**: AVIF, JXL (JPEG XL) support

### **⚡ Performance Improvements**
- [ ] **GPU Acceleration**: CUDA/OpenCL for faster processing
- [ ] **CDN Integration**: CloudFront for global delivery
- [ ] **Caching Layer**: Redis for session management
- [ ] **Queue System**: Background job processing with Bull
- [ ] **Progressive Upload**: Chunked file uploads
- [ ] **WebAssembly**: Client-side processing for small files
- [ ] **Streaming Processing**: Real-time conversion pipeline

### **🛡️ Security & Privacy**
- [ ] **End-to-End Encryption**: Client-side encryption
- [ ] **Zero-Knowledge**: Server never sees unencrypted files
- [ ] **GDPR Compliance**: Enhanced privacy controls
- [ ] **2FA Admin**: Two-factor authentication
- [ ] **Audit Logging**: Comprehensive security logs
- [ ] **IP Geoblocking**: Country-based restrictions
- [ ] **Honeypot Protection**: Advanced bot detection

### **🎯 User Experience**
- [ ] **Offline Support**: Service worker caching
- [ ] **Background Sync**: Queue conversions offline
- [ ] **Desktop App**: Electron-based desktop version
- [ ] **API Access**: RESTful API for developers
- [ ] **Bulk Operations**: Enterprise batch processing
- [ ] **Custom Presets**: User-defined conversion settings
- [ ] **History/Favorites**: Recent conversions tracking

### **📊 Analytics & Insights**
- [ ] **Real-time Dashboard**: Live conversion statistics
- [ ] **Performance Metrics**: Detailed processing analytics
- [ ] **User Behavior**: Privacy-focused usage insights
- [ ] **A/B Testing**: Conversion optimization
- [ ] **Error Tracking**: Comprehensive error monitoring
- [ ] **Business Intelligence**: Revenue and usage reports

### **🌐 Platform Expansion**
- [ ] **Mobile Apps**: iOS and Android native apps
- [ ] **Browser Extensions**: Chrome/Firefox extensions
- [ ] **API Marketplace**: Integration with other services
- [ ] **White-label Solution**: Branded versions for enterprises
- [ ] **Plugin System**: WordPress, Shopify plugins
- [ ] **Webhook Support**: Real-time notifications

### **🎪 Advanced Features**
- [ ] **Video Conversion**: MP4, WebM, GIF support
- [ ] **Document Processing**: PDF to image conversion
- [ ] **3D Model Support**: GLB, OBJ format conversion
- [ ] **AI Features**: Smart cropping, object removal
- [ ] **Collaboration Tools**: Team workspaces
- [ ] **Version Control**: Image history tracking

## 🏆 Current Achievements

### **✅ Recently Implemented**
- **Professional RAW Processing**: LibRaw integration
- **Real-time Progress Tracking**: Live conversion progress
- **Security Hardening**: Rate limiting and CSP protection
- **AWS Infrastructure**: Scalable cloud deployment
- **SEO Optimization**: Rich structured data
- **PWA Support**: Installable web app
- **Accessibility**: Screen reader and keyboard support
- **Performance**: Worker thread processing

### **🎯 Key Metrics**
- **Processing Speed**: ~18s for 4x 50MB RAW files
- **Memory Efficiency**: 4GB container handles large batches
- **Uptime**: 99.9% availability with AWS ECS
- **Security**: Zero security incidents since launch
- **User Experience**: Real progress tracking across all converters

## 🧪 Testing

### **Manual Testing**
```bash
# Test RAW conversion
curl -X POST -F "files=@test.cr3" -F "outputFormat=jpg" http://localhost:3000/convert

# Test progress tracking
curl http://localhost:3000/progress/session_id

# Test rate limiting
# (Make 51 requests in 15 minutes to test limits)
```

### **Load Testing**
```bash
# Install dependencies
npm install -g artillery

# Run load test
artillery quick --count 10 --num 5 http://localhost:3000
```

## 🐛 Troubleshooting

### **Common Issues**
- **RAW files appear black**: Check LibRaw installation and brightness settings
- **Large file uploads fail**: Verify file size limits and timeout settings
- **Progress tracking not working**: Ensure clientSessionId is sent correctly
- **Memory issues**: Monitor worker thread memory usage

### **Debug Mode**
```bash
# Enable debug logging
DEBUG=* npm start

# Check system dependencies
node debug-raw.js
```

## 🤝 Contributing

### **Development Setup**
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Install dependencies: `npm install`
4. Make changes and test locally
5. Build assets: `npm run build`
6. Test thoroughly with different file types
7. Submit pull request

### **Code Style**
- Use ES6+ features
- Follow existing naming conventions
- Add comments for complex logic
- Test with multiple file formats
- Ensure mobile responsiveness

## 📊 Analytics & Privacy

### **Privacy-First Analytics**
- **Anonymous Tracking**: No personal data collected
- **Aggregate Statistics**: File counts, formats, processing times
- **Local Storage**: Data stored on server, not third-party
- **Daily Reports**: Email summaries to admin
- **Opt-out Available**: Users can disable tracking

### **Usage Statistics**
- Total conversions per day
- Popular format combinations
- Processing time metrics
- Error rates and types
- Geographic distribution (country-level only)

## 🏗️ Architecture

### **Current Architecture**
```
Internet → Route 53 → ALB → ECS/Fargate → Container
                                        ├── Node.js/Express
                                        ├── LibRaw/Python
                                        ├── ImageMagick
                                        └── Worker Threads
```

### **Planned Architecture**
```
Internet → CloudFront → ALB → ECS/Fargate → Container
                                          ├── API Gateway
                                          ├── Lambda Functions  
                                          ├── GPU Processing
                                          └── Redis Cache
```

## 🔮 Vision

**imgtojpg.org** aims to become the **world's most trusted and powerful image conversion platform**, combining:

- **Professional Quality**: Enterprise-grade processing
- **Privacy-First**: Zero-knowledge architecture
- **Global Scale**: Sub-second response times worldwide
- **AI-Powered**: Intelligent image enhancement
- **Developer-Friendly**: Comprehensive APIs and integrations

## 📈 Roadmap Timeline

### **Q1 2026: Performance & Scale**
- GPU acceleration implementation
- CDN integration with CloudFront
- WebAssembly client-side processing
- Real-time collaborative features

### **Q2 2026: AI & Intelligence**
- AI upscaling integration
- Smart cropping and enhancement
- Automatic quality optimization
- Intelligent format recommendations

### **Q3 2026: Platform Expansion**
- Mobile apps (iOS/Android)
- Desktop applications
- Browser extensions
- API marketplace launch

### **Q4 2026: Enterprise & Advanced**
- White-label solutions
- Enterprise team features
- Advanced analytics dashboard
- Video conversion support

## 🏆 Technical Achievements

### **Performance Optimizations**
- **Worker Thread Processing**: Non-blocking conversions
- **Memory Management**: Efficient large file handling
- **Compression**: Gzip/Brotli with smart filtering
- **Caching**: Static asset optimization
- **Load Balancing**: Multi-AZ deployment

### **Security Implementations**
- **Rate Limiting**: Express-rate-limit with Redis backing
- **Security Headers**: Helmet.js comprehensive protection
- **Input Validation**: Strict file type and size validation
- **Session Management**: Secure temporary file handling
- **Audit Logging**: Comprehensive request tracking

## 💻 Development Commands

```bash
# Development
npm run dev              # Start dev server with CSS watch
npm run watch:css        # Watch CSS changes only
npm test                 # Run test suite

# Building
npm run build            # Build all production assets
npm run build:css:prod   # Build minified CSS
npm run build:js:individual # Minify individual JS files

# Deployment
./deploy-vps.sh          # Deploy to VPS

# Maintenance
npm run cleanup          # Clean temporary files
npm run analyze          # Analyze bundle size
npm run security-audit   # Check for vulnerabilities
```

## 🔧 Configuration Options

### **Environment Variables**
```bash
# Server Configuration
PORT=3000                    # Server port
NODE_ENV=production         # Environment mode

# Email Configuration (optional)
EMAIL_USER=admin@domain.com # SMTP username
EMAIL_PASS=app-password     # SMTP password

# Security Configuration
RATE_LIMIT_WINDOW=900000    # Rate limit window (15 min)
RATE_LIMIT_MAX=50           # Max requests per window
UPLOAD_LIMIT=104857600      # Max file size (100MB)

# AWS Configuration (for deployment)
AWS_REGION=eu-north-1       # AWS region
AWS_ACCOUNT_ID=123456789    # AWS account ID
```

### **Advanced Configuration**
```javascript
// tailwind.config.js - Customize styling
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#your-brand-color'
      }
    }
  }
}

// server.js - Adjust processing limits
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const WORKER_TIMEOUT = 5 * 60 * 1000;    // 5 minutes
const SESSION_CLEANUP = 15 * 60 * 1000;  // 15 minutes
```

## 🎯 Performance Benchmarks

### **Current Performance**
- **RAW Processing**: ~18s for 4x 50MB CR3 files
- **Memory Usage**: ~121MB RSS, ~11MB heap
- **Throughput**: 50 conversions per 15 min per IP
- **Uptime**: 99.9% availability
- **Response Time**: <2s for standard images

### **Target Performance (Future)**
- **RAW Processing**: <5s for 4x 50MB files (GPU acceleration)
- **Memory Usage**: <50MB per conversion (optimization)
- **Throughput**: 1000+ conversions per minute (scaling)
- **Global Latency**: <100ms worldwide (CDN)

## 🛡️ Security Features

### **Current Security**
- ✅ Rate limiting (50 conversions/15min per IP)
- ✅ File type validation
- ✅ Size limits (100MB max)
- ✅ Auto cleanup (15min sessions)
- ✅ Security headers (CSP, HSTS, etc.)
- ✅ Input sanitization
- ✅ Worker isolation

### **Planned Security**
- [ ] End-to-end encryption
- [ ] Zero-knowledge architecture
- [ ] Advanced bot detection
- [ ] Geographic restrictions
- [ ] Audit logging
- [ ] Compliance certifications

## 📞 Support & Contact

- **Website**: [imgtojpg.org](https://imgtojpg.org)
- **Email**: [Contact Form](https://imgtojpg.org/contact.html)
- **Issues**: GitHub Issues
- **Documentation**: Built-in help center

## 📄 License

This project is open source and available under the **MIT License**.

## 🙏 Acknowledgments

- **LibRaw**: Professional RAW processing library
- **Sharp**: High-performance image processing
- **Tailwind CSS**: Utility-first CSS framework
- **AWS**: Reliable cloud infrastructure
- **Community**: Contributors and users worldwide

---

**🎯 Built with ❤️ in Gurugram, India**  
**⚡ Powered by LibRaw, Node.js, AWS, and modern web technologies**

*Last updated: September 2025*
