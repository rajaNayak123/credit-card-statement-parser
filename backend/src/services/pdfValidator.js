/**
 * PDF Content Validator
 * Quickly checks if a PDF is actually a credit card statement
 */

/**
 * Credit card statement indicators
 */
const STATEMENT_INDICATORS = {
    required: [
      // Must have at least one of these
      'credit card',
      'card account',
      'card number',
      'billing cycle',
      'statement period',
      'payment due',
      'minimum payment',
    ],
    bankNames: [
      'hdfc bank',
      'icici bank',
      'axis bank',
      'state bank',
      'sbi card',
      'kotak mahindra',
      'yes bank',
      'indusind',
      'standard chartered',
      'citibank',
      'hsbc',
      'american express',
      'rbl bank',
      'idfc first',
      'au small finance',
      'chase',
      'bank of america',
      'wells fargo',
      'capital one',
      'discover',
    ],
    positive: [
      // Bonus indicators (not required)
      'reward points',
      'cashback',
      'credit limit',
      'available credit',
      'total amount due',
      'outstanding balance',
      'transaction details',
      'account summary',
    ],
    negative: [
      // If these are present, likely NOT a credit card statement
      'invoice',
      'purchase order',
      'delivery note',
      'tax invoice',
      'pro forma',
      'quotation',
      'estimate',
    ],
  };
  
  /**
   * Extract first page or first N characters from PDF text
   */
  export const getQuickSample = (pdfText, maxChars = 1000) => {
    if (!pdfText) return '';
    
    // Get first 1000 characters for quick analysis
    const sample = pdfText.slice(0, maxChars).toLowerCase();
    return sample;
  };
  
  /**
   * Quick validation: Check if text contains credit card statement indicators
   */
  export const isLikelyCreditCardStatement = (pdfText) => {
    const sample = getQuickSample(pdfText, 2000);
    
    if (!sample || sample.length < 100) {
      console.log('   ⚠️  PDF text too short for validation');
      return {
        isStatement: false,
        confidence: 'low',
        reason: 'Insufficient text extracted',
      };
    }
    
    let score = 0;
    const matches = [];
    
    // Check for required indicators (high weight)
    const hasRequired = STATEMENT_INDICATORS.required.some(indicator => {
      if (sample.includes(indicator)) {
        matches.push(indicator);
        score += 3;
        return true;
      }
      return false;
    });
    
    if (!hasRequired) {
      console.log('   ❌ Missing required credit card indicators');
      return {
        isStatement: false,
        confidence: 'high',
        reason: 'No credit card statement keywords found',
        matches,
      };
    }
    
    // Check for bank name (high weight)
    const hasBankName = STATEMENT_INDICATORS.bankNames.some(bank => {
      if (sample.includes(bank)) {
        matches.push(bank);
        score += 2;
        return true;
      }
      return false;
    });
    
    // Check for positive indicators (medium weight)
    STATEMENT_INDICATORS.positive.forEach(indicator => {
      if (sample.includes(indicator)) {
        matches.push(indicator);
        score += 1;
      }
    });
    
    // Check for negative indicators (penalty)
    const hasNegative = STATEMENT_INDICATORS.negative.some(indicator => {
      if (sample.includes(indicator)) {
        score -= 5;
        return true;
      }
      return false;
    });
    
    // Determine confidence
    let confidence = 'low';
    let isStatement = false;
    
    if (score >= 5 && !hasNegative) {
      confidence = 'high';
      isStatement = true;
    } else if (score >= 3 && !hasNegative) {
      confidence = 'medium';
      isStatement = true;
    } else if (score >= 1) {
      confidence = 'low';
      isStatement = true;
    }
    
    console.log(`   📊 Statement validation score: ${score}`);
    console.log(`   🎯 Confidence: ${confidence}`);
    console.log(`   ✅ Matched indicators: ${matches.slice(0, 3).join(', ')}`);
    
    return {
      isStatement,
      confidence,
      score,
      matches,
      hasBankName,
    };
  };
  
  /**
   * Check if PDF contains account/card number patterns
   */
  export const hasCardNumberPattern = (pdfText) => {
    const sample = getQuickSample(pdfText, 2000);
    
    // Common card number patterns (masked)
    const patterns = [
      /\*{4,}\s?\d{4}/,           // ****1234
      /xxxx\s?\d{4}/i,             // XXXX 1234
      /\d{4}\s?\*{4,}/,            // 1234 ****
      /card\s+ending\s+\d{4}/i,    // Card ending 1234
      /ending\s+in\s+\d{4}/i,      // Ending in 1234
    ];
    
    return patterns.some(pattern => pattern.test(sample));
  };
  
  /**
   * Advanced validation: Estimate document type
   */
  export const estimateDocumentType = (pdfText) => {
    const sample = getQuickSample(pdfText, 3000);
    
    const documentTypes = {
      creditCardStatement: 0,
      invoice: 0,
      receipt: 0,
      bankStatement: 0,
      other: 0,
    };
    
    // Credit card statement indicators
    if (sample.includes('credit card') || sample.includes('card account')) {
      documentTypes.creditCardStatement += 3;
    }
    if (sample.includes('reward points') || sample.includes('cashback')) {
      documentTypes.creditCardStatement += 2;
    }
    if (sample.includes('minimum payment') || sample.includes('payment due')) {
      documentTypes.creditCardStatement += 2;
    }
    
    // Invoice indicators
    if (sample.includes('invoice') || sample.includes('tax invoice')) {
      documentTypes.invoice += 3;
    }
    if (sample.includes('gst') || sample.includes('vat')) {
      documentTypes.invoice += 1;
    }
    
    // Receipt indicators
    if (sample.includes('receipt') || sample.includes('purchase receipt')) {
      documentTypes.receipt += 2;
    }
    
    // Bank statement indicators (not credit card)
    if (sample.includes('savings account') || sample.includes('current account')) {
      documentTypes.bankStatement += 2;
    }
    
    // Find highest score
    const maxType = Object.entries(documentTypes).reduce((max, [type, score]) => 
      score > max.score ? { type, score } : max,
      { type: 'other', score: 0 }
    );
    
    return {
      type: maxType.type,
      confidence: maxType.score >= 3 ? 'high' : maxType.score >= 2 ? 'medium' : 'low',
      scores: documentTypes,
    };
  };