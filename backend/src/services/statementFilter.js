/**
 * Enhanced Statement Filter Service
 * Filters statements by bank AND card variant to get the latest one for each unique card
 * NOW WITH DUPLICATE DETECTION
 */

/**
 * Bank card variants dictionary
 * Used for fuzzy matching card names in statements
 */
const BANK_CARD_VARIANTS = {
  "SBI": [
    "Air India Signature",
    "Etihad Guest Premier",
    "Air India Platinum",
    "Krisflyer SBI Apex",
    "Aurum",
    "Club Vistara",
    "Miles Elite",
    "Krisflyer SBI",
    "Miles",
    "Club Vistara Prime",
    "Etihad Guest",
    "Miles Prime"
  ],
  "AXIS": [
    "Rewards",
    "Horizon",
    "Primus",
    "Vistara",
    "Indian Oil Premium",
    "Vistara Infinite",
    "Olympus",
    "Magnus for Burgundy",
    "Magnus",
    "Burgundy Private - One Card",
    "Burgundy Private NRI",
    "Atlas",
    "Vistara Signature",
    "Miles & More",
    "Reserve"
  ],
  "AMEX": [
    "Centurion",
    "Membership Rewards",
    "Platinum",
    "Gold",
    "Green",
    "EveryDay Preferred",
    "Business Gold",
    "Business Green Rewards",
    "SmartEarn",
    "EveryDay",
    "Business Platinum",
    "Platinum Travel",
    "Platinum Reserve",
    "Blue Business Plus"
  ],
  "IndusInd": [
    "Indulge",
    "Iconia",
    "Pioneer Legacy",
    "Tiger",
    "Legend",
    "Crest",
    "Celesta",
    "Pinnacle",
    "Avios Visa Infinite",
    "Club Vistara Explorer",
    "Pioneer Heritage"
  ],
  "ICICI": [
    "Emirates Skywards Sapphiro",
    "Emirates Skywards Rubyx",
    "Times Black",
    "Emeralde Private Metal",
    "Rubyx - Visa",
    "Coral",
    "Rubyx - Mastercard",
    "Emirates Skywards Emeralde",
    "Sapphiro - Visa"
  ],
  "HSBC": [
    "TravelOne",
    "RuPay Platinum",
    "Platinum",
    "Privé",
    "Premier"
  ],
  "Kotak Mahindra Bank": [
    "Solitaire",
    "Kotak Air+"
  ],
  "DBS": [
    "Vantage"
  ],
  "AU Small Bank": [
    "AU Zenith+"
  ],
  "HDFC": [
    "Biz Black Metal Edition",
    "Diners Club Black",
    "Infinia"
  ],
  "Citibank": [
    "ThankYou Preferred",
    "Double Cash",
    "Custom Cash",
    "Rewards+",
    "AT&T Access",
    "AT&T Access More",
    "Premier",
    "Prestige"
  ],
  "Capital One": [
    "Venture X Rewards",
    "Spark Miles for Business",
    "Spark Miles Select for Business",
    "VentureOne Rewards",
    "Venture Rewards"
  ],
  "Wells Fargo": [
    "Autograph",
    "Autograph Journey"
  ],
  "Chase": [
    "Ink Business Cash",
    "Sapphire Reserve",
    "Freedom Flex",
    "Reserve",
    "Sapphire Preferred",
    "Ink Business Preferred",
    "Ink Business Unlimited",
    "Freedom Unlimited"
  ],
  "Bilt": [
    "Bilt"
  ]
};


/**
 * Parse month name to number (1-12)
 */
const parseMonth = (monthStr) => {
  const months = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
  };
  return months[monthStr.toLowerCase()] || null;
};

/**
 * Parse statement period to get end date
 * Handles various date formats commonly found in statements
 */
export const parseStatementDate = (statementPeriod) => {
  if (!statementPeriod) return null;

  const periodStr = statementPeriod.trim();

  const patterns = [
    // HDFC: "03 Jan, 2026 - 02 Feb, 2026"
    {
      regex: /-\s*(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})\s*$/i,
      parse: (match) => {
        const day = parseInt(match[1]);
        const month = parseMonth(match[2]);
        const year = parseInt(match[3]);
        if (month) return new Date(year, month - 1, day);
        return null;
      }
    },
    
    // ICICI: "January 3, 2025 to February 2, 2025"
    {
      regex: /to\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\s*$/i,
      parse: (match) => {
        const month = parseMonth(match[1]);
        const day = parseInt(match[2]);
        const year = parseInt(match[3]);
        if (month) return new Date(year, month - 1, day);
        return null;
      }
    },
    
    // Axis Bank: "20/03/2024 - 18/04/2024"
    {
      regex: /-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/,
      parse: (match) => {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        const year = parseInt(match[3]);
        return new Date(year, month - 1, day);
      }
    },
    
    // Alternative: "DD-MM-YYYY - DD-MM-YYYY"
    {
      regex: /-\s*(\d{1,2})-(\d{1,2})-(\d{4})\s*$/,
      parse: (match) => {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        const year = parseInt(match[3]);
        return new Date(year, month - 1, day);
      }
    },
    
    // ISO format: "2024-01-01 to 2024-01-31"
    {
      regex: /to\s+(\d{4})-(\d{2})-(\d{2})\s*$/,
      parse: (match) => {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]);
        const day = parseInt(match[3]);
        return new Date(year, month - 1, day);
      }
    },
    
    // Single date formats
    {
      regex: /^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/i,
      parse: (match) => {
        const day = parseInt(match[1]);
        const month = parseMonth(match[2]);
        const year = parseInt(match[3]);
        if (month) return new Date(year, month - 1, day);
        return null;
      }
    },
    
    {
      regex: /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i,
      parse: (match) => {
        const month = parseMonth(match[1]);
        const day = parseInt(match[2]);
        const year = parseInt(match[3]);
        if (month) return new Date(year, month - 1, day);
        return null;
      }
    },
    
    {
      regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      parse: (match) => {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        const year = parseInt(match[3]);
        return new Date(year, month - 1, day);
      }
    },
    
    {
      regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      parse: (match) => {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        const year = parseInt(match[3]);
        return new Date(year, month - 1, day);
      }
    },
    
    {
      regex: /^(\d{4})-(\d{2})-(\d{2})$/,
      parse: (match) => {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]);
        const day = parseInt(match[3]);
        return new Date(year, month - 1, day);
      }
    },
    
    {
      regex: /^(\d{4})\/(\d{2})\/(\d{2})$/,
      parse: (match) => {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]);
        const day = parseInt(match[3]);
        return new Date(year, month - 1, day);
      }
    },
  ];

  for (const pattern of patterns) {
    const match = periodStr.match(pattern.regex);
    if (match) {
      const date = pattern.parse(match);
      if (date && !isNaN(date.getTime())) {
        return date;
      }
    }
  }

  return null;
};

/**
 * Normalize bank name for consistent grouping
 */
const normalizeBankName = (bankName) => {
  if (!bankName) return 'unknown';
  
  const normalized = bankName.trim().toLowerCase();
  
  const mappings = {
    'hdfc': 'hdfc bank',
    'icici': 'icici bank',
    'axis': 'axis bank',
    'sbi': 'sbi card',
    'standard chartered': 'standard chartered',
    'hsbc': 'hsbc',
    'kotak': 'kotak mahindra bank',
    'yes': 'yes',
    'indusind': 'indusind',
    'citi': 'citibank',
    'american express': 'amex',
    'dbs': 'dbs',
    'au': 'au small bank',
    'capital one': 'capital one',
    'wells fargo': 'wells fargo',
    'chase': 'chase',
    'bilt': 'bilt',
  };
  
  for (const [key, value] of Object.entries(mappings)) {
    if (normalized.includes(key)) {
      return value;
    }
  }
  
  return normalized;
};

/**
 * Get bank variants key for card variant detection
 */
const getBankVariantsKey = (normalizedBankName) => {
  const mapping = {
    'hdfc bank': 'HDFC',
    'icici bank': 'ICICI',
    'axis bank': 'AXIS',
    'sbi card': 'SBI',
    'amex': 'AMEX',
    'yes': 'YES',
    'indusind': 'IndusInd',
    'citibank': 'Citibank',
    'standard chartered': 'Standard Chartered',
    'hsbc': 'HSBC',
    'kotak mahindra bank': 'Kotak Mahindra Bank',
    'dbs': 'DBS',
    'au small bank': 'AU Small Bank',
    'capital one': 'Capital One',
    'wells fargo': 'Wells Fargo',
    'chase': 'Chase',
    'bilt': 'Bilt',
  };
  
  return mapping[normalizedBankName] || null;
};

/**
 * Extract card variant from statement text using fuzzy matching
 * @param {String} text - Raw extracted text from PDF or AI response
 * @param {String} bankName - Normalized bank name
 * @returns {String} - Detected card variant or "Unknown Variant"
 */
export const detectCardVariant = (text, bankName) => {
  if (!text || !bankName) {
    return 'Unknown Variant';
  }

  const normalizedBank = normalizeBankName(bankName);
  const variantsKey = getBankVariantsKey(normalizedBank);
  
  if (!variantsKey || !BANK_CARD_VARIANTS[variantsKey]) {
    return 'Unknown Variant';
  }

  const variants = BANK_CARD_VARIANTS[variantsKey];
  const textLower = text.toLowerCase();
  
  // Score each variant based on how well it matches
  const scores = variants.map(variant => {
    const variantLower = variant.toLowerCase();
    
    // Exact match (highest score)
    if (textLower.includes(variantLower)) {
      return { variant, score: 100 };
    }
    
    // Partial word matching
    const variantWords = variantLower.split(/\s+/);
    const matchedWords = variantWords.filter(word => 
      word.length > 2 && textLower.includes(word)
    );
    
    if (matchedWords.length > 0) {
      const score = (matchedWords.length / variantWords.length) * 80;
      return { variant, score };
    }
    
    return { variant, score: 0 };
  });
  
  // Get the best match
  const best = scores.reduce((max, curr) => 
    curr.score > max.score ? curr : max,
    { variant: 'Unknown Variant', score: 0 }
  );
  
  // Require at least 40% match confidence
  if (best.score >= 40) {
    return best.variant;
  }
  
  return 'Unknown Variant';
};

/**
 * Check if two statements are duplicates (same period and card number)
 */
const areDuplicateStatements = (stmt1, stmt2) => {
  // Same statement period
  const samePeriod = stmt1.statementPeriod === stmt2.statementPeriod;
  
  // Same card number (if available)
  const sameCard = stmt1.cardNumber && stmt2.cardNumber 
    ? stmt1.cardNumber === stmt2.cardNumber
    : false;
  
  // Check filename similarity (might be the exact same file)
  const sameFilename = stmt1.fileName === stmt2.fileName;
  
  return samePeriod && (sameCard || sameFilename);
};

/**
 * Group statements by bank AND card variant
 * Structure: { "hdfc bank": { "Infinia": [...], "Regalia": [...] }, ... }
 */
const groupStatementsByBankAndVariant = (statements) => {
  const groups = {};

  statements.forEach(statement => {
    const bankName = normalizeBankName(statement.bankName);
    const cardVariant = statement.cardVariant || 'Unknown Variant';
    
    if (!groups[bankName]) {
      groups[bankName] = {};
    }
    
    if (!groups[bankName][cardVariant]) {
      groups[bankName][cardVariant] = [];
    }
    
    groups[bankName][cardVariant].push(statement);
  });

  return groups;
};

/**
 * Get the latest statement from a group of statements
 * NOW WITH DUPLICATE DETECTION AND BETTER TIEBREAKER
 */
const getLatestStatement = (statements) => {
  if (!statements || statements.length === 0) return null;
  if (statements.length === 1) return statements[0];

  const statementsWithDates = statements.map(stmt => ({
    statement: stmt,
    parsedDate: parseStatementDate(stmt.statementPeriod),
    period: stmt.statementPeriod || 'No period',
    uploadDate: stmt.uploadDate || new Date(0), // Fallback for older records
  }));

  const withDates = statementsWithDates.filter(s => s.parsedDate !== null);
  const withoutDates = statementsWithDates.filter(s => s.parsedDate === null);

  if (withDates.length === 0) {
    console.log(`   ⚠️  No valid dates found, returning first statement`);
    return statements[0];
  }

  // Sort by statement date DESC, then by upload date DESC (tiebreaker)
  withDates.sort((a, b) => {
    const dateDiff = b.parsedDate - a.parsedDate;
    
    // If statement periods are different, use that
    if (dateDiff !== 0) return dateDiff;
    
    // TIEBREAKER: If same statement period, prefer the most recently uploaded one
    return new Date(b.uploadDate) - new Date(a.uploadDate);
  });
  
  const latest = withDates[0];
  
  // Detect duplicates
  const duplicates = [];
  const unique = [];
  const seen = new Set();
  
  withDates.forEach((s, idx) => {
    const isDuplicate = withDates.slice(0, idx).some(other => 
      areDuplicateStatements(s.statement, other.statement)
    );
    
    if (isDuplicate) {
      duplicates.push(s);
    } else {
      unique.push(s);
    }
  });
  
  console.log(`   📅 Date comparison for ${withDates.length} statement(s):`);
  
  if (duplicates.length > 0) {
    console.log(`   ⚠️  Found ${duplicates.length} duplicate(s) (same period + card):`);
  }
  
  withDates.forEach((s, idx) => {
    const isLatest = idx === 0;
    const isDupe = duplicates.includes(s);
    
    const dateStr = s.parsedDate.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
    
    const uploadDateStr = new Date(s.uploadDate).toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    let prefix = '⏸️  OLDER ';
    if (isLatest) prefix = '✅ LATEST';
    if (isDupe) prefix = '🔁 DUPE  ';
    
    console.log(`      ${prefix} - ${dateStr} (${s.period}) | Uploaded: ${uploadDateStr}`);
  });
  
  if (withoutDates.length > 0) {
    console.log(`   ⚠️  ${withoutDates.length} statement(s) without valid dates (ignored)`);
  }
  
  return latest.statement;
};

/**
 * Filter statements to get only the latest one from each bank + card variant combination
 * @param {Array} statements - Array of statement objects
 * @returns {Object} - { latest: Array, filtered: Array, duplicates: Array, summary: Object }
 */
export const filterLatestStatements = (statements) => {
  if (!statements || statements.length === 0) {
    return {
      latest: [],
      filtered: [],
      duplicates: [],
      summary: {
        totalStatements: 0,
        uniqueBanks: 0,
        uniqueCards: 0,
        latestStatements: 0,
        filteredStatements: 0,
        duplicates: 0,
      },
    };
  }

  // Group by bank and variant
  const groups = groupStatementsByBankAndVariant(statements);
  const uniqueBanks = Object.keys(groups).length;
  
  let uniqueCards = 0;
  Object.values(groups).forEach(bankGroup => {
    uniqueCards += Object.keys(bankGroup).length;
  });

  const latest = [];
  const filtered = [];
  const duplicates = [];

  console.log(`\n📊 Filtering ${statements.length} statement(s) from ${uniqueBanks} bank(s), ${uniqueCards} unique card(s):\n`);

  // For each bank -> For each variant -> Get latest
  Object.entries(groups).forEach(([bankName, variants]) => {
    console.log(`🏦 ${bankName.toUpperCase()}: ${Object.keys(variants).length} card variant(s)`);
    
    Object.entries(variants).forEach(([cardVariant, variantStatements]) => {
      console.log(`   💳 ${cardVariant}: ${variantStatements.length} statement(s)`);
      
      if (variantStatements.length === 1) {
        latest.push(variantStatements[0]);
        console.log(`      ✅ Only one statement, keeping it`);
      } else {
        // Check for duplicates first
        const uniqueStatements = [];
        const dupeStatements = [];
        
        variantStatements.forEach(stmt => {
          const isDupe = uniqueStatements.some(existing => 
            areDuplicateStatements(stmt, existing)
          );
          
          if (isDupe) {
            dupeStatements.push(stmt);
          } else {
            uniqueStatements.push(stmt);
          }
        });
        
        if (dupeStatements.length > 0) {
          console.log(`      🔁 Detected ${dupeStatements.length} duplicate(s)`);
          duplicates.push(...dupeStatements);
        }
        
        const latestStmt = getLatestStatement(uniqueStatements.length > 0 ? uniqueStatements : variantStatements);
        
        if (latestStmt) {
          latest.push(latestStmt);

          // Add others to filtered list
          variantStatements.forEach(stmt => {
            if (stmt._id ? stmt._id.toString() !== latestStmt._id?.toString() : stmt !== latestStmt) {
              if (!dupeStatements.includes(stmt)) {
                filtered.push(stmt);
              }
            }
          });
        }
      }
    });
    console.log('');
  });

  const summary = {
    totalStatements: statements.length,
    uniqueBanks,
    uniqueCards,
    latestStatements: latest.length,
    filteredStatements: filtered.length,
    duplicates: duplicates.length,
  };

  console.log(`📈 Summary: Kept ${latest.length} latest (${uniqueCards} unique cards), filtered ${filtered.length} older, ${duplicates.length} duplicate(s)\n`);

  return {
    latest,
    filtered,
    duplicates,
    summary,
  };
};

/**
 * Get latest statements (convenience function)
 */
export const getLatestStatements = (statements) => {
  const result = filterLatestStatements(statements);
  return result.latest;
};

/**
 * Sort statements by date (most recent first)
 */
export const sortStatementsByDate = (statements) => {
  return [...statements]
    .map(stmt => ({
      ...stmt,
      parsedDate: parseStatementDate(stmt.statementPeriod),
    }))
    .sort((a, b) => {
      if (!a.parsedDate && !b.parsedDate) return 0;
      if (!a.parsedDate) return 1;
      if (!b.parsedDate) return -1;
      
      return b.parsedDate - a.parsedDate;
    });
};

/**
 * Get statistics about statements by bank and card variant
 */
export const getStatementStats = (statements) => {
  const groups = groupStatementsByBankAndVariant(statements);
  
  const stats = [];
  
  Object.entries(groups).forEach(([bankName, variants]) => {
    Object.entries(variants).forEach(([cardVariant, variantStatements]) => {
      const dates = variantStatements
        .map(stmt => parseStatementDate(stmt.statementPeriod))
        .filter(date => date !== null)
        .sort((a, b) => b - a);

      stats.push({
        bankName,
        cardVariant,
        totalStatements: variantStatements.length,
        latestDate: dates[0] || null,
        oldestDate: dates[dates.length - 1] || null,
        dateRange: dates.length > 1 
          ? `${dates[dates.length - 1].toLocaleDateString('en-IN')} - ${dates[0].toLocaleDateString('en-IN')}`
          : dates.length === 1
          ? dates[0].toLocaleDateString('en-IN')
          : 'No valid dates',
      });
    });
  });

  return stats.sort((a, b) => b.totalStatements - a.totalStatements);
};

/**
 * Validate statement period extraction
 */
export const validateStatementPeriod = (statementPeriod) => {
  const parsedDate = parseStatementDate(statementPeriod);
  
  return {
    original: statementPeriod,
    parsedDate,
    isValid: parsedDate !== null,
    formattedDate: parsedDate ? parsedDate.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    }) : null,
    timestamp: parsedDate ? parsedDate.getTime() : null,
  };
};