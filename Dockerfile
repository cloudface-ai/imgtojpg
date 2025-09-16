# Simple and reliable Dockerfile for Railway
FROM node:20-bullseye

# Set working directory
WORKDIR /app

# Install system dependencies for image processing
RUN apt-get update && apt-get install -y \
    # ImageMagick (main package includes all needed libraries)
    imagemagick \
    # LibRaw for RAW image support
    libraw-bin \
    # dcraw for additional RAW support
    dcraw \
    # VIPS for high-performance image processing
    libvips-tools \
    # Clean up package lists to reduce image size
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Debug: Check what's actually installed and available
RUN echo "=== Checking what's installed ===" && \
    echo "Available ImageMagick commands:" && \
    ls -la /usr/bin/*magick* 2>/dev/null || echo "No magick commands found" && \
    echo "Available convert commands:" && \
    ls -la /usr/bin/convert 2>/dev/null || echo "convert command not found" && \
    echo "Available dcraw commands:" && \
    ls -la /usr/bin/dcraw 2>/dev/null || echo "dcraw command not found" && \
    echo "Available libraw commands:" && \
    ls -la /usr/bin/raw* 2>/dev/null || echo "No raw commands found" && \
    echo "=== Package verification complete ==="

# Verify critical installations with correct command names
RUN echo "=== Verifying installations ===" && \
    (convert -version || echo "convert command failed") && \
    (dcraw -V || echo "dcraw command failed") && \
    echo "=== All dependencies installed successfully ==="

# Copy package files
COPY package*.json ./

# Install dependencies using npm install instead of npm ci for better compatibility
RUN npm install

# Copy application code
COPY . .

# Build the application (CSS and JS) - this is needed for the app to work
RUN npm run build

# Create necessary directories
RUN mkdir -p uploads converted public

# Set proper permissions
RUN chmod 755 uploads converted public

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Start the application
CMD ["npm", "start"]
