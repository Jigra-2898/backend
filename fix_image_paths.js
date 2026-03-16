const fs = require('fs');
const path = require('path');

try {
  const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
  const imagesDir = './uploads/images';
  
  let fixedCount = 0;
  let notFoundCount = 0;
  
  // Function to get all files in a directory recursively
  function getFilesInDir(dir) {
    const files = {};
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.forEach(entry => {
        if (entry.isFile()) {
          files[entry.name] = path.join(dir, entry.name).replace(/\\/g, '/');
        } else if (entry.isDirectory()) {
          Object.assign(files, getFilesInDir(path.join(dir, entry.name)));
        }
      });
    } catch (e) {
      // Directory doesn't exist
    }
    return files;
  }
  
  // Build a map of all available files
  console.log('Scanning image directory...');
  const allFiles = getFilesInDir(imagesDir);
  console.log(`  Found ${Object.keys(allFiles).length} image files`);
  
  // Fix each item's photo paths
  db.items.forEach((item, idx) => {
    if (item.photos && Array.isArray(item.photos)) {
      item.photos = item.photos.map(photoPath => {
        // Extract the folder from the path and the target filename
        const parts = photoPath.split('/');
        const filename = parts[parts.length - 1];
        
        // Try to find a matching file
        // First, try exact match
        if (allFiles[filename]) {
          return allFiles[filename].replace(/^\.\//, 'uploads/');
        }
        
        // Try removing imgi_XX_ prefix and matching
        const nameWithoutImgPrefix = filename.replace(/^imgi_\d+_/, '');
        const matches = Object.keys(allFiles).filter(f => 
          f.endsWith(nameWithoutImgPrefix) || 
          f.includes(nameWithoutImgPrefix.replace(/-disposable-vape\./, '-disposable-vape-5ct.').replace(/-5ct/, ''))
        );
        
        if (matches.length > 0) {
          fixedCount++;
          return allFiles[matches[0]].replace(/^\.\//, 'uploads/');
        }
        
        // If still not found, try to construct the path from folder info
        const folderPath = parts.slice(0, -1).join('/');
        const baseName = nameWithoutImgPrefix.replace(/\.png$|\.jpg$/, '');
        
        // Look for any file in that folder matching the pattern
        const folderFiles = Object.keys(allFiles).filter(f => 
          f.includes(baseName.split('-')[baseName.split('-').length - 1]) &&
          allFiles[f].includes(folderPath)
        );
        
        if (folderFiles.length > 0) {
          fixedCount++;
          return allFiles[folderFiles[0]].replace(/^\.\//, 'uploads/');
        }
        
        notFoundCount++;
        return photoPath; // Return original if no match found
      });
    }
  });
  
  // Save the updated database
  fs.writeFileSync('db.json', JSON.stringify(db, null, 2), 'utf8');
  
  // Verify the result
  const verify = JSON.parse(fs.readFileSync('db.json'));
  console.log('\n✓ Fixed image paths:');
  console.log(`  Paths fixed: ${fixedCount}`);
  console.log(`  Not found: ${notFoundCount}`);
  console.log(`  Total items: ${verify.items.length}`);
  console.log('\nSample updated paths:');
  verify.items.slice(9, 12).forEach(item => {
    if (item.photos && item.photos[0]) {
      console.log(`  ${item.name}`);
      console.log(`    → ${item.photos[0]}`);
    }
  });
  
} catch (error) {
  console.error('ERROR:', error.message);
  process.exit(1);
}
