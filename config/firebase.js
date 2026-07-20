// Firebase configuration for authentication
const admin = require('firebase-admin');

// Firebase Admin SDK configuration
const path = require('path');
const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');

let firebaseConfig;
try {
  // Try to load service account file first
  firebaseConfig = require(serviceAccountPath);
  console.log('🔥 Loaded Firebase service account from file');
} catch (error) {
  // Fallback to environment variables
  firebaseConfig = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID || "imgtojpg-demo",
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "demo-key-id",
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || "-----BEGIN PRIVATE KEY-----\nDEMO_KEY\n-----END PRIVATE KEY-----\n",
    client_email: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-demo@imgtojpg-demo.iam.gserviceaccount.com",
    client_id: process.env.FIREBASE_CLIENT_ID || "demo-client-id",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-demo%40imgtojpg-demo.iam.gserviceaccount.com"
  };
  console.log('🔥 Using Firebase config from environment variables');
}

// Initialize Firebase Admin
let firebaseApp;
try {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
    // Use actual Firebase credentials
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(firebaseConfig),
      projectId: firebaseConfig.project_id
    });
    console.log('🔥 Firebase Admin initialized with real credentials');
  } else {
    // Development: Initialize with demo configuration
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(firebaseConfig),
      projectId: firebaseConfig.project_id
    });
    console.log('🔥 Firebase Admin initialized for development (demo mode)');
  }
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  // If initialization fails, create a minimal mock app
  if (!admin.apps.length) {
    try {
      firebaseApp = admin.initializeApp({
        projectId: 'demo-project'
      });
      console.log('🔥 Firebase Admin initialized with minimal config');
    } catch (fallbackError) {
      console.error('❌ Firebase fallback initialization failed:', fallbackError);
    }
  }
}

// Firebase Auth helper functions
class FirebaseAuth {
  
  // Verify ID token from client
  static async verifyToken(idToken) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      return {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.display_name,
        email_verified: decodedToken.email_verified,
        provider: decodedToken.firebase?.sign_in_provider
      };
    } catch (error) {
      console.error('❌ Token verification error:', error);
      throw new Error('Invalid authentication token');
    }
  }

  // Get user by UID
  static async getUser(uid) {
    try {
      const userRecord = await admin.auth().getUser(uid);
      return {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        emailVerified: userRecord.emailVerified,
        disabled: userRecord.disabled,
        creationTime: userRecord.metadata.creationTime,
        lastSignInTime: userRecord.metadata.lastSignInTime
      };
    } catch (error) {
      console.error('❌ Get user error:', error);
      throw new Error('User not found');
    }
  }

  // Create custom token (for server-side auth)
  static async createCustomToken(uid, additionalClaims = {}) {
    try {
      if (process.env.NODE_ENV !== 'production') {
        // Demo mode - return mock token
        return 'demo-custom-token-' + uid;
      }
      
      return await admin.auth().createCustomToken(uid, additionalClaims);
    } catch (error) {
      console.error('❌ Custom token creation error:', error);
      throw new Error('Failed to create custom token');
    }
  }

  // Update user claims (for role-based access)
  static async setCustomClaims(uid, claims) {
    try {
      if (process.env.NODE_ENV !== 'production') {
        // Demo mode - just log
        console.log('🔥 Demo: Setting custom claims for', uid, claims);
        return;
      }
      
      await admin.auth().setCustomUserClaims(uid, claims);
    } catch (error) {
      console.error('❌ Set custom claims error:', error);
      throw new Error('Failed to set custom claims');
    }
  }

  // Delete user
  static async deleteUser(uid) {
    try {
      if (process.env.NODE_ENV !== 'production') {
        // Demo mode - just log
        console.log('🔥 Demo: Deleting user', uid);
        return;
      }
      
      await admin.auth().deleteUser(uid);
    } catch (error) {
      console.error('❌ Delete user error:', error);
      throw new Error('Failed to delete user');
    }
  }

  // List users (for admin)
  static async listUsers(maxResults = 100, nextPageToken = undefined) {
    try {
      if (process.env.NODE_ENV !== 'production') {
        // Demo mode - return mock users
        return {
          users: [
            {
              uid: 'demo-user-1',
              email: 'demo1@example.com',
              displayName: 'Demo User 1',
              emailVerified: true,
              disabled: false
            },
            {
              uid: 'demo-user-2',
              email: 'demo2@example.com',
              displayName: 'Demo User 2',
              emailVerified: true,
              disabled: false
            }
          ],
          pageToken: undefined
        };
      }
      
      const listUsersResult = await admin.auth().listUsers(maxResults, nextPageToken);
      return {
        users: listUsersResult.users.map(userRecord => ({
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
          emailVerified: userRecord.emailVerified,
          disabled: userRecord.disabled,
          creationTime: userRecord.metadata.creationTime,
          lastSignInTime: userRecord.metadata.lastSignInTime
        })),
        pageToken: listUsersResult.pageToken
      };
    } catch (error) {
      console.error('❌ List users error:', error);
      throw new Error('Failed to list users');
    }
  }

  // Send password reset email
  static async sendPasswordResetEmail(email) {
    try {
      if (process.env.NODE_ENV !== 'production') {
        // Demo mode - just log
        console.log('🔥 Demo: Sending password reset email to', email);
        return;
      }
      
      // Note: This requires Firebase Auth REST API call since Admin SDK doesn't have this method
      // For now, we'll handle this on the client side
      throw new Error('Password reset should be handled on the client side');
    } catch (error) {
      console.error('❌ Send password reset error:', error);
      throw error;
    }
  }

  // Revoke refresh tokens (force re-authentication)
  static async revokeRefreshTokens(uid) {
    try {
      if (process.env.NODE_ENV !== 'production') {
        // Demo mode - just log
        console.log('🔥 Demo: Revoking refresh tokens for', uid);
        return;
      }
      
      await admin.auth().revokeRefreshTokens(uid);
    } catch (error) {
      console.error('❌ Revoke tokens error:', error);
      throw new Error('Failed to revoke refresh tokens');
    }
  }
}

// Client-side Firebase configuration (for frontend)
const clientConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBpXcQ5SEyuuvKcq_7iWbSXIB06aH3nOyo",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${process.env.FIREBASE_PROJECT_ID || 'imgtojpg'}.firebaseapp.com`,
  projectId: process.env.FIREBASE_PROJECT_ID || "imgtojpg",
  storageBucket: `${process.env.FIREBASE_PROJECT_ID || 'imgtojpg'}.firebasestorage.app`,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "1047494776765",
  appId: process.env.FIREBASE_APP_ID || "1:1047494776765:web:0145873f41104e5cc164d4",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-2P190S3BCE"
};

module.exports = {
  admin,
  FirebaseAuth,
  clientConfig,
  firebaseApp
};
