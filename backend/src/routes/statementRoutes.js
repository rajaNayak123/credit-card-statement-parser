import express from 'express';
import { upload } from '../middleware/upload.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  uploadStatement,
  getAllStatements,
  getStatementById,
  deleteStatement,
} from '../controllers/statementController.js';

const router = express.Router();

// Protected routes
router.post(
  '/upload',
  requireAuth,
  upload.single('statement'),
  uploadStatement
);

router.get('/', requireAuth, getAllStatements);
router.get('/:id', requireAuth, getStatementById);
router.delete('/:id', requireAuth, deleteStatement);

export default router;
