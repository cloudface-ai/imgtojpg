-- ImgToJPG Subscription System Database Schema
-- PostgreSQL Database Setup

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    current_plan VARCHAR(20) DEFAULT 'free' CHECK (current_plan IN ('free', 'basic', 'pro', 'team')),
    plan_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('basic', 'pro', 'team')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'suspended')),
    stripe_subscription_id VARCHAR(255) UNIQUE,
    razorpay_subscription_id VARCHAR(255) UNIQUE,
    payment_provider VARCHAR(20) NOT NULL CHECK (payment_provider IN ('stripe', 'razorpay')),
    amount_paid DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    next_billing_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Usage tracking table
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET, -- For free tier tracking
    session_id VARCHAR(255),
    file_name VARCHAR(500),
    file_size_mb DECIMAL(10,3) NOT NULL,
    input_format VARCHAR(10) NOT NULL,
    output_format VARCHAR(10) NOT NULL,
    processing_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    billing_period_start TIMESTAMP WITH TIME ZONE,
    billing_period_end TIMESTAMP WITH TIME ZONE
);

-- Plan limits table (for flexible plan management)
CREATE TABLE plan_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_type VARCHAR(20) UNIQUE NOT NULL,
    monthly_conversions INTEGER,
    monthly_storage_gb DECIMAL(8,2),
    max_file_size_mb DECIMAL(8,2),
    batch_conversion BOOLEAN DEFAULT false,
    priority_queue BOOLEAN DEFAULT false,
    email_support BOOLEAN DEFAULT false,
    team_access BOOLEAN DEFAULT false,
    price_usd DECIMAL(8,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment transactions table
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('subscription', 'upgrade', 'refund')),
    payment_provider VARCHAR(20) NOT NULL CHECK (payment_provider IN ('stripe', 'razorpay')),
    provider_transaction_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_method VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_current_plan ON users(current_plan);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_razorpay_id ON subscriptions(razorpay_subscription_id);
CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_ip_address ON usage_logs(ip_address);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX idx_usage_logs_billing_period ON usage_logs(billing_period_start, billing_period_end);
CREATE INDEX idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_provider_id ON payment_transactions(provider_transaction_id);

-- Insert default plan limits
INSERT INTO plan_limits (plan_type, monthly_conversions, monthly_storage_gb, max_file_size_mb, batch_conversion, priority_queue, email_support, team_access, price_usd) VALUES
('free', 20, 2.0, 100, false, false, false, false, 0.00), -- 5 per week = ~20 per month
('basic', 300, 30.0, 500, true, false, false, false, 3.00),
('pro', 1500, 150.0, 1000, true, true, true, false, 9.00),
('team', -1, -1, 2000, true, true, true, true, 29.00); -- -1 means unlimited

-- Function to get current usage for a user in current billing period
CREATE OR REPLACE FUNCTION get_user_current_usage(user_uuid UUID)
RETURNS TABLE(
    conversions_used INTEGER,
    storage_used_gb DECIMAL(10,3),
    billing_period_start TIMESTAMP WITH TIME ZONE,
    billing_period_end TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    user_plan VARCHAR(20);
    period_start TIMESTAMP WITH TIME ZONE;
    period_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get user's current plan
    SELECT current_plan INTO user_plan FROM users WHERE id = user_uuid;
    
    -- Calculate billing period based on plan
    IF user_plan = 'free' THEN
        -- Weekly billing for free users
        period_start := date_trunc('week', NOW());
        period_end := period_start + INTERVAL '1 week';
    ELSE
        -- Monthly billing for paid users
        period_start := date_trunc('month', NOW());
        period_end := period_start + INTERVAL '1 month';
    END IF;
    
    -- Get usage stats
    RETURN QUERY
    SELECT 
        COALESCE(COUNT(*)::INTEGER, 0) as conversions_used,
        COALESCE(SUM(file_size_mb)::DECIMAL(10,3) / 1024, 0) as storage_used_gb,
        period_start,
        period_end
    FROM usage_logs 
    WHERE user_id = user_uuid 
        AND created_at >= period_start 
        AND created_at < period_end
        AND success = true;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can perform conversion
CREATE OR REPLACE FUNCTION can_user_convert(user_uuid UUID, file_size_mb DECIMAL)
RETURNS TABLE(
    can_convert BOOLEAN,
    reason TEXT,
    conversions_remaining INTEGER,
    storage_remaining_gb DECIMAL
) AS $$
DECLARE
    user_plan VARCHAR(20);
    plan_limits RECORD;
    current_usage RECORD;
BEGIN
    -- Get user plan
    SELECT current_plan INTO user_plan FROM users WHERE id = user_uuid;
    
    -- Get plan limits
    SELECT * INTO plan_limits FROM plan_limits WHERE plan_type = user_plan;
    
    -- Get current usage
    SELECT * INTO current_usage FROM get_user_current_usage(user_uuid);
    
    -- Check conversion limit
    IF plan_limits.monthly_conversions > 0 AND current_usage.conversions_used >= plan_limits.monthly_conversions THEN
        RETURN QUERY SELECT false, 'Monthly conversion limit reached', 0, 0::DECIMAL;
        RETURN;
    END IF;
    
    -- Check file size limit
    IF file_size_mb > plan_limits.max_file_size_mb THEN
        RETURN QUERY SELECT false, 'File size exceeds plan limit', 0, 0::DECIMAL;
        RETURN;
    END IF;
    
    -- Check storage limit
    IF plan_limits.monthly_storage_gb > 0 AND (current_usage.storage_used_gb + file_size_mb/1024) > plan_limits.monthly_storage_gb THEN
        RETURN QUERY SELECT false, 'Monthly storage limit would be exceeded', 0, 0::DECIMAL;
        RETURN;
    END IF;
    
    -- Calculate remaining quotas
    RETURN QUERY SELECT 
        true, 
        'Conversion allowed'::TEXT,
        CASE 
            WHEN plan_limits.monthly_conversions < 0 THEN -1 
            ELSE plan_limits.monthly_conversions - current_usage.conversions_used 
        END,
        CASE 
            WHEN plan_limits.monthly_storage_gb < 0 THEN -1 
            ELSE plan_limits.monthly_storage_gb - current_usage.storage_used_gb 
        END;
END;
$$ LANGUAGE plpgsql;

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_plan_limits_updated_at BEFORE UPDATE ON plan_limits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for easy querying
CREATE VIEW user_subscription_status AS
SELECT 
    u.id,
    u.firebase_uid,
    u.email,
    u.display_name,
    u.current_plan,
    u.plan_expires_at,
    s.status as subscription_status,
    s.current_period_end,
    s.payment_provider,
    pl.monthly_conversions,
    pl.monthly_storage_gb,
    pl.batch_conversion,
    pl.priority_queue,
    pl.email_support,
    pl.team_access
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
LEFT JOIN plan_limits pl ON u.current_plan = pl.plan_type;

COMMENT ON TABLE users IS 'User accounts integrated with Firebase Auth';
COMMENT ON TABLE subscriptions IS 'Active subscriptions with payment provider details';
COMMENT ON TABLE usage_logs IS 'Conversion usage tracking for billing and quotas';
COMMENT ON TABLE plan_limits IS 'Configurable limits for each subscription plan';
COMMENT ON TABLE payment_transactions IS 'Payment transaction history';
