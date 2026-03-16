const fs = require('fs');
const path = require('path');

// Read the database
const dbPath = path.join(__dirname, 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

// Process all items
if (db.items && Array.isArray(db.items)) {
  let updateCount = 0;
  
  db.items.forEach(item => {
    if (item.photos && Array.isArray(item.photos)) {
      item.photos = item.photos.map(photo => {
        // Remove patterns like -5ct, -4ct, -3ct, etc. from the path
        const updated = photo.replace(/-\d+ct(?=\/|$)/gi, '');
        if (updated !== photo) {
          updateCount++;
        }
        return updated;
      });
    }
  });
  
  // Write updated database back
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
  console.log('✓ Removed -XCt from all photo paths in db.json');
  console.log(`✓ Updated ${updateCount} photo paths`);
  console.log(`✓ Processed ${db.items ? db.items.length : 0} items`);
}
