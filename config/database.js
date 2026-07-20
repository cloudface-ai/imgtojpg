// Database configuration for PostgreSQL
const { Pool } = require('pg');

// Database configuration
const dbConfig = {
  // AWS RDS PostgreSQL connection (will be configured later)
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'imgtojpg_dev',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
  connectionTimeoutMillis: 2000, // How long to wait when connecting
  
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false // For AWS RDS
  } : false
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('🔥 Unexpected error on idle client', err);
  process.exit(-1);
});

// Database helper functions
class Database {
  
  // Execute a query
  static async query(text, params) {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log('📊 Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('❌ Database query error:', error);
      throw error;
    }
  }

  // Get a client from the pool for transactions
  static async getClient() {
    return await pool.connect();
  }

  // User management functions
  static async createUser(firebaseUid, email, displayName = null) {
    const query = `
      INSERT INTO users (firebase_uid, email, display_name)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await this.query(query, [firebaseUid, email, displayName]);
    return result.rows[0];
  }

  static async getUserByFirebaseUid(firebaseUid) {
    const query = `
      SELECT u.*, pl.monthly_conversions, pl.monthly_storage_gb, pl.batch_conversion, 
             pl.priority_queue, pl.email_support, pl.team_access, pl.price_usd
      FROM users u
      LEFT JOIN plan_limits pl ON u.current_plan = pl.plan_type
      WHERE u.firebase_uid = $1 AND u.is_active = true
    `;
    const result = await this.query(query, [firebaseUid]);
    return result.rows[0];
  }

  static async getUserByEmail(email) {
    const query = `
      SELECT u.*, pl.monthly_conversions, pl.monthly_storage_gb, pl.batch_conversion,
             pl.priority_queue, pl.email_support, pl.team_access, pl.price_usd
      FROM users u
      LEFT JOIN plan_limits pl ON u.current_plan = pl.plan_type
      WHERE u.email = $1 AND u.is_active = true
    `;
    const result = await this.query(query, [email]);
    return result.rows[0];
  }

  static async updateUserPlan(userId, planType, expiresAt = null) {
    const query = `
      UPDATE users 
      SET current_plan = $2, plan_expires_at = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.query(query, [userId, planType, expiresAt]);
    return result.rows[0];
  }

  static async updateUserLastLogin(userId) {
    const query = `
      UPDATE users 
      SET last_login_at = NOW()
      WHERE id = $1
    `;
    await this.query(query, [userId]);
  }

  // Usage tracking functions
  static async logUsage(userId, ipAddress, sessionId, fileName, fileSizeMb, inputFormat, outputFormat, processingTimeMs = null, success = true, errorMessage = null) {
    const query = `
      INSERT INTO usage_logs (user_id, ip_address, session_id, file_name, file_size_mb, 
                             input_format, output_format, processing_time_ms, success, error_message)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const result = await this.query(query, [
      userId, ipAddress, sessionId, fileName, fileSizeMb, 
      inputFormat, outputFormat, processingTimeMs, success, errorMessage
    ]);
    return result.rows[0];
  }

  static async getUserCurrentUsage(userId) {
    const query = `SELECT * FROM get_user_current_usage($1)`;
    const result = await this.query(query, [userId]);
    return result.rows[0];
  }

  static async canUserConvert(userId, fileSizeMb) {
    const query = `SELECT * FROM can_user_convert($1, $2)`;
    const result = await this.query(query, [userId, fileSizeMb]);
    return result.rows[0];
  }

  // For free tier (IP-based tracking)
  static async getIPUsage(ipAddress) {
    const query = `
      SELECT 
        COUNT(*) as conversions_used,
        SUM(file_size_mb) / 1024 as storage_used_gb
      FROM usage_logs 
      WHERE ip_address = $1 
        AND created_at >= date_trunc('week', NOW())
        AND success = true
    `;
    const result = await this.query(query, [ipAddress]);
    return result.rows[0];
  }

  static async canIPConvert(ipAddress, fileSizeMb) {
    const usage = await this.getIPUsage(ipAddress);
    const freeLimit = 5; // 5 conversions per week
    const storageLimit = 2; // 2GB per week
    
    return {
      can_convert: usage.conversions_used < freeLimit && 
                   (parseFloat(usage.storage_used_gb || 0) + fileSizeMb/1024) <= storageLimit,
      reason: usage.conversions_used >= freeLimit ? 'Weekly conversion limit reached' :
              (parseFloat(usage.storage_used_gb || 0) + fileSizeMb/1024) > storageLimit ? 'Weekly storage limit exceeded' :
              'Conversion allowed',
      conversions_remaining: Math.max(0, freeLimit - parseInt(usage.conversions_used)),
      storage_remaining_gb: Math.max(0, storageLimit - parseFloat(usage.storage_used_gb || 0))
    };
  }

  // Subscription management functions
  static async createSubscription(userId, planType, paymentProvider, subscriptionId, amountPaid, currency, currentPeriodStart, currentPeriodEnd) {
    const query = `
      INSERT INTO subscriptions (user_id, plan_type, payment_provider, stripe_subscription_id, 
                                razorpay_subscription_id, amount_paid, currency, 
                                current_period_start, current_period_end, next_billing_date)
      VALUES ($1, $2, $3, 
              CASE WHEN $3 = 'stripe' THEN $4 ELSE NULL END,
              CASE WHEN $3 = 'razorpay' THEN $4 ELSE NULL END,
              $5, $6, $7, $8, $8)
      RETURNING *
    `;
    const result = await this.query(query, [
      userId, planType, paymentProvider, subscriptionId, 
      amountPaid, currency, currentPeriodStart, currentPeriodEnd
    ]);
    return result.rows[0];
  }

  static async getActiveSubscription(userId) {
    const query = `
      SELECT * FROM subscriptions 
      WHERE user_id = $1 AND status = 'active'
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const result = await this.query(query, [userId]);
    return result.rows[0];
  }

  static async updateSubscriptionStatus(subscriptionId, status, cancelledAt = null) {
    const query = `
      UPDATE subscriptions 
      SET status = $2, cancelled_at = $3, updated_at = NOW()
      WHERE stripe_subscription_id = $1 OR razorpay_subscription_id = $1
      RETURNING *
    `;
    const result = await this.query(query, [subscriptionId, status, cancelledAt]);
    return result.rows[0];
  }

  // Payment transaction functions
  static async logPayment(userId, subscriptionId, transactionType, paymentProvider, providerTransactionId, amount, currency, status, paymentMethod = null) {
    const query = `
      INSERT INTO payment_transactions (user_id, subscription_id, transaction_type, 
                                       payment_provider, provider_transaction_id, amount, 
                                       currency, status, payment_method)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const result = await this.query(query, [
      userId, subscriptionId, transactionType, paymentProvider, 
      providerTransactionId, amount, currency, status, paymentMethod
    ]);
    return result.rows[0];
  }

  // Plan management functions
  static async getAllPlans() {
    const query = `SELECT * FROM plan_limits WHERE is_active = true ORDER BY price_usd ASC`;
    const result = await this.query(query);
    return result.rows;
  }

  static async getPlan(planType) {
    const query = `SELECT * FROM plan_limits WHERE plan_type = $1 AND is_active = true`;
    const result = await this.query(query, [planType]);
    return result.rows[0];
  }

  // Admin functions
  static async getUserStats() {
    const query = `
      SELECT 
        current_plan,
        COUNT(*) as user_count,
        SUM(CASE WHEN last_login_at > NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) as active_users
      FROM users 
      WHERE is_active = true 
      GROUP BY current_plan
    `;
    const result = await this.query(query);
    return result.rows;
  }

  static async getUsageStats(days = 30) {
    const query = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as conversions,
        SUM(file_size_mb) / 1024 as total_gb_processed,
        COUNT(DISTINCT COALESCE(user_id::text, ip_address::text)) as unique_users
      FROM usage_logs 
      WHERE created_at >= NOW() - INTERVAL '${days} days'
        AND success = true
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
    const result = await this.query(query);
    return result.rows;
  }

  // Health check
  static async healthCheck() {
    try {
      const result = await this.query('SELECT NOW() as server_time, version() as pg_version');
      return { 
        status: 'healthy', 
        timestamp: result.rows[0].server_time,
        version: result.rows[0].pg_version 
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message 
      };
    }
  }

  // Close all connections
  static async close() {
    await pool.end();
  }
}

module.exports = Database;
