# ImgToJPG Subscription System Setup Guide

## 🚀 Complete Subscription System Ready!

Your subscription system is fully built and ready for deployment. Here's how to set it up:

---

## 📋 What's Been Built

### ✅ **Database System**
- PostgreSQL schema with 5 tables (users, subscriptions, usage_logs, plan_limits, payment_transactions)
- Smart quota checking functions
- Usage tracking and billing period management
- Admin analytics and reporting

### ✅ **Authentication System**
- Firebase Auth integration (Google + Email/Password)
- User management and session handling
- Optional authentication for free users
- Admin role support

### ✅ **Payment Integration**
- **Stripe** for international payments
- **Razorpay** for Indian customers
- Unified payment service with automatic provider selection
- Webhook handling for subscription lifecycle

### ✅ **User Interface**
- **Minimalist pricing page** (`/pricing.html`) - Matches your app's clean style
- **User dashboard** (`/dashboard.html`) - Usage tracking, billing management
- **Legal pages** - Terms of Service and Privacy Policy

### ✅ **Subscription Middleware**
- Quota checking before conversions
- Usage logging after successful conversions
- Plan-based rate limiting
- Automatic free/paid user handling

---

## 🛠️ Setup Steps

### 1. **Install Dependencies**
```bash
npm install
```

### 2. **Set Up AWS RDS PostgreSQL Database**

#### Create RDS Instance:
```bash
# Create PostgreSQL instance in AWS RDS
# - Engine: PostgreSQL 15+
# - Instance: db.t3.micro (for testing) or db.t3.small (production)
# - Storage: 20GB minimum
# - Region: eu-north-1 (same as your ECS)
# - VPC: Same as your ECS cluster
# - Security Group: Allow port 5432 from ECS security group
```

#### Initialize Database:
```bash
# Once RDS is ready, run:
npm run db:setup
```

### 3. **Configure Firebase Auth**

#### Create Firebase Project:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project: "imgtojpg-prod"
3. Enable Authentication → Sign-in methods:
   - ✅ Email/Password
   - ✅ Google
4. Add your domain: `imgtojpg.org` to authorized domains
5. Generate service account key:
   - Project Settings → Service Accounts → Generate new private key

### 4. **Configure Stripe**

#### Create Stripe Account:
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Get your keys from API section:
   - Publishable key: `pk_test_...` or `pk_live_...`
   - Secret key: `sk_test_...` or `sk_live_...`
3. Create Products and Prices:
   - Basic: $3/month
   - Pro: $9/month  
   - Team: $29/month
4. Set up webhook endpoint: `https://imgtojpg.org/api/payments/webhooks/stripe`

### 5. **Configure Environment Variables**

Copy `example.env.subscription` to `.env` and fill in:

```bash
# Database (your RDS details)
DB_HOST=your-rds-endpoint.eu-north-1.rds.amazonaws.com
DB_NAME=imgtojpg
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Firebase (from your project)
FIREBASE_PROJECT_ID=imgtojpg-prod
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_key_here\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@imgtojpg-prod.iam.gserviceaccount.com
FIREBASE_API_KEY=your_web_api_key

# Stripe (from your dashboard)
STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key
STRIPE_SECRET_KEY=sk_live_your_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRICE_BASIC_MONTHLY=price_your_basic_price_id
STRIPE_PRICE_PRO_MONTHLY=price_your_pro_price_id
STRIPE_PRICE_TEAM_MONTHLY=price_your_team_price_id

# Razorpay (your existing account)
RAZORPAY_KEY_ID=rzp_live_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret

# AWS SES (for support emails)
SES_FROM_EMAIL=support@imgtojpg.org

# Business info
BUSINESS_NAME=ImgToJPG
BUSINESS_EMAIL=support@imgtojpg.org
ADMIN_EMAIL=your_admin@email.com
```

---

## 🚀 Deployment

### Update Dockerfile:
The system is ready to deploy with your existing Docker setup. The new dependencies are already added to `package.json`.

### Deploy to AWS ECS:
```bash
# Build with subscription system
docker build --platform linux/amd64 -t imgtojpg:subscription .
docker tag imgtojpg:subscription 048270140359.dkr.ecr.eu-north-1.amazonaws.com/imgtojpg:subscription
docker push 048270140359.dkr.ecr.eu-north-1.amazonaws.com/imgtojpg:subscription

# Deploy to ECS (add environment variables to task definition)
aws ecs register-task-definition --family imgtojpg-task --task-definition-file task-definition-subscription.json
aws ecs update-service --cluster imgtojpg-cluster --service imgtojpg-service --task-definition imgtojpg-task:25
```

---

## 📊 How It Works

### **For Free Users (Anonymous):**
1. Visit site → Use converter → IP-based quota tracking
2. 5 conversions/week, 2GB storage limit
3. Prompted to sign up when limits reached

### **For Paid Users:**
1. Visit `/pricing.html` → Choose plan → Sign in with Firebase
2. Payment via Stripe (international) or Razorpay (India)
3. Webhook updates database → User gets higher limits
4. Dashboard shows usage, billing, plan management

### **Conversion Flow:**
```
Upload → Auth Check → Quota Check → Convert → Log Usage → Download
```

### **Admin Features:**
- View all subscriptions and payments
- Process refunds
- User analytics and statistics
- Usage monitoring

---

## 🔧 Testing

### Test the System:
1. **Free tier**: Try converting 6 files (should block after 5)
2. **Sign up**: Create account via `/pricing.html`
3. **Subscribe**: Test payment flow (use Stripe test cards)
4. **Dashboard**: Check usage tracking at `/dashboard.html`
5. **Admin**: Test admin endpoints with your admin email

---

## 📈 What's Next

### Phase 4 (Optional Enhancements):
- **Email notifications** (welcome, billing, limits)
- **Advanced analytics** (conversion trends, popular formats)
- **Team management** (multi-user accounts)
- **API access** (for enterprise customers)
- **White-label options** (custom branding)

---

## 🎯 Key Features

✅ **Smart Payment Routing**: India → Razorpay, Others → Stripe  
✅ **Automatic Quota Management**: Free/Basic/Pro/Team limits  
✅ **Real Usage Tracking**: Actual conversions and file sizes  
✅ **Professional Dashboard**: Clean, minimalist design  
✅ **Secure Architecture**: Firebase Auth + PostgreSQL + AWS  
✅ **International Ready**: Multi-currency, global payment support  
✅ **Admin Tools**: Complete subscription management  

**Your image conversion app is now a full SaaS platform! 🎉**

---

## 📞 Support

If you need help with setup:
1. Database issues → Check RDS security groups and connection strings
2. Firebase issues → Verify service account permissions
3. Payment issues → Check webhook endpoints and API keys
4. General issues → Check CloudWatch logs for detailed errors

**Ready to launch your subscription-based image conversion service! 🚀**
