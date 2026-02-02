import { getGeminiModel } from '../config/gemini.js';

/**
 * Extract reward points using Gemini AI
 */
export const extractRewardPoints = async (pdfText, metadata = {}) => {
  try {
    const model = getGeminiModel();
    
    const prompt = `
You are an expert at analyzing credit card statements and extracting reward points information.

Analyze the following credit card statement text and extract ALL reward points information.

IMPORTANT INSTRUCTIONS:
1. Look for reward points, loyalty points, cashback points, or any similar terminology
2. Extract opening balance, earned points, redeemed points, and closing balance
3. Identify any point breakdown by category (e.g., dining, travel, shopping)
4. Try to identify the bank name and statement period
5. Handle variations in formatting and wording
6. If information is unclear or missing, use null or 0 as appropriate

Statement Text:
${pdfText}

${metadata.isScanned ? 'NOTE: This is a scanned PDF with limited text extraction.' : ''}

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
  "notes": "any relevant observations"
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean the response - remove markdown code blocks if present
    let cleanedText = text.trim();
    cleanedText = cleanedText.replace(/```json\n?/g, '');
    cleanedText = cleanedText.replace(/```\n?/g, '');
    cleanedText = cleanedText.trim();
    
    // Parse JSON
    const parsedData = JSON.parse(cleanedText);
    
    return parsedData;
    
  } catch (error) {
    console.error('Gemini API Error:', error);
    
    // If JSON parsing fails, try to extract manually
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse Gemini response as JSON. Please try again.');
    }
    
    throw new Error(`Gemini extraction failed: ${error.message}`);
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