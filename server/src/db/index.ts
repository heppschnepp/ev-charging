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
  `);

  console.log('✅ Database initialised at', DB_PATH);
}

// Cache TTL in seconds (1 hour)
const CACHE_TTL = 60 * 60;

export function getCachedGeocode(city: string) {
  const row = db
    .prepare(
      `SELECT * FROM geocode_cache
       WHERE lower(city) = lower(?)
       AND (unixepoch('now') - unixepoch(cached_at)) < ?`,
    )
    .get(city, CACHE_TTL) as
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
       AND (unixepoch('now') - unixepoch(cached_at)) < ?`,
    )
    .get(key, CACHE_TTL) as { data: string; cached_at: string } | undefined;
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
