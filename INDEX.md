# Documentation Index

Master index of documentation for the EV Charging Finder monorepo. The root `README.md` is the primary entry point — this file maps all supplementary docs.

## Project docs

| Doc | Description |
|-----|-------------|
| [README.md](README.md) | Main README: stack, features, setup, project structure, API endpoints, environment variables |
| [INDEX.md](INDEX.md) | This file — master index of all documentation |
| [README_schema.md](README_schema.md) | OCM `/poi` API response schema (station objects, connections, operators, request params) |
| [README_db.md](README_db.md) | SQLite database schema (`server/src/db/index.ts`): tables, columns, constraints, cache TTL, migrations |
| [README_coordinates.md](README_coordinates.md) | How to find lat/lon coordinates for searches (Nominatim, Google Maps, CLI) |
| [README_curl.md](README_curl.md) | Ready-to-run curl examples for the OCM API |
| [README_https.md](README_https.md) | Serving over HTTPS for iPhone geolocation (ngrok / mkcert) |
| [README_nas.md](README_nas.md) | Deploying to a Synology NAS (build locally, install on device, boot task, reverse proxy) |

## Relationships between docs

- `README_schema.md` describes the structure of the JSON blobs stored in `station_cache.data` (see `README_db.md`).
- `README_curl.md` and `README_schema.md` both cover the OCM `/poi` endpoint — the former is copy-paste examples, the latter the reference schema.
- `README_coordinates.md` explains how the app's geocoding works (Nominatim) and how to get the coordinates used in `README_curl.md` / `README_schema.md` examples (e.g. Liederbach am Taunus `50.1230468, 8.4878708`).
- `README_https.md` complements the dev-setup section of `README.md`.
- `README_nas.md` is the production-deployment companion: it depends on `README_db.md` (`DB_PATH`/WAL) and `README_schema.md` (OCM API), and its Option A requires adding static SPA serving to `server/src/index.ts`.

## Tooling / agent docs (not project documentation)

| Doc | Description |
|-----|-------------|
| [AGENTS.md](AGENTS.md) | Instructions for AI agents working in this repo: planning rule, commands, verification, domain gotchas |

## Source of truth

Schema-like docs describe code, so the code is authoritative when they disagree:

- OCM response schema → `server/src/middleware/ocm.ts` (parsing) + official OpenAPI spec (see link in `README_schema.md`)
- SQLite schema → `server/src/db/index.ts` (runs `CREATE TABLE IF NOT EXISTS` + guarded migrations on every boot)