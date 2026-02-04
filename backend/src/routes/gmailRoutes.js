import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  getGmailAuthUrl,
  handleOAuthCallback,
  checkAuthStatus,
  disconnectGmail,
  fetchStatementsFromGmail,
  getBankDomains,
} from '../controllers/gmailController.js';

const router = express.Router();

// OAuth routes (no auth required for OAuth flow)
router.get('/auth/url', getGmailAuthUrl);
router.get('/oauth/callback', handleOAuthCallback);
router.get('/auth/status', checkAuthStatus);

// Protected routes (require authentication)
router.post('/auth/disconnect', requireAuth, disconnectGmail);
router.post('/fetch', requireAuth, fetchStatementsFromGmail);

// Utility routes
router.get('/bank-domains', getBankDomains);

export default router;