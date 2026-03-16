# Backend Deployment Guide

## Local Development

```bash
npm install
npm start
```

Server runs on `http://localhost:4000`

## Database

The database contains all product data perfectly aligned with actual image files:
- **Items**: 1,132 products
- **Brands**: 12
- **Categories**: 4 (Disposable Vapes, Pods, 0 Nicotine, Hybrid Devices)
- **Sections**: 25 (product lines)
- **Images**: 571 actual image files
- **Alignment**: 100% - All items have valid, verified image paths

**Image Distribution**:
- Each product folder cycles through its available images for all items
- Example: If a product has 110 items but only 50 unique images, images are repeated cyclically
- All image file paths are verified to exist on disk

## Environment Variables

Create a `.env` file with:
```
PORT=4000
JWT_SECRET=your_jwt_secret_here
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=password123
STAFF_EMAIL=staff@example.com
STAFF_PASSWORD=password123
```

## Vercel Deployment

### Prerequisites
1. Ensure `.env` variables are set in Vercel Dashboard under Project Settings → Environment Variables
2. Make sure `vercel.json` is properly configured
3. `.vercelignore` prevents node_modules from being uploaded

### Required Environment Variables on Vercel
- `JWT_SECRET` - JWT signing key
- `ADMIN_EMAIL` - Admin user email
- `ADMIN_PASSWORD` - Admin user password  
- `STAFF_EMAIL` - Staff user email
- `STAFF_PASSWORD` - Staff user password
- `NODE_ENV` - Set to `production`
- `API_BASE_URL` - ⚠️ **CRITICAL FOR IMAGES** - Set to your Vercel URL (e.g., `https://backend-xxxxx.vercel.app`)
- `FRONTEND_URLS` - ⚠️ **FOR CORS** - Frontend Vercel URLs (comma-separated, e.g., `https://frontend-xxxxx.vercel.app`)
  - By default, all `*.vercel.app` origins are accepted for development convenience
  - In production, set this to your specific frontend URL(s)

### Troubleshooting Crashes

If you see "FUNCTION_INVOCATION_FAILED" or 500 errors:

1. **Check Vercel Logs**: 
   - Go to Vercel Dashboard → Functions tab
   - Look for logs with `[INIT]`, `[DB INIT]`, `[ROUTE INIT]`, or `[FATAL ERROR]` tags

2. **Common Issues**:
   - Missing environment variables
   - Database file not writable (using /tmp on Vercel - data lost on cold start)
   - Function timeout (default 60s, set in vercel.json)
   - Memory exceeded (set to 1024MB in vercel.json)

### Images Not Loading

If images show 404 or don't load on your published URL:

1. **Verify `API_BASE_URL` is set correctly** ✅
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Ensure `API_BASE_URL` is set to your Vercel URL WITHOUT trailing slash
   - Example: `https://backend-livid-phi-92.vercel.app` (not `https://backend-livid-phi-92.vercel.app/`)

2. **Images are served via API endpoint**:
   - The app now uses `/api/image/*` endpoint to serve images
   - This is more reliable than static middleware on Vercel serverless
   - Image URLs are auto-generated: `{API_BASE_URL}/api/image/{imagePath}`

3. **Verify images are in repository**:
   - Make sure `uploads/` folder is committed to git
   - Images should exist at `uploads/images/{product-category}/{image-files}`
   - Check that `.vercelignore` does NOT exclude the `uploads/` folder

4. **Test image endpoints**:
   ```bash
   # Test API image endpoint
   curl "https://your-backend-url.vercel.app/api/image/images/elf-bar/gh20k-disposable-vape/image.jpg"
   ```

5. **If still not working**:
   - Check Vercel Function logs for 'Uploads dir exists' message
   - Verify the exact image path matches what's in db.json
   - Images use relative paths like `uploads/images/...` in the database

3. **Test Endpoints Locally**:
   ```bash
   # Health check
   curl http://localhost:4000/api/health
   
   # Admin login
   curl -X POST http://localhost:4000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"password123"}'
   ```

### Debug Logging
- All initialization steps are logged with `[INIT]`, `[DB INIT]`, `[ROUTE INIT]` prefixes
- Check Vercel Function logs for these messages to track where crashes occur

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login endpoint (returns token and role)

### Images
- `GET /api/image/*` - Serve image files (public, no auth required)
  - Example: `/api/image/images/elf-bar/gh20k-disposable-vape/image.jpg`
  - Includes CORS headers, suitable for frontend consumption

### Brands
- `GET /api/brands` - List all brands
- `GET /api/brands/:id` - Get specific brand by ID
- `POST /api/brands` - Create brand (requires auth)
- `PUT /api/brands/:id` - Update brand (requires auth)
- `DELETE /api/brands/:id` - Delete brand (requires auth)

### Categories
- `GET /api/categories` - List all categories
- `GET /api/categories/:id` - Get specific category by ID

### Sections (Product Lines)
- `GET /api/sections` - List all sections
- `GET /api/sections/:id` - Get specific section by ID
- `POST /api/sections` - Create section (requires auth)
- `PUT /api/sections/:id` - Update section (requires auth)
- `DELETE /api/sections/:id` - Delete section (requires auth)

### Items
- `GET /api/items` - List all items
- `GET /api/items/:id` - Get specific item by ID
- `POST /api/items` - Create item with photos (requires auth)
- `PUT /api/items/:id` - Update item (requires auth)
- `DELETE /api/items/:id` - Delete item (requires auth)

### Health Check
- `GET /api/health` - Detailed health check
- `GET /` - Simple health check
