import { getCachedCars, setCachedCars } from '../db/index.js';

const EVDB_BASE = 'https://gaia-charge.github.io/evdb/v1';

interface EvdbRaw {
  id: string;
  brand: string;
  model: string;
  variant_name?: string;
  model_year?: number;
  range_wltp_km?: number;
}

interface EvdbFullRecord {
  id?: string;
  brand?: string;
  model_name?: string;
  variant_name?: string;
  model_year?: number;
  range_wltp_km?: number;
  dc_charge_time_10_80_min?: number;
  dc_charge_time_0_100_min?: number;
}

export interface VehicleDetail {
  brand: string;
  model: string;
  variantName: string | null;
  modelYear: number | null;
  rangeKm: number | null;
  chargeTime10To80Min: number | null;
  chargeTime10To100Min: number | null;
}

export interface CarSearchResult {
  externalId: string;
  brand: string;
  model: string;
  variantName: string | null;
  modelYear: number | null;
  rangeKm: number | null;
}

async function fetchCatalogue(): Promise<EvdbRaw[]> {
  const cached = getCachedCars();
  if (cached !== null) {
    return JSON.parse(cached) as EvdbRaw[];
  }

  const res = await fetch(`${EVDB_BASE}/vehicles.json`);
  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch { /* ignore */ }
    throw new Error(`EVDB API error ${res.status}: ${res.statusText}${body ? ` - ${body.slice(0, 500)}` : ''}`);
  }
  const data = (await res.json()) as { results?: EvdbRaw[] };
  const results = data.results ?? [];
  setCachedCars(JSON.stringify(results));
  return results;
}

export async function searchCars(query: string, limit = 20): Promise<CarSearchResult[]> {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const all = await fetchCatalogue();
  const matches = all.filter((v) => {
    const haystack = `${v.brand} ${v.model} ${v.variant_name ?? ''}`.toLowerCase();
    return tokens.every((t) => haystack.includes(t));
  });

  const sorted = [...matches].sort((a, b) =>
    `${a.brand} ${a.model} ${a.variant_name ?? ''}`.localeCompare(`${b.brand} ${b.model} ${b.variant_name ?? ''}`),
  );

  return sorted.slice(0, limit).map((v) => ({
    externalId: v.id,
    brand: v.brand,
    model: v.model,
    variantName: v.variant_name || null,
    modelYear: v.model_year ?? null,
    rangeKm: v.range_wltp_km ?? null,
  }));
}

export async function fetchVehicleDetail(externalId: string): Promise<VehicleDetail | null> {
  const res = await fetch(`${EVDB_BASE}/vehicles/${encodeURIComponent(externalId)}.json`);
  if (!res.ok) return null;
  const v = (await res.json()) as EvdbFullRecord;
  return {
    brand: v.brand || '',
    model: v.model_name || '',
    variantName: v.variant_name || null,
    modelYear: v.model_year ?? null,
    rangeKm: v.range_wltp_km ?? null,
    chargeTime10To80Min: v.dc_charge_time_10_80_min ?? null,
    chargeTime10To100Min: v.dc_charge_time_0_100_min ?? null,
  };
}