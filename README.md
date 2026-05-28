# ⚡ EV Charging Finder

A full-stack monorepo app to find EV charging stations near any city, powered by [Open Charge Map](https://openchargemap.org).

## Stack

| Layer    | Tech                                   |
|----------|----------------------------------------|
| Client   | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query |
| Server   | Express, TypeScript, better-sqlite3, Zod |
| Tooling  | pnpm workspaces, concurrently, Prettier |

## Features

- 🔍 City search with geocoding (OpenStreetMap Nominatim)
- ⚡ Filter by: all / operational / fast charge (≥50 kW) / free
- ❤️ Save favourite stations (persisted in SQLite)
- 🕐 Search history with one-click re-search
- 💾 Server-side caching (1 hour TTL) to avoid hammering APIs
- 📱 Responsive layout with sticky sidebar

## Getting started

### Prerequisites

- Node.js ≥ 18
- pnpm ≥ 9 (`npm i -g pnpm`)

### Setup

```bash
# Install all workspace dependencies
pnpm install

# Copy and configure server env
cp server/.env.example server/.env
# Edit server/.env and set your OCM_API_KEY
```

### Development
```bash
# Start both client (port 5173) and server (port 3001)
pnpm dev

# Or individually:
pnpm client:dev
pnpm server:dev
```

### Stop servers
```bash
# Stop all dev processes
# macOS/Linux
pkill -f "tsx watch" && pkill -f "vite"

# Kill process on specific port (macOS)
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Kill processes on ports 3001 and 5173 (macOS)
lsof -ti:3001,5173 | xargs kill -9 2>/dev/null || true

# Windows PowerShell - Kill processes on ports
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001,5173 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force
```

### Production build

```bash
pnpm build
pnpm server:start
```

## Project structure

```
ev-charging/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── components/      # UI components
│       ├── pages/           # Page components
│       ├── hooks/           # React Query hooks
│       ├── lib/             # API client, utilities
│       └── types/           # TypeScript types
├── server/                  # Express backend
│   └── src/
│       ├── routes/          # API route handlers
│       ├── db/              # SQLite database layer
│       ├── middleware/       # OCM + geocoding service
│       └── types/           # Shared types
├── package.json             # Root workspace config
└── pnpm-workspace.yaml
```

## API endpoints

| Method | Path                        | Description              |
|--------|-----------------------------|--------------------------|
| GET    | `/api/stations/search`      | Search stations by city  |
| GET    | `/api/favorites`            | List favourites          |
| POST   | `/api/favorites`            | Add a favourite          |
| DELETE | `/api/favorites/:stationId` | Remove a favourite       |
| GET    | `/api/history`              | Recent search history    |
| GET    | `/health`                   | Health check             |

## Environment variables

```env
PORT=3001
OCM_API_KEY=your-key-here
OCM_BASE_URL=https://api.openchargemap.io/v3
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
DB_PATH=./data/ev-cache.db
CORS_ORIGIN=http://localhost:5173
```
