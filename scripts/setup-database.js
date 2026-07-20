#!/usr/bin/env node
// Database setup script for ImgToJPG subscription system
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Database = require('../config/database');

async function setupDatabase() {
  console.log('🚀 Setting up ImgToJPG subscription database...');
  
  try {
    // Test database connection
    console.log('📡 Testing database connection...');
    const healthCheck = await Database.healthCheck();
    
    if (healthCheck.status === 'healthy') {
      console.log('✅ Database connection successful');
      console.log(`📊 PostgreSQL version: ${healthCheck.version.split(' ')[0]}`);
    } else {
      throw new Error(`Database health check failed: ${healthCheck.error}`);
    }

    // Read and execute schema
    console.log('📋 Reading database schema...');
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('⚡ Executing database schema...');
    await Database.query(schema);
    
    console.log('✅ Database schema created successfully');

    // Verify tables were created
    console.log('🔍 Verifying table creation...');
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    const result = await Database.query(tablesQuery);
    const tables = result.rows.map(row => row.table_name);
    
    const expectedTables = [
      'users', 
      'subscriptions', 
      'usage_logs', 
      'plan_limits', 
      'payment_transactions'
    ];
    
    const missingTables = expectedTables.filter(table => !tables.includes(table));
    
    if (missingTables.length > 0) {
      throw new Error(`Missing tables: ${missingTables.join(', ')}`);
    }
    
    console.log('✅ All required tables created:');
    tables.forEach(table => console.log(`   📋 ${table}`));

    // Verify functions were created
    console.log('🔍 Verifying functions...');
    const functionsQuery = `
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_type = 'FUNCTION'
      ORDER BY routine_name
    `;
    
    const functionsResult = await Database.query(functionsQuery);
    const functions = functionsResult.rows.map(row => row.routine_name);
    
    const expectedFunctions = [
      'get_user_current_usage',
      'can_user_convert',
      'update_updated_at_column'
    ];
    
    const missingFunctions = expectedFunctions.filter(func => !functions.includes(func));
    
    if (missingFunctions.length > 0) {
      console.log('⚠️ Some functions may not have been created:', missingFunctions);
    } else {
      console.log('✅ All database functions created');
    }

    // Check plan limits data
    console.log('📊 Checking plan limits...');
    const plansResult = await Database.getAllPlans();
    
    if (plansResult.length === 0) {
      throw new Error('No plan limits found - schema insertion may have failed');
    }
    
    console.log('✅ Plan limits configured:');
    plansResult.forEach(plan => {
      const conversions = plan.monthly_conversions === -1 ? 'Unlimited' : plan.monthly_conversions;
      const storage = plan.monthly_storage_gb === -1 ? 'Unlimited' : `${plan.monthly_storage_gb}GB`;
      console.log(`   💳 ${plan.plan_type.toUpperCase()}: ${conversions} conversions, ${storage} storage, $${plan.price_usd}/month`);
    });

    // Create admin user if ADMIN_EMAIL is set
    if (process.env.ADMIN_EMAIL) {
      console.log('👤 Creating admin user...');
      try {
        const adminUser = await Database.createUser(
          'admin-' + Date.now(),
          process.env.ADMIN_EMAIL,
          'Admin User'
        );
        
        // Update admin metadata
        await Database.query(
          'UPDATE users SET metadata = $1 WHERE id = $2',
          [JSON.stringify({ isAdmin: true }), adminUser.id]
        );
        
        console.log('✅ Admin user created:', process.env.ADMIN_EMAIL);
      } catch (error) {
        if (error.message.includes('duplicate key')) {
          console.log('ℹ️ Admin user already exists');
        } else {
          console.log('⚠️ Failed to create admin user:', error.message);
        }
      }
    }

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Configure your environment variables in .env');
    console.log('2. Set up Firebase Auth project');
    console.log('3. Configure Stripe and Razorpay accounts');
    console.log('4. Run: npm run db:seed (optional - for test data)');
    console.log('5. Start the server: npm start');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Ensure PostgreSQL is running');
    console.error('2. Check database credentials in .env');
    console.error('3. Verify database exists and user has permissions');
    console.error('4. Check network connectivity to database');
    
    process.exit(1);
  } finally {
    await Database.close();
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;
