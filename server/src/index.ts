import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { initDb } from './db/index.js';
import { stationsRouter } from './routes/stations.js';
import { favoritesRouter } from './routes/favorites.js';
import { historyRouter } from './routes/history.js';
import { carsRouter } from './routes/cars.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

const CLIENT_DIST =
  process.env.CLIENT_DIST ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist');

app.use(cors({ origin: process.env.CORS_ORIGIN === '*' ? true : (process.env.CORS_ORIGIN ?? 'http://localhost:5173') }));
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(self)');
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Routes
app.use('/api/stations', stationsRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/history', historyRouter);
app.use('/api/cars', carsRouter);

// Serve the built SPA if present (production / NAS deployment / after `pnpm build`).
// Fallback only for non-API GET requests so unknown /api paths keep the JSON 404.
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      return res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    }
    next();
  });
}

// 404
app.use((_req, res) => {
  res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
});

initDb();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ EV Charging Server running on http://0.0.0.0:${PORT}`);
  console.log(`Access from mobile: http://[your-ip]:${PORT}`);
  if (fs.existsSync(CLIENT_DIST)) {
    console.log(`Serving SPA from ${CLIENT_DIST}`);
  } else {
    console.log(`SPA not found at ${CLIENT_DIST} — API-only mode (use Vite dev server)`);
  }
});
