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
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';

const app = express();
app.use(cors());
app.use(express.json());

// mount API router at /api
const apiRouter = express.Router();
app.use('/api', apiRouter);

// ensure uploads folder
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// We'll dynamically import lowdb (ESM) and then initialize DB, multer, routes, and start the server.
(async () => {
  const { Low } = await import('lowdb');
  const { JSONFile } = await import('lowdb/node');
  const { nanoid } = await import('nanoid');

  // lowdb setup
  const dbFile = path.join(__dirname, 'db.json');
  const adapter = new JSONFile(dbFile);
  const db = new Low(adapter, { brands: [], categories: [], items: [] });

  async function initDb() {
    await db.read();
    db.data = db.data || { brands: [], categories: [], items: [] };
    await db.write();
  }

  await initDb();

  // multer
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  });
  const upload = multer({ storage });

  // auth
  apiRouter.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const token = jwt.sign({ role: 'admin', email }, JWT_SECRET, { expiresIn: '8h' });
      return res.json({ token });
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

  // Brands
  apiRouter.get('/brands', async (req, res) => {
    await db.read();
    res.json(db.data.brands);
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
    // remove categories and items under brand
    const removedCatIds = db.data.categories.filter(c => c.brandId === id).map(c => c.id);
    db.data.categories = db.data.categories.filter(c => c.brandId !== id);
    db.data.items = db.data.items.filter(it => !removedCatIds.includes(it.categoryId));
    await db.write();
    res.json({ ok: true });
  });

  // Categories
  apiRouter.get('/categories', async (req, res) => {
    await db.read();
    res.json(db.data.categories);
  });

  apiRouter.post('/categories', authMiddleware, async (req, res) => {
    const { name, brandId } = req.body;
    if (!name || !brandId) return res.status(400).json({ message: 'Missing fields' });
    await db.read();
    const category = { id: nanoid(), name, brandId };
    db.data.categories.push(category);
    await db.write();
    res.json(category);
  });

  apiRouter.put('/categories/:id', authMiddleware, async (req, res) => {
    const id = req.params.id;
    const { name, brandId } = req.body;
    await db.read();
    const c = db.data.categories.find(x => x.id === id);
    if (!c) return res.status(404).json({ message: 'Not found' });
    c.name = name || c.name;
    c.brandId = brandId || c.brandId;
    await db.write();
    res.json(c);
  });

  apiRouter.delete('/categories/:id', authMiddleware, async (req, res) => {
    const id = req.params.id;
    await db.read();
    db.data.categories = db.data.categories.filter(x => x.id !== id);
    db.data.items = db.data.items.filter(it => it.categoryId !== id);
    await db.write();
    res.json({ ok: true });
  });

  // Items
  apiRouter.get('/items', async (req, res) => {
    await db.read();
    res.json(db.data.items);
  });

  apiRouter.get('/items/:id', async (req, res) => {
    await db.read();
    const item = db.data.items.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  });

  apiRouter.post('/items', authMiddleware, upload.array('photos', 8), async (req, res) => {
    const { name, description, brandId, categoryId, price, status } = req.body;
    if (!name || !categoryId) return res.status(400).json({ message: 'Missing required fields' });
    await db.read();
    const photos = (req.files || []).map(f => `/uploads/${path.basename(f.path)}`);
    const item = { id: nanoid(), name, description: description || '', brandId, categoryId, price: price || null, status: status || 'Active', photos };
    db.data.items.push(item);
    await db.write();
    res.json(item);
  });

  apiRouter.put('/items/:id', authMiddleware, upload.array('photos', 8), async (req, res) => {
    const id = req.params.id;
    const { name, description, brandId, categoryId, price, status, removePhotos } = req.body;
    await db.read();
    const it = db.data.items.find(x => x.id === id);
    if (!it) return res.status(404).json({ message: 'Not found' });
    if (name) it.name = name;
    if (description) it.description = description;
    if (brandId) it.brandId = brandId;
    if (categoryId) it.categoryId = categoryId;
    if (price !== undefined) it.price = price;
    if (status) it.status = status;
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
    // when running on Vercel the platform will call our exported `app`
    console.log('Running on Vercel - exporting express app as handler');
  }
})();

// Serve frontend production build if present
const clientDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// when running under Vercel we export the express `app` so the platform
// can hook it up as a serverless function. The `app.listen` call above
// will be skipped by checking process.env.VERCEL.
if (process.env.VERCEL) {
  module.exports = app;
}
