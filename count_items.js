const fs = require('fs');

const c = fs.readFileSync('db.json', 'utf8');
const m = c.match(/"id":\s*"item-(\d+)"/g);

console.log('Total items found: ' + (m ? m.length : 0));
if(m) {
  console.log('First item: ' + m[0]);
  console.log('Last item: ' + m[m.length-1]);
  
  // Find last item position
  const lastItemStr = m[m.length-1];
  const lastPos = c.lastIndexOf(lastItemStr);
  console.log('Last item at position: ' + lastPos);
  
  // Show context around last item
  console.log('\nContext (500 chars after last item id):');
  console.log(c.substring(lastPos, lastPos + 500));
}
