import mongoose from 'mongoose';

const statementSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
  },
  uploadDate: {
    type: Date,
    default: Date.now,
  },
  bankName: {
    type: String,
    default: 'Unknown',
  },
  statementPeriod: {
    type: String,
  },
  rewardPoints: {
    opening: {
      type: Number,
      default: 0,
    },
    earned: {
      type: Number,
      default: 0,
    },
    redeemed: {
      type: Number,
      default: 0,
    },
    closing: {
      type: Number,
      default: 0,
    },
    breakdown: [{
      category: String,
      points: Number,
    }],
  },
  rawExtractedText: {
    type: String,
  },
  aiResponse: {
    type: Object,
  },
  processingStatus: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing',
  },
  errorMessage: {
    type: String,
  },
});

export default mongoose.model('Statement', statementSchema);