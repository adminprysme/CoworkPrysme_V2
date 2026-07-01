# Architecture Cowork Prysme

Ce document décrit les choix structurants du monorepo à quatre applications. Il ne couvre pas le métier applicatif.

## Vue d'ensemble

Quatre applications déployables indépendamment, regroupées par environnement (`vitrine` / `gestion`), packages partagés et un cluster MongoDB unique.

```mermaid
graph TB
    subgraph public [Vitrine — public]
        VW[vitrine-web :3001<br/>apps/vitrine/Frontend]
        VA[vitrine-api :8002<br/>apps/vitrine/Backend]
    end

    subgraph internal [Gestion — interne]
        GW[gestion-web :3002<br/>apps/gestion/Frontend]
        GA[gestion-api :8003<br/>apps/gestion/Backend]
    end

    subgraph packages [Packages]
        SH[shared — Zod + env]
        DB[db — Mongoose]
        CF[config — ESLint / TS]
    end

    subgraph mongo [Cluster MongoDB]
        C[(cowork_bdd R/W)]
        P[(prysma_bdd RO)]
    end

    VW -->|NEXT_PUBLIC_API_URL| VA
    GW -->|VITE_API_URL| GA
    VA -->|GESTION_API_URL writes stub| GA
    VA --> DB
    VA --> C
    GA --> DB
    GA --> C
    GA --> P
    VW -.-> SH
    GW -.-> SH
    VA -.-> SH
    GA -.-> SH
    DB -.-> SH
```

## Arborescence apps

```
apps/
├── vitrine/
│   ├── Frontend/    @coworkprysme/vitrine-web   (Next.js)
│   └── Backend/     @coworkprysme/vitrine-api    (NestJS)
└── gestion/
    ├── Frontend/    @coworkprysme/gestion-web   (Vite + nginx)
    └── Backend/     @coworkprysme/gestion-api    (NestJS)
```

Les **noms npm** (`@coworkprysme/vitrine-web`, etc.) sont inchangés — seuls les chemins filesystem diffèrent. Turborepo et `pnpm --filter` continuent de cibler par nom de package.

## Rôles des applications

| App (package)   | Stack                | Port | Rôle                                                                                      |
| --------------- | -------------------- | ---- | ----------------------------------------------------------------------------------------- |
| **vitrine-web** | Next.js App Router   | 3001 | Frontend public SEO. Aucun accès direct à la base.                                        |
| **vitrine-api** | NestJS (ESM)         | 8002 | BFF public. Lit `cowork_bdd` uniquement. Délègue les écritures à gestion-api (stub HTTP). |
| **gestion-web** | Vite + React + nginx | 3002 | Frontend CRM interne (SPA).                                                               |
| **gestion-api** | NestJS (ESM)         | 8003 | Cœur métier. Écritures sur `cowork_bdd`, lecture seule `prysma_bdd`.                      |

## Flux inter-services

### Vitrine (public)

1. Le navigateur charge **vitrine-web** (SSR/SSG).
2. Les appels API passent par `NEXT_PUBLIC_API_URL` → **vitrine-api**.
3. **vitrine-api** lit `cowork_bdd` via `packages/db` (`DbModule` fin, sans `@nestjs/mongoose`).
4. Les opérations d'écriture futures seront déléguées à **gestion-api** via `GESTION_API_URL` (stub `GestionClientService` en place).

### Gestion (interne)

1. **gestion-web** (SPA statique) appelle **gestion-api** via `VITE_API_URL`.
2. **gestion-api** centralise la logique métier et l'accès aux deux bases.

## Monorepo : pnpm + Turborepo

**pnpm workspaces** avec glob `apps/*/*` + `packages/*`. **Turborepo** orchestre le cache et l'ordre de build (`dependsOn: ["^build"]`).

Presets TypeScript dans `packages/config` :

- `typescript/nextjs.json` — vitrine-web
- `typescript/nestjs.json` — APIs Nest (NodeNext / ESM)
- `typescript/vite.json` — gestion-web
- `typescript/library.json` — packages compilés

## Sécurité

### Variables d'environnement

Validation Zod centralisée dans `packages/shared/src/env.ts`, parsers dédiés par app :

| Parser               | Initialisation                                                            |
| -------------------- | ------------------------------------------------------------------------- |
| `parseVitrineWebEnv` | `initVitrineWebEnv()` dans `apps/vitrine/Frontend/src/instrumentation.ts` |
| `parseVitrineApiEnv` | `initVitrineApiEnv()` dans `apps/vitrine/Backend/src/main.ts`             |
| `parseGestionApiEnv` | `initGestionApiEnv()` dans `apps/gestion/Backend/src/main.ts`             |
| `parseGestionWebEnv` | côté client Vite (`import.meta.env`)                                      |

| Variable               | Dev                  | Production                                  |
| ---------------------- | -------------------- | ------------------------------------------- |
| `MONGODB_URI`          | `mongodb://` accepté | `mongodb+srv://` ou `?tls=true` obligatoire |
| `ALLOWED_ORIGIN`       | liste CSV explicite  | idem, **jamais `*`**                        |
| `NEXT_PUBLIC_SITE_URL` | optionnel            | **obligatoire** (vitrine-web)               |

### CORS (APIs Nest)

`ALLOWED_ORIGIN` est une **liste d'origines séparées par des virgules**, configurée explicitement par API :

- **vitrine-api** : origines du frontend public (ex. `http://localhost:3001`)
- **gestion-api** : frontend gestion **et** vitrine-api si appels server-side (ex. `http://localhost:3002,http://localhost:8002`)

### Content-Security-Policy

| App         | Mécanisme                              | `connect-src`                                                 |
| ----------- | -------------------------------------- | ------------------------------------------------------------- |
| vitrine-web | `apps/vitrine/Frontend/next.config.ts` | `'self'` + origin de `NEXT_PUBLIC_API_URL`                    |
| gestion-web | nginx `add_header`                     | `'self'` + origin de `VITE_API_URL` (injecté au build Docker) |

### prysma_bdd — lecture seule

- `getPrysmaDb()` **non exporté** via `@coworkprysme/db`
- **vitrine-api** n'accède **jamais** à `prysma_bdd` (`runCoworkReadinessCheck` uniquement)
- **gestion-api** seule exécute le readiness complet (cowork + prysma)

### Health checks

| App         | Route         | Type              | Réponse                                             |
| ----------- | ------------- | ----------------- | --------------------------------------------------- |
| vitrine-web | `/api/health` | Liveness          | `{ "status": "ok" }`                                |
| gestion-web | `/api/health` | Liveness (nginx)  | `{ "status": "ok" }`                                |
| vitrine-api | `/health`     | Readiness cowork  | `{ status, timestamp, checks: { cowork } }`         |
| gestion-api | `/health`     | Readiness complet | `{ status, timestamp, checks: { cowork, prysma } }` |

## MongoDB + Mongoose (`packages/db`)

Connexion unique au cluster, bascule via `useDb()` :

```
MONGODB_URI ──► mongoose.connect()
                    ├── useDb(MONGODB_DB_COWORK)  → cowork_bdd  (R/W)
                    └── useDb(MONGODB_DB_PRYSMA)  → prysma_bdd  (RO, gestion-api)
```

`DbModule` / `DbService` fins dans chaque API — wrapper autour de `packages/db`, **sans** `@nestjs/mongoose`.

## Docker

Stratégie multi-stage : `turbo prune --docker` → build → runner non-root (ou nginx).

| App         | Dockerfile                         | Runner                                                          |
| ----------- | ---------------------------------- | --------------------------------------------------------------- |
| vitrine-web | `apps/vitrine/Frontend/Dockerfile` | Next.js standalone — `CMD node apps/vitrine/Frontend/server.js` |
| vitrine-api | `apps/vitrine/Backend/Dockerfile`  | `pnpm deploy --prod`                                            |
| gestion-web | `apps/gestion/Frontend/Dockerfile` | nginx                                                           |
| gestion-api | `apps/gestion/Backend/Dockerfile`  | `pnpm deploy --prod`                                            |

### Coolify — configuration par service

| Service Coolify | Dockerfile path                    | Build context     | Port |
| --------------- | ---------------------------------- | ----------------- | ---- |
| vitrine-web     | `apps/vitrine/Frontend/Dockerfile` | `.` (racine repo) | 3001 |
| vitrine-api     | `apps/vitrine/Backend/Dockerfile`  | `.`               | 8002 |
| gestion-web     | `apps/gestion/Frontend/Dockerfile` | `.`               | 3002 |
| gestion-api     | `apps/gestion/Backend/Dockerfile`  | `.`               | 8003 |

Les filtres `turbo prune` / `pnpm deploy` utilisent les **noms de package** (`@coworkprysme/vitrine-web`, etc.), pas les chemins filesystem.

## Qualité

- TypeScript strict, ESLint 9, Prettier, Husky + Commitlint
- Tests : `packages/db` (singleton, read-only prysma), `packages/shared` (env)

## Lancer une app individuellement

```bash
pnpm --filter @coworkprysme/vitrine-web dev
pnpm --filter @coworkprysme/vitrine-api dev
pnpm --filter @coworkprysme/gestion-web dev
pnpm --filter @coworkprysme/gestion-api dev
pnpm --filter @coworkprysme/db test
```

## Évolutions prévues (hors périmètre actuel)

- Modèles métier sur `cowork_bdd`
- Endpoints de délégation vitrine-api → gestion-api (au-delà du stub HTTP)
- Authentification staff via `prysma_bdd`
- CI/CD automatisé
