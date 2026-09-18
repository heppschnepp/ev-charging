import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH ?? './data/ev-cache.db';

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS geocode_cache (
      city       TEXT PRIMARY KEY,
      lat        REAL NOT NULL,
      lon        REAL NOT NULL,
      display_name TEXT NOT NULL,
      cached_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS station_cache (
      cache_key   TEXT PRIMARY KEY,
      city        TEXT NOT NULL,
      lat         REAL NOT NULL,
      lon         REAL NOT NULL,
      distance    INTEGER NOT NULL,
      max_results INTEGER NOT NULL,
      data        TEXT NOT NULL,
      cached_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id  INTEGER NOT NULL UNIQUE,
      station_uuid TEXT NOT NULL,
      station_name TEXT NOT NULL,
      address     TEXT,
      lat         REAL,
      lon         REAL,
      added_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS search_history (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      city      TEXT NOT NULL,
      lat       REAL NOT NULL,
      lon       REAL NOT NULL,
      distance  INTEGER NOT NULL,
      results   INTEGER NOT NULL,
      searched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reverse_geocode_cache (
      lat_rounded INTEGER NOT NULL,
      lon_rounded INTEGER NOT NULL,
      display_name TEXT NOT NULL,
      cached_at   TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (lat_rounded, lon_rounded)
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT UNIQUE,
      brand       TEXT NOT NULL,
      model       TEXT NOT NULL,
      variant_name TEXT,
      model_year  INTEGER,
      range_km    INTEGER NOT NULL,
      charge_time_10_80_min INTEGER,
      charge_time_10_100_min INTEGER,
      added_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS car_cache (
      cache_key TEXT PRIMARY KEY,
      data      TEXT NOT NULL,
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrations for existing databases
  const vehicleCols = db.prepare(`PRAGMA table_info(vehicles)`).all() as { name: string }[];
  const vehicleColNames = new Set(vehicleCols.map((c) => c.name));
  if (!vehicleColNames.has('charge_time_10_80_min')) {
    db.exec(`ALTER TABLE vehicles ADD COLUMN charge_time_10_80_min INTEGER`);
  }
  if (!vehicleColNames.has('charge_time_10_100_min')) {
    db.exec(`ALTER TABLE vehicles ADD COLUMN charge_time_10_100_min INTEGER`);
  }

  // Clear stale cache entries on startup (older than 1 hour)
  db.prepare(`DELETE FROM geocode_cache WHERE cached_at < datetime('now', '-1 hour')`).run();
  db.prepare(`DELETE FROM station_cache WHERE cached_at < datetime('now', '-1 hour')`).run();
  db.prepare(`DELETE FROM reverse_geocode_cache WHERE cached_at < datetime('now', '-1 hour')`).run();
  db.prepare(`DELETE FROM car_cache WHERE cached_at < datetime('now', '-1 hour')`).run();

  console.log('✅ Database initialised at', DB_PATH);
}

// Cache TTL in seconds (1 hour)
const CACHE_TTL = 60 * 60;

export function getCachedGeocode(city: string) {
  const row = db
    .prepare(
      `SELECT * FROM geocode_cache
        WHERE lower(city) = lower(?)
        AND cached_at >= datetime('now', '-1 hour')`,
    )
    .get(city) as
    | { lat: number; lon: number; display_name: string; cached_at: string }
    | undefined;
  return row ?? null;
}

export function setCachedGeocode(city: string, lat: number, lon: number, displayName: string) {
  db.prepare(
    `INSERT OR REPLACE INTO geocode_cache (city, lat, lon, display_name, cached_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
  ).run(city, lat, lon, displayName);
}

export function getCachedReverseGeocode(lat: number, lon: number): string | null {
  // Round to 4 decimal places (about 11 meters precision)
  const latRounded = Math.round(lat * 10000);
  const lonRounded = Math.round(lon * 10000);
  const row = db
    .prepare(
      `SELECT display_name FROM reverse_geocode_cache
        WHERE lat_rounded = ? AND lon_rounded = ?
        AND cached_at >= datetime('now', '-1 hour')`,
    )
    .get(latRounded, lonRounded) as { display_name: string } | undefined;
  return row?.display_name ?? null;
}

export function setCachedReverseGeocode(lat: number, lon: number, displayName: string) {
  const latRounded = Math.round(lat * 10000);
  const lonRounded = Math.round(lon * 10000);
  db.prepare(
    `INSERT OR REPLACE INTO reverse_geocode_cache (lat_rounded, lon_rounded, display_name, cached_at)
     VALUES (?, ?, ?, datetime('now'))`,
  ).run(latRounded, lonRounded, displayName);
}

export function getCachedStations(
  city: string,
  distance: number,
  maxResults: number,
): { data: string; cached_at: string } | null {
  const key = `${city.toLowerCase()}:${distance}:${maxResults}`;
  const row = db
    .prepare(
      `SELECT data, cached_at FROM station_cache
       WHERE cache_key = ?
       AND cached_at >= datetime('now', '-1 hour')`,
    )
    .get(key) as { data: string; cached_at: string } | undefined;
  return row ?? null;
}

export function setCachedStations(
  city: string,
  lat: number,
  lon: number,
  distance: number,
  maxResults: number,
  data: string,
) {
  const key = `${city.toLowerCase()}:${distance}:${maxResults}`;
  db.prepare(
    `INSERT OR REPLACE INTO station_cache
       (cache_key, city, lat, lon, distance, max_results, data, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).run(key, city, lat, lon, distance, maxResults, data);
}

export function getFavorites() {
  return db
    .prepare(`SELECT * FROM favorites ORDER BY added_at DESC`)
    .all() as {
    id: number;
    station_id: number;
    station_uuid: string;
    station_name: string;
    address: string;
    lat: number;
    lon: number;
    added_at: string;
  }[];
}

export function addFavorite(
  stationId: number,
  uuid: string,
  name: string,
  address: string,
  lat: number,
  lon: number,
) {
  db.prepare(
    `INSERT OR IGNORE INTO favorites (station_id, station_uuid, station_name, address, lat, lon)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(stationId, uuid, name, address, lat, lon);
}

export function removeFavorite(stationId: number) {
  db.prepare(`DELETE FROM favorites WHERE station_id = ?`).run(stationId);
}

export function clearFavorites() {
  db.prepare(`DELETE FROM favorites`).run();
}

export function isFavorite(stationId: number): boolean {
  const row = db
    .prepare(`SELECT 1 FROM favorites WHERE station_id = ?`)
    .get(stationId);
  return !!row;
}

export function addSearchHistory(
  city: string,
  lat: number,
  lon: number,
  distance: number,
  results: number,
) {
  db.prepare(
    `INSERT INTO search_history (city, lat, lon, distance, results) VALUES (?, ?, ?, ?, ?)`,
  ).run(city, lat, lon, distance, results);
}

export function getSearchHistory() {
  return db
    .prepare(
      `SELECT city, lat, lon, distance, results, searched_at
        FROM search_history ORDER BY searched_at DESC LIMIT 20`,
    )
    .all();
}

export function clearSearchHistory() {
  db.prepare(`DELETE FROM search_history`).run();
}

// ── Vehicle inventory ─────────────────────────────────────────────────────────

export interface VehicleRow {
  id: number;
  external_id: string | null;
  brand: string;
  model: string;
  variant_name: string | null;
  model_year: number | null;
  range_km: number;
  charge_time_10_80_min: number | null;
  charge_time_10_100_min: number | null;
  added_at: string;
}

export function getVehicles(): VehicleRow[] {
  return db
    .prepare(`SELECT * FROM vehicles ORDER BY added_at DESC`)
    .all() as VehicleRow[];
}

export function addVehicle(
  brand: string,
  model: string,
  rangeKm: number,
  externalId?: string | null,
  variantName?: string | null,
  modelYear?: number | null,
  chargeTime10To80Min?: number | null,
  chargeTime10To100Min?: number | null,
): number {
  const res = db
    .prepare(
      `INSERT INTO vehicles (external_id, brand, model, variant_name, model_year, range_km, charge_time_10_80_min, charge_time_10_100_min)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      externalId ?? null,
      brand,
      model,
      variantName ?? null,
      modelYear ?? null,
      rangeKm,
      chargeTime10To80Min ?? null,
      chargeTime10To100Min ?? null,
    );
  return Number(res.lastInsertRowid);
}

export function updateVehicle(
  id: number,
  patch: {
    brand?: string;
    model?: string;
    variantName?: string | null;
    modelYear?: number | null;
    rangeKm?: number;
    chargeTime10To80Min?: number | null;
    chargeTime10To100Min?: number | null;
  },
) {
  const current = db.prepare(`SELECT * FROM vehicles WHERE id = ?`).get(id) as
    | VehicleRow
    | undefined;
  if (!current) return false;

  db.prepare(
    `UPDATE vehicles SET
       brand = ?, model = ?, variant_name = ?, model_year = ?, range_km = ?,
       charge_time_10_80_min = ?, charge_time_10_100_min = ?
     WHERE id = ?`,
  ).run(
    patch.brand ?? current.brand,
    patch.model ?? current.model,
    patch.variantName === undefined ? current.variant_name : patch.variantName,
    patch.modelYear === undefined ? current.model_year : patch.modelYear,
    patch.rangeKm ?? current.range_km,
    patch.chargeTime10To80Min === undefined ? current.charge_time_10_80_min : patch.chargeTime10To80Min,
    patch.chargeTime10To100Min === undefined ? current.charge_time_10_100_min : patch.chargeTime10To100Min,
    id,
  );
  return true;
}

export function removeVehicle(id: number) {
  db.prepare(`DELETE FROM vehicles WHERE id = ?`).run(id);
}

export function vehicleExistsByExternalId(externalId: string): boolean {
  return !!db.prepare(`SELECT 1 FROM vehicles WHERE external_id = ?`).get(externalId);
}

// ── EVDB catalogue cache ──────────────────────────────────────────────────────

export function getCachedCars(): string | null {
  const row = db
    .prepare(
      `SELECT data FROM car_cache
       WHERE cache_key = 'all'
       AND cached_at >= datetime('now', '-1 hour')`,
    )
    .get() as { data: string } | undefined;
  return row?.data ?? null;
}

export function setCachedCars(data: string) {
  db.prepare(
    `INSERT OR REPLACE INTO car_cache (cache_key, data, cached_at)
     VALUES ('all', ?, datetime('now'))`,
  ).run(data);
}
