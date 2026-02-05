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
  // Gmail integration fields
  source: {
    type: String,
    enum: ['manual', 'gmail'],
    default: 'manual',
  },
  metadata: {
    // Gmail message info
    gmailMessageId: {
      type: String,
      index: true,
    },
    gmailSubject: String,
    gmailFrom: String,
    gmailDate: String,
    
    // Decision flow info
    senderDomain: String,
    decisionCase: {
      type: String,
      enum: ['Case 1', 'Case 2', 'Case 3'],
    },
    decisionReason: String,
    
    // Validation info
    validationConfidence: String,
    validationScore: Number,
  },
});

// Compound index for faster duplicate checking
statementSchema.index({ userId: 1, 'metadata.gmailMessageId': 1 });

// Index for querying by decision case
statementSchema.index({ 'metadata.decisionCase': 1 });

export default mongoose.model('Statement', statementSchema);