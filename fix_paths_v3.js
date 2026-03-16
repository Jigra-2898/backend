const fs = require('fs');
const path = require('path');

try {
  const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
  const imagesDir = './uploads/images';
  
  // Build file index by folder
  const fileIndex = {};
  
  function indexFiles(dir, folderKey = '') {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.forEach(entry => {
        const fullPath = path.join(dir, entry.name);
        const newKey = folderKey ? `${folderKey}/${entry.name}` : entry.name;
        
        if (entry.isFile()) {
          if (!fileIndex[folderKey]) {
            fileIndex[folderKey] = [];
          }
          fileIndex[folderKey].push(entry.name);
        } else if (entry.isDirectory()) {
          indexFiles(fullPath, newKey);
        }
      });
    } catch (e) {
      // Skip
    }
  }
  
  console.log('Indexing image files...');
  indexFiles(imagesDir);
  
  let fixedCount = 0;
  
  // Fix each item
  db.items.forEach((item, idx) => {
    if (!item.photos || !item.photos[0]) return;
    
    const photoPath = item.photos[0];
    const pathParts = photoPath.split('/');
    const filename = pathParts[pathParts.length - 1];
    
    // Extract folder path (everything except filename)
    const folderPath = pathParts.slice(0, -1).join('/'); // uploads/images/elf-bar/bc-pro-80k-disposable-vape
    const folderKey = folderPath.replace('uploads/images/', ''); // elf-bar/bc-pro-80k-disposable-vape
    
    if (!fileIndex[folderKey]) return; // Folder not found
    
    // Extract flavor from item name: "BC Pro 80K Disposable Vape (Blueberry Ice)" => "blueberry-ice"
    let flavorPattern = '';
    const flavorMatch = item.name.match(/\(([^)]+)\)/);
    if (flavorMatch) {
      const flavor = flavorMatch[1].toLowerCase().replace(/\s+/g, '-');
      flavorPattern = flavor;
    }
    
    // Find matching file
    let matchedFile = null;
    
    if (flavorPattern) {
      // Look for file containing the flavor pattern
      matchedFile = fileIndex[folderKey].find(f =>
        f.toLowerCase().includes(flavorPattern)
      );
    }
    
    if (!matchedFile && fileIndex[folderKey].length > 0) {
      // Fallback: use first file (not ideal but better than broken links)
      matchedFile = fileIndex[folderKey][0];
    }
    
    if (matchedFile) {
      item.photos[0] = `${folderPath}/${matchedFile}`;
      fixedCount++;
    }
  });
  
  // Save
  fs.writeFileSync('db.json', JSON.stringify(db, null, 2), 'utf8');
  
  // Verify
  const verify = JSON.parse(fs.readFileSync('db.json'));
  console.log(`\n✓ Fixed ${fixedCount} items`);
  console.log(`Total items: ${verify.items.length}\n`);
  console.log('Sample items:');
  verify.items.slice(9, 13).forEach(item => {
    if (item.photos && item.photos[0]) {
      const fileName = item.photos[0].split('/').pop();
      console.log(`  ${item.name}`);
      console.log(`    → ${fileName}\n`);
    }
  });
  
} catch (error) {
  console.error('ERROR:', error.message);
  process.exit(1);
}
