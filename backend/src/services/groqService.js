import { getGroqModel } from '../config/groq.js';

/**
 * Pre-process raw PDF text to reassemble fragments that get split
 * by PDF layout extraction.
 *
 * pdf.js-extract outputs the Axis Bank eDGE block as ONE line with spaces:
 *   "eDGE REWARD POINTS   BALANCE AS ON DATE   CUSTOMER ID 498659   30-03-2025   849227095"
 *
 * The three values on that line are, IN ORDER:
 *   1. eDGE Reward Points balance  (498659)
 *   2. Balance-as-on date          (30-03-2025)
 *   3. Customer ID                 (849227095)
 *
 * This helper rewrites that line so the points value is clearly labelled
 * and Groq cannot confuse it with the Customer ID.
 */
const preprocessPdfText = (text) => {
  let processed = text;

  // Matches both the space-separated format (what pdf.js-extract actually produces)
  // and the newline-separated format (what some other extractors produce).
  // Capture groups: $1 = points, $2 = date, $3 = customer ID
  processed = processed.replace(
    /eDGE\s+REWARD\s+POINTS\s+BALANCE\s+AS\s+ON\s+DATE\s+CUSTOMER\s+ID\s+(\d[\d,]*)\s+([\d\/-]+)\s+(\d+)/i,
    'eDGE REWARD POINTS BALANCE: $1 | BALANCE AS ON DATE: $2 | CUSTOMER ID: $3'
  );

  return processed;
};

/**
 * Extract reward points using Groq AI (Llama 3)
 * Enhanced to handle OCR-extracted text with potential errors
 */
export const extractRewardPoints = async (pdfText, metadata = {}) => {
  try {
    const groq = getGroqModel();
    
    // Build additional context based on metadata
    let additionalContext = '';
    
    if (metadata.isScanned) {
      additionalContext += `\nNOTE: This is a scanned PDF processed with OCR.`;
      
      if (metadata.ocrConfidence) {
        additionalContext += `\nOCR Confidence: ${metadata.ocrConfidence.toFixed(2)}%`;
      }
      
      if (metadata.ocrValidation?.warning) {
        additionalContext += `\nOCR Warning: ${metadata.ocrValidation.warning}`;
        additionalContext += `\nThe text may contain OCR errors. Please be flexible in pattern matching.`;
      }
    }

    // Reassemble fragments that get broken by PDF layout extraction
    const cleanedPdfText = preprocessPdfText(pdfText);

    // Log so you can verify the reassembly worked during dev
    if (cleanedPdfText !== pdfText) {
      console.log('🔧 preprocessPdfText: reassembled fragmented text blocks');
      // Log the exact line that was rewritten — useful for debugging
      const match = cleanedPdfText.match(/eDGE REWARD POINTS BALANCE: .+/i);
      if (match) console.log('   →', match[0]);
    }
    
    const prompt = `
You are an expert at analyzing credit card statements and extracting reward points information.

Analyze the following credit card statement text and extract ALL reward points information.

IMPORTANT INSTRUCTIONS:
1. Look for reward points, loyalty points, cashback points, or any similar terminology.
   Indian banks use names like "eDGE REWARD POINTS" (Axis Bank), "JetPrivilege Points" (ICICI),
   "Bpoints" (BOB), "RPay Points", etc.
2. Extract opening balance, earned points, redeemed points, and closing balance.
   - If only a single "balance" or "points balance" figure is present with no earned/redeemed
     breakdown, treat it as the CLOSING balance.
3. Identify reward points ONLY if they are EXPLICITLY mentioned in the statement text.
   - DO NOT calculate or infer reward points from transaction amounts.
   - DO NOT assume earn rates.
   - DO NOT create category-wise reward breakdowns unless the statement explicitly provides them.
   - If category-wise reward points are not present, return breakdown as null.
4. Try to identify the bank name and statement period.
5. Handle variations in formatting and wording.
6. Be flexible with OCR errors - look for patterns even if spelling isn't perfect.
7. Common OCR mistakes to watch for:
   - Numbers: 0/O, 1/I/l, 5/S, 8/B
   - Letters: rn/m, cl/d, vv/w
8. If information is missing or not explicitly stated, use null (NOT 0).
9. CRITICAL - The text has already been pre-processed. Look for these EXACT patterns:
   - "eDGE REWARD POINTS BALANCE: <number>"  →  that number is the closing points balance.
     Do NOT confuse it with the CUSTOMER ID that follows.
   - "Previous Balance", "Opening Balance", "Balance Forward"
   - "Points Earned", "Rewards Earned", "Points This Period"
   - "Points Redeemed", "Rewards Redeemed", "Points Used"
   - "Current Balance", "Closing Balance", "Available Points"

Statement Text:
${cleanedPdfText}
${additionalContext}

Respond with a JSON object in this exact format (no markdown, no code blocks, just pure JSON):
{
  "bankName": "detected bank name or null",
  "statementPeriod": "detected period or null",
  "rewardPoints": {
    "opening": number or 0,
    "earned": number or 0,
    "redeemed": number or 0,
    "closing": number or 0,
    "breakdown": [
      {"category": "category name", "points": number}
    ]
  },
  "confidence": "high/medium/low",
  "notes": "any relevant observations, especially OCR-related issues you noticed"
}
`;

    console.log('\n🤖 Sending to Groq AI (Llama 3) for analysis...');
    
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.1, // Lower temperature for more consistent JSON output
      max_tokens: 2048,
      response_format: { type: "json_object" } // Request JSON format
    });
    
    const text = response.choices[0]?.message?.content;
    
    if (!text) {
      throw new Error('No response received from Groq API');
    }
    
    console.log('✅ Received response from Groq');
    
    // Clean the response - remove markdown code blocks if present
    let cleanedText = text.trim();
    cleanedText = cleanedText.replace(/```json\n?/g, '');
    cleanedText = cleanedText.replace(/```\n?/g, '');
    cleanedText = cleanedText.trim();
    
    // Parse JSON
    const parsedData = JSON.parse(cleanedText);
    
    console.log(`📊 Extraction Confidence: ${parsedData.confidence}`);
    
    return parsedData;
    
  } catch (error) {
    console.error('❌ Groq API Error:', error);
    
    // Handle rate limit errors
    if (error.status === 429) {
      throw new Error('Groq API rate limit exceeded. Please wait a moment and try again.');
    }
    
    // Handle authentication errors
    if (error.status === 401) {
      throw new Error('Invalid Groq API key. Please check your GROQ_API_KEY environment variable.');
    }
    
    if (error instanceof SyntaxError) {
      console.error('Failed to parse Groq response. Raw response might be available in logs.');
      throw new Error('Failed to parse Groq response as JSON. Please try again.');
    }
    
    throw new Error(`Groq extraction failed: ${error.message}`);
  }
};

/**
 * Validate extracted data
 */
export const validateExtractedData = (data) => {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid data structure' };
  }
  
  if (!data.rewardPoints) {
    return { valid: false, error: 'Missing reward points data' };
  }
  
  return { valid: true };
};