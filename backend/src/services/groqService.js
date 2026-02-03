import { getGroqModel } from '../config/groq.js';

const preprocessAxisBank = (text) =>
  text.replace(
    /eDGE\s+REWARD\s+POINTS\s+BALANCE\s+AS\s+ON\s+DATE\s+CUSTOMER\s+ID\s+([\d,]+)\s+([\d\/-]+)\s+(\d+)/i,
    'eDGE REWARD POINTS BALANCE (Closing): $1 | BALANCE AS ON DATE: $2 | CUSTOMER ID: $3'
  );


const preprocessHDFC = (text) =>
  text.replace(
    // Header part: tolerant of line breaks and the "innext" artefact
    /Opening\s+Balance\s+Feature\s*\+?\s*Bonus\s+Reward\s+Points\s+Earned\s+Disbursed\s+Adjusted\s*\/?\s*Lapsed\s+Closing\s+Balance\s+Points\s+expiring\s+in\s*n?ext\s+30\s+days\s+Points\s+expiring\s+in\s*\n?\s*next\s+60\s+days\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/i,
    [
      'HDFC REWARD POINTS SUMMARY:',
      'Opening Balance: $1',
      'Reward Points Earned (Feature + Bonus): $2',
      'Disbursed (Redeemed): $3',
      'Adjusted/Lapsed: $4',
      'Closing Balance: $5',
      'Points Expiring in 30 days: $6',
      'Points Expiring in 60 days: $7',
    ].join('\n')
  );


const preprocessICICI = (text) =>
  text.replace(
    /Points\s+Earned\s+ICICI\s+Bank\s+Rewards\s+([\d,]+)/i,
    'ICICI BANK REWARDS — Points Earned This Period: $1\n(No opening / closing / redeemed summary available in this statement.)'
  );

/**
 * Master entry point — runs every bank rewriter in sequence.
 * Only one will actually match for any given statement; the others are no-ops.
 */
const preprocessPdfText = (text) => {
  let processed = text;
  processed = preprocessAxisBank(processed);
  processed = preprocessHDFC(processed);
  processed = preprocessICICI(processed);
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

    // Dev log — shows which rewriter fired and what it produced
    if (cleanedPdfText !== pdfText) {
      console.log('🔧 preprocessPdfText: reassembled fragmented text blocks');
      for (const pattern of [
        /eDGE REWARD POINTS BALANCE .+/i,
        /HDFC REWARD POINTS SUMMARY:[\s\S]*?Points Expiring in 60 days: \d+/i,
        /ICICI BANK REWARDS .+/i,
      ]) {
        const match = cleanedPdfText.match(pattern);
        if (match) {
          console.log('   →', match[0]);
          break;
        }
      }
    }

    const prompt = `
You are an expert at analyzing credit card statements and extracting reward points information.

Analyze the following credit card statement text and extract ALL reward points information.

IMPORTANT INSTRUCTIONS:
1. Look for reward points, loyalty points, cashback points, or any similar terminology.
   Indian banks use names like "eDGE REWARD POINTS" (Axis Bank), "ICICI Bank Rewards" (ICICI),
   "Bpoints" (BOB), "RPay Points", etc.

2. Extract opening balance, earned points, redeemed points, and closing balance.
   - If only a single "balance" or "points balance" figure is present with no earned/redeemed
     breakdown, treat it as the CLOSING balance.
   - If only a single "Points Earned" figure is present with no other summary, treat it as
     EARNED only; set opening, redeemed, and closing to null.

3. Identify reward points ONLY if they are EXPLICITLY mentioned in the statement text.
   - DO NOT calculate or infer reward points from transaction amounts.
   - DO NOT assume earn rates.
   - DO NOT create category-wise reward breakdowns unless the statement explicitly provides them.
   - If category-wise reward points are not present, return breakdown as null.
   - Pie-chart percentages (e.g. "Apparel/Grocery-69%") are NOT point counts — ignore them for breakdown.

4. Try to identify the bank name and statement period.

5. Handle variations in formatting and wording.

6. Be flexible with OCR errors - look for patterns even if spelling isn't perfect.

7. Common OCR mistakes to watch for:
   - Numbers: 0/O, 1/I/l, 5/S, 8/B
   - Letters: rn/m, cl/d, vv/w

8. If information is missing or not explicitly stated, use null (NOT 0).

9. CRITICAL — The text has ALREADY been pre-processed.  Each bank's summary block
   has been rewritten with explicit labels.  Read those labels literally:

   ▸ Axis Bank:
       "eDGE REWARD POINTS BALANCE (Closing): <number>"
       → That number is the CLOSING balance.
       → The CUSTOMER ID number that follows is NOT a points value — ignore it.
       → No opening / earned / redeemed data exists in this statement; set them to null.

   ▸ HDFC:
       "HDFC REWARD POINTS SUMMARY:"
       followed by one value per line:
         Opening Balance:                        → opening
         Reward Points Earned (Feature + Bonus): → earned
         Disbursed (Redeemed):                   → redeemed
         Adjusted/Lapsed:                        → adjustedLapsed  (a SEPARATE field — NOT closing)
         Closing Balance:                        → closing         (the line AFTER Adjusted/Lapsed)
       WARNING: "Adjusted/Lapsed" and "Closing Balance" are different fields.
                Map each to its own key.  Never put the same value in both.

   ▸ ICICI:
       "ICICI BANK REWARDS — Points Earned This Period: <number>"
       → That number is EARNED only.
       → The note below it explicitly states no opening/closing/redeemed summary exists.
       → Set opening, redeemed, closing to null.

   ▸ For any OTHER bank not listed above, apply general heuristics:
       - "Opening Balance" / "Previous Balance"  → opening
       - "Points Earned"  / "Rewards Earned"     → earned
       - "Points Redeemed" / "Redeemed"          → redeemed
       - "Closing Balance" / "Current Balance" / "Available Points" → closing

Statement Text:
${cleanedPdfText}
${additionalContext}

Respond with a JSON object in this exact format (no markdown, no code blocks, just pure JSON):
{
  "bankName": "detected bank name or null",
  "statementPeriod": "detected period or null",
  "rewardPoints": {
    "opening": number or null,
    "earned": number or null,
    "redeemed": number or null,
    "adjustedLapsed": number or null,
    "closing": number or null,
    "breakdown": [
      {"category": "category name", "points": number}
    ] or null
  },
  "confidence": "high/medium/low",
  "notes": "any relevant observations"
}

REMEMBER:
- adjustedLapsed and closing are SEPARATE fields — never put the same value in both.
- If a field has no data in the statement, use null, NOT 0.
- breakdown must be null unless the statement gives explicit per-category point counts.
`;

    console.log('\n🤖 Sending to Groq AI (Llama 3) for analysis...');

    const response = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content;

    if (!text) {
      throw new Error('No response received from Groq API');
    }

    console.log('✅ Received response from Groq');

    // Clean the response — remove markdown code blocks if present
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

    if (error.status === 429) {
      throw new Error('Groq API rate limit exceeded. Please wait a moment and try again.');
    }

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