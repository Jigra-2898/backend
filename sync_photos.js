const fs = require('fs');
const path = require('path');

const baseImages = path.join(__dirname, 'uploads', 'images');
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

function slugify(str) {
  return str
    .replace(/\[([^\]]+)\]\s*/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9\-_.]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Collect all files from images folder
function walk(dir) {
  let results = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) {
      results = results.concat(walk(full));
    } else if (d.isFile()) {
      results.push(full);
    }
  });
  return results;
}

const allFiles = walk(baseImages);
const imagesByBrandCat = {}; // grouping by brand/category

// Organize files by brand and category
allFiles.forEach(fullPath => {
  const rel = path.relative(baseImages, fullPath).split(path.sep);
  if (rel.length < 3) return; // need at least brand/category/file
  
  const brand = rel[0];
  const category = rel[1];
  const fileName = path.basename(fullPath);
  const key = `${brand}/${category}`;
  
  if (!imagesByBrandCat[key]) imagesByBrandCat[key] = [];
  imagesByBrandCat[key].push({ fileName, fullPath, rel: rel.join('/') });
});

// Build set of existing photo paths in db
const existingPhotos = new Set();
db.items.forEach(item => {
  if (item.photos && Array.isArray(item.photos)) {
    item.photos.forEach(photo => {
      const normalized = photo.replace(/^https?:\/\/[^/]+\//, '');
      existingPhotos.add(normalized);
    });
  }
});

console.log(`Found ${existingPhotos.size} existing photos in db.json`);

// Process each brand/category group
let newItemsCount = 0;
let addedPhotosCount = 0;

Object.entries(imagesByBrandCat).forEach(([key, files]) => {
  const [brand, category] = key.split('/');
  const brandSlug = brand;
  const catSlug = category;
  
  // Find matching category in db
  const dbCat = db.categories.find(c => 
    c.name.toLowerCase().includes(catSlug.replace(/-/g, ' ')) ||
    slugify(c.name) === catSlug
  );
  
  if (!dbCat) {
    console.log(`⚠ Category not found for ${key}`);
    return;
  }
  
  const brandId = dbCat.brandId;
  const categoryId = dbCat.id;
  
  // Process each file
  files.forEach(fileObj => {
    const photoPath = `uploads/images/${fileObj.rel}`;
    
    // Check if photo exists in any item
    let photoExists = existingPhotos.has(photoPath);
    
    if (!photoExists) {
      // Extract flavor from filename
      const fileName = fileObj.fileName;
      const noExt = fileName.replace(/\.[^.]+$/, '');
      const flavorMatch = noExt.match(/\(([^)]+)\)/);
      const flavor = flavorMatch ? flavorMatch[1] : null;
      
      // Find or create item for this flavor
      let item = null;
      if (flavor) {
        // Look for existing item with same category and flavor
        item = db.items.find(i => 
          i.categoryId === categoryId && 
          i.name.includes(flavor) &&
          i.brandId === brandId
        );
      }
      
      if (item) {
        // Add photo to existing item
        if (!item.photos) item.photos = [];
        item.photos.push(photoPath);
        addedPhotosCount++;
        console.log(`✓ Added photo to "${item.name}"`);
      } else {
        // Create new item
        const itemName = flavor ? `${dbCat.name} (${flavor})` : dbCat.name;
        const newItem = {
          id: `item-${String(db.items.length + 1).padStart(3, '0')}`,
          name: itemName,
          description: `${db.brands.find(b => b.id === brandId).name} - ${itemName}`,
          brandId,
          categoryId,
          price: "0.00",
          status: "Active",
          photos: [photoPath]
        };
        db.items.push(newItem);
        newItemsCount++;
        console.log(`✓ Created new item: "${itemName}"`);
      }
    }
  });
});

// Save updated db
fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
console.log(`\nSummary:`);
console.log(`- New items created: ${newItemsCount}`);
console.log(`- Photos added to existing items: ${addedPhotosCount}`);
console.log(`- Total items in db: ${db.items.length}`);
console.log(`- Saved to db.json`);
