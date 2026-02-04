import mongoose from 'mongoose';

const statementSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
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
      default: null,
    },
    earned: {
      type: Number,
      default: null,
    },
    redeemed: {
      type: Number,
      default: null,
    },
    adjustedLapsed: {
      type: Number,
      default: null,
    },
    closing: {
      type: Number,
      default: null,
    },
    breakdown: {
      type: Array,
      default: null
    }
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
  // NEW FIELDS FOR GMAIL INTEGRATION
  source: {
    type: String,
    enum: ['manual', 'gmail'],
    default: 'manual',
  },
  metadata: {
    gmailMessageId: {
      type: String,
      index: true,
    },
    gmailSubject: String,
    gmailFrom: String,
    gmailDate: String,
  },
});

// Compound index for faster duplicate checking
statementSchema.index({ userId: 1, 'metadata.gmailMessageId': 1 });

export default mongoose.model('Statement', statementSchema);