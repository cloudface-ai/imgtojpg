// Authentication middleware for subscription system
const { admin } = require('../config/firebase');
const Database = require('../config/firestore');

// Middleware to verify Firebase token and load user
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Get or create user in database
    let user = await Database.getUserByFirebaseUid(decodedToken.uid);
    
    if (!user) {
      // Create new user in database
      user = await Database.createUser(
        decodedToken.uid,
        decodedToken.email,
        decodedToken.name
      );
      console.log('✅ New user created:', user.email);
    } else {
      // Update last login
      await Database.updateUserLastLogin(user.id);
    }

    // Attach user to request
    req.user = user;
    req.firebaseUser = decodedToken;
    
    next();
  } catch (error) {
    console.error('❌ Authentication error:', error);
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Invalid authentication token'
    });
  }
}

// Optional authentication - doesn't fail if no token
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      
      try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        let user = await Database.getUserByFirebaseUid(decodedToken.uid);
        
        if (!user) {
          user = await Database.createUser(
            decodedToken.uid,
            decodedToken.email,
            decodedToken.name
          );
        } else {
          await Database.updateUserLastLogin(user.id);
        }

        req.user = user;
        req.firebaseUser = decodedToken;
        console.log('✅ Optional auth successful:', user.email, 'User ID:', user.id);
      } catch (authError) {
        // Invalid token, but continue as anonymous
        console.log('⚠️ Invalid token in optional auth, continuing as anonymous');
        console.log('⚠️ Auth error details:', {
          code: authError.code,
          message: authError.message,
          userAgent: req.headers['user-agent'] ? req.headers['user-agent'].substring(0, 50) + '...' : 'Unknown'
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('❌ Optional auth error:', error);
    next(); // Continue without user
  }
}

// Middleware to check subscription status
function requireSubscription(allowedPlans = ['basic', 'pro', 'team']) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Please sign in to access this feature'
      });
    }

    if (!allowedPlans.includes(req.user.current_plan)) {
      return res.status(403).json({
        success: false,
        error: 'SUBSCRIPTION_REQUIRED',
        message: 'This feature requires a paid subscription',
        currentPlan: req.user.current_plan,
        requiredPlans: allowedPlans,
        upgradeUrl: '/pricing'
      });
    }

    // Check if subscription is expired
    if (req.user.plan_expires_at && new Date(req.user.plan_expires_at) < new Date()) {
      return res.status(403).json({
        success: false,
        error: 'SUBSCRIPTION_EXPIRED',
        message: 'Your subscription has expired',
        expiredAt: req.user.plan_expires_at,
        renewUrl: '/pricing'
      });
    }

    next();
  };
}

// Middleware to check conversion quota
async function checkConversionQuota(req, res, next) {
  try {
    const clientIP = req.ip || req.connection.remoteAddress;
    let quotaCheck;

    if (req.user) {
      // Authenticated user - check user quota
      const fileSizeMB = req.fileSize || 0; // Will be set by upload middleware
      quotaCheck = await Database.canUserConvert(req.user.id, fileSizeMB);
    } else {
      // Anonymous user - check IP quota
      const fileSizeMB = req.fileSize || 0;
      quotaCheck = await Database.canIPConvert(clientIP, fileSizeMB);
    }

    if (!quotaCheck.can_convert) {
      const errorResponse = {
        success: false,
        error: 'QUOTA_EXCEEDED',
        message: quotaCheck.reason,
        quotaInfo: {
          conversionsRemaining: quotaCheck.conversions_remaining,
          storageRemainingGB: quotaCheck.storage_remaining_gb
        }
      };

      if (!req.user) {
        errorResponse.suggestion = 'Sign up for a free account to get higher limits';
        errorResponse.signupUrl = '/signup';
      } else if (req.user.current_plan === 'free') {
        errorResponse.suggestion = 'Upgrade to a paid plan for higher limits';
        errorResponse.upgradeUrl = '/pricing';
      }

      return res.status(429).json(errorResponse);
    }

    // Attach quota info to request
    req.quotaInfo = quotaCheck;
    next();
  } catch (error) {
    console.error('❌ Quota check error:', error);
    return res.status(500).json({
      success: false,
      error: 'QUOTA_CHECK_FAILED',
      message: 'Failed to check conversion quota'
    });
  }
}

// Middleware to log usage after successful conversion
async function logConversionUsage(req, res, next) {
  // Store original res.json to intercept response
  const originalJson = res.json;
  
  res.json = function(data) {
    // Log usage if conversion was successful
    if (data && data.success) {
      const clientIP = req.ip || req.connection.remoteAddress;
      const userId = req.user ? req.user.id : null;
      const sessionId = req.sessionId || req.headers['x-session-id'];
      const fileName = req.fileName || 'unknown';
      const fileSizeMB = req.fileSize || 0;
      const inputFormat = req.inputFormat || 'unknown';
      const outputFormat = req.outputFormat || 'jpg';
      const processingTime = req.processingTime || null;

      // Determine conversion type (RAW vs Normal)
      const rawFormats = ['cr2', 'cr3', 'nef', 'arw', 'raf', 'orf', 'pef', 'rw2', '3fr', 'iiq'];
      const isRawConversion = rawFormats.includes(inputFormat.toLowerCase());
      const conversionType = isRawConversion ? 'raw' : 'normal';
      
      // Calculate billing period
      const now = new Date();
      const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const billingPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      // Log usage asynchronously
      console.log('🔍 logConversionUsage - Logging conversion:', {
        userId: userId,
        sessionId: sessionId,
        fileSizeMB: fileSizeMB,
        conversionType: conversionType,
        clientIP: clientIP,
        isAnonymous: !userId,
        billingPeriodStart: billingPeriodStart.toISOString(),
        billingPeriodEnd: billingPeriodEnd.toISOString()
      });
      
      if (!userId) {
        console.log('⚠️ WARNING: Conversion being logged as anonymous user!');
      } else {
        console.log('✅ Conversion being logged for authenticated user:', userId);
      }
      
      Database.logUsage(
        userId, sessionId, 1, fileSizeMB, conversionType, clientIP, !userId, 
        billingPeriodStart, billingPeriodEnd
      ).then(result => {
        console.log('✅ logConversionUsage - Successfully logged usage:', result.id);
      }).catch(error => {
        console.error('❌ Failed to log usage:', error);
      });
    }
    
    // Call original json method
    return originalJson.call(this, data);
  };
  
  next();
}

// Middleware to check admin privileges
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Admin access requires authentication'
    });
  }

  // Check if user has admin role (stored in metadata or custom claims)
  const isAdmin = req.user.metadata?.isAdmin || 
                  req.firebaseUser?.admin || 
                  req.user.email === process.env.ADMIN_EMAIL;

  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'ADMIN_REQUIRED',
      message: 'This endpoint requires admin privileges'
    });
  }

  next();
}

// Middleware to extract file information from multipart upload
function extractFileInfo(req, res, next) {
  // This will be enhanced when we integrate with multer
  // For now, we'll extract basic info from the request
  
  if (req.files && req.files.length > 0) {
    const file = req.files[0];
    req.fileName = file.originalname;
    req.fileSize = file.size / (1024 * 1024); // Convert to MB
    req.inputFormat = file.originalname.split('.').pop().toLowerCase();
  } else if (req.body.fileName && req.body.fileSize) {
    req.fileName = req.body.fileName;
    req.fileSize = parseFloat(req.body.fileSize) / (1024 * 1024); // Convert to MB
    req.inputFormat = req.body.fileName.split('.').pop().toLowerCase();
  }

  // Set output format from request
  req.outputFormat = req.body.outputFormat || req.query.format || 'jpg';
  
  next();
}

// Rate limiting for different plan tiers
function getPlanRateLimit(plan) {
  const limits = {
    free: { windowMs: 15 * 60 * 1000, max: 10 }, // 10 requests per 15 minutes
    basic: { windowMs: 15 * 60 * 1000, max: 50 }, // 50 requests per 15 minutes
    pro: { windowMs: 15 * 60 * 1000, max: 200 }, // 200 requests per 15 minutes
    team: { windowMs: 15 * 60 * 1000, max: 1000 } // 1000 requests per 15 minutes
  };
  
  return limits[plan] || limits.free;
}

// Middleware to apply plan-based rate limiting
function planBasedRateLimit(req, res, next) {
  const plan = req.user ? req.user.current_plan : 'free';
  const limits = getPlanRateLimit(plan);
  
  // Store rate limit info for other middleware
  req.rateLimitInfo = limits;
  
  next();
}

module.exports = {
  authenticateUser,
  optionalAuth,
  requireSubscription,
  checkConversionQuota,
  logConversionUsage,
  requireAdmin,
  extractFileInfo,
  planBasedRateLimit,
  getPlanRateLimit
};
