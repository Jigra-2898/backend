const fs = require('fs');
const path = require('path');

// Read the database
const dbPath = path.join(__dirname, 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

// Function to extract puffs value from text
function extractPuffs(text) {
  if (!text) return null;
  
  // Match patterns like: 80K, 60k, 50K, 25K, 10k, 2500, 5ct, 4ct, 1200, etc.
  const puffPatterns = [
    /(\d+\.?\d*\s*k)/i,      // 80k, 60K, 2.5k, etc.
    /(\d+\s*ct)/i,            // 5ct, 4ct, etc.
    /(\d{4,})/                // 2500, 1200, etc.
  ];
  
  for (const pattern of puffPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().toLowerCase();
    }
  }
  
  return null;
}

// Function to remove puffs value from text
function removePuffs(text) {
  if (!text) return text;
  
  // Remove patterns like: 80K, 60k, 50K, 25K, 10k, 2500, 5ct, 4ct, 1200, etc.
  let cleaned = text
    .replace(/\s*(\d+\.?\d*\s*k)\s*/gi, ' ')      // Remove k values
    .replace(/\s*(\d+\s*ct)\s*/gi, ' ')           // Remove ct values
    .replace(/\s+(\d{4,})\s+/g, ' ')              // Remove 4+ digit numbers with spaces around
    .replace(/\s+/g, ' ')                          // Clean up multiple spaces
    .trim();
  
  return cleaned;
}

// Process all items
if (db.items && Array.isArray(db.items)) {
  db.items.forEach(item => {
    // Extract puffs from name first, then description
    let puffs = extractPuffs(item.name);
    if (!puffs && item.description) {
      puffs = extractPuffs(item.description);
    }
    
    // Remove puffs from name and description
    if (item.name) {
      item.name = removePuffs(item.name);
    }
    if (item.description) {
      item.description = removePuffs(item.description);
    }
    
    // Add puffs field
    item.puffs = puffs || null;
  });
}

// Write updated database back
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
console.log('✓ Puffs field added to all items in db.json');
console.log('✓ Removed puff values (5ct, 60k, 80k, etc.) from names and descriptions');
console.log(`✓ Processed ${db.items ? db.items.length : 0} items`);
