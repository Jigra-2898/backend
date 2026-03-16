#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { put } = require('@vercel/blob');

/**
 * VERCEL BLOB IMAGE UPLOAD SCRIPT
 * 
 * This script uploads all images from uploads/images to Vercel Blob storage
 * and updates db.json with the public blob URLs.
 * 
 * Prerequisites:
 * 1. Install package: npm install @vercel/blob
 * 2. Set environment variable: BLOB_READ_WRITE_TOKEN (from Vercel Dashboard)
 * 3. Run: node upload_to_blob.js
 */

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

if (!BLOB_TOKEN) {
  console.error('❌ Error: BLOB_READ_WRITE_TOKEN environment variable not set');
  console.error('\nHow to set it:');
  console.error('1. Go to Vercel Dashboard → Project → Settings → Storage → Blob');
  console.error('2. Create a token or copy existing one');
  console.error('3. Set environment variable: export BLOB_READ_WRITE_TOKEN="your_token"');
  process.exit(1);
}

console.log('🚀 Starting Vercel Blob image upload...\n');

const imagesDir = path.join(__dirname, 'uploads', 'images');
const db = JSON.parse(fs.readFileSync(path.join(__dirname, 'db.json'), 'utf-8'));

let uploadCount = 0;
let errorCount = 0;
const uploadedUrls = new Map(); // Maps local path to blob URL

/**
 * Recursively scan and upload all image files
 */
async function uploadImagesRecursive(dir, relativePrefix = '') {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        // Recursively process subdirectories
        await uploadImagesRecursive(fullPath, relativePath);
      } else if (/\.(png|jpg|jpeg|gif|webp)$/i.test(entry.name)) {
        // Upload image file
        try {
          const fileContent = fs.readFileSync(fullPath);
          const blobPath = `products/${relativePath}`;
          
          console.log(`⏳ Uploading: ${relativePath}...`);
          
          const blob = await put(blobPath, fileContent, {
            access: 'public',
            token: BLOB_TOKEN,
          });
          
          uploadedUrls.set(`uploads/images/${relativePath}`, blob.url);
          uploadCount++;
          
          console.log(`   ✅ ${blob.url}`);
        } catch (err) {
          errorCount++;
          console.error(`   ❌ Failed: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err.message);
  }
}

/**
 * Update database items with blob URLs
 */
function updateDatabaseUrls() {
  console.log('\n📝 Updating database with blob URLs...\n');
  
  let itemsUpdated = 0;
  
  for (const item of db.items) {
    if (item.photos && item.photos.length > 0) {
      const oldPath = item.photos[0];
      
      if (uploadedUrls.has(oldPath)) {
        const newUrl = uploadedUrls.get(oldPath);
        item.photos = [newUrl];
        itemsUpdated++;
      }
    }
  }
  
  return itemsUpdated;
}

/**
 * Main execution
 */
async function main() {
  try {
    // Upload all images
    console.log('📸 Scanning and uploading images...\n');
    await uploadImagesRecursive(imagesDir);
    
    // Update database
    const itemsUpdated = updateDatabaseUrls();
    
    // Save updated database
    fs.writeFileSync(
      path.join(__dirname, 'db.json'),
      JSON.stringify(db, null, 2)
    );
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Upload Complete!');
    console.log('='.repeat(60));
    console.log(`\n📊 Results:`);
    console.log(`   Images uploaded: ${uploadCount}`);
    console.log(`   Upload errors: ${errorCount}`);
    console.log(`   Items updated: ${itemsUpdated}`);
    console.log(`\n💾 Database saved: db.json`);
    console.log('\n🚀 Next steps:');
    console.log('   1. Commit changes: git add db.json && git commit -m "Update database with Vercel Blob URLs"');
    console.log('   2. Push to Vercel: git push origin main');
    console.log('   3. No more size limit issues! Images are served from Blob storage.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
