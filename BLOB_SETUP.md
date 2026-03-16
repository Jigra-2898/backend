# Vercel Blob Storage Setup Guide

## What is Vercel Blob?
Vercel Blob is a cost-effective, serverless blob storage solution that stores files outside your function. Perfect for:
- Storing images without hitting function size limits
- Automatic CDN distribution
- Simple authentication with tokens
- Built into Vercel dashboard

## Setup Steps

### 1. Install Dependencies
```bash
npm install @vercel/blob
```

### 2. Create Vercel Blob Token

#### Via Vercel Dashboard:
1. Go to your Vercel Project
2. Navigate to **Settings → Storage → Blob**
3. Click **Create Database**
4. Copy the token (starts with `vercel_blob_...`)

#### Or via Vercel CLI:
```bash
vercel env add BLOB_READ_WRITE_TOKEN
# Paste your token when prompted
```

### 3. Set Local Environment Variable

#### On Windows (PowerShell):
```powershell
$env:BLOB_READ_WRITE_TOKEN = "your_token_here"
node upload_to_blob.js
```

#### On Windows (Command Prompt):
```cmd
set BLOB_READ_WRITE_TOKEN=your_token_here
node upload_to_blob.js
```

#### On Mac/Linux:
```bash
export BLOB_READ_WRITE_TOKEN="your_token_here"
node upload_to_blob.js
```

### 4. Run Upload Script
```bash
node upload_to_blob.js
```

Expected output:
```
🚀 Starting Vercel Blob image upload...

📸 Scanning and uploading images...

⏳ Uploading: drip-n-by-envi/evo-63k-disposable-vapes-20ml-180-smoke/dripn_evo_63k_disposable_vape_0000s_0000_blue_razz.jpg...
   ✅ https://blob-... (URL will be shown)
...

✅ Upload Complete!

📊 Results:
   Images uploaded: 1170
   Upload errors: 0
   Items updated: 1132

💾 Database saved: db.json
```

### 5. Commit and Push
```bash
git add db.json package.json package-lock.json
git commit -m "Migrate images to Vercel Blob storage"
git push origin main
```

### 6. Verify on Production
1. Go to your live Vercel URL
2. Images should load from Blob URLs
3. Check Vercel Dashboard → Storage → Blob to see uploaded files

## How It Works

### Before (Local Images):
```json
{
  "photos": ["uploads/images/elf-bar/product.png"]
}
```
❌ Images included in function (481MB - exceeds 300MB limit)

### After (Vercel Blob):
```json
{
  "photos": ["https://blob-abc123...prod.vercel-storage.com/products/elf-bar/product.png"]
}
```
✅ Images stored separately, function <20MB

## API Changes

The `/api/image/*` endpoint automatically detects blob URLs and serves them:
- **Local paths** (`uploads/images/...`) → Serves from local filesystem
- **Blob URLs** (`https://blob-...`) → Returns as-is (CDN handles it)
- **HTTP URLs** (`https://example.com/...`) → Returns as-is

No code changes needed! 🎉

## Troubleshooting

### Error: "BLOB_READ_WRITE_TOKEN environment variable not set"
- Make sure you set the environment variable before running the script
- Check you copied the full token correctly

### Error: "Invalid token"
- Token may have expired
- Generate a new one from Vercel Dashboard
- Make sure it's a **Read-Write** token, not just read-only

### Some images fail to upload?
- Check file permissions
- Ensure files aren't corrupted
- Retry with: `node upload_to_blob.js`

### Images not showing on Vercel?
- Check Vercel Blob in Dashboard → verify files are uploaded
- Ensure `db.json` was updated with correct URLs
- Check browser DevTools → Network tab for blob URL response

## Cost

- **Free tier**: Up to 100 GB of storage
- **Pricing**: $0.50/GB after free tier
- **Bandwidth**: Unlimited, included in storage cost
- Perfect for up to ~200,000 product images

## Rollback (If Needed)

```bash
git revert <commit-hash>  # Rollback db.json
git push origin main
# Delete blobs from Vercel Dashboard if needed
```

## Next Steps

After blob migration:
1. ✅ Function size < 20MB
2. ✅ All 1,170 images accessible
3. ✅ Automatic CDN distribution
4. ✅ No more image size limitations
5. Deploy more products without worrying about size!
