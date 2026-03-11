const fs = require('fs');
const path = require('path');

const baseImages = path.join(__dirname, 'uploads', 'images');
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));

function slugify(str) {
  return str
    .toString()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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

const brandPatterns = {
  "Allo": ["allo"],
  "Breez": ["breez"],
  "Kraze": ["kraze"],
  "Flavour Beast": ["flavour beast", "beast mode"],
  "Level X": ["level x"],
  "Marz Bar": ["marz"],
  "NAR": ["nar shisha"],
  "Zpods": ["zpods"],
  "STLTH": ["stlth"],
  "Elf Bar": ["elf bar"],
  "Drip'n by Envi": ["dripn"]
};

function detectBrand(name) {
  const lower = name.toLowerCase();
  for (const [brand, patterns] of Object.entries(brandPatterns)) {
    for (const pat of patterns) {
      if (lower.includes(pat)) return brand;
    }
  }
  return null;
}

const allFiles = walk(baseImages);
const existingPhotos = new Set();

db.items.forEach(item => {
  if (item.photos && Array.isArray(item.photos)) {
    item.photos.forEach(photo => {
      const normalized = photo.replace(/^https?:\/\/[^/]+\//, '');
      existingPhotos.add(normalized);
    });
  }
});

let brandCounter = db.brands.length + 1;
let catCounter = db.categories.length + 1;
let itemCounter = db.items.length + 1;
let newBrands = 0;
let newCats = 0;
let newItems = 0;
let processedCount = 0;

// Process all files
allFiles.forEach(fullPath => {
  const rel = path.relative(baseImages, fullPath).split(path.sep);
  if (rel.length < 2) return;
  
  const topFolder = rel[0];
  const fileName = path.basename(fullPath);
  const photoPath = `uploads/images/${rel.join('/')}`;
  
  // Skip if already in db
  if (existingPhotos.has(photoPath)) return;
  
  processedCount++;
  
  // Detect brand
  const brand = detectBrand(topFolder);
  if (!brand) {
    console.log(`⚠ Could not detect brand from: "${topFolder}"`);
    return;
  }
  
  const brandSlug = slugify(brand);
  
  // Ensure brand exists
  let brandRecord = db.brands.find(b => slugify(b.name) === brandSlug);
  if (!brandRecord) {
    brandRecord = { id: `brand-${String(brandCounter++).padStart(3, '0')}`, name: brand };
    db.brands.push(brandRecord);
    newBrands++;
  }
  const brandId = brandRecord.id;
  
  // Extract product name (remove brand and special chars from folder)
  let productName = topFolder;
  
  // Remove brand name variations
  productName = productName.replace(new RegExp(brand, 'i'), '').trim();
  productName = productName.replace(/^[\s\-_,|ΓÇô]+|[\s\-_,|ΓÇô]+$/g, '');
  
  if (!productName || productName.length < 2) {
    productName = brand;
  }
  
  // Clean up product name
  productName = productName.replace(/[\s_-]{2,}/g, ' ').trim();
  
  const productSlug = slugify(productName);
  
  // Ensure category exists
  let catRecord = db.categories.find(c => 
    slugify(c.name) === productSlug && c.brandId === brandId
  );
  if (!catRecord) {
    catRecord = { 
      id: `cat-${String(catCounter++).padStart(3, '0')}`, 
      name: productName, 
      brandId 
    };
    db.categories.push(catRecord);
    newCats++;
  }
  const categoryId = catRecord.id;
  
  // Extract flavor
  const noExt = fileName.replace(/\.[^.]+$/, '');
  const flavorMatch = noExt.match(/\(([^)]+)\)|_([a-z_]+)\.|([a-z_]+)\.jpg/i);
  let flavor = flavorMatch ? (flavorMatch[1] || flavorMatch[2] || flavorMatch[3]) : null;
  if (flavor) flavor = flavor.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  // Find or create item
  let item = null;
  if (flavor) {
    item = db.items.find(i => 
      i.categoryId === categoryId &&
      i.name.includes(flavor) &&
      i.brandId === brandId
    );
  }
  
  if (item) {
    if (!item.photos) item.photos = [];
    item.photos.push(photoPath);
    console.log(`✓ Added photo to "${item.name}"`);
  } else {
    const itemName = flavor ? `${productName} (${flavor})` : productName;
    const newItem = {
      id: `item-${String(itemCounter++).padStart(3, '0')}`,
      name: itemName,
      description: `${brand} - ${itemName}`,
      brandId,
      categoryId,
      price: "0.00",
      status: "Active",
      photos: [photoPath]
    };
    db.items.push(newItem);
    newItems++;
    console.log(`✓ Created: "${itemName}"`);
  }
});

fs.writeFileSync('db.json', JSON.stringify(db, null, 2));

console.log(`\n=== Summary ===`);
console.log(`Processed files: ${processedCount}`);
console.log(`New brands: ${newBrands}`);
console.log(`New categories: ${newCats}`);
console.log(`New items: ${newItems}`);
console.log(`Total brands: ${db.brands.length}`);
console.log(`Total categories: ${db.categories.length}`);
console.log(`Total items: ${db.items.length}`);
