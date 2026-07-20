// Razorpay payment service for Indian payments
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Database = require('../config/firestore');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Plan pricing in INR (Indian Rupees) - enables UPI, wallets, and local payment methods
// Note: Razorpay expects amount in paise (smallest currency unit)
const RAZORPAY_PLANS = {
  basic: {
    amount: 14900, // ₹149 = 14900 paise
    currency: 'INR',
    period: 'monthly',
    interval: 1
  },
  pro: {
    amount: 39900, // ₹399 = 39900 paise
    currency: 'INR',
    period: 'monthly',
    interval: 1
  },
  team: {
    amount: 124900, // ₹1,249 = 124900 paise
    currency: 'INR',
    period: 'monthly',
    interval: 1
  }
};

class RazorpayService {

  // Create subscription plan (one-time setup)
  static async createPlan(planType) {
    try {
      const planConfig = RAZORPAY_PLANS[planType];
      if (!planConfig) {
        throw new Error(`Invalid plan type: ${planType}`);
      }

      const plan = await razorpay.plans.create({
        period: planConfig.period,
        interval: planConfig.interval,
        item: {
          name: `ImgToJPG ${planType.charAt(0).toUpperCase() + planType.slice(1)} Plan`,
          amount: planConfig.amount,
          currency: planConfig.currency,
          description: `Monthly subscription for ImgToJPG ${planType} plan`
        }
      });

      console.log('✅ Razorpay plan created:', plan.id);
      return plan;
    } catch (error) {
      console.error('❌ Razorpay plan creation failed:', error);
      throw error;
    }
  }

  // Create subscription
  static async createSubscription(user, planType) {
    try {
      const planConfig = RAZORPAY_PLANS[planType];
      if (!planConfig) {
        throw new Error(`Invalid plan type: ${planType}`);
      }

      // Ensure we have Razorpay credentials
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('Razorpay credentials not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
      }

      // Create customer first
      const customer = await this.createCustomer(user);

      const subscription = await razorpay.subscriptions.create({
        plan_id: process.env[`RAZORPAY_PLAN_${planType.toUpperCase()}`],
        customer_notify: 1,
        quantity: 1,
        total_count: 12, // 12 months
        notes: {
          userId: user.id,
          planType: planType,
          email: user.email,
          app_name: 'HEIC to JPG Converter',
          service: 'Image Conversion Service'
        },
        notify_info: {
          notify_phone: user.phone || '',
          notify_email: user.email
        }
      });

      console.log('✅ Razorpay subscription created:', subscription.id);
      return subscription;
    } catch (error) {
      console.error('❌ Razorpay subscription creation failed:', error);
      throw error;
    }
  }

  // Create customer
  static async createCustomer(user) {
    try {
      // Ensure we have Razorpay credentials
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('Razorpay credentials not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
      }

      const customer = await razorpay.customers.create({
        name: user.display_name || user.email.split('@')[0],
        email: user.email,
        contact: user.phone || '',
        notes: {
          userId: user.id,
          firebaseUid: user.firebase_uid,
          app_name: 'HEIC to JPG Converter',
          service: 'Image Conversion Service'
        }
      });

      console.log('✅ Razorpay customer created:', customer.id);
      return customer;
    } catch (error) {
      console.error('❌ Razorpay customer creation failed:', error);
      
      // If customer already exists, try to find existing customer by email
      if (error.error && error.error.code === 'BAD_REQUEST_ERROR' && 
          error.error.description && error.error.description.includes('already exists')) {
        console.log('⚠️ Customer already exists, finding existing customer by email');
        
        try {
          const existingCustomers = await razorpay.customers.all({
            email: user.email,
            count: 1
          });
          
          if (existingCustomers.items && existingCustomers.items.length > 0) {
            console.log('✅ Found existing customer:', existingCustomers.items[0].id);
            return existingCustomers.items[0];
          }
        } catch (searchError) {
          console.log('⚠️ Could not search for existing customer, using fallback');
        }
        
        // Fallback: return a customer object with the email
        return {
          id: `cust_existing_${user.id}`,
          name: user.display_name || user.email.split('@')[0],
          email: user.email,
          contact: user.phone || ''
        };
      }
      
      throw error;
    }
  }

  // Create order for one-time payment (if needed)
  static async createOrder(amount, currency = 'INR', receipt, notes = {}) {
    try {
      const order = await razorpay.orders.create({
        amount: amount, // Amount in paise
        currency: currency,
        receipt: receipt,
        notes: notes
      });

      console.log('✅ Razorpay order created:', order.id);
      return order;
    } catch (error) {
      console.error('❌ Razorpay order creation failed:', error);
      throw error;
    }
  }

  // Verify payment signature
  static verifyPaymentSignature(orderId, paymentId, signature) {
    try {
      const body = orderId + '|' + paymentId;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'demo_secret')
        .update(body.toString())
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      console.error('❌ Payment signature verification failed:', error);
      return false;
    }
  }

  // Verify subscription signature
  static verifySubscriptionSignature(subscriptionId, paymentId, signature) {
    try {
      const body = subscriptionId + '|' + paymentId;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'demo_secret')
        .update(body.toString())
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      console.error('❌ Subscription signature verification failed:', error);
      return false;
    }
  }

  // Verify webhook signature
  static verifyWebhookSignature(body, signature) {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new Error('Razorpay webhook secret not configured');
      }

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      console.error('❌ Webhook signature verification failed:', error);
      return false;
    }
  }

  // Handle successful payment link payment (one-time subscription purchase)
  static async handlePaymentLinkPayment(payment) {
    try {
      console.log('🔍 Processing payment link payment:', payment.id);
      console.log('🔍 Payment notes:', payment.notes);
      
      let userId = payment.notes.userId || payment.notes.firebaseUid;
      const planType = payment.notes.planType;
      const userEmail = payment.notes.email || payment.customer_details?.email;

      if (!planType) {
        throw new Error('Missing planType in payment notes');
      }

      // If userId is missing or invalid, try to find user by email
      if (!userId && userEmail) {
        console.log('⚠️ Missing userId, searching by email:', userEmail);
        try {
          const user = await Database.getUserByEmail(userEmail);
          if (user) {
            userId = user.id;
            console.log('✅ Found user by email:', userId);
          }
        } catch (emailSearchError) {
          console.log('⚠️ Could not find user by email:', emailSearchError.message);
        }
      }

      if (!userId) {
        throw new Error('Could not determine user ID from payment notes or email');
      }

      // Calculate subscription period (monthly from payment date)
      const currentStart = new Date();
      const currentEnd = new Date();
      currentEnd.setMonth(currentEnd.getMonth() + 1);

      // Create subscription record in database
      const dbSubscription = await Database.createSubscription(
        userId,
        planType,
        'razorpay',
        `plink_${payment.id}`, // Use payment link ID as subscription ID
        payment.amount / 100, // Convert paise to rupees
        payment.currency,
        currentStart,
        currentEnd
      );

      // Update user's current plan
      await Database.updateUserPlan(
        userId,
        planType,
        currentEnd
      );

      // Log payment transaction
      await Database.logPayment(
        userId,
        dbSubscription.id,
        'subscription',
        'razorpay',
        payment.id,
        payment.amount / 100,
        payment.currency,
        'completed',
        payment.method
      );

      console.log('✅ Razorpay payment link payment processed successfully:', {
        paymentId: payment.id,
        userId: userId,
        planType: planType,
        subscriptionId: dbSubscription.id
      });
      return dbSubscription;
    } catch (error) {
      console.error('❌ Payment link payment processing failed:', error);
      throw error;
    }
  }

  // Handle successful subscription payment
  static async handleSubscriptionPayment(payment) {
    try {
      console.log('🔍 Processing subscription payment:', payment.id);
      console.log('🔍 Payment notes:', payment.notes);
      
      const subscriptionId = payment.notes.subscription_id;
      let userId = payment.notes.userId;
      const planType = payment.notes.planType;
      const userEmail = payment.notes.email || payment.customer_details?.email;

      if (!planType) {
        throw new Error('Missing planType in payment notes');
      }

      // If userId is missing or invalid, try to find user by email
      if (!userId && userEmail) {
        console.log('⚠️ Missing userId, searching by email:', userEmail);
        try {
          const user = await Database.getUserByEmail(userEmail);
          if (user) {
            userId = user.id;
            console.log('✅ Found user by email:', userId);
          }
        } catch (emailSearchError) {
          console.log('⚠️ Could not find user by email:', emailSearchError.message);
        }
      }

      if (!userId) {
        throw new Error('Could not determine user ID from payment notes or email');
      }

      // Get subscription details from Razorpay
      const subscription = await razorpay.subscriptions.fetch(subscriptionId);
      console.log('🔍 Razorpay subscription details:', subscription.id);

      // Create/update subscription in database
      const dbSubscription = await Database.createSubscription(
        userId,
        planType,
        'razorpay',
        subscriptionId,
        payment.amount / 100, // Convert paise to rupees
        payment.currency,
        new Date(subscription.current_start * 1000),
        new Date(subscription.current_end * 1000)
      );

      // Update user's current plan
      await Database.updateUserPlan(
        userId,
        planType,
        new Date(subscription.current_end * 1000)
      );

      // Log payment transaction
      await Database.logPayment(
        userId,
        dbSubscription.id,
        'subscription',
        'razorpay',
        payment.id,
        payment.amount / 100,
        payment.currency,
        'completed',
        payment.method
      );

      console.log('✅ Razorpay subscription payment processed successfully:', {
        paymentId: payment.id,
        userId: userId,
        planType: planType,
        subscriptionId: subscriptionId
      });
      return dbSubscription;
    } catch (error) {
      console.error('❌ Subscription payment processing failed:', error);
      throw error;
    }
  }

  // Handle subscription cancellation
  static async handleSubscriptionCancellation(subscription) {
    try {
      // Update subscription status in database
      await Database.updateSubscriptionStatus(
        subscription.id,
        'cancelled',
        new Date()
      );

      // Update user plan
      const user = await Database.query(
        'SELECT * FROM users WHERE id = (SELECT user_id FROM subscriptions WHERE razorpay_subscription_id = $1)',
        [subscription.id]
      );

      if (user.rows.length > 0) {
        await Database.updateUserPlan(
          user.rows[0].id,
          'free',
          new Date(subscription.current_end * 1000)
        );
      }

      console.log('✅ Razorpay subscription cancelled:', subscription.id);
    } catch (error) {
      console.error('❌ Subscription cancellation handling failed:', error);
      throw error;
    }
  }

  // Handle failed payments
  static async handlePaymentFailed(payment) {
    try {
      const userId = payment.notes.userId;
      
      if (userId) {
        // Log failed payment
        await Database.logPayment(
          userId,
          null,
          'subscription',
          'razorpay',
          payment.id,
          payment.amount / 100,
          payment.currency,
          'failed',
          payment.method
        );
      }

      console.log('⚠️ Razorpay payment failed:', payment.id);
    } catch (error) {
      console.error('❌ Payment failure handling failed:', error);
      throw error;
    }
  }

  // Get subscription details
  static async getSubscription(subscriptionId) {
    try {
      return await razorpay.subscriptions.fetch(subscriptionId);
    } catch (error) {
      console.error('❌ Get subscription failed:', error);
      throw error;
    }
  }

  // Cancel subscription
  static async cancelSubscription(subscriptionId, cancelAtCycleEnd = true) {
    try {
      return await razorpay.subscriptions.cancel(subscriptionId, {
        cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0
      });
    } catch (error) {
      console.error('❌ Cancel subscription failed:', error);
      throw error;
    }
  }

  // Get payment details
  static async getPayment(paymentId) {
    try {
      return await razorpay.payments.fetch(paymentId);
    } catch (error) {
      console.error('❌ Get payment failed:', error);
      throw error;
    }
  }

  // Get customer's payments
  static async getCustomerPayments(customerId) {
    try {
      return await razorpay.payments.all({
        customer_id: customerId
      });
    } catch (error) {
      console.error('❌ Get customer payments failed:', error);
      throw error;
    }
  }

  // Create payment link for subscription
  static async createPaymentLink(user, planType, callbackUrl) {
    try {
      const planConfig = RAZORPAY_PLANS[planType];
      if (!planConfig) {
        throw new Error(`Invalid plan type: ${planType}`);
      }

      // Validate user data
      if (!user.id || !user.email) {
        throw new Error('User ID and email are required for payment link creation');
      }

      console.log('🔍 Creating payment link for user:', {
        userId: user.id,
        email: user.email,
        planType: planType
      });

      const paymentLink = await razorpay.paymentLink.create({
        amount: planConfig.amount,
        currency: planConfig.currency,
        description: `ImgToJPG ${planType.charAt(0).toUpperCase() + planType.slice(1)} Plan Subscription`,
        customer: {
          name: user.display_name || user.email.split('@')[0],
          email: user.email,
          contact: user.phone || ''
        },
        notify: {
          sms: true,
          email: true
        },
        reminder_enable: true,
        callback_url: callbackUrl,
        callback_method: 'get',
        notes: {
          userId: user.id,
          firebaseUid: user.id, // Store Firebase UID as well
          email: user.email,    // Store email for fallback lookup
          planType: planType,
          app_name: 'HEIC to JPG Converter',
          service: 'Image Conversion Service',
          created_at: new Date().toISOString()
        },
        // Enable all payment methods for payment links
        options: {
          checkout: {
            method: {
              netbanking: 1,
              wallet: 1,
              emi: 1,
              upi: 1,
              card: 1
            }
          }
        }
      });

      console.log('✅ Razorpay payment link created successfully:', {
        paymentLinkId: paymentLink.id,
        userId: user.id,
        email: user.email,
        planType: planType,
        amount: planConfig.amount
      });
      return paymentLink;
    } catch (error) {
      console.error('❌ Payment link creation failed:', error);
      throw error;
    }
  }

  // Refund payment
  static async refundPayment(paymentId, amount = null, notes = {}) {
    try {
      const refundData = {
        notes: notes
      };

      if (amount) {
        refundData.amount = amount;
      }

      const refund = await razorpay.payments.refund(paymentId, refundData);
      console.log('✅ Razorpay refund created:', refund.id);
      return refund;
    } catch (error) {
      console.error('❌ Refund creation failed:', error);
      throw error;
    }
  }

  // Get plan pricing for display
  static getPlanPricing() {
      return Object.keys(RAZORPAY_PLANS).reduce((acc, planType) => {
      acc[planType] = {
        amount: RAZORPAY_PLANS[planType].amount / 100, // Convert cents to dollars
        currency: RAZORPAY_PLANS[planType].currency,
        period: RAZORPAY_PLANS[planType].period
      };
      return acc;
    }, {});
  }

  // Check if payment method is available in India
  static isAvailableInIndia() {
    return true; // Razorpay is specifically for India
  }
}

module.exports = RazorpayService;
