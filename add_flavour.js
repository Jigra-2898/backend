const fs = require('fs');
const path = require('path');

// Read the database
const dbPath = path.join(__dirname, 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

// Function to extract flavour from image filename
function extractFlavour(imagePath) {
  if (!imagePath) return null;
  
  // Get the filename without extension
  const filename = path.basename(imagePath, path.extname(imagePath));
  
  // List of product descriptor words to exclude
  const productDescriptors = ['disposable', 'vape', 'pod', 'puffs', 'puff', 'bc', 'pro', 'elf', 'bar', 'loop', 'stlth', 'geek', 'titan', 'max', 'ultra', 'evo', 'dripn'];
  
  // Check if filename uses underscores with the "0000s" pattern (like imgi_7_dripn_evo_63k_disposable_vape_0000s_0006_strawberry_ice)
  if (filename.match(/_\d{4}s?_/)) {
    // Match pattern: _0000s_XXXX_FLAVOUR where XXXX is a number to skip
    const match = filename.match(/_\d{4}s?_\d+_(.+)$/);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Check if filename uses hyphens (like imgi_10_elf-bar-bc-pro-80k-disposable-vape-5ct-double-mango)
  if (filename.includes('-')) {
    const parts = filename.split('-');
    const flavourParts = [];
    
    // Work backwards from the end to collect flavour parts
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i].toLowerCase();
      
      // Stop if we hit a product descriptor
      if (productDescriptors.includes(part.replace(/[0-9]/g, ''))) {
        break;
      }
      
      // Stop if we hit what looks like a size/count (5ct, 80k, etc)
      if (/^[0-9]+[a-z]+$/.test(part)) {
        break;
      }
      
      // Stop if we hit pure numbers (like 80, 20, 63, 10, 2500)
      if (/^\d+$/.test(part) && parseInt(part) > 20) {
        break;
      }
      
      // We found a flavour part, add it
      if (part.length > 0) {
        flavourParts.unshift(parts[i]); // Use original case
      }
    }
    
    if (flavourParts.length > 0) {
      return flavourParts.join('_');
    }
  }
  
  // Fallback for other formats
  const parts = filename.split('_');
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    if (lastPart && !/^\d+$/.test(lastPart) && lastPart.length > 2) {
      return lastPart;
    }
  }
  
  return filename;
}

// Add flavour field to each item
if (db.items && Array.isArray(db.items)) {
  db.items.forEach(item => {
    if (item.photos && item.photos.length > 0) {
      const primaryPhoto = item.photos[0];
      const flavour = extractFlavour(primaryPhoto);
      item.flavour = flavour || null;
    } else {
      item.flavour = null;
    }
  });
}

// Write updated database back
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
console.log('✓ Flavour field added to all items in db.json');
console.log(`✓ Processed ${db.items ? db.items.length : 0} items`);
