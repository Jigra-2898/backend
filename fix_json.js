const fs = require('fs');

try {
  const content = fs.readFileSync('db.json', 'utf8');
  
  // Remove BOM if present
  const cleanContent = content.replace(/^\uFEFF/, '');
  
  // Find the brands array to rebuild from
  const brandsMatch = cleanContent.match(/"brands"\s*:\s*\[[\s\S]*?\]\s*,/);
  const categoriesMatch = cleanContent.match(/"categories"\s*:\s*\[[\s\S]*?\]\s*,/);
  const sectionsMatch = cleanContent.match(/"sections"\s*:\s*\[[\s\S]*?\]\s*,/);
  
  if (!brandsMatch || !categoriesMatch || !sectionsMatch) {
    console.log('ERROR: Could not find required arrays');
    process.exit(1);
  }
  
  // Try to find items array up to first real issue
  const itemsStart = cleanContent.indexOf('"items"');
  const beforeItems = cleanContent.substring(0, itemsStart);
  const afterItems = cleanContent.substring(itemsStart + 8); // Skip "items":
  
  // Find the opening bracket
  const bracketPos = afterItems.indexOf('[');
  const restOfItems = afterItems.substring(bracketPos + 1);
  
  // Try to extract valid items by balancing braces
  let braceCount = 0;
  let itemsEnd = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < restOfItems.length && braceCount <= 500; i++) {
    const char = restOfItems[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          itemsEnd = i + 1;
          break;
        }
      }
    }
  }
  
  if (itemsEnd === 0) {
    console.log('ERROR: Could not find end of items array');
    process.exit(1);
  }
  
  const validItems = restOfItems.substring(0, itemsEnd);
  
  // Rebuild the JSON
  const rebuilt = `${beforeItems}"items": [${validItems}]\n}`;
  
  fs.writeFileSync('db.json', rebuilt, 'utf8');
  
  // Validate the rebuild
  const validate = JSON.parse(rebuilt);
  console.log('✓ JSON rebuilt successfully');
  console.log(`  Total items: ${validate.items.length}`);
  console.log(`  Brands: ${validate.brands.length}`);
  console.log(`  Categories: ${validate.categories.length}`);
  console.log(`  Sections: ${validate.sections.length}`);
  
} catch (error) {
  console.log('ERROR: ' + error.message);
  process.exit(1);
}
