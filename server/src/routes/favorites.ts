import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { getFavorites, addFavorite, removeFavorite, isFavorite } from '../db/index.js';

export const favoritesRouter: RouterType = Router();

const AddFavoriteSchema = z.object({
  stationId: z.number().int().positive(),
  uuid: z.string(),
  name: z.string(),
  address: z.string().optional().default(''),
  lat: z.number(),
  lon: z.number(),
});

favoritesRouter.get('/', (_req, res) => {
  const favorites = getFavorites();
  res.json(favorites);
});

favoritesRouter.post('/', (req, res) => {
  const parsed = AddFavoriteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid body', code: 'INVALID_PARAMS' });
  }
  const { stationId, uuid, name, address, lat, lon } = parsed.data;
  addFavorite(stationId, uuid, name, address, lat, lon);
  return res.status(201).json({ ok: true });
});

favoritesRouter.delete('/:stationId', (req, res) => {
  const id = parseInt(req.params.stationId, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id', code: 'INVALID_PARAMS' });
  removeFavorite(id);
  return res.json({ ok: true });
});

favoritesRouter.get('/:stationId', (req, res) => {
  const id = parseInt(req.params.stationId, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id', code: 'INVALID_PARAMS' });
  return res.json({ isFavorite: isFavorite(id) });
});
