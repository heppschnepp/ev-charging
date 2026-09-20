# SQLite Database Schema

The app uses a single SQLite database (`better-sqlite3`). The schema is defined *in code* at `server/src/db/index.ts` — `initDb()` runs `CREATE TABLE IF NOT EXISTS` statements and guarded `ALTER TABLE … ADD COLUMN` migrations on every server boot. **Never hand-edit the DB file; delete it to reset.**

## Database File

| Setting | Value |
|---------|-------|
| Default path | `server/data/ev-cache.db` |
| Env override | `DB_PATH` (absolute or relative to the server working directory) |
| Journal mode | WAL (`journal_mode = WAL`) |
| Foreign keys | `ON` |

On boot, `initDb()` also purges entries older than 1 hour from all four cache tables (`geocode_cache`, `station_cache`, `reverse_geocode_cache`, `car_cache`).

## Tables

### geocode_cache

City → coordinates lookup from Nominatim.

| Column | Type | Constraints |
|--------|------|-------------|
| `city` | TEXT | PRIMARY KEY |
| `lat` | REAL | NOT NULL |
| `lon` | REAL | NOT NULL |
| `display_name` | TEXT | NOT NULL |
| `cached_at` | TEXT | NOT NULL, DEFAULT `datetime('now')` |

Lookups match on `lower(city)`. Entries expire after 1 hour (soft TTL via `cached_at >= datetime('now','-1 hour')`); expired rows are deleted on boot.

### station_cache

OCM station search results. `data` is the full JSON response (array of mapped `ChargingStation`), so the cache only needs the search key to replay the payload without re-calling OCM.

| Column | Type | Constraints |
|--------|------|-------------|
| `cache_key` | TEXT | PRIMARY KEY |
| `city` | TEXT | NOT NULL |
| `lat` | REAL | NOT NULL |
| `lon` | REAL | NOT NULL |
| `distance` | INTEGER | NOT NULL |
| `max_results` | INTEGER | NOT NULL |
| `data` | TEXT | NOT NULL — JSON blob |
| `cached_at` | TEXT | NOT NULL, DEFAULT `datetime('now')` |

`cache_key` = `"<city lowercased>:<distance>:<max_results>"`. Same 1-hour soft-TTL as other caches.

### favorites

The user's saved stations (managed via `GET/POST/DELETE /api/favorites`).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `station_id` | INTEGER | NOT NULL, UNIQUE |
| `station_uuid` | TEXT | NOT NULL |
| `station_name` | TEXT | NOT NULL |
| `address` | TEXT | nullable |
| `lat` | REAL | nullable |
| `lon` | REAL | nullable |
| `added_at` | TEXT | NOT NULL, DEFAULT `datetime('now')` |

Returned newest-first (`ORDER BY added_at DESC`). Never expires.

### search_history

Last 20 user searches for the recent-searches UI.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `city` | TEXT | NOT NULL |
| `lat` | REAL | NOT NULL |
| `lon` | REAL | NOT NULL |
| `distance` | INTEGER | NOT NULL |
| `results` | INTEGER | NOT NULL |
| `searched_at` | TEXT | NOT NULL, DEFAULT `datetime('now')` |

Queries are limited to the 20 most recent rows.

### reverse_geocode_cache

Coordinates → place name from Nominatim. Coordinates are rounded to 4 decimal places (`Math.round(lat * 10000)`, ≈11 m precision) so nearby search points reuse one entry.

| Column | Type | Constraints |
|--------|------|-------------|
| `lat_rounded` | INTEGER | NOT NULL, part of composite PRIMARY KEY |
| `lon_rounded` | INTEGER | NOT NULL, part of composite PRIMARY KEY |
| `display_name` | TEXT | NOT NULL |
| `cached_at` | TEXT | NOT NULL, DEFAULT `datetime('now')` |

### vehicles

EV inventory (Settings → Electric cars). Rows come from the EVDB catalogue (auto-filled) or manual entry.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `external_id` | TEXT | UNIQUE, nullable (EVDB catalogue id) |
| `brand` | TEXT | NOT NULL |
| `model` | TEXT | NOT NULL |
| `variant_name` | TEXT | nullable |
| `model_year` | INTEGER | nullable |
| `range_km` | INTEGER | NOT NULL (WLTP, optimistic) |
| `charge_time_10_80_min` | INTEGER | nullable |
| `charge_time_10_100_min` | INTEGER | nullable; stores EVDB 0→100 time as documented estimate |
| `added_at` | TEXT | NOT NULL, DEFAULT `datetime('now')` |

**Migrations:** for databases created before these columns existed, `initDb()` checks `PRAGMA table_info(vehicles)` and runs guarded `ALTER TABLE vehicles ADD COLUMN charge_time_10_80_min INTEGER` / `charge_time_10_100_min INTEGER` if missing.

Charge-time defaults (45 / 55 min) are *not* stored — they are applied at plan time when a car has `NULL` charge times and the plan is flagged `usesEstimates`.

### car_cache

EVDB catalogue cache. `data` is the full JSON catalogue payload.

| Column | Type | Constraints |
|--------|------|-------------|
| `cache_key` | TEXT | PRIMARY KEY (always `'all'`) |
| `data` | TEXT | NOT NULL — JSON blob |
| `cached_at` | TEXT | NOT NULL, DEFAULT `datetime('now')` |

## Relations

There are no foreign keys between tables — each table is independent. `vehicles.external_id` links to the EVDB catalogue (not enforced by the DB), and `station_cache.data` embeds OCM station objects (structure described in `README_schema.md`).

## Reset

Stop the server, delete `server/data/ev-cache.db` (and its `-wal` / `-shm` sidecar files if present), restart. `initDb()` recreates everything on boot.