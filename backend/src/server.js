import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import statementRoutes from './routes/statementRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createAuth } from './config/auth.js';
import { toNodeHandler } from 'better-auth/node';

const app = express();

// Call connectDB and wait for connection before initializing auth
await connectDB();

// Initialize auth after database connection is established
const auth = createAuth();

// Middleware
app.use(
    cors({
      origin: "http://localhost:3000", // frontend URL
      credentials: true,               // allow cookies
    })
  );
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
// Better Auth handler - wrap with toNodeHandler for Express compatibility
// app.use will match /api/auth and all sub-routes like /api/auth/sign-up/email
app.use('/api/auth', async (req, res, next) => {
  try {
    await toNodeHandler(auth)(req, res, next);
  } catch (error) {
    console.error('Better Auth handler error:', error);
    next(error);
  }
});
app.use('/api/statements', statementRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 8000

app.listen(PORT, ()=>{
    console.log(`Server running on port ${PORT}`);
})