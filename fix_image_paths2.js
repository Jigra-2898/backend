const fs = require('fs');
const path = require('path');

try {
  const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
  const imagesDir = './uploads/images';
  
  // Build a complete file mapping by folder
  const filesByFolder = {};
  
  function mapFilesByFolder(dir, prefix = '') {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.forEach(entry => {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(prefix, entry.name).replace(/\\/g, '/');
        
        if (entry.isFile()) {
          if (!filesByFolder[prefix]) {
            filesByFolder[prefix] = {};
          }
          filesByFolder[prefix][entry.name] = `uploads/images/${relPath}`;
        } else if (entry.isDirectory()) {
          mapFilesByFolder(fullPath, relPath);
        }
      });
    } catch (e) {
      // Skip if directory doesn't exist
    }
  }
  
  console.log('Building file mapping...');
  mapFilesByFolder(imagesDir);
  console.log(`Mapped ${Object.keys(filesByFolder).length} folders\n`);
  
  let fixedCount = 0;
  
  // Fix each item's photos
  db.items.forEach((item, idx) => {
    if (!item.photos || !Array.isArray(item.photos)) return;
    
    item.photos = item.photos.map(photoPath => {
      // Extract folder and filename
      const parts = photoPath.split('/');
      const filename = parts[parts.length - 1];
      const folderParts = parts.slice(0, -1).join('/'); // uploads/images/brand/product
      const folderKey = folderParts.replace('uploads/images/', ''); // brand/product
      
      // Try to find the folder in our mapping
      if (filesByFolder[folderKey]) {
        // Get all files in that folder
        const filesInFolder = Object.keys(filesByFolder[folderKey]);
        
        // Extract flavor from item name (last part in parentheses if exists)
        let flavor = '';
        const nameMatch = item.name.match(/\(([^)]+)\)/);
        if (nameMatch) {
          flavor = nameMatch[1].toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
        }
        
        // Find matching file
        let matchedFile = null;
        
        if (flavor) {
          // Try to find file with matching flavor
          matchedFile = filesInFolder.find(f => 
            f.toLowerCase().includes(flavor) || 
            flavor.includes(f.toLowerCase().split('-').slice(-2).join('-'))
          );
        }
        
        // If no match, try to find any file in that folder
        if (!matchedFile && filesInFolder.length > 0) {
          matchedFile = filesInFolder[0];
        }
        
        if (matchedFile) {
          fixedCount++;
          return filesByFolder[folderKey][matchedFile];
        }
      }
      
      return photoPath; // Return original if no match
    });
  });
  
  // Save the updated database
  fs.writeFileSync('db.json', JSON.stringify(db, null, 2), 'utf8');
  
  // Verify
  const verify = JSON.parse(fs.readFileSync('db.json'));
  console.log('✓ Image paths updated');
  console.log(`  Items with photos fixed: ${fixedCount}`);
  console.log(`  Total items: ${verify.items.length}`);
  console.log('\nSample paths:');
  
  verify.items.slice(9, 13).forEach(item => {
    if (item.photos && item.photos[0]) {
      const fileName = item.photos[0].split('/').pop();
      console.log(`  ${item.name}`);
      console.log(`    → .../${fileName}`);
    }
  });
  
} catch (error) {
  console.error('ERROR:', error.message);
  process.exit(1);
}
