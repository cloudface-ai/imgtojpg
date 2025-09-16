// Example Email Configuration using Environment Variables
// This file shows the structure but should NOT contain actual credentials
// 
// Instead of using this file, set these environment variables in your deployment platform:
// 
// For Render:
// 1. Go to your service dashboard
// 2. Navigate to Environment Variables
// 3. Add these variables:
//    - EMAIL_USER: your-gmail@gmail.com
//    - EMAIL_PASS: your-app-password
//
// For local development, you can create a .env file (make sure it's in .gitignore):
// EMAIL_USER=your-gmail@gmail.com
// EMAIL_PASS=your-app-password

module.exports = {
  email: {
    user: process.env.EMAIL_USER || 'your-gmail@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
};

// Note: For Gmail, you need to use an App Password, not your regular password
// To generate an App Password:
// 1. Enable 2-Factor Authentication on your Google account
// 2. Go to Google Account settings > Security > App passwords
// 3. Generate a new app password for "Mail"
// 4. Use that password here instead of your regular Gmail password
