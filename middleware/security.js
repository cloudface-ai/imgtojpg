// middleware/security.js
const securityHeaders = (req, res, next) => {
  // Strict Transport Security (HSTS) - Force HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://kit.fontawesome.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://www.google-analytics.com;");
  
  // X-Frame-Options - Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // X-Content-Type-Options - Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Cross-Origin policies for isolation and safety (no COEP to avoid breakage)
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
};

module.exports = securityHeaders;
