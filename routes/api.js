// API routes for subscription system integration
const express = require('express');
const router = express.Router();
const { clientConfig } = require('../config/firebase');
const { authenticateUser, optionalAuth } = require('../middleware/auth');
const Database = require('../config/firestore');

// Firebase config endpoint for client-side initialization
router.get('/firebase-config', (req, res) => {
  // Simple, clean Firebase configuration
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyBpXcQ5SEyuuvKcq_7iWbSXIB06aH3nOyo',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'imgtojpg.firebaseapp.com',
    projectId: process.env.FIREBASE_PROJECT_ID || 'imgtojpg',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'imgtojpg.firebasestorage.app',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '1047494776765',
    appId: process.env.FIREBASE_APP_ID || '1:1047494776765:web:0145873f41104e5cc164d4',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || 'G-2P190S3BCE'
  };
  
  console.log('🔥 Serving Firebase config for project:', firebaseConfig.projectId);
  res.json(firebaseConfig);
});

// Get user profile and subscription status
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    const usage = await Database.getUserCurrentUsage(req.user.id);
    const subscription = await Database.getActiveSubscription(req.user.id);
    
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        displayName: req.user.display_name,
        currentPlan: req.user.current_plan,
        planExpiresAt: req.user.plan_expires_at,
        createdAt: req.user.created_at,
        lastLoginAt: req.user.last_login_at
      },
      usage: usage,
      subscription: subscription,
      planLimits: {
        monthlyConversions: req.user.monthly_conversions,
        monthlyStorageGb: req.user.monthly_storage_gb,
        batchConversion: req.user.batch_conversion,
        priorityQueue: req.user.priority_queue,
        emailSupport: req.user.email_support,
        teamAccess: req.user.team_access
      }
    });
  } catch (error) {
    console.error('❌ Get profile failed:', error);
    res.status(500).json({
      success: false,
      error: 'PROFILE_FETCH_FAILED',
      message: 'Failed to fetch user profile'
    });
  }
});

// Update user profile
router.put('/profile', authenticateUser, async (req, res) => {
  try {
    const { displayName } = req.body;
    
    if (displayName) {
      await Database.query(
        'UPDATE users SET display_name = $1, updated_at = NOW() WHERE id = $2',
        [displayName, req.user.id]
      );
    }
    
    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('❌ Update profile failed:', error);
    res.status(500).json({
      success: false,
      error: 'PROFILE_UPDATE_FAILED',
      message: 'Failed to update profile'
    });
  }
});

// Get usage statistics (for charts/analytics)
router.get('/usage-stats', authenticateUser, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    
    const query = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as conversions,
        SUM(file_size_mb) / 1024 as storage_gb,
        AVG(processing_time_ms) as avg_processing_time
      FROM usage_logs 
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '${days} days'
        AND success = true
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
    
    const result = await Database.query(query, [req.user.id]);
    
    res.json({
      success: true,
      stats: result.rows
    });
  } catch (error) {
    console.error('❌ Get usage stats failed:', error);
    res.status(500).json({
      success: false,
      error: 'STATS_FETCH_FAILED',
      message: 'Failed to fetch usage statistics'
    });
  }
});

// Check quota status (for real-time quota display)
router.get('/quota-status', optionalAuth, async (req, res) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress;
    let quotaStatus;

    if (req.user) {
      // Authenticated user
      const usage = await Database.getUserCurrentUsage(req.user.id);
      const canConvert = await Database.canUserConvert(req.user.id, 0); // Check with 0 MB file
      
      quotaStatus = {
        authenticated: true,
        plan: req.user.current_plan,
        usage: usage,
        limits: {
          monthlyConversions: req.user.monthly_conversions,
          monthlyStorageGb: req.user.monthly_storage_gb,
          maxFileSizeMb: req.user.max_file_size_mb
        },
        canConvert: canConvert.can_convert,
        reason: canConvert.reason
      };
    } else {
      // Anonymous user
      const ipUsage = await Database.getIPUsage(clientIP);
      const canConvert = await Database.canIPConvert(clientIP, 0);
      
      quotaStatus = {
        authenticated: false,
        plan: 'free',
        usage: {
          conversions_used: parseInt(ipUsage.conversions_used || 0),
          storage_used_gb: parseFloat(ipUsage.storage_used_gb || 0)
        },
        limits: {
          monthlyConversions: 5, // 5 per week for free
          monthlyStorageGb: 2,
          maxFileSizeMb: 100
        },
        canConvert: canConvert.can_convert,
        reason: canConvert.reason
      };
    }
    
    res.json({
      success: true,
      quota: quotaStatus
    });
  } catch (error) {
    console.error('❌ Get quota status failed:', error);
    res.status(500).json({
      success: false,
      error: 'QUOTA_CHECK_FAILED',
      message: 'Failed to check quota status'
    });
  }
});

// Delete user account
router.delete('/account', authenticateUser, async (req, res) => {
  try {
    const { confirmEmail } = req.body;
    
    if (confirmEmail !== req.user.email) {
      return res.status(400).json({
        success: false,
        error: 'EMAIL_MISMATCH',
        message: 'Email confirmation does not match'
      });
    }
    
    // Cancel active subscription first
    const activeSubscription = await Database.getActiveSubscription(req.user.id);
    if (activeSubscription) {
      // This would cancel the subscription via payment provider
      console.log('⚠️ User has active subscription, should be cancelled first');
    }
    
    // Soft delete user (keep for compliance/records)
    await Database.query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1',
      [req.user.id]
    );
    
    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    console.error('❌ Delete account failed:', error);
    res.status(500).json({
      success: false,
      error: 'ACCOUNT_DELETE_FAILED',
      message: 'Failed to delete account'
    });
  }
});

module.exports = router;
