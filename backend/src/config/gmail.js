import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = path.join(process.cwd(), 'src', 'config', 'gmail-token.json');

/**
 * Create OAuth2 client
 */
export const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

/**
 * Generate authentication URL
 */
export const getAuthUrl = () => {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force to get refresh token
  });
};

/**
 * Get tokens from authorization code
 */
export const getTokensFromCode = async (code) => {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  await saveToken(tokens);
  return tokens;
};

/**
 * Save token to file
 */
export const saveToken = async (token) => {
  const dir = path.dirname(TOKEN_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(TOKEN_PATH, JSON.stringify(token, null, 2));
};

/**
 * Load token from file
 */
export const loadToken = async () => {
  try {
    const content = await fs.readFile(TOKEN_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
};

/**
 * Get authenticated Gmail client
 */
export const getGmailClient = async () => {
  const oauth2Client = getOAuth2Client();
  const token = await loadToken();
  
  if (!token) {
    throw new Error('No token found. Please authorize first.');
  }
  
  oauth2Client.setCredentials(token);
  
  // Refresh token if expired
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.refresh_token) {
      await saveToken(tokens);
    }
  });
  
  return google.gmail({ version: 'v1', auth: oauth2Client });
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async () => {
  const token = await loadToken();
  return token !== null;
};

/**
 * Revoke token (logout)
 */
export const revokeToken = async () => {
  try {
    const token = await loadToken();
    if (token) {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials(token);
      await oauth2Client.revokeToken(token.access_token);
      await fs.unlink(TOKEN_PATH);
    }
  } catch (error) {
    console.error('Error revoking token:', error);
  }
};