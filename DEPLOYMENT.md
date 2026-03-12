# Backend Deployment Guide

## Local Development

```bash
npm install
npm start
```

Server runs on `http://localhost:4000`

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

### Brands (Protected)
- `GET /api/brands` - List all brands
- `POST /api/brands` - Create brand (requires auth)
- `PUT /api/brands/:id` - Update brand (requires auth)
- `DELETE /api/brands/:id` - Delete brand (requires auth)

### Items (Protected)
- `GET /api/items` - List all items
- `POST /api/items` - Create item with photos (requires auth)
- `PUT /api/items/:id` - Update item (requires auth)
- `DELETE /api/items/:id` - Delete item (requires auth)

### Health Check
- `GET /api/health` - Detailed health check
- `GET /` - Simple health check
