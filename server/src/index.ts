import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb } from './db/index.js';
import { stationsRouter } from './routes/stations.js';
import { favoritesRouter } from './routes/favorites.js';
import { historyRouter } from './routes/history.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.use(cors({ origin: process.env.CORS_ORIGIN === '*' ? true : (process.env.CORS_ORIGIN ?? 'http://localhost:5173') }));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Routes
app.use('/api/stations', stationsRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/history', historyRouter);

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
});
