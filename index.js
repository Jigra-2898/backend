const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
 

require('dotenv').config();

let server = null;

function gracefulShutdown(code = 0) {
  console.log('Shutting down gracefully...');
  if (server && server.close) {
    server.close(() => {
      console.log('Server closed. Exiting.');
      process.exit(code);
    });
    setTimeout(() => {
      console.error('Force exit after timeout.');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(code);
  }
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && err.stack ? err.stack : err);
  gracefulShutdown(1);
});

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
  gracefulShutdown(1);
});

process.on('SIGINT', () => gracefulShutdown(0));
process.on('SIGTERM', () => gracefulShutdown(0));

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// User credentials with consistent fields
const users = {
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'password123',
    role: 'admin'
  },
  staff: {
    email: process.env.STAFF_EMAIL || 'staff@example.com',
    password: process.env.STAFF_PASSWORD || 'password123',
    role: 'staff'
  }
};

const app = express();

// CORS: allow specific frontend origins (add yours here)
// In production, set FRONTEND_URLS env variable (comma-separated)
const defaultAllowedOrigins = [
  'https://frontend-beta-silk-13.vercel.app',
  'https://backend-livid-phi-92.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

const frontendUrls = process.env.FRONTEND_URLS 
  ? process.env.FRONTEND_URLS.split(',').map(url => url.trim())
  : [];

const allowedOrigins = [...defaultAllowedOrigins, ...frontendUrls];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow server-to-server or curl requests
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Accept all vercel.app origins in development/production
    if (origin.includes('vercel.app')) return callback(null, true);
    return callback(new Error('CORS_NOT_ALLOWED'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Backend is running', status: 'OK', timestamp: new Date().toISOString() });
});

// Health check for Vercel
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    dbInitialized,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Config endpoint - returns API base URL
app.get('/api/config', (req, res) => {
  const apiBaseUrl = process.env.API_BASE_URL || `http://${req.get('host')}`;
  res.json({ apiBaseUrl });
});

// mount API router at /api
const apiRouter = express.Router();
app.use('/api', apiRouter);

// ensure uploads folder
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Debug logging for uploads
if (process.env.NODE_ENV === 'development' || process.env.VERCEL) {
  console.log(`Serving uploads from: ${uploadsDir}`);
  console.log(`Uploads dir exists: ${fs.existsSync(uploadsDir)}`);
  const imagesPath = path.join(uploadsDir, 'images');
  if (fs.existsSync(imagesPath)) {
    console.log(`Images dir exists with items:`, fs.readdirSync(imagesPath).slice(0, 5));
  }
}

// Serve static files with caching headers
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '1h',
  lastModified: true,
  etag: false,
  setHeaders: (res, filePath) => {
    // Add CORS headers for images
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
}));

// Global state for db - will be initialized async
let db = null;
let nanoid = null;
let dbInitialized = false;
let initError = null;

// We'll dynamically import lowdb (ESM) and then initialize DB, multer, routes, and start the server.
const initPromise = (async () => {
  try {
    const { Low } = await import('lowdb');
    const { JSONFile } = await import('lowdb/node');
    const nanonModule = await import('nanoid');
    nanoid = nanonModule.nanoid;

    // lowdb setup
    // Use /tmp on Vercel (writable), __dirname locally (persistent)
    const dbFile = process.env.VERCEL 
      ? path.join('/tmp', 'db.json') 
      : path.join(__dirname, 'db.json');
    const adapter = new JSONFile(dbFile);
    db = new Low(adapter, { brands: [], categories: [], items: [] });
    
    if (process.env.VERCEL) {
      console.log('⚠️  Using ephemeral /tmp for database (data lost on cold start). Consider using a managed database.');
    }

    async function initDb() {
      await db.read();
      
      // If database is empty and we're on Vercel, seed with data from persistent db.json
      if (process.env.VERCEL && (!db.data || db.data.brands?.length === 0)) {
        const persistentDbPath = path.join(__dirname, 'db.json');
        if (fs.existsSync(persistentDbPath)) {
          try {
            const seedData = JSON.parse(fs.readFileSync(persistentDbPath, 'utf-8'));
            db.data = seedData;
            console.log('Seeded /tmp database with persistent db.json data');
          } catch (e) {
            console.error('Failed to seed database from db.json:', e);
            db.data = db.data || { brands: [], categories: [], items: [] };
          }
        } else {
          db.data = db.data || { brands: [], categories: [], items: [] };
        }
      } else {
        db.data = db.data || { brands: [], categories: [], items: [] };
      }
      
      await db.write();
    }

    await initDb();
    dbInitialized = true;
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    initError = error;
  }
})();

// Middleware to ensure DB is initialized before handling requests
const ensureDbInitialized = async (req, res, next) => {
  if (dbInitialized) {
    return next();
  }
  try {
    await initPromise;
    if (initError) throw initError;
    next();
  } catch (error) {
    console.error('Database not ready:', error);
    res.status(500).json({ message: 'Database initialization failed', error: error.message });
  }
};

app.use('/api', ensureDbInitialized);

// Wait for initialization to complete, then set up routes
(async () => {
  try {
    await initPromise;
    if (initError) throw initError;

    // Helper to build full URLs for images
    const getBaseUrl = (req) => {
      // Priority: env variable > detect from host
      if (process.env.API_BASE_URL) {
        return process.env.API_BASE_URL;
      }
      // On Vercel, use x-forwarded-proto and host headers
      const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
      const host = req.get('x-forwarded-host') || req.get('host');
      return `${protocol}://${host}`;
    };

    const transformItemPhotos = (item, baseUrl) => {
      if (!item.photos || !Array.isArray(item.photos)) return item;
      return {
        ...item,
        photos: item.photos.map(photo => {
          // Already an absolute URL
          if (photo.startsWith('http')) return photo;
          
          // Convert paths to API image endpoint for reliability on Vercel
          let imagePath = photo;
          if (photo.startsWith('/uploads/')) {
            imagePath = photo.substring('/uploads/'.length);
          } else if (photo.startsWith('uploads/')) {
            imagePath = photo.substring('uploads/'.length);
          }
          
          const cleanBaseUrl = baseUrl.replace(/\/$/, '');
          // Use /api/image/ endpoint as primary (more reliable on Vercel)
          return `${cleanBaseUrl}/api/image/${imagePath}`;
        })
      };
    };

    // multer
    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadsDir),
      filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
    });
    const upload = multer({ storage });

    // auth
    apiRouter.post('/auth/login', async (req, res) => {
      const { email, password } = req.body;
      
      // Check credentials against all users
      for (const [key, user] of Object.entries(users)) {
        if (email === user.email && password === user.password) {
          const token = jwt.sign({ role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
          return res.json({ token, role: user.role });
        }
      }
      
      return res.status(401).json({ message: 'Invalid credentials' });
    });

    function authMiddleware(req, res, next) {
      const auth = req.headers.authorization;
      if (!auth) return res.status(401).json({ message: 'No token' });
      const parts = auth.split(' ');
      if (parts.length !== 2) return res.status(401).json({ message: 'Bad auth' });
      const token = parts[1];
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
      } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
      }
    }

    // Image serving endpoint (optional fallback if static middleware fails on Vercel)
    apiRouter.get('/image/*', async (req, res) => {
      const imagePath = req.params[0]; // Get the * part of the route
      const fullPath = path.join(uploadsDir, imagePath);
      
      // Security: prevent directory traversal
      if (!fullPath.startsWith(uploadsDir)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ message: 'Image not found' });
      }
      
      // Set appropriate headers
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.sendFile(fullPath);
    });

    // Brands
    apiRouter.get('/brands', async (req, res) => {
      await db.read();
      res.json(db.data.brands);
    });

    apiRouter.get('/brands/:id', async (req, res) => {
      const id = req.params.id;
      await db.read();
      const brand = db.data.brands.find(x => x.id === id);
      if (!brand) return res.status(404).json({ message: 'Brand not found' });
      res.json(brand);
    });

    apiRouter.post('/brands', authMiddleware, async (req, res) => {
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: 'Name required' });
      await db.read();
      const brand = { id: nanoid(), name };
      db.data.brands.push(brand);
      await db.write();
      res.json(brand);
    });

    apiRouter.put('/brands/:id', authMiddleware, async (req, res) => {
      const id = req.params.id;
      const { name } = req.body;
      await db.read();
      const b = db.data.brands.find(x => x.id === id);
      if (!b) return res.status(404).json({ message: 'Not found' });
      b.name = name || b.name;
      await db.write();
      res.json(b);
    });

    apiRouter.delete('/brands/:id', authMiddleware, async (req, res) => {
      const id = req.params.id;
      await db.read();
      db.data.brands = db.data.brands.filter(x => x.id !== id);
      // remove sections and items under brand
      const removedSectionIds = db.data.sections.filter(s => s.brandId === id).map(s => s.id);
      db.data.sections = db.data.sections.filter(s => s.brandId !== id);
      db.data.items = db.data.items.filter(it => !removedSectionIds.includes(it.sectionId));
      await db.write();
      res.json({ ok: true });
    });

    // Main Categories (product types) - read-only from database
    apiRouter.get('/categories', async (req, res) => {
      try {
        await db.read();
        res.json(db.data.categories);
      } catch (error) {
        console.error('Error reading categories:', error);
        res.status(500).json({ message: 'Failed to read categories' });
      }
    });

    apiRouter.get('/categories/:id', async (req, res) => {
      const id = req.params.id;
      try {
        await db.read();
        const cat = db.data.categories.find(x => x.id === id);
        if (!cat) return res.status(404).json({ message: 'Category not found' });
        res.json(cat);
      } catch (error) {
        console.error('Error reading category:', error);
        res.status(500).json({ message: 'Failed to read category' });
      }
    });

    // Sections (product lines) - CRUD operations
    apiRouter.get('/sections', async (req, res) => {
      await db.read();
      res.json(db.data.sections);
    });

    apiRouter.get('/sections/:id', async (req, res) => {
      const id = req.params.id;
      await db.read();
      const section = db.data.sections.find(x => x.id === id);
      if (!section) return res.status(404).json({ message: 'Section not found' });
      res.json(section);
    });

    apiRouter.post('/sections', authMiddleware, async (req, res) => {
      const { name, brandId } = req.body;
      if (!name || !brandId) return res.status(400).json({ message: 'Missing fields' });
      await db.read();
      // Determine category based on name
      const categoryId = (() => {
        const nameLower = name.toLowerCase();
        if (nameLower.includes('0nic') || nameLower.includes('nicotine free')) return 'cat-0nic';
        if (nameLower.includes('pod') && !nameLower.includes('disposable')) return 'cat-pods';
        if (nameLower.includes('hybrid')) return 'cat-hybrid';
        return 'cat-disp';
      })();
      const section = { id: nanoid(), name, brandId, categoryId };
      db.data.sections.push(section);
      await db.write();
      res.json(section);
    });

    apiRouter.put('/sections/:id', authMiddleware, async (req, res) => {
      const id = req.params.id;
      const { name, brandId, categoryId } = req.body;
      await db.read();
      const s = db.data.sections.find(x => x.id === id);
      if (!s) return res.status(404).json({ message: 'Not found' });
      s.name = name || s.name;
      s.brandId = brandId || s.brandId;
      s.categoryId = categoryId || s.categoryId;
      await db.write();
      res.json(s);
    });

    apiRouter.delete('/sections/:id', authMiddleware, async (req, res) => {
      const id = req.params.id;
      await db.read();
      db.data.sections = db.data.sections.filter(x => x.id !== id);
      db.data.items = db.data.items.filter(it => it.sectionId !== id);
      await db.write();
      res.json({ ok: true });
    });

    // Items
    apiRouter.get('/items', async (req, res) => {
      await db.read();
      const baseUrl = getBaseUrl(req);
      const transformedItems = db.data.items.map(item => transformItemPhotos(item, baseUrl));
      res.json(transformedItems);
    });

    apiRouter.get('/items/:id', async (req, res) => {
      await db.read();
      const item = db.data.items.find(i => i.id === req.params.id);
      if (!item) return res.status(404).json({ message: 'Not found' });
      const baseUrl = getBaseUrl(req);
      res.json(transformItemPhotos(item, baseUrl));
    });

    apiRouter.post('/items', authMiddleware, upload.array('photos', 8), async (req, res) => {
      const { name, description, brandId, categoryId, sectionId, price, status, outofstock } = req.body;
      if (!name || !categoryId || !sectionId) return res.status(400).json({ message: 'Missing required fields (name, categoryId, sectionId)' });
      await db.read();
      const photos = (req.files || []).map(f => `/uploads/${path.basename(f.path)}`);
      const item = { 
        id: nanoid(), 
        name, 
        description: description || '', 
        brandId: brandId || null, 
        categoryId, 
        sectionId, 
        price: price || null, 
        status: status || 'Active', 
        outofstock: outofstock === 'true' || outofstock === true || false,
        photos 
      };
      db.data.items.push(item);
      await db.write();
      res.json(item);
    });

    apiRouter.put('/items/:id', authMiddleware, upload.array('photos', 8), async (req, res) => {
      const id = req.params.id;
      const { name, description, brandId, categoryId, sectionId, price, status, outofstock, removePhotos } = req.body;
      await db.read();
      const it = db.data.items.find(x => x.id === id);
      if (!it) return res.status(404).json({ message: 'Not found' });
      if (name) it.name = name;
      if (description) it.description = description;
      if (brandId) it.brandId = brandId;
      if (categoryId) it.categoryId = categoryId;
      if (sectionId) it.sectionId = sectionId;
      if (price !== undefined) it.price = price;
      if (status) it.status = status;
      if (outofstock !== undefined) it.outofstock = outofstock === 'true' || outofstock === true;
      // removePhotos is comma separated paths
      if (removePhotos) {
        const toRemove = String(removePhotos).split(',').map(s => s.trim()).filter(Boolean);
        it.photos = it.photos.filter(p => !toRemove.includes(p));
      }
      if (req.files && req.files.length) {
        const newPhotos = req.files.map(f => `/uploads/${path.basename(f.path)}`);
        it.photos = it.photos.concat(newPhotos);
      }
      await db.write();
      res.json(it);
    });

    apiRouter.delete('/items/:id', authMiddleware, async (req, res) => {
      const id = req.params.id;
      await db.read();
      db.data.items = db.data.items.filter(x => x.id !== id);
      await db.write();
      res.json({ ok: true });
    });

    // start server only when not running in a serverless / Vercel environment
    if (!process.env.VERCEL) {
      server = app.listen(PORT, () => {
        console.log(`Backend running on http://localhost:${PORT}`);
      });
    } else {
      console.log('Running on Vercel - serverless function ready');
    }
  } catch (error) {
    console.error('Fatal error during route initialization:', error);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  }
})().catch(error => {
  console.error('Fatal error during initialization:', error);
  if (!process.env.VERCEL) {
    process.exit(1);
  }
});

// Serve frontend production build if present
const clientDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handler - provide clearer response for CORS rejections
app.use((err, req, res, next) => {
  if (err && err.message === 'CORS_NOT_ALLOWED') {
    return res.status(403).json({ message: 'CORS origin not allowed' });
  }
  console.error('Unhandled error:', err);
  
  // Return proper error response
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Handle 404s
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Export app for Vercel - it will use this as the serverless handler
module.exports = app;
