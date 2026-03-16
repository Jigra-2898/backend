// Quick API test script
const http = require('http');

// Test 1: Get items
console.log('🔍 Testing API...\n');

const req = http.get('http://localhost:4000/api/items', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const items = JSON.parse(data);
      const firstItem = items[0];
      
      console.log('✅ /api/items response:');
      console.log(`   Name: ${firstItem.name}`);
      console.log(`   First photo: ${firstItem.photos[0]}`);
      console.log(`   Total photos: ${firstItem.photos.length}`);
      console.log('');
      
      // Test 2: Get categories
      const catReq = http.get('http://localhost:4000/api/categories', (catRes) => {
        let catData = '';
        catRes.on('data', chunk => catData += chunk);
        catRes.on('end', () => {
          try {
            const categories = JSON.parse(catData);
            console.log('✅ /api/categories response:');
            console.log(`   Total categories: ${categories.length}`);
            categories.forEach(c => console.log(`   - ${c.id}: ${c.name}`));
          } catch (e) {
            console.error('❌ Failed to parse categories:', e.message);
          }
        });
      });
      
      catReq.on('error', (e) => {
        console.error('❌ Categories request failed:', e.message);
      });
      
    } catch (e) {
      console.error('❌ Failed to parse items:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Items request failed:', e.message);
});
