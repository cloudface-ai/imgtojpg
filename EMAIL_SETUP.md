# Email Setup for Contact Form

This document explains how to set up the email functionality for the contact form so that emails are sent directly to nerdykeeda@gmail.com without opening an external email client.

## Prerequisites

1. A Gmail account
2. 2-Factor Authentication enabled on your Google account
3. Node.js and npm installed

## Setup Steps

### 1. Generate Gmail App Password

1. Go to your [Google Account settings](https://myaccount.google.com/)
2. Navigate to **Security**
3. Under "Signing in to Google", find **2-Step Verification** and make sure it's enabled
4. Go to **App passwords** (under 2-Step Verification)
5. Select **Mail** as the app and **Other** as the device
6. Click **Generate**
7. Copy the 16-character password that appears

### 2. Configure Email Settings

**For Production Deployment (Render):**

1. Go to your Render service dashboard
2. Navigate to **Environment Variables**
3. Add these variables:
   - `EMAIL_USER`: your-actual-gmail@gmail.com
   - `EMAIL_PASS`: your-16-char-app-password

**For Local Development:**

1. Create a `.env` file in your project root (make sure it's in `.gitignore`)
2. Add these variables:
   ```
   EMAIL_USER=your-actual-gmail@gmail.com
   EMAIL_PASS=your-16-char-app-password
   ```

**Note:** The server now uses environment variables instead of a config file for better security and deployment compatibility.

### 3. Test the Setup

1. Start your server: `npm start`
2. Go to `/contact.html` in your browser
3. Fill out the contact form and submit
4. Check your email (nerdykeeda@gmail.com) for the message
5. Check the server console for success/error messages

## Security Notes

- **Never commit your actual email credentials to version control**
- The `email-config.js` file should be added to `.gitignore`
- App passwords are more secure than using your regular Gmail password
- Each app password is unique and can be revoked individually

## Environment Variables

The application now uses environment variables for email configuration, which is more secure and deployment-friendly:

### Required Variables

- `EMAIL_USER`: Your Gmail address
- `EMAIL_PASS`: Your Gmail app password

### Benefits of Environment Variables

1. **Security**: Credentials are not stored in code files
2. **Deployment**: Easy to configure in different environments
3. **Team Development**: Each developer can use their own credentials
4. **CI/CD**: Can be set in deployment pipelines

### Setting Environment Variables

**Render:**
- Service Dashboard → Environment Variables → Add Variable

**Local Development:**
- Create `.env` file (ensure it's in `.gitignore`)
- Use a package like `dotenv` to load them

## Troubleshooting

### Common Issues

1. **"Invalid login" error**: Make sure you're using an App Password, not your regular Gmail password
2. **"Less secure app access" error**: Enable 2-Factor Authentication and use App Passwords
3. **"Authentication failed"**: Double-check your email and app password
4. **"Network error"**: Check your internet connection and server status

### Alternative Email Services

If you prefer not to use Gmail, you can modify the transporter configuration in `server.js`:

```javascript
// For Outlook/Hotmail
const transporter = nodemailer.createTransport({
  service: 'outlook',
  auth: {
    user: 'your-email@outlook.com',
    pass: 'your-password'
  }
});

// For custom SMTP server
const transporter = nodemailer.createTransport({
  host: 'your-smtp-server.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@domain.com',
    pass: 'your-password'
  }
});
```

## File Structure

```
heic-to-jpg/
├── server.js              # Main server with email endpoint (uses environment variables)
├── email-config.example.js # Example configuration (for reference only)
├── .env                   # Local environment variables (not committed to git)
├── public/
│   └── contact.html      # Contact form (already updated)
└── package.json           # Dependencies (nodemailer added)
```

## API Endpoint

The contact form now sends POST requests to `/api/contact` with the following data:

```json
{
  "name": "User's Name",
  "email": "user@example.com",
  "subject": "Subject Line",
  "message": "Message content"
}
```

The server will send an email to nerdykeeda@gmail.com with this information formatted nicely in both HTML and plain text.
