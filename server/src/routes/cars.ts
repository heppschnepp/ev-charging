import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import {
  getVehicles,
  addVehicle,
  removeVehicle,
  updateVehicle,
  vehicleExistsByExternalId,
} from '../db/index.js';
import { searchCars, fetchVehicleDetail } from '../middleware/evdb.js';

export const carsRouter: RouterType = Router();

const AddCarSchema = z.object({
  brand: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  rangeKm: z.number().int().min(1).max(2000),
  externalId: z.string().min(1).max(200).optional(),
  variantName: z.string().max(200).optional(),
  modelYear: z.number().int().min(1990).max(2100).optional(),
  chargeTime10to80Min: z.number().int().min(1).max(600).optional(),
  chargeTime10to100Min: z.number().int().min(1).max(900).optional(),
});

const UpdateCarSchema = z.object({
  brand: z.string().trim().min(1).max(100).optional(),
  model: z.string().trim().min(1).max(100).optional(),
  variantName: z.string().trim().max(100).nullable().optional(),
  modelYear: z.number().int().min(1990).max(2100).nullable().optional(),
  rangeKm: z.number().int().min(1).max(2000).optional(),
  chargeTime10to80Min: z.number().int().min(1).max(600).nullable().optional(),
  chargeTime10to100Min: z.number().int().min(1).max(900).nullable().optional(),
});

const SearchSchema = z.object({
  q: z.string().trim().min(2).max(100),
});

carsRouter.get('/search', async (req, res) => {
  const parsed = SearchSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid parameters', code: 'INVALID_PARAMS' });
  }
  try {
    const results = await searchCars(parsed.data.q);
    return res.json({ results, total: results.length });
  } catch (err) {
    console.error('EV car search error:', err);
    return res.status(502).json({ message: 'Failed to fetch car data', code: 'UPSTREAM_ERROR' });
  }
});

carsRouter.get('/', (_req, res) => {
  res.json(getVehicles());
});

carsRouter.post('/', async (req, res) => {
  const parsed = AddCarSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid body', code: 'INVALID_PARAMS' });
  }
  const {
    brand,
    model,
    rangeKm,
    externalId,
    variantName,
    modelYear,
    chargeTime10to80Min,
    chargeTime10to100Min,
  } = parsed.data;

  if (externalId && vehicleExistsByExternalId(externalId)) {
    return res.status(409).json({ message: 'Car is already in the inventory', code: 'DUPLICATE' });
  }

  let ct80 = chargeTime10to80Min;
  let ct100 = chargeTime10to100Min;
  if (externalId && (ct80 === undefined || ct100 === undefined)) {
    try {
      const detail = await fetchVehicleDetail(externalId);
      if (detail) {
        ct80 = ct80 ?? detail.chargeTime10To80Min ?? undefined;
        ct100 = ct100 ?? detail.chargeTime10To100Min ?? undefined;
      }
    } catch (err) {
      console.warn('EVDB detail fetch failed:', err);
    }
  }

  const id = addVehicle(
    brand,
    model,
    rangeKm,
    externalId ?? null,
    variantName ?? null,
    modelYear ?? null,
    ct80,
    ct100,
  );
  return res.status(201).json({ ok: true, id });
});

carsRouter.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id', code: 'INVALID_PARAMS' });

  const parsed = UpdateCarSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid body', code: 'INVALID_PARAMS' });
  }

  const updated = updateVehicle(id, parsed.data);
  if (!updated) return res.status(404).json({ message: 'Car not found', code: 'NOT_FOUND' });
  return res.json({ ok: true });
});

carsRouter.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid id', code: 'INVALID_PARAMS' });
  removeVehicle(id);
  return res.json({ ok: true });
});