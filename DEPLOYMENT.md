# Backend Deployment Guide

⚠️ **IMPORTANT: Images Excluded from Vercel - See "Images on Vercel" section below**

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

### Images on Vercel (Important!)

**⚠️ Vercel Function Size Limit: 300MB**

The 1,170+ product images (~480MB) exceed Vercel's 300MB function size limit. They are **intentionally excluded** from the function by `.vercelignore` to keep deployment working.

**Options for Production Image Hosting:**

1. **Option 1: Use External CDN (Recommended)** ✅
   - Upload images to AWS S3, Google Cloud Storage, or Cloudinary
   - Update `db.json` with full CDN URLs instead of relative paths
   - Example: `"https://cdn.example.com/images/product.png"` instead of `"uploads/images/..."`
   - No code changes needed - API will serve CDN URLs as-is

2. **Option 2: Vercel Blob Storage** ✅
   - Use Vercel's built-in blob storage service
   - Stores files outside the function (no size limit)
   - Reference in code: [Vercel Blob Docs](https://vercel.com/docs/storage/vercel-blob)

3. **Option 3: Separate Static Hosting** ✅
   - Deploy images to separate static hosting (Netlify, Cloudfront, etc.)
   - Update database to point to external URLs

4. **Option 4: Local Development Only** ⚠️
   - Keep setup as-is working locally
   - Images will return 404 on Vercel with helpful message
   - Good for development/testing, not production

**For Local Development:**
- Images are available in `uploads/images/` folder
- Run `npm start` to serve images locally via `/api/image/*`

**Quick Migration Guide (Option 1 - AWS S3):**
```bash
# 1. Upload images to S3 bucket
# 2. Get S3 URL for each image: https://your-bucket.s3.amazonaws.com/images/product.png
# 3. Update db.json to use full URLs instead of relative paths
# 4. Push to Vercel - no function size issues!
```

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
