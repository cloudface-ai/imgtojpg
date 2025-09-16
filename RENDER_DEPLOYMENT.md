# Render Deployment Guide

This guide explains how to deploy your heic-to-jpg application on Render and fix the email configuration issue.

## Prerequisites

1. A Render account
2. Your application code pushed to a Git repository (GitHub, GitLab, etc.)
3. Gmail account with 2-Factor Authentication enabled

## Performance Features

This deployment includes **JavaScript minification** for optimal performance:

- **44% smaller JavaScript files** (123KB → 69.4KB)
- **Faster page loading** and better SEO scores
- **Improved Core Web Vitals** (LCP, FID, CLS)
- **Better mobile performance** and user experience
- **Automatic minification** during Render builds

## Deployment Steps

### 1. Connect Your Repository

1. Log in to [Render](https://render.com)
2. Click "New +" and select "Web Service"
3. Connect your Git repository
4. Choose the repository containing your heic-to-jpg project

### 2. Configure the Service

- **Name**: `heic-to-jpg` (or your preferred name)
- **Environment**: `Node`
- **Build Command**: 
  ```bash
  # Install system dependencies via buildpacks
  apt-get update && apt-get install -y \
    imagemagick \
    libraw-bin \
    libvips-dev \
    libvips-tools \
    && rm -rf /var/lib/apt/lists/*
  
  # Install Node.js dependencies
  npm ci --only=production
  
  # Build CSS and JavaScript for production
  npm run build:css:prod
  npm run build:js:individual
  ```
- **Start Command**: `npm start`

### 3. Set Environment Variables

**This is the crucial step to fix the deployment error!**

1. In your service dashboard, go to **Environment Variables**
2. Add these variables:

   | Key | Value | Description |
   |-----|--------|-------------|
   | `EMAIL_USER` | `your-gmail@gmail.com` | Your Gmail address |
   | `EMAIL_PASS` | `your-app-password` | Your Gmail app password |
   | `NODE_ENV` | `production` | Set to production mode |

### 4. Generate Gmail App Password

If you haven't already:

1. Go to [Google Account settings](https://myaccount.google.com/)
2. Navigate to **Security**
3. Under "Signing in to Google", find **2-Step Verification** and enable it
4. Go to **App passwords** (under 2-Step Verification)
5. Select **Mail** as the app and **Other** as the device
6. Click **Generate**
7. Copy the 16-character password
8. Use this password as the value for `EMAIL_PASS`

### 5. Deploy

1. Click **Create Web Service**
2. Render will automatically build and deploy your application
3. The build should now succeed without the "Cannot find module './email-config'" error

## Troubleshooting

### Build Fails with "Cannot find module './email-config'"

**Cause**: The email-config.js file is in .gitignore and not available during deployment.

**Solution**: Set the `EMAIL_USER` and `EMAIL_PASS` environment variables in Render.

### Email Not Working

**Check**:
1. Environment variables are set correctly
2. Gmail app password is valid
3. 2-Factor Authentication is enabled on your Google account

### Contact Form Returns 503 Error

**Cause**: Email credentials are not configured.

**Solution**: Verify that both `EMAIL_USER` and `EMAIL_PASS` environment variables are set in Render.

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `EMAIL_USER` | Yes | Your Gmail address |
| `EMAIL_PASS` | Yes | Your Gmail app password |
| `NODE_ENV` | No | Set to 'production' for production deployments |
| `PORT` | No | Port number (Render sets this automatically) |

## Security Notes

- **Never commit email credentials to your repository**
- Use environment variables for sensitive information
- Gmail app passwords are more secure than regular passwords
- Each app password can be revoked individually if compromised

## Support

If you continue to have issues:

1. Check the build logs in Render dashboard
2. Verify all environment variables are set correctly
3. Ensure your Gmail account has 2-Factor Authentication enabled
4. Test with a fresh Gmail app password
