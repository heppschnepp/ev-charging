# Deploying to a Synology NAS

Deploy the EV Charging Finder to a Synology NAS (e.g. DS223, DSM 7.2). The strategy: **build everything on your dev machine** and copy only the compiled output to the NAS — the NAS needs Node.js + production dependencies only, no TypeScript, pnpm, or Vite.

## Prerequisites

- Synology NAS (worded for the DS223, ARMv8) on DSM 7.2+
- Dev machine with Node.js ≥ 18 + pnpm ≥ 9
- An [OCM API key](https://openchargemap.org) — **required** for live station data (the NAS has no cached DB on first run)
- A user account on the NAS with SSH + admin access

Related docs: [README_db.md](README_db.md) (schema, `DB_PATH`, WAL) and [README_schema.md](README_schema.md) (OCM API).

---

## Step 1 — Install Node.js via Package Center

1. Open **Package Center**, search for **Node.js**, install the latest version offered for your model.
2. For the DS223 (Realtek armv8), Synology publishes a **Node.js v20** package (`Node.js_v20-armv8`), which includes a bundled `npm` — no separate npm install.
3. **Version note:** Node 20 is EOL. If your DSM offers a newer Node.js major, prefer it. If you end up on Node 20, follow the better-sqlite3 pin in Step 5 (otherwise `npm install` will fail).

## Step 2 — Enable SSH

**Control Panel → Terminal & SNMP → Enable SSH service.** You need this to run install commands and manage the process, since the Package Center Node.js package only provides the runtime.

## Step 3 — Build client and server locally

On your dev machine, at the repo root use the workspace scripts (the packages are named `ev-client` / `ev-server`, not `client` / `server`):

```bash
pnpm client:build   # = pnpm --filter ev-client build  → client/dist
pnpm server:build   # = pnpm --filter ev-server build  → server/dist
```

This compiles TS to plain JS (ESM) — no TypeScript/pnpm needed on the NAS. **If you choose Option A in Step 6, apply that server change *before* building.**

Output layout you'll transfer:

- `client/dist/` — static SPA (Vite build, includes PWA `sw.js` + icons)
- `server/dist/index.js` + `server/dist/{db,middleware,routes,types}/` — compiled server
- `server/package.json` — **do not skip this**: it sets `"type": "module"`, which is required for Node to run the ESM output in `dist/`

## Step 4 — Transfer build output to the NAS

Copy to an app folder, e.g. `/volume1/apps/ev-app/`, using File Station or `scp`:

```
ev-app/
├── client/dist/          # Option A: served by Express
│   └── (index.html, assets/, sw.js, …)
├── server/
│   ├── dist/             # compiled server (index.js + folders)
│   ├── package.json      # required ("type": "module") — edit per Step 5
│   └── .env              # created in Step 7
└── data/                 # created in Step 5 (DB lives here)
```

`scp` example:

```bash
scp -r client/dist server/dist server/package.json \
  user@<nas-ip>:/volume1/apps/
```

Then move things into place on the NAS (or target the exact paths with `scp` directly).

## Step 5 — Install production dependencies on the NAS

**Headline gotcha:** better-sqlite3 is a native module. From **v12.10.0 onward the Node 20 (ABI 115) prebuilt binaries were removed**, so on a NAS running Synology's Node 20, `npm install` with current versions finds no prebuilt `<node>-linux-arm64` binary and tries to compile from source — which fails because DSM has no `gcc`/`python`. The fix: pin `better-sqlite3` to `~12.9.1` (last line that ships Node 20 / ABI-115 linux-arm64 prebuilds). If you installed a newer Node.js package (≥ 22), you can keep the normal `^12.10.0` range instead.

Copy `server/package.json` into `/volume1/apps/ev-app/server/`, and for Node 20 change just the pin:

```bash
cd /volume1/apps/ev-app/server
npm pkg set dependencies.better-sqlite3="~12.9.1"   # Node 20 only; skip if Node ≥ 22
npm install --omit=dev --no-audit --no-fund
```

This must run **on the NAS** — not be copied from your dev machine — because the binary must match the NAS CPU (arm64) and Node ABI. npm creates its own `package-lock.json` (it ignores `pnpm-lock.yaml`; keeping the pnpm lockfile from the repo is unnecessary for this install).

Verify the module loaded the prebuilt binary:

```bash
cd /volume1/apps/ev-app/server
node -e "require('better-sqlite3'); console.log('ok')"
```

If it instead tries to compile from source (you'll see `node-gyp`/`gcc` in the output) and fails, this is the known risk from above — apply the `~12.9.1` pin or install a newer Node.js package and re-run `npm install`.

Create the data directory (write access for the user that will run the app):

```bash
mkdir -p /volume1/apps/ev-app/data
```

## Step 6 — Serve the client

The Express server is currently **API-only** (`server/src/index.ts` returns 404 JSON for everything except `/api/*` and `/health`). The SPA needs one of these two options.

### Option A — Express serves the SPA (recommended)

One small change to `server/src/index.ts`, then rebuild + re-transfer `server/dist`. Add static serving + SPA fallback after the API routes and **before** the 404 handler, only when the built client is present:

```ts
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const CLIENT_DIST =
  process.env.CLIENT_DIST ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist');

// after the /api routes…
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      return res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    }
    next();
  });
}
```

`CLIENT_DIST` defaults to `<server-dist>/../../client/dist`, so it resolves to `<repo>/client/dist` in this repo and to `/volume1/apps/ev-app/client/dist` in the NAS layout; set `CLIENT_DIST` explicitly if you place the folders otherwise. Rebuild (`pnpm server:build`) and re-copy `server/dist`. Everything now runs from **one origin** (`http://<nas-ip>:3000`), so no CORS config is needed.

### Option B — host the SPA separately (Web Station)

- Host `client/dist` in a **Web Station** virtual host.
- Add a **reverse proxy** entry (DSM 7.2: Control Panel → Login Portal → Advanced → Reverse Proxy): forward `/api` → `localhost:3000` (and `/health` if used).
- The browser then calls `/api` same-origin; still set `CORS_ORIGIN` to the SPA origin (or `*`) in case the origins ever diverge.

## Step 7 — Environment variables + manual test

Create `/volume1/apps/ev-app/server/.env` (the server loads `.env` from its working directory via `dotenv`); or export the same values inline. Variables:

```env
PORT=3000
DB_PATH=/volume1/apps/ev-app/data/ev-cache.db
OCM_API_KEY=your-key-here
CORS_ORIGIN=*                              # *=allow any; else set your SPA origin
CLIENT_DIST=/volume1/apps/ev-app/client/dist   # Option A only
```

Test manually (run with `cd` into the app folder):

```bash
cd /volume1/apps/ev-app
node server/dist/index.js
```

Then from your LAN visit `http://<nas-ip>:3000` (SPA + API under one origin with Option A; `/health` and `/api/cars` return 200). Stop with `Ctrl+C`. Note: the first run creates the SQLite DB plus `-wal`/`-shm` sidecar files in `data/` — the runtime user needs write permission there.

## Step 8 — Start on boot

**Control Panel → Task Scheduler → Create → Triggered Task → User-defined script**, trigger **Boot-up**.

- In **Routine settings**, set **Run as** to a regular user (not root) so DSM doesn't own the DB files.
- **Task Settings → User-defined script:**

```sh
#!/bin/sh
APP=/volume1/apps/ev-app
export PORT=3000
export DB_PATH="$APP/data/ev-cache.db"
export OCM_API_KEY=your-key-here
export CORS_ORIGIN=*
export CLIENT_DIST="$APP/client/dist"   # Option A only
cd "$APP" || exit 1
nohup node server/dist/index.js >> "$APP/app.log" 2>&1 &
```

Manage the process manually when needed:

```bash
pgrep -f "server/dist/index.js"           # find PID
kill $(pgrep -f "server/dist/index.js")   # stop
tail -f /volume1/apps/ev-app/app.log      # logs
```

If files created during your manual root test are owned by `root`, fix ownership once:

```bash
chown -R <user>:<group> /volume1/apps/ev-app/data
```

## Step 9 — Expose it externally (HTTPS)

1. **DDNS:** Control Panel → External Access → DDNS → add a hostname for your WAN IP.
2. **Reverse proxy** (DSM 7.2): Control Panel → **Login Portal → Advanced → Reverse Proxy** → Create: source `https://<hostname>:443` → destination `localhost:3000`. (With Option A this single proxy serves both the SPA and the API.)
3. **Certificate:** Control Panel → Security → Certificate → add a Let's Encrypt certificate for the hostname (or use **Cloudflare Tunnel** instead, which avoids opening a port entirely — see [README_https.md](README_https.md) for why HTTPS is important, e.g. geolocation).

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `npm install` starts `node-gyp` or a compile and fails on the NAS | better-sqlite3 has no prebuild for your Node ABI → apply the `~12.9.1` pin (Node 20) or install a newer Node.js package |
| `ERR_REQUIRE_ESM` / `ERR_MDLN_MODULE_NOT_FOUND` style module errors | `server/package.json` missing or not `"type": "module"` — copy it next to `server/dist` |
| Nothing served at `http://<nas-ip>:3000` | Server is API-only → use Option A (static) or Option B (Web Station); `GET /` is 404 only for `/health`, `/api/*` |
| Station search fails with an OCM API error | `OCM_API_KEY` not set (fresh NAS has no DB cache) |
| API blocked from the browser | `CORS_ORIGIN` still defaults to `http://localhost:5173` → set it to `*` or your origin |
| DB write errors as `root`/permission | `chown` `data/` to the task's runtime user; allow `-wal`/`-shm` sidecars |

## See also

- [README_db.md](README_db.md) — SQLite schema, reset-by-delete, WAL
- [README_schema.md](README_schema.md) — OCM `/poi` response structure
- [README_https.md](README_https.md) — testing geolocation over HTTPS (dev-time)