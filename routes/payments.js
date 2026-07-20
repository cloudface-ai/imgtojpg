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

    // Check if user already has an active subscription
    const existingSubscription = await Database.getActiveSubscription(req.user.id);
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        error: 'SUBSCRIPTION_EXISTS',
        message: 'You already have an active subscription',
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
router.post('/webhooks/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;

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

    const eventData = JSON.parse(body);
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
        console.log('✅ Processing successful payment...');
        // Check if this is a payment link payment (subscription purchase)
        const payment = eventData.payload.payment.entity;
        if (payment.notes && payment.notes.planType) {
          console.log('🔍 This appears to be a payment link subscription purchase');
          await RazorpayService.handlePaymentLinkPayment(payment);
        } else {
          console.log('ℹ️ One-time payment, no subscription action needed');
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

module.exports = router;
