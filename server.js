// server.js
// Load environment variables from .env file (for local development)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const { Worker } = require('worker_threads');
const nodemailer = require('nodemailer');
const compression = require('compression');

const app = express();
const port = process.env.PORT || 3000;

// Performance monitoring
const getMemoryUsage = () => {
  const used = process.memoryUsage();
  return {
    rss: Math.round(used.rss / 1024 / 1024 * 100) / 100,
    heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100,
    heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100,
    external: Math.round(used.external / 1024 / 1024 * 100) / 100
  };
};

// Log memory usage every 30 seconds
setInterval(() => {
  const mem = getMemoryUsage();
  console.log(`📊 Memory Usage - RSS: ${mem.rss}MB, Heap: ${mem.heapUsed}/${mem.heapTotal}MB, External: ${mem.external}MB`);
}, 30000);

// Enable compression middleware for better performance
app.use(compression({
  level: 6, // Compression level (1-9, 6 is good balance)
  threshold: 1024, // Only compress files larger than 1KB
  filter: (req, res) => {
    // Don't compress already compressed files
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Import middleware
const redirectMiddleware = require('./middleware/redirects');
const securityHeaders = require('./middleware/security');

// Email configuration - using environment variables
const emailUser = process.env.EMAIL_USER || 'nerdykeeda@gmail.com';
const emailPass = process.env.EMAIL_PASS;

// Debug: Log environment variable values (without showing passwords)
console.log('Environment variables loaded:');
console.log('EMAIL_USER:', emailUser ? 'SET' : 'NOT SET');
console.log('EMAIL_PASS:', emailPass ? 'SET' : 'NOT SET');
console.log('NODE_ENV:', process.env.NODE_ENV);

// Only create transporter if email credentials are provided
let transporter = null;
if (emailUser && emailPass) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });
  console.log('✅ Email transporter created successfully');
} else {
  console.log('❌ Email credentials not configured (missing EMAIL_PASS). Contact form will be disabled.');
}

// Daily analytics email at 21:00 local time
function scheduleDailyAnalyticsEmail() {
  let lastSentDate = null; // YYYY-MM-DD
  setInterval(() => {
    try {
      if (!transporter) return; // email not configured
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const today = now.toISOString().slice(0, 10);
      if (hours === 21 && minutes === 0 && lastSentDate !== today) {
        sendAnalyticsEmail(today).then(() => {
          lastSentDate = today;
          console.log('📧 Daily analytics email sent for', today);
        }).catch((err) => {
          console.log('⚠️ Failed to send analytics email:', err.message);
        });
      }
    } catch (e) {
      // swallow scheduler errors
    }
  }, 60 * 1000);
}

async function sendAnalyticsEmail(day) {
  const statsDir = path.join(__dirname, 'stats');
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(new Date(day).getTime() - i * 24 * 60 * 60 * 1000);
    days.push(d.toISOString().slice(0, 10));
  }

  let summary = { total: 0, failures: 0, byFormat: {} };
  const lines = [];
  for (const d of days) {
    try {
      const file = path.join(statsDir, `usage_${d}.json`);
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        const t = data.total || 0;
        const f = data.failures || 0;
        summary.total += t;
        summary.failures += f;
        if (data.byFormat) {
          for (const fmt of Object.keys(data.byFormat)) {
            summary.byFormat[fmt] = (summary.byFormat[fmt] || 0) + (data.byFormat[fmt] || 0);
          }
        }
        lines.push(`${d}: total=${t}, failures=${f}`);
      } else {
        lines.push(`${d}: no data`);
      }
    } catch (e) {
      lines.push(`${d}: error reading stats`);
    }
  }

  const formatRows = Object.keys(summary.byFormat).sort().map(fmt => `<tr><td style="padding:6px 10px;border:1px solid #ddd">${fmt}</td><td style="padding:6px 10px;border:1px solid #ddd">${summary.byFormat[fmt]}</td></tr>`).join('');

  const html = `
  <div style="font-family:Inter,Arial,sans-serif;color:#111">
    <h2>imgtojpg.org · Daily Usage Summary</h2>
    <p>Date: ${day}</p>
    <p><b>7-day totals</b></p>
    <ul>
      <li>Total conversions: <b>${summary.total}</b></li>
      <li>Failures: <b>${summary.failures}</b></li>
    </ul>
    <h3>By output format</h3>
    <table style="border-collapse:collapse;border:1px solid #ddd">
      <thead><tr><th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Format</th><th style="padding:6px 10px;border:1px solid #ddd;text-align:right">Count</th></tr></thead>
      <tbody>${formatRows || '<tr><td style="padding:6px 10px;border:1px solid #ddd">(none)</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:right">0</td></tr>'}</tbody>
    </table>
    <h3 style="margin-top:16px">Daily breakdown</h3>
    <pre style="background:#f8f8f8;border:1px solid #eee;padding:10px;border-radius:6px">${lines.join('\n')}</pre>
  </div>`;

  const attachments = [];
  try {
    const todayPath = path.join(statsDir, `usage_${day}.json`);
    if (fs.existsSync(todayPath)) {
      attachments.push({ filename: `usage_${day}.json`, path: todayPath, contentType: 'application/json' });
    }
  } catch (e) { /* ignore */ }

  const mailOptions = {
    from: emailUser,
    to: 'nerdykeeda@gmail.com',
    subject: `Daily Usage Summary - ${day}`,
    html,
    attachments
  };
  return transporter.sendMail(mailOptions);
}

scheduleDailyAnalyticsEmail();

app.use(express.static('public'));
app.use(express.json()); // Add this line for parsing JSON requests

// Use security headers middleware
app.use(securityHeaders);

// Use redirect middleware
app.use(redirectMiddleware);

// Performance monitoring endpoint
app.get('/performance', (req, res) => {
  const mem = getMemoryUsage();
  const uptime = process.uptime();
  
  res.json({
    success: true,
    performance: {
      memory: mem,
      uptime: Math.round(uptime),
      uptimeFormatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    },
    timestamp: new Date().toISOString()
  });
});

// Diagnostic endpoint to check Render environment
app.get('/debug-env', (req, res) => {
  try {
    const { execSync } = require('child_process');
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      uid: process.getuid(),
      gid: process.getgid()
    };
    
    // Check system dependencies
    const tools = ['magick', 'convert', 'dcraw'];
    diagnostics.tools = {};
    
    for (const tool of tools) {
      try {
        const version = execSync(`${tool} -version`, { stdio: 'pipe', timeout: 5000 }).toString().split('\n')[0];
        diagnostics.tools[tool] = { available: true, version };
      } catch (error) {
        try {
          // Try alternative commands
          if (tool === 'magick') {
            const convertVersion = execSync('convert -version', { stdio: 'pipe', timeout: 5000 }).toString().split('\n')[0];
            diagnostics.tools[tool] = { available: true, version: convertVersion, fallback: 'convert' };
          } else {
            diagnostics.tools[tool] = { available: false, error: error.message };
          }
        } catch (fallbackError) {
          diagnostics.tools[tool] = { available: false, error: error.message };
        }
      }
    }
    
    // Check file permissions
    try {
      const testDir = './debug-test';
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      
      const testFile = path.join(testDir, 'test.txt');
      fs.writeFileSync(testFile, 'test');
      const stats = fs.statSync(testFile);
      
      diagnostics.fileSystem = {
        writable: true,
        permissions: stats.mode.toString(8),
        uid: stats.uid,
        gid: stats.gid
      };
      
      // Cleanup
      fs.unlinkSync(testFile);
      fs.rmdirSync(testDir);
    } catch (error) {
      diagnostics.fileSystem = {
        writable: false,
        error: error.message
      };
    }
    
    res.json({
      success: true,
      diagnostics
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Admin authentication middleware
const adminAuth = (req, res, next) => {
  const adminToken = req.headers['admin-token'] || req.query.adminToken;
  
  // Simple token-based auth (you can change this to any secure token you want)
  const validToken = 'admin123'; // Change this to a secure token
  
  if (adminToken === validToken) {
    next();
  } else {
    res.status(401).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }
};

// Simple rate limiting for conversion endpoint
const conversionRequests = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // Max 10 conversions per minute per IP

const rateLimit = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!conversionRequests.has(clientIP)) {
    conversionRequests.set(clientIP, []);
  }
  
  const requests = conversionRequests.get(clientIP);
  
  // Remove old requests outside the window
  const validRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
  conversionRequests.set(clientIP, validRequests);
  
  if (validRequests.length >= RATE_LIMIT_MAX) {
    return res.status(429).json({
      success: false,
      message: 'Too many conversion requests. Please wait a moment before trying again.',
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
    });
  }
  
  // Add current request
  validRequests.push(now);
  conversionRequests.set(clientIP, validRequests);
  
  next();
};

const upload = multer({ dest: 'uploads/' });

// POST /convert
app.post('/convert', rateLimit, upload.array('files'), async (req, res) => {
  const requestStartTime = Date.now();
  const initialMemory = getMemoryUsage();
  
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }
    
    console.log(`🚀 Conversion request started - Files: ${req.files.length}, Memory: ${initialMemory.heapUsed}MB`);

    // Validate file types
    const allowedExtensions = ['.heic', '.heif', '.jpg', '.jpeg', '.png', '.webp', '.tiff', '.svg', '.cr2', '.cr3', '.nef', '.nrw', '.arw', '.srf', '.sr2', '.raf', '.orf', '.pef', '.rw2', '.3fr', '.rdc', '.iiq', '.dcr', '.k25', '.kdc', '.mef', '.mos', '.erf'];
    const invalidFiles = req.files.filter(file => {
      const ext = path.extname(file.originalname).toLowerCase();
      return !allowedExtensions.includes(ext);
    });

    if (invalidFiles.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid file type(s): ${invalidFiles.map(f => f.originalname).join(', ')}`
      });
    }

    // Validate file sizes (100MB limit for RAW files)
    const maxSize = 100 * 1024 * 1024; // 100MB
    const oversizedFiles = req.files.filter(file => file.size > maxSize);

    if (oversizedFiles.length > 0) {
      return res.status(400).json({
        success: false,
        message: `File(s) too large: ${oversizedFiles.map(f => f.originalname).join(', ')} (max 50MB)`
      });
    }

    // Get output format from request body
    const outputFormat = req.body.outputFormat || 'jpg';
    
    // Validate output format
    const validOutputFormats = ['jpg', 'jpeg', 'png', 'webp', 'tiff', 'svg', 'psd'];
    if (!validOutputFormats.includes(outputFormat.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid output format. Supported formats: JPG, PNG, WebP, TIFF, SVG, PSD'
      });
    }

    // Create session directory (allow client-provided id for progress polling)
    let sessionId = (req.body && req.body.clientSessionId) ? String(req.body.clientSessionId) : uuidv4();
    // basic sanitize: allow a-zA-Z0-9 - _ only
    sessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || uuidv4();
    const sessionPath = path.join(__dirname, 'public', 'converted', sessionId);
    
    // Create session directory
    try {
      fs.mkdirSync(sessionPath, { recursive: true });
    } catch (dirError) {
      console.error('Error creating session directory:', dirError);
      return res.status(500).json({
        success: false,
        message: 'Failed to create session directory'
      });
    }

    // Copy uploaded files to session directory
    const copiedFiles = [];
    for (const file of req.files) {
      const fileName = file.originalname;
      const sessionFilePath = path.join(sessionPath, fileName);
      
      try {
        // Copy file to session directory
        fs.copyFileSync(file.path, sessionFilePath);
        
        // Clean up temporary upload file
        fs.unlinkSync(file.path);
        
        copiedFiles.push({
          path: sessionFilePath,
          originalname: fileName,
          size: file.size
        });
        
        console.log(`Copied ${fileName} to session directory`);
      } catch (copyError) {
        console.error(`Failed to copy ${fileName}:`, copyError);
        // Clean up temporary file even if copy fails
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupError) {
          console.log(`Warning: Could not clean up temp file ${file.path}`);
        }
        throw new Error(`Failed to copy file ${fileName}: ${copyError.message}`);
      }
    }

    const jobData = {
      sessionId,
      sessionPath,
      files: copiedFiles,
      outputFormat: outputFormat
    };

    // Store job data temporarily
    try {
      fs.writeFileSync(path.join(sessionPath, 'jobData.json'), JSON.stringify(jobData));
      // Initialize progress file
      const progress = {
        sessionId,
        total: copiedFiles.length,
        done: 0,
        status: 'queued',
        updatedAt: new Date().toISOString()
      };
      fs.writeFileSync(path.join(sessionPath, 'progress.json'), JSON.stringify(progress));
    } catch (writeError) {
      console.error('Error writing job data:', writeError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save job data'
      });
    }

    // Create and run worker (reliable RAW path with vips + dcraw)
    const worker = new Worker(path.join(__dirname, 'jobs', 'convert_reliable.js'), {
      workerData: jobData
    });

    // Set worker timeout (5 minutes)
    const workerTimeout = setTimeout(() => {
      worker.terminate();
      res.status(500).json({
        success: false,
        message: 'Conversion timed out. Please try again with smaller files.'
      });
    }, 5 * 60 * 1000);

    worker.on('message', (message) => {
      clearTimeout(workerTimeout);
      const totalTime = (Date.now() - requestStartTime) / 1000;
      const finalMemory = getMemoryUsage();
      
      if (message.success) {
        console.log(`✅ Conversion completed successfully in ${totalTime.toFixed(2)}s`);
        console.log(`📊 Performance - Processing: ${message.processingTime || 'N/A'}s, Memory: ${initialMemory.heapUsed}MB → ${finalMemory.heapUsed}MB`);
        try {
          // Anonymous aggregate: update a lightweight counter file (no IP, no filenames)
          const statsDir = path.join(__dirname, 'stats');
          const day = new Date().toISOString().slice(0,10);
          const file = path.join(statsDir, `usage_${day}.json`);
          if (!fs.existsSync(statsDir)) fs.mkdirSync(statsDir, { recursive: true });
          const base = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : { total:0, byFormat:{}, failures:0 };
          base.total += 1;
          const fmt = (req.body && req.body.outputFormat || 'jpg').toLowerCase();
          base.byFormat[fmt] = (base.byFormat[fmt]||0) + 1;
          fs.writeFileSync(file, JSON.stringify(base));
        } catch(_) {}
        
        res.json({
          success: true,
          message: 'Conversion completed successfully',
          downloadLink: `/download/${sessionId}`,
          convertedFiles: message.convertedFiles,
          performance: {
            totalTime: totalTime,
            processingTime: message.processingTime,
            memoryUsage: finalMemory
          }
        });
      } else {
        console.log(`❌ Conversion failed after ${totalTime.toFixed(2)}s: ${message.error}`);
        try {
          const statsDir = path.join(__dirname, 'stats');
          const day = new Date().toISOString().slice(0,10);
          const file = path.join(statsDir, `usage_${day}.json`);
          if (!fs.existsSync(statsDir)) fs.mkdirSync(statsDir, { recursive: true });
          const base = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : { total:0, byFormat:{}, failures:0 };
          base.failures += 1;
          fs.writeFileSync(file, JSON.stringify(base));
        } catch(_) {}
        res.status(500).json({
          success: false,
          message: 'Conversion failed: ' + message.error
        });
      }
      // Give worker a moment to clean up before terminating
      setTimeout(() => worker.terminate(), 100);
    });

    worker.on('error', (error) => {
      clearTimeout(workerTimeout);
      console.error('Worker error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Worker error: ' + error.message
        });
      }
      worker.terminate();
    });

    worker.on('exit', (code) => {
      clearTimeout(workerTimeout);
      // Only log non-zero exit codes if response hasn't been sent
      if (code !== 0 && !res.headersSent) {
        console.error(`Worker stopped with exit code ${code}`);
        res.status(500).json({
          success: false,
          message: 'Conversion process failed unexpectedly'
        });
      } else if (code !== 0) {
        // Just log the exit code if response was already sent
        console.log(`Worker completed with exit code ${code} (response already sent)`);
      }
    });

  } catch (error) {
    console.error('Server error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Server error: ' + error.message
      });
    }
  }
});

// Progress endpoint
app.get('/progress/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionPath = path.join(__dirname, 'public', 'converted', sessionId);
    const progressPath = path.join(sessionPath, 'progress.json');
    if (!fs.existsSync(progressPath)) {
      return res.status(404).json({ success: false, message: 'Progress not found yet' });
    }
    const data = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
    const percent = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
    res.json({ success: true, sessionId, total: data.total, done: data.done, percent, status: data.status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Serve the ZIP download
app.get('/download/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const sessionPath = path.join(__dirname, 'public', 'converted', sessionId);
  const zipPath = path.join(sessionPath, 'converted_images.zip');

  console.log(`Download request for session: ${sessionId}`);
  console.log(`ZIP path: ${zipPath}`);

  if (!fs.existsSync(zipPath)) {
    console.log(`ZIP file not found: ${zipPath}`);
    return res.status(404).send('File not found or expired.');
  }

  // Get file stats for debugging
  const stats = fs.statSync(zipPath);
  console.log(`ZIP file size: ${stats.size} bytes`);

  res.download(zipPath, `converted_images_${sessionId}.zip`, (err) => {
    if (err) {
      console.error('Download error:', err);
    } else {
      console.log(`ZIP download completed successfully for session: ${sessionId}`);
    }
  });
});

// Serve individual converted images
app.get('/converted/:sessionId/:filename', (req, res) => {
  const { sessionId, filename } = req.params;
  const filePath = path.join(__dirname, 'public', 'converted', sessionId, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found.');
  }
  
  // Set proper content type based on file extension
  const ext = path.extname(filename).toLowerCase();
  let contentType = 'application/octet-stream'; // default
  
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      contentType = 'image/jpeg';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.webp':
      contentType = 'image/webp';
      break;
    case '.tiff':
    case '.tif':
      contentType = 'image/tiff';
      break;
    case '.svg':
      contentType = 'image/svg+xml';
      break;
  }
  
  // Set headers for proper download
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  // Send the file
  res.sendFile(filePath);
});

// Blog dashboard route
app.get('/blog-dashboard', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'blog-dashboard.html'));
});

// API endpoint to update blog.html
app.post('/api/update-blog', adminAuth, (req, res) => {
  try {
    const { postData, postHTML } = req.body;
    
    if (!postData || !postHTML) {
      return res.status(400).json({
        success: false,
        message: 'Missing post data or HTML'
      });
    }

    // Read current blog.html
    const blogPath = path.join(__dirname, 'public', 'blog.html');
    let blogContent = fs.readFileSync(blogPath, 'utf8');
    
    // Find the position to insert new post (after the navigation header, before existing content)
    const navEndIndex = blogContent.indexOf('<!-- BLOG POSTS START - New posts will be inserted here -->');
    let newBlogContent;
    
    if (navEndIndex === -1) {
      // Fallback: insert after body tag if nav marker not found
      const bodyTagIndex = blogContent.indexOf('<body>') + 7;
      const beforeBody = blogContent.substring(0, bodyTagIndex);
      const afterBody = blogContent.substring(bodyTagIndex);
      newBlogContent = beforeBody + '\n\n  ' + postHTML + '\n\n  ' + afterBody;
    } else {
      // Insert after the marker comment, so new posts appear at the top
      const markerEndIndex = navEndIndex + '<!-- BLOG POSTS START - New posts will be inserted here -->'.length;
      const beforeMarker = blogContent.substring(0, markerEndIndex);
      const afterMarker = blogContent.substring(markerEndIndex);
      newBlogContent = beforeMarker + '\n\n  ' + postHTML + '\n\n  ' + afterMarker;
    }
    
    // Write updated blog.html
    fs.writeFileSync(blogPath, newBlogContent);
    
    res.json({
      success: true,
      message: 'Blog updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating blog:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating blog: ' + error.message
    });
  }
});

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    
    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }
    
    // Check if email is configured
    if (!transporter) {
      return res.status(503).json({
        success: false,
        message: 'Contact form is temporarily unavailable. Please try again later or contact us directly.'
      });
    }

    // Email content
    const mailOptions = {
      from: emailUser,
      to: 'nerdykeeda@gmail.com',
      subject: `Contact Form: ${subject}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <hr>
        <p><em>This message was sent from the contact form on imgtojpg.org</em></p>
      `,
      text: `
        New Contact Form Submission
        
        Name: ${name}
        Email: ${email}
        Subject: ${subject}
        Message:
        ${message}
        
        ---
        This message was sent from the contact form on imgtojpg.org
      `
    };
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully:', info.messageId);
    
    res.json({
      success: true,
      message: 'Your message has been sent successfully! We\'ll get back to you soon.',
      messageId: info.messageId
    });
    
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email. Please try again later.'
    });
  }
});

// 🔁 Auto-delete old sessions (older than 15 mins)
const CLEANUP_INTERVAL = 5 * 60 * 1000; // every 5 minutes
const MAX_AGE = 15 * 60 * 1000; // 15 minutes

setInterval(() => {
  const baseDir = path.join(__dirname, 'public', 'converted');

  fs.readdir(baseDir, (err, folders) => {
    if (err) return;

    folders.forEach(folder => {
      const folderPath = path.join(baseDir, folder);
      fs.stat(folderPath, (err, stats) => {
        if (!err && Date.now() - stats.ctimeMs > MAX_AGE) {
          fs.rm(folderPath, { recursive: true, force: true }, () => {
            console.log(`🧹 Deleted expired session folder: ${folder}`);
          });
        }
      });
    });
  });
}, CLEANUP_INTERVAL);

// 404 Error Handler - Must be placed after all other routes
app.use((req, res) => {
  // Log 404 errors for debugging
  console.log(`404 Error - Page not found: ${req.method} ${req.url}`);
  console.log(`Referrer: ${req.get('Referrer') || 'Direct access'}`);
  console.log(`User Agent: ${req.get('User-Agent')}`);
  
  // Serve custom 404 page
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
