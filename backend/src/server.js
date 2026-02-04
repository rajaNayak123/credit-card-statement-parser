import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import statementRoutes from './routes/statementRoutes.js';
import gmailRoutes from './routes/gmailRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createAuth } from './config/auth.js';
import { toNodeHandler } from 'better-auth/node';

const app = express();

// Call connectDB and wait for connection before initializing auth
await connectDB();

// Initialize auth after database connection is established
const auth = createAuth();

// IMPROVED CORS Configuration for Postman Testing
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like Postman, mobile apps, curl)
      if (!origin) return callback(null, true);
      
      // Allow specific origins
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:8000',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8000'
      ];
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // For testing, allow all origins
        // In production, use: callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Origin', 'Accept'],
    exposedHeaders: ['Set-Cookie']
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
// Better Auth handler - wrap with toNodeHandler for Express compatibility
app.use('/api/auth', async (req, res, next) => {
  try {
    await toNodeHandler(auth)(req, res, next);
  } catch (error) {
    console.error('Better Auth handler error:', error);
    next(error);
  }
});

app.use('/api/statements', statementRoutes);
app.use('/api/gmail', gmailRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Gmail OAuth callback: http://localhost:${PORT}/api/gmail/oauth/callback`);
});