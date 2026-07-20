// Unified payment service for handling both Stripe and Razorpay
const StripeService = require('./stripe');
const RazorpayService = require('./razorpay');
const Database = require('../config/firestore');

// Country to payment provider mapping
const PAYMENT_PROVIDERS = {
  // Stripe countries (international)
  'US': 'stripe', 'CA': 'stripe', 'GB': 'stripe', 'AU': 'stripe', 'DE': 'stripe',
  'FR': 'stripe', 'ES': 'stripe', 'IT': 'stripe', 'NL': 'stripe', 'SE': 'stripe',
  'NO': 'stripe', 'DK': 'stripe', 'FI': 'stripe', 'BE': 'stripe', 'AT': 'stripe',
  'CH': 'stripe', 'IE': 'stripe', 'PT': 'stripe', 'LU': 'stripe', 'JP': 'stripe',
  'SG': 'stripe', 'HK': 'stripe', 'NZ': 'stripe', 'MX': 'stripe', 'BR': 'stripe',
  
  // Razorpay countries (India-focused)
  'IN': 'razorpay'
};

// Plan pricing in USD (both providers will auto-convert for local customers)
const PLAN_PRICING = {
  stripe: {
    basic: { amount: 2.99, currency: 'USD' },
    pro: { amount: 8.99, currency: 'USD' },
    team: { amount: 28.99, currency: 'USD' }
  },
  razorpay: {
    basic: { amount: 2.99, currency: 'USD' },
    pro: { amount: 8.99, currency: 'USD' },
    team: { amount: 28.99, currency: 'USD' }
  }
};

class PaymentService {

  // Determine payment provider based on country
  static getPaymentProvider(countryCode) {
    return PAYMENT_PROVIDERS[countryCode?.toUpperCase()] || 'stripe'; // Default to Stripe
  }

  // Get plan pricing for a specific provider
  static getPlanPricing(provider = 'stripe') {
    return PLAN_PRICING[provider] || PLAN_PRICING.stripe;
  }

  // Get all available pricing options
  static getAllPricing() {
    return PLAN_PRICING.stripe; // Same pricing for all regions
  }

  // Create checkout session based on user's location
  static async createCheckoutSession(user, planType, countryCode, successUrl, cancelUrl) {
    try {
      const provider = this.getPaymentProvider(countryCode);
      
      if (provider === 'stripe') {
        return await StripeService.createCheckoutSession(user, planType, successUrl, cancelUrl);
      } else if (provider === 'razorpay') {
        // For Razorpay, we create a subscription directly
        const subscription = await RazorpayService.createSubscription(user, planType);
        return {
          provider: 'razorpay',
          subscriptionId: subscription.id,
          shortUrl: subscription.short_url,
          hostedPage: subscription.hosted_page
        };
      } else {
        throw new Error(`Unsupported payment provider: ${provider}`);
      }
    } catch (error) {
      console.error('❌ Checkout session creation failed:', error);
      throw error;
    }
  }

  // Create payment link (useful for email/SMS)
  static async createPaymentLink(user, planType, countryCode, callbackUrl) {
    try {
      const provider = this.getPaymentProvider(countryCode);
      
      if (provider === 'stripe') {
        // Stripe doesn't have direct payment links, use checkout session
        const session = await StripeService.createCheckoutSession(
          user, 
          planType, 
          callbackUrl + '?success=true', 
          callbackUrl + '?cancelled=true'
        );
        return {
          provider: 'stripe',
          url: session.url,
          sessionId: session.id
        };
      } else if (provider === 'razorpay') {
        const paymentLink = await RazorpayService.createPaymentLink(user, planType, callbackUrl);
        return {
          provider: 'razorpay',
          url: paymentLink.short_url,
          linkId: paymentLink.id
        };
      } else {
        throw new Error(`Unsupported payment provider: ${provider}`);
      }
    } catch (error) {
      console.error('❌ Payment link creation failed:', error);
      throw error;
    }
  }

  // Handle webhook events
  static async handleWebhook(provider, payload, signature, event) {
    try {
      if (provider === 'stripe') {
        return await this.handleStripeWebhook(payload, signature);
      } else if (provider === 'razorpay') {
        return await this.handleRazorpayWebhook(payload, signature, event);
      } else {
        throw new Error(`Unsupported webhook provider: ${provider}`);
      }
    } catch (error) {
      console.error('❌ Webhook handling failed:', error);
      throw error;
    }
  }

  // Handle Stripe webhooks
  static async handleStripeWebhook(payload, signature) {
    try {
      const event = StripeService.validateWebhook(payload, signature);
      
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await StripeService.handleSubscriptionSuccess(event.data.object);
          break;
          
        case 'customer.subscription.deleted':
          await StripeService.handleSubscriptionCancellation(event.data.object);
          break;
          
        case 'invoice.payment_succeeded':
          // Handle successful recurring payments
          console.log('✅ Stripe payment succeeded:', event.data.object.id);
          break;
          
        case 'invoice.payment_failed':
          await StripeService.handlePaymentFailed(event.data.object);
          break;
          
        default:
          console.log('ℹ️ Unhandled Stripe event:', event.type);
      }
      
      return { received: true, provider: 'stripe', type: event.type };
    } catch (error) {
      console.error('❌ Stripe webhook handling failed:', error);
      throw error;
    }
  }

  // Handle Razorpay webhooks
  static async handleRazorpayWebhook(payload, signature, event) {
    try {
      const isValid = RazorpayService.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        throw new Error('Invalid Razorpay webhook signature');
      }

      const eventData = JSON.parse(payload);
      
      switch (eventData.event) {
        case 'subscription.charged':
          await RazorpayService.handleSubscriptionPayment(eventData.payload.payment.entity);
          break;
          
        case 'subscription.cancelled':
          await RazorpayService.handleSubscriptionCancellation(eventData.payload.subscription.entity);
          break;
          
        case 'payment.failed':
          await RazorpayService.handlePaymentFailed(eventData.payload.payment.entity);
          break;
          
        default:
          console.log('ℹ️ Unhandled Razorpay event:', eventData.event);
      }
      
      return { received: true, provider: 'razorpay', type: eventData.event };
    } catch (error) {
      console.error('❌ Razorpay webhook handling failed:', error);
      throw error;
    }
  }

  // Get user's subscription details
  static async getUserSubscription(userId) {
    try {
      const subscription = await Database.getActiveSubscription(userId);
      
      if (!subscription) {
        return null;
      }

      let providerDetails = null;
      
      if (subscription.payment_provider === 'stripe' && subscription.stripe_subscription_id) {
        try {
          providerDetails = await StripeService.getSubscription(subscription.stripe_subscription_id);
        } catch (error) {
          console.log('⚠️ Failed to fetch Stripe subscription details:', error.message);
        }
      } else if (subscription.payment_provider === 'razorpay' && subscription.razorpay_subscription_id) {
        try {
          providerDetails = await RazorpayService.getSubscription(subscription.razorpay_subscription_id);
        } catch (error) {
          console.log('⚠️ Failed to fetch Razorpay subscription details:', error.message);
        }
      }

      return {
        ...subscription,
        providerDetails
      };
    } catch (error) {
      console.error('❌ Get user subscription failed:', error);
      throw error;
    }
  }

  // Cancel user's subscription
  static async cancelSubscription(userId, immediately = false) {
    try {
      const subscription = await Database.getActiveSubscription(userId);
      
      if (!subscription) {
        throw new Error('No active subscription found');
      }

      let result = null;
      
      if (subscription.payment_provider === 'stripe' && subscription.stripe_subscription_id) {
        result = await StripeService.cancelSubscription(subscription.stripe_subscription_id, immediately);
      } else if (subscription.payment_provider === 'razorpay' && subscription.razorpay_subscription_id) {
        result = await RazorpayService.cancelSubscription(subscription.razorpay_subscription_id, !immediately);
      } else {
        throw new Error('Invalid subscription provider');
      }

      // Update database
      await Database.updateSubscriptionStatus(
        subscription.stripe_subscription_id || subscription.razorpay_subscription_id,
        immediately ? 'cancelled' : 'cancel_at_period_end',
        immediately ? new Date() : null
      );

      return result;
    } catch (error) {
      console.error('❌ Cancel subscription failed:', error);
      throw error;
    }
  }

  // Create billing portal session
  static async createBillingPortalSession(userId, returnUrl) {
    try {
      const subscription = await Database.getActiveSubscription(userId);
      
      if (!subscription) {
        throw new Error('No active subscription found');
      }

      if (subscription.payment_provider === 'stripe') {
        const user = await Database.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (user.rows.length === 0) {
          throw new Error('User not found');
        }
        
        return await StripeService.createBillingPortalSession(user.rows[0], returnUrl);
      } else if (subscription.payment_provider === 'razorpay') {
        // Razorpay doesn't have a billing portal, redirect to dashboard
        return {
          url: returnUrl + '?message=Please contact support to manage your Razorpay subscription'
        };
      } else {
        throw new Error('Invalid subscription provider');
      }
    } catch (error) {
      console.error('❌ Create billing portal session failed:', error);
      throw error;
    }
  }

  // Get payment history for user
  static async getPaymentHistory(userId, limit = 10) {
    try {
      const query = `
        SELECT pt.*, s.plan_type, s.payment_provider
        FROM payment_transactions pt
        LEFT JOIN subscriptions s ON pt.subscription_id = s.id
        WHERE pt.user_id = $1
        ORDER BY pt.created_at DESC
        LIMIT $2
      `;
      
      const result = await Database.query(query, [userId, limit]);
      return result.rows;
    } catch (error) {
      console.error('❌ Get payment history failed:', error);
      throw error;
    }
  }

  // Upgrade/downgrade subscription
  static async changeSubscription(userId, newPlanType) {
    try {
      const subscription = await Database.getActiveSubscription(userId);
      
      if (!subscription) {
        throw new Error('No active subscription found');
      }

      if (subscription.payment_provider === 'stripe') {
        const newPriceId = process.env[`STRIPE_PRICE_${newPlanType.toUpperCase()}_MONTHLY`];
        if (!newPriceId) {
          throw new Error(`Price ID not found for plan: ${newPlanType}`);
        }
        
        await StripeService.updateSubscription(subscription.stripe_subscription_id, newPriceId);
      } else if (subscription.payment_provider === 'razorpay') {
        // Razorpay doesn't support plan changes directly
        // Cancel current and create new subscription
        await RazorpayService.cancelSubscription(subscription.razorpay_subscription_id, false);
        
        const user = await Database.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (user.rows.length > 0) {
          await RazorpayService.createSubscription(user.rows[0], newPlanType);
        }
      }

      // Update database
      await Database.updateUserPlan(userId, newPlanType);
      
      return { success: true, newPlan: newPlanType };
    } catch (error) {
      console.error('❌ Change subscription failed:', error);
      throw error;
    }
  }

  // Process refund
  static async processRefund(paymentId, amount = null, reason = 'requested_by_customer') {
    try {
      // Get payment details from database
      const payment = await Database.query(
        'SELECT * FROM payment_transactions WHERE provider_transaction_id = $1',
        [paymentId]
      );

      if (payment.rows.length === 0) {
        throw new Error('Payment not found');
      }

      const paymentRecord = payment.rows[0];
      let refund = null;

      if (paymentRecord.payment_provider === 'stripe') {
        // Stripe refunds are handled through their API
        const stripePayment = await StripeService.getPayment(paymentId);
        refund = await stripePayment.refund({
          amount: amount ? Math.round(amount * 100) : undefined, // Convert to cents
          reason: reason
        });
      } else if (paymentRecord.payment_provider === 'razorpay') {
        refund = await RazorpayService.refundPayment(
          paymentId, 
          amount ? Math.round(amount * 100) : null, // Convert to paise
          { reason: reason }
        );
      }

      // Log refund in database
      if (refund) {
        await Database.logPayment(
          paymentRecord.user_id,
          paymentRecord.subscription_id,
          'refund',
          paymentRecord.payment_provider,
          refund.id,
          -(amount || paymentRecord.amount), // Negative amount for refund
          paymentRecord.currency,
          'completed'
        );
      }

      return refund;
    } catch (error) {
      console.error('❌ Process refund failed:', error);
      throw error;
    }
  }

  // Get available payment methods for a country
  static getAvailablePaymentMethods(countryCode) {
    const provider = this.getPaymentProvider(countryCode);
    
    if (provider === 'stripe') {
      return {
        provider: 'stripe',
        methods: ['card', 'apple_pay', 'google_pay'],
        currencies: ['USD']
      };
    } else if (provider === 'razorpay') {
      return {
        provider: 'razorpay',
        methods: ['card', 'netbanking', 'wallet', 'upi'],
        currencies: ['USD'] // Razorpay will auto-convert to INR
      };
    }
    
    return null;
  }
}

module.exports = PaymentService;
