const { admin } = require('./firebase');

// Initialize Firestore
const db = admin.firestore();

// Plan limits configuration (same as PostgreSQL schema)
const PLAN_LIMITS = {
  free: {
    monthly_conversions: 20,
    monthly_storage_gb: 2.0,
    max_file_size_mb: 100,
    batch_conversion: false,
    priority_queue: false,
    email_support: false,
    team_access: false,
    price_usd: 0.00
  },
  basic: {
    monthly_conversions: 300,
    monthly_storage_gb: 30.0,
    max_file_size_mb: 500,
    batch_conversion: true,
    priority_queue: false,
    email_support: false,
    team_access: false,
    price_usd: 1.79,
    price_inr: 149
  },
  pro: {
    monthly_conversions: 1500,
    monthly_storage_gb: 150.0,
    max_file_size_mb: 1000,
    batch_conversion: true,
    priority_queue: true,
    email_support: true,
    team_access: false,
    price_usd: 8.99,
    price_inr: 749
  },
  team: {
    monthly_conversions: -1, // unlimited
    monthly_storage_gb: -1, // unlimited
    max_file_size_mb: 2000,
    batch_conversion: true,
    priority_queue: true,
    email_support: true,
    team_access: true,
    price_usd: 28.99,
    price_inr: 2399
  }
};

class FirestoreDatabase {
  
  // Health check
  static async healthCheck() {
    try {
      await db.collection('_health').doc('test').set({ timestamp: admin.firestore.FieldValue.serverTimestamp() });
      return { status: 'healthy', message: 'Firestore connection successful' };
    } catch (error) {
      return { status: 'unhealthy', message: 'Firestore connection failed', error: error.message };
    }
  }

  // User management
  static async getUserById(userId) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      return userDoc.exists ? { id: userId, ...userDoc.data() } : null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }

  static async getUserByFirebaseUid(firebaseUid) {
    try {
      const usersRef = db.collection('users');
      const query = usersRef.where('firebase_uid', '==', firebaseUid);
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        return null;
      }
      
      const userDoc = snapshot.docs[0];
      return { id: userDoc.id, ...userDoc.data() };
    } catch (error) {
      console.error('Error getting user by Firebase UID:', error);
      return null;
    }
  }

  static async getUserByEmail(email) {
    try {
      const usersRef = db.collection('users');
      const query = usersRef.where('email', '==', email);
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        return null;
      }
      
      const userDoc = snapshot.docs[0];
      return { id: userDoc.id, ...userDoc.data() };
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }

  static async createUser(firebaseUid, email, displayName) {
    try {
      const userRef = db.collection('users').doc();
      const userData = {
        firebase_uid: firebaseUid,
        email: email,
        display_name: displayName || email,
        current_plan: 'free',
        subscription_status: 'inactive',
        subscription_id: null,
        plan_expires_at: null,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        last_login: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await userRef.set(userData);
      return { id: userRef.id, ...userData };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  static async updateUser(userId, data) {
    try {
      const userRef = db.collection('users').doc(userId);
      const updateData = {
        ...data,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await userRef.update(updateData);
      const updatedDoc = await userRef.get();
      return { id: userId, ...updatedDoc.data() };
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  static async updateUserLastLogin(userId) {
    try {
      const userRef = db.collection('users').doc(userId);
      await userRef.update({
        last_login: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }

  // Plan limits
  static async getPlanLimits(planType) {
    return PLAN_LIMITS[planType] || PLAN_LIMITS.free;
  }

  // Subscription management
  static async getActiveSubscription(userId) {
    try {
      const user = await this.getUserById(userId);
      if (!user || user.subscription_status !== 'active') {
        return null;
      }

      const planLimits = await this.getPlanLimits(user.current_plan);
      
      return {
        id: user.id,
        user_id: userId,
        plan_type: user.current_plan,
        provider: user.payment_provider || 'stripe',
        provider_subscription_id: user.subscription_id,
        status: user.subscription_status,
        current_period_start: user.current_period_start,
        current_period_end: user.current_period_end || user.plan_expires_at,
        cancel_at_period_end: user.cancel_at_period_end || false,
        created_at: user.subscription_created_at,
        updated_at: user.updated_at,
        ...planLimits
      };
    } catch (error) {
      console.error('Error getting active subscription:', error);
      return null;
    }
  }

  static async createSubscription(userId, planType, provider, providerSubscriptionId, status, currentPeriodStart, currentPeriodEnd) {
    try {
      const subscriptionData = {
        current_plan: planType,
        payment_provider: provider,
        subscription_id: providerSubscriptionId,
        subscription_status: status,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        plan_expires_at: currentPeriodEnd,
        subscription_created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };

      await this.updateUser(userId, subscriptionData);
      return await this.getActiveSubscription(userId);
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  static async updateSubscriptionStatus(providerSubscriptionId, status, currentPeriodEnd = null) {
    try {
      const usersRef = db.collection('users');
      const query = usersRef.where('subscription_id', '==', providerSubscriptionId);
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        console.error('No user found with subscription ID:', providerSubscriptionId);
        return null;
      }
      
      const userDoc = snapshot.docs[0];
      const updateData = {
        subscription_status: status,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (currentPeriodEnd) {
        updateData.current_period_end = currentPeriodEnd;
        updateData.plan_expires_at = currentPeriodEnd;
      }
      
      await userDoc.ref.update(updateData);
      return { id: userDoc.id, ...userDoc.data(), ...updateData };
    } catch (error) {
      console.error('Error updating subscription status:', error);
      throw error;
    }
  }

  // Usage tracking
  static async logUsage(userId, sessionId, fileCount, totalSizeMb, conversionType, ipAddress, isAnonymous, billingPeriodStart, billingPeriodEnd) {
    try {
      const usageRef = db.collection('usage_logs').doc();
      const usageData = {
        user_id: userId,
        session_id: sessionId,
        file_count: fileCount,
        total_size_mb: totalSizeMb,
        conversion_type: conversionType,
        ip_address: ipAddress,
        is_anonymous: isAnonymous,
        billing_period_start: billingPeriodStart,
        billing_period_end: billingPeriodEnd,
        success: true,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await usageRef.set(usageData);
      return { id: usageRef.id, ...usageData };
    } catch (error) {
      console.error('Error logging usage:', error);
      throw error;
    }
  }

  // Usage calculations (simplified to avoid index requirements)
  static async getUserCurrentUsage(userId) {
    try {
      console.log('🔍 getUserCurrentUsage - User ID:', userId);
      
      const user = await this.getUserById(userId);
      if (!user) {
        console.log('⚠️ getUserCurrentUsage - User not found');
        return { 
          total_conversions: 0, 
          monthly_conversions: 0, 
          normal_conversions_used: 0,
          raw_conversions_used: 0,
          conversions_used: 0, // Keep for backward compatibility
          remaining_conversions: 1000,
          storage_used_gb: 0 
        };
      }

      console.log('🔍 getUserCurrentUsage - User found:', user.email);

      // Try a simpler query first (without orderBy to avoid index requirement)
      const usageRef = db.collection('usage_logs');
      let query = usageRef
        .where('user_id', '==', userId)
        .where('success', '==', true);
      
      console.log('🔍 getUserCurrentUsage - Executing query...');
      const snapshot = await query.get();
      console.log('🔍 getUserCurrentUsage - Query returned', snapshot.size, 'documents');
      
      let totalConversions = 0;
      let monthlyConversions = 0;
      let normalConversions = 0;
      let rawConversions = 0;
      let storageUsedMb = 0;
      
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const createdAt = data.created_at ? data.created_at.toDate() : new Date();
        const fileCount = data.file_count || 0;
        const conversionType = data.conversion_type || 'normal';
        
        console.log('🔍 getUserCurrentUsage - Processing log:', {
          createdAt: createdAt.toISOString(),
          fileCount: fileCount,
          conversionType: conversionType,
          monthStart: monthStart.toISOString()
        });
        
        totalConversions += fileCount;
        storageUsedMb += data.total_size_mb || 0;
        
        // Count monthly conversions by type
        if (createdAt >= monthStart) {
          monthlyConversions += fileCount;
          if (conversionType === 'raw') {
            rawConversions += fileCount;
          } else {
            normalConversions += fileCount;
          }
        }
      });
      
      console.log('🔍 getUserCurrentUsage - Final counts:', {
        totalConversions,
        monthlyConversions,
        normalConversions,
        rawConversions,
        storageUsedMb
      });

      // Get plan limits
      const planLimits = await this.getPlanLimits(user.current_plan);
      const remainingConversions = planLimits.monthly_conversions === -1 ? 
        999999 : Math.max(0, planLimits.monthly_conversions - monthlyConversions);

      return {
        total_conversions: totalConversions,
        monthly_conversions: monthlyConversions,
        normal_conversions_used: normalConversions,
        raw_conversions_used: rawConversions,
        conversions_used: monthlyConversions, // Keep for backward compatibility
        remaining_conversions: remainingConversions,
        storage_used_gb: storageUsedMb / 1024
      };
    } catch (error) {
      console.error('Error getting user current usage:', error);
      return { 
        total_conversions: 0, 
        monthly_conversions: 0, 
        normal_conversions_used: 0,
        raw_conversions_used: 0,
        conversions_used: 0, // Keep for backward compatibility
        remaining_conversions: 1000,
        storage_used_gb: 0 
      };
    }
  }

  static async getAnonymousUserCurrentUsage(ipAddress) {
    try {
      // Use weekly period for anonymous users
      const now = new Date();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

      const usageRef = db.collection('usage_logs');
      const query = usageRef
        .where('ip_address', '==', ipAddress)
        .where('is_anonymous', '==', true)
        .where('created_at', '>=', weekStart)
        .where('created_at', '<=', weekEnd)
        .where('success', '==', true);
      
      const snapshot = await query.get();
      
      let conversionsUsed = 0;
      let normalConversions = 0;
      let rawConversions = 0;
      let storageUsedMb = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const fileCount = data.file_count || 0;
        conversionsUsed += fileCount;
        storageUsedMb += data.total_size_mb || 0;
        
        // Count by conversion type
        if (data.conversion_type === 'raw') {
          rawConversions += fileCount;
        } else {
          normalConversions += fileCount;
        }
      });

      return {
        conversions_used: conversionsUsed,
        normal_conversions_used: normalConversions,
        raw_conversions_used: rawConversions,
        storage_used_gb: storageUsedMb / 1024,
        period_start: weekStart,
        period_end: weekEnd
      };
    } catch (error) {
      console.error('Error getting anonymous user current usage:', error);
      return { 
        conversions_used: 0,
        normal_conversions_used: 0,
        raw_conversions_used: 0,
        storage_used_gb: 0,
        period_start: new Date(),
        period_end: new Date()
      };
    }
  }

  // Quota checking
  static async canUserConvert(userId, fileSizeMb) {
    try {
      const user = await this.getUserById(userId);
      const planLimits = await this.getPlanLimits(user ? user.current_plan : 'free');
      const usage = await this.getUserCurrentUsage(userId);

      const conversionsRemaining = planLimits.monthly_conversions === -1 ? 
        999999 : Math.max(0, planLimits.monthly_conversions - usage.conversions_used);
      
      const storageRemainingGb = planLimits.monthly_storage_gb === -1 ? 
        999999 : Math.max(0, planLimits.monthly_storage_gb - usage.storage_used_gb);

      const canConvert = 
        (planLimits.monthly_conversions === -1 || usage.conversions_used < planLimits.monthly_conversions) &&
        (planLimits.monthly_storage_gb === -1 || (usage.storage_used_gb + fileSizeMb/1024) <= planLimits.monthly_storage_gb) &&
        (planLimits.max_file_size_mb === -1 || fileSizeMb <= planLimits.max_file_size_mb);

      let reason = 'Conversion allowed';
      if (!canConvert) {
        if (planLimits.monthly_conversions !== -1 && usage.conversions_used >= planLimits.monthly_conversions) {
          reason = `Monthly conversion limit reached (${planLimits.monthly_conversions})`;
        } else if (planLimits.monthly_storage_gb !== -1 && (usage.storage_used_gb + fileSizeMb/1024) > planLimits.monthly_storage_gb) {
          reason = `Monthly storage limit exceeded (${planLimits.monthly_storage_gb}GB)`;
        } else if (planLimits.max_file_size_mb !== -1 && fileSizeMb > planLimits.max_file_size_mb) {
          reason = `File size exceeds limit (${planLimits.max_file_size_mb}MB)`;
        }
      }

      return {
        can_convert: canConvert,
        reason: reason,
        conversions_remaining: conversionsRemaining,
        storage_remaining_gb: storageRemainingGb,
        plan_type: user ? user.current_plan : 'free'
      };
    } catch (error) {
      console.error('Error checking user conversion quota:', error);
      return { can_convert: false, reason: 'Error checking quota' };
    }
  }

  static async canIPConvert(ipAddress, fileSizeMb) {
    try {
      const usage = await this.getAnonymousUserCurrentUsage(ipAddress);
      const freeLimit = 5; // 5 conversions per week
      const storageLimit = 2; // 2GB per week

      const canConvert = 
        usage.conversions_used < freeLimit && 
        (usage.storage_used_gb + fileSizeMb/1024) <= storageLimit;

      let reason = 'Conversion allowed';
      if (!canConvert) {
        if (usage.conversions_used >= freeLimit) {
          reason = 'Weekly conversion limit reached (5 conversions)';
        } else if ((usage.storage_used_gb + fileSizeMb/1024) > storageLimit) {
          reason = 'Weekly storage limit exceeded (2GB)';
        }
      }

      return {
        can_convert: canConvert,
        reason: reason,
        conversions_remaining: Math.max(0, freeLimit - usage.conversions_used),
        storage_remaining_gb: Math.max(0, storageLimit - usage.storage_used_gb)
      };
    } catch (error) {
      console.error('Error checking IP conversion quota:', error);
      return { can_convert: false, reason: 'Error checking quota' };
    }
  }

  // Payment transactions
  static async recordPaymentTransaction(userId, subscriptionId, provider, providerTransactionId, amountUsd, currency, status, transactionType) {
    try {
      const transactionRef = db.collection('payment_transactions').doc();
      const transactionData = {
        user_id: userId,
        subscription_id: subscriptionId,
        provider: provider,
        provider_transaction_id: providerTransactionId,
        amount_usd: amountUsd,
        currency: currency,
        status: status,
        transaction_type: transactionType,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await transactionRef.set(transactionData);
      return { id: transactionRef.id, ...transactionData };
    } catch (error) {
      console.error('Error recording payment transaction:', error);
      throw error;
    }
  }

  // Additional methods for Razorpay integration
  static async createSubscription(userId, planType, provider, providerSubscriptionId, amountPaid, currency, currentPeriodStart, currentPeriodEnd) {
    try {
      const subscriptionData = {
        current_plan: planType,
        payment_provider: provider,
        subscription_id: providerSubscriptionId,
        subscription_status: 'active',
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        plan_expires_at: currentPeriodEnd,
        subscription_created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };

      await this.updateUser(userId, subscriptionData);
      return await this.getActiveSubscription(userId);
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  static async updateUserPlan(userId, planType, expiresAt = null) {
    try {
      const updateData = {
        current_plan: planType,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };

      if (expiresAt) {
        updateData.plan_expires_at = expiresAt;
        updateData.current_period_end = expiresAt;
      }

      return await this.updateUser(userId, updateData);
    } catch (error) {
      console.error('Error updating user plan:', error);
      throw error;
    }
  }

  static async logPayment(userId, subscriptionId, transactionType, provider, providerTransactionId, amount, currency, status, method = null) {
    try {
      const transactionRef = db.collection('payment_transactions').doc();
      const transactionData = {
        user_id: userId,
        subscription_id: subscriptionId,
        transaction_type: transactionType,
        payment_provider: provider,
        provider_transaction_id: providerTransactionId,
        amount: amount,
        currency: currency,
        status: status,
        method: method,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await transactionRef.set(transactionData);
      return { id: transactionRef.id, ...transactionData };
    } catch (error) {
      console.error('Error logging payment:', error);
      throw error;
    }
  }
}

module.exports = FirestoreDatabase;
