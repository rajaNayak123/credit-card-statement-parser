import express from 'express';
import { upload } from '../middleware/upload.js';
import {
  uploadStatement,
  getAllStatements,
  getStatementById,
  deleteStatement,
} from '../controllers/statementController.js';

const router = express.Router();

router.post('/upload', upload.single('statement'), uploadStatement);
router.get('/', getAllStatements);
router.get('/:id', getStatementById);
router.delete('/:id', deleteStatement);

export default router;
