import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db.js';
import statementRoutes from './routes/statementRoutes.js';
import gmailRoutes from './routes/gmailRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Connect to MongoDB
await connectDB();

// CORS Configuration for frontend
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
    credentials: true, // Important: allows cookies to be sent
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Origin', 'Accept'],
    exposedHeaders: ['Set-Cookie']
  })
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Important: parse cookies

// Routes
app.use('/api/auth', authRoutes);
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

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});