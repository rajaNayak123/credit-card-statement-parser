import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import statementRoutes from './routes/statementRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Call connectDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/statements', statementRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 8000

app.listen(PORT, ()=>{
    console.log(`Server running on port ${PORT}`);
})