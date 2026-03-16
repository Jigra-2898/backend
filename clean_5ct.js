const fs = require('fs');

try {
  // Read the original file
  const data = JSON.parse(fs.readFileSync('db.json', 'utf8'));
  
  console.log('Original state:');
  console.log(`  Items: ${data.items.length}`);
  
  let changedCount = 0;
  
  // Remove " - 5ct" from all item names and descriptions
  data.items.forEach(item => {
    if (item.name && item.name.includes(' - 5ct')) {
      item.name = item.name.replace(/ - 5ct/g, '');
      changedCount++;
    }
    if (item.description && item.description.includes(' - 5ct')) {
      item.description = item.description.replace(/ - 5ct/g, '');
    }
  });
  
  // Also remove "-5ct" from section names
  data.sections.forEach(section => {
    if (section.name && section.name.includes(' - 5ct')) {
      section.name = section.name.replace(/ - 5ct/g, '');
    }
  });
  
  // Update folder paths
  data.items.forEach(item => {
    if (item.photos && Array.isArray(item.photos)) {
      item.photos = item.photos.map(photo => {
        // Remove -5ct from folder names in paths
        return photo.replace(/-5ct/g, '');
      });
    }
  });
  
  // Write back the updated data
  fs.writeFileSync('db.json', JSON.stringify(data, null, 2), 'utf8');
  
  // Verify
  const verify = JSON.parse(fs.readFileSync('db.json', 'utf8'));
  console.log('\nAfter cleanup:');
  console.log(`  Items changed: ${changedCount}`);
  console.log(`  Total items: ${verify.items.length}`);
  
  // Show before/after examples
  console.log('\nExamples of changes:');
  let exampleCount = 0;
  verify.items.forEach((item, idx) => {
    if (exampleCount < 3 && idx < 100) {
      console.log(`  ${item.id}: ${item.name}`);
      exampleCount++;
    }
  });
  
  console.log('\n✓ File updated successfully');
  
} catch (error) {
  console.log('ERROR: ' + error.message);
  process.exit(1);
}
