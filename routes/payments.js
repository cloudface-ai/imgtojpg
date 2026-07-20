// Payment routes for subscription system (Razorpay only)
const express = require('express');
const router = express.Router();
const RazorpayService = require('../services/razorpay');
const { authenticateUser, requireAdmin } = require('../middleware/auth');
const Database = require('../config/firestore');

// Get pricing information
router.get('/pricing', async (req, res) => {
  try {
    // Razorpay pricing
    const pricing = RazorpayService.getPlanPricing();
    const paymentMethods = ['upi', 'netbanking', 'cards', 'wallet'];
    
    res.json({
      success: true,
      provider: 'razorpay',
      pricing: pricing,
      paymentMethods: paymentMethods,
      allPricing: { razorpay: pricing }
    });
  } catch (error) {
    console.error('❌ Get pricing failed:', error);
    res.status(500).json({
      success: false,
      error: 'PRICING_FETCH_FAILED',
      message: 'Failed to fetch pricing information'
    });
  }
});

// Create checkout session
router.post('/checkout', authenticateUser, async (req, res) => {
  try {
    const { planType, countryCode } = req.body;
    
    if (!planType || !['basic', 'pro', 'team'].includes(planType)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PLAN',
        message: 'Invalid plan type specified'
      });
    }

    // Allow upgrades/downgrades; only block buying the same active plan again
    const existingSubscription = await Database.getActiveSubscription(req.user.id);
    if (existingSubscription && existingSubscription.plan_type === planType) {
      return res.status(400).json({
        success: false,
        error: 'SAME_PLAN',
        message: `You are already on the ${planType} plan`,
        currentPlan: existingSubscription.plan_type
      });
    }

    // Create Razorpay payment link (better payment method support)
    const callbackUrl = `${req.protocol}://${req.get('host')}/dashboard.html?payment=success`;
    const paymentLink = await RazorpayService.createPaymentLink(req.user, planType, callbackUrl);
    
    res.json({
      success: true,
      provider: 'razorpay',
      paymentLink: {
        id: paymentLink.id,
        shortUrl: paymentLink.short_url,
        hostedPage: paymentLink.hosted_page
      }
    });
  } catch (error) {
    console.error('❌ Checkout creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'CHECKOUT_FAILED',
      message: 'Failed to create checkout session'
    });
  }
});

// Create payment link
router.post('/payment-link', authenticateUser, async (req, res) => {
  try {
    const { planType, countryCode } = req.body;
    
    if (!planType || !['basic', 'pro', 'team'].includes(planType)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PLAN',
        message: 'Invalid plan type specified'
      });
    }

    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const callbackUrl = `${baseUrl}/dashboard?payment=success`;

    // Create Razorpay payment link
    const paymentLink = await RazorpayService.createPaymentLink(req.user, planType, callbackUrl);

    res.json({
      success: true,
      provider: 'razorpay',
      paymentLink: {
        id: paymentLink.id,
        url: paymentLink.short_url
      }
    });
  } catch (error) {
    console.error('❌ Payment link creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'PAYMENT_LINK_FAILED',
      message: 'Failed to create payment link'
    });
  }
});

// Verify Razorpay payment link callback and activate subscription
// Used when user returns to dashboard after paying (webhook may be delayed/missing)
router.post('/verify', authenticateUser, async (req, res) => {
  try {
    const {
      paymentId,
      paymentLinkId,
      paymentLinkReferenceId,
      paymentLinkStatus,
      signature
    } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PAYMENT_ID',
        message: 'Payment ID is required'
      });
    }

    const subscription = await RazorpayService.verifyAndActivatePaymentLink({
      paymentId,
      paymentLinkId,
      paymentLinkReferenceId,
      paymentLinkStatus,
      signature,
      authenticatedUser: req.user
    });

    res.json({
      success: true,
      message: 'Payment verified and subscription activated',
      subscription,
      currentPlan: subscription?.plan_type || req.user.current_plan
    });
  } catch (error) {
    console.error('❌ Payment verification failed:', error);
    res.status(400).json({
      success: false,
      error: 'PAYMENT_VERIFY_FAILED',
      message: error.message || 'Failed to verify payment'
    });
  }
});

// Get user's subscription details
router.get('/subscription', authenticateUser, async (req, res) => {
  try {
    console.log('🔍 Subscription API - User ID:', req.user.id);
    console.log('🔍 Subscription API - User email:', req.user.email);
    console.log('🔍 Subscription API - User current_plan:', req.user.current_plan);
    console.log('🔍 Subscription API - User subscription_status:', req.user.subscription_status);
    
    const subscription = await Database.getActiveSubscription(req.user.id);
    console.log('🔍 Subscription API - getActiveSubscription result:', subscription);
    
    let usage = null;
    
    try {
      usage = await Database.getUserCurrentUsage(req.user.id);
    } catch (usageError) {
      console.log('⚠️ Usage fetch failed (index needed):', usageError.message);
      usage = { 
        conversions_used: 0,
        storage_used_gb: 0,
        period_start: new Date(),
        period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };
    }

    res.json({
      success: true,
      subscription: subscription,
      usage: usage,
      paymentHistory: [], // TODO: Implement payment history
      currentPlan: req.user.current_plan || 'free',
      planExpiresAt: req.user.plan_expires_at
    });
  } catch (error) {
    console.error('❌ Get subscription failed:', error);
    res.status(500).json({
      success: false,
      error: 'SUBSCRIPTION_FETCH_FAILED',
      message: 'Failed to fetch subscription details'
    });
  }
});

// Cancel subscription
router.post('/subscription/cancel', authenticateUser, async (req, res) => {
  try {
    const { immediately = false } = req.body;
    
    const subscription = await Database.getActiveSubscription(req.user.id);
    if (!subscription) {
      return res.status(400).json({
        success: false,
        error: 'NO_SUBSCRIPTION',
        message: 'No active subscription found'
      });
    }

    const result = await RazorpayService.cancelSubscription(
      subscription.razorpay_subscription_id, 
      !immediately
    );
    
    res.json({
      success: true,
      message: immediately ? 'Subscription cancelled immediately' : 'Subscription will be cancelled at the end of the billing period',
      cancellation: result
    });
  } catch (error) {
    console.error('❌ Cancel subscription failed:', error);
    res.status(500).json({
      success: false,
      error: 'CANCELLATION_FAILED',
      message: error.message || 'Failed to cancel subscription'
    });
  }
});

// Change subscription plan
router.post('/subscription/change', authenticateUser, async (req, res) => {
  try {
    const { newPlanType } = req.body;
    
    if (!newPlanType || !['basic', 'pro', 'team'].includes(newPlanType)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PLAN',
        message: 'Invalid plan type specified'
      });
    }

    // TODO: Implement plan change for Razorpay
    // For now, return success (this would require canceling current and creating new subscription)
    res.json({
      success: true,
      message: `Subscription plan change to ${newPlanType} is not yet implemented`,
      change: { newPlan: newPlanType }
    });
  } catch (error) {
    console.error('❌ Change subscription failed:', error);
    res.status(500).json({
      success: false,
      error: 'PLAN_CHANGE_FAILED',
      message: error.message || 'Failed to change subscription plan'
    });
  }
});

// Create billing portal session
router.post('/billing-portal', authenticateUser, async (req, res) => {
  try {
    return res.status(400).json({
      success: false,
      error: 'NOT_SUPPORTED',
      message: 'Billing portal is not supported with Razorpay'
    });
  } catch (error) {
    console.error('❌ Billing portal creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'BILLING_PORTAL_FAILED',
      message: error.message || 'Failed to create billing portal session'
    });
  }
});

// Get payment history
router.get('/history', authenticateUser, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    // TODO: Implement payment history from Firestore
    const paymentHistory = [];
    
    res.json({
      success: true,
      payments: paymentHistory
    });
  } catch (error) {
    console.error('❌ Get payment history failed:', error);
    res.status(500).json({
      success: false,
      error: 'HISTORY_FETCH_FAILED',
      message: 'Failed to fetch payment history'
    });
  }
});

// Razorpay webhook endpoint
router.post('/webhooks/razorpay', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    // Body is a raw Buffer from server middleware (required for signature check)
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));

    console.log('🔍 Razorpay webhook received');
    console.log('🔍 Signature present:', !!signature);
    console.log('🔍 Body length:', body.length);

    if (!signature) {
      console.error('❌ Missing Razorpay signature');
      return res.status(400).json({ error: 'Missing signature' });
    }

    // Verify webhook signature
    const isValid = RazorpayService.verifyWebhookSignature(body, signature);
    if (!isValid) {
      console.error('❌ Invalid Razorpay signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const eventData = JSON.parse(body.toString('utf8'));
    console.log('✅ Razorpay webhook verified:', eventData.event);
    console.log('🔍 Event payload:', JSON.stringify(eventData.payload, null, 2));

    // Handle different webhook events
    switch (eventData.event) {
      case 'subscription.charged':
        console.log('💰 Processing subscription charge...');
        await RazorpayService.handleSubscriptionPayment(eventData.payload.payment.entity);
        break;
        
      case 'subscription.cancelled':
        console.log('❌ Processing subscription cancellation...');
        await RazorpayService.handleSubscriptionCancellation(eventData.payload.subscription.entity);
        break;
        
      case 'payment.failed':
        console.log('💳 Processing failed payment...');
        await RazorpayService.handlePaymentFailed(eventData.payload.payment.entity);
        break;
        
      case 'payment.captured':
      case 'payment_link.paid':
        console.log('✅ Processing successful payment...');
        {
          const paymentEntity = eventData.payload.payment?.entity;
          if (paymentEntity && paymentEntity.notes && paymentEntity.notes.planType) {
            console.log('🔍 Activating subscription from payment link purchase');
            await RazorpayService.handlePaymentLinkPayment(paymentEntity);
          } else {
            console.log('ℹ️ Payment captured without planType notes — no subscription action');
          }
        }
        break;
        
      default:
        console.log('ℹ️ Unhandled Razorpay event:', eventData.event);
    }

    console.log('✅ Webhook processed successfully');
    res.json({ received: true });
  } catch (error) {
    console.error('❌ Razorpay webhook failed:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      body: req.body ? req.body.toString() : 'No body'
    });
    res.status(500).json({ error: error.message });
  }
});

// Admin routes (simplified for Firestore)

// Get all subscriptions (admin only)
router.get('/admin/subscriptions', requireAdmin, async (req, res) => {
  try {
    // TODO: Implement admin subscriptions from Firestore
    res.json({
      success: true,
      subscriptions: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        pages: 0
      }
    });
  } catch (error) {
    console.error('❌ Get admin subscriptions failed:', error);
    res.status(500).json({
      success: false,
      error: 'ADMIN_FETCH_FAILED',
      message: 'Failed to fetch subscriptions'
    });
  }
});

// Get payment analytics (admin only)
router.get('/admin/analytics', requireAdmin, async (req, res) => {
  try {
    // TODO: Implement analytics from Firestore
    res.json({
      success: true,
      analytics: {
        revenue: [],
        subscriptions: [],
        userStats: { totalUsers: 0, activeSubscriptions: 0 }
      }
    });
  } catch (error) {
    console.error('❌ Get payment analytics failed:', error);
    res.status(500).json({
      success: false,
      error: 'ANALYTICS_FAILED',
      message: 'Failed to fetch payment analytics'
    });
  }
});

// Process refund (admin only)
router.post('/admin/refund', requireAdmin, async (req, res) => {
  try {
    const { paymentId, amount, reason } = req.body;
    
    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PAYMENT_ID',
        message: 'Payment ID is required'
      });
    }
    
    const refund = await RazorpayService.refundPayment(paymentId, amount, { reason });
    
    res.json({
      success: true,
      message: 'Refund processed successfully',
      refund: refund
    });
  } catch (error) {
    console.error('❌ Process refund failed:', error);
    res.status(500).json({
      success: false,
      error: 'REFUND_FAILED',
      message: error.message || 'Failed to process refund'
    });
  }
});

// Admin auth via Firebase admin OR ADMIN_TOKEN header (for ops repair)
function requireAdminOrToken(req, res, next) {
  const adminToken = req.headers['admin-token'] || req.query.adminToken;
  const validToken = process.env.ADMIN_TOKEN;
  if (validToken && adminToken && adminToken === validToken) {
    return next();
  }
  if (req.user) {
    return requireAdmin(req, res, next);
  }
  return res.status(401).json({
    success: false,
    error: 'UNAUTHORIZED',
    message: 'Valid admin-token header required'
  });
}

// Repair: activate subscription from an existing Razorpay payment id
router.post('/admin/repair-payment', requireAdminOrToken, async (req, res) => {
  try {
    const { paymentId, email } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PAYMENT_ID',
        message: 'paymentId is required (e.g. pay_xxxxx)'
      });
    }

    const payment = await RazorpayService.getPayment(paymentId);
    const status = (payment.status || '').toLowerCase();

    if (!['captured', 'authorized', 'paid'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'PAYMENT_NOT_SUCCESSFUL',
        message: `Payment status is ${payment.status}, expected captured`,
        payment: { id: payment.id, status: payment.status, amount: payment.amount }
      });
    }

    let authenticatedUser = null;
    const lookupEmail = email || payment.notes?.email || payment.email;
    if (lookupEmail) {
      authenticatedUser = await Database.getUserByEmail(lookupEmail);
    }
    if (!authenticatedUser && payment.notes?.userId) {
      authenticatedUser = await Database.getUserById(payment.notes.userId);
    }

    const subscription = await RazorpayService.handlePaymentLinkPayment(
      payment,
      authenticatedUser
    );

    const user = authenticatedUser
      ? await Database.getUserById(authenticatedUser.id)
      : null;

    res.json({
      success: true,
      message: 'Payment repaired and subscription activated',
      paymentId: payment.id,
      subscription,
      user: user ? {
        id: user.id,
        email: user.email,
        current_plan: user.current_plan,
        subscription_status: user.subscription_status,
        plan_expires_at: user.plan_expires_at
      } : null
    });
  } catch (error) {
    console.error('❌ Repair payment failed:', error);
    res.status(500).json({
      success: false,
      error: 'REPAIR_FAILED',
      message: error.message || 'Failed to repair payment'
    });
  }
});

// Lookup payment event / Razorpay status (admin)
router.get('/admin/payment-status/:paymentId', requireAdminOrToken, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const event = await Database.getPaymentEvent(paymentId);
    let razorpayPayment = null;
    try {
      razorpayPayment = await RazorpayService.getPayment(paymentId);
    } catch (e) {
      razorpayPayment = { error: e.message };
    }

    res.json({
      success: true,
      paymentId,
      firestoreEvent: event,
      razorpay: razorpayPayment ? {
        id: razorpayPayment.id,
        status: razorpayPayment.status,
        amount: razorpayPayment.amount,
        currency: razorpayPayment.currency,
        notes: razorpayPayment.notes,
        email: razorpayPayment.email,
        method: razorpayPayment.method
      } : null
    });
  } catch (error) {
    console.error('❌ Payment status lookup failed:', error);
    res.status(500).json({
      success: false,
      error: 'STATUS_LOOKUP_FAILED',
      message: error.message
    });
  }
});

module.exports = router;
