# Cowork Prysme

Monorepo pour la **vitrine publique** (SEO) et l'**application de gestion interne** (CRM), avec frontends et APIs séparés.

## Prérequis

- **Node.js 24 LTS** (voir `.nvmrc`)
- **pnpm 10.8.x** (`packageManager`: `pnpm@10.8.1`)
- Accès au cluster MongoDB (`MONGODB_URI`)

## Structure

```
coworkprysme_v2/
├── apps/
│   ├── vitrine-web/   # Frontend public — Next.js, port 3001
│   ├── vitrine-api/   # BFF public — NestJS, port 8002
│   ├── gestion-web/   # Frontend CRM — Vite SPA, port 3002
│   └── gestion-api/   # API métier — NestJS, port 8003
├── packages/
│   ├── config/        # ESLint, Prettier, tsconfig partagés
│   ├── db/            # Mongoose singleton, schémas, health checks
│   └── shared/        # Schémas Zod, contrats inter-services
├── .env.example
└── ARCHITECTURE.md
```

## Démarrage rapide

```bash
pnpm install

# Copier les variables par app (voir .env.example dans chaque app/)
cp apps/vitrine-web/.env.example apps/vitrine-web/.env.local
cp apps/vitrine-api/.env.example apps/vitrine-api/.env
cp apps/gestion-web/.env.example apps/gestion-web/.env
cp apps/gestion-api/.env.example apps/gestion-api/.env

pnpm build
pnpm dev
```

| App         | URL locale            | Health check    |
| ----------- | --------------------- | --------------- |
| vitrine-web | http://localhost:3001 | GET /api/health |
| vitrine-api | http://localhost:8002 | GET /health     |
| gestion-web | http://localhost:3002 | GET /api/health |
| gestion-api | http://localhost:8003 | GET /health     |

## Flux inter-services

```
vitrine-web  ──NEXT_PUBLIC_API_URL──►  vitrine-api  ──GESTION_API_URL──►  gestion-api
gestion-web  ──VITE_API_URL──────────►  gestion-api
vitrine-api  ──packages/db───────────►  cowork_bdd (readiness cowork seul)
gestion-api  ──packages/db───────────►  cowork_bdd + prysma_bdd (RO)
```

## Docker / Coolify

Chaque app possède un `Dockerfile` sous `apps/<app>/Dockerfile`.

**Important Coolify** : le **contexte de build est la racine du monorepo** (`.`), pas le sous-dossier de l'app.

| App         | Dockerfile                    | Port | Notes                                                                |
| ----------- | ----------------------------- | ---- | -------------------------------------------------------------------- |
| vitrine-web | `apps/vitrine-web/Dockerfile` | 3001 | Build args + runtime : `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL` |
| vitrine-api | `apps/vitrine-api/Dockerfile` | 8002 | `pnpm deploy --prod`, `ALLOWED_ORIGIN` (liste CSV)                   |
| gestion-web | `apps/gestion-web/Dockerfile` | 3002 | Build arg : `VITE_API_URL` (injecté dans CSP nginx)                  |
| gestion-api | `apps/gestion-api/Dockerfile` | 8003 | `pnpm deploy --prod`, `ALLOWED_ORIGIN` (liste CSV)                   |

Build local :

```bash
docker build -f apps/vitrine-web/Dockerfile -t vitrine-web .
docker build -f apps/vitrine-api/Dockerfile -t vitrine-api .
docker build -f apps/gestion-web/Dockerfile -t gestion-web .
docker build -f apps/gestion-api/Dockerfile -t gestion-api .
```

## Scripts racine

| Commande            | Description                         |
| ------------------- | ----------------------------------- |
| `pnpm dev`          | Démarre toutes les apps (Turborepo) |
| `pnpm build`        | Build packages + apps               |
| `pnpm lint`         | ESLint sur tout le monorepo         |
| `pnpm typecheck`    | Vérification TypeScript stricte     |
| `pnpm format`       | Formate avec Prettier               |
| `pnpm format:check` | Vérifie le formatage                |

## Variables d'environnement (résumé)

| Variable               | Apps concernées          | Description                                                      |
| ---------------------- | ------------------------ | ---------------------------------------------------------------- |
| `MONGODB_URI`          | vitrine-api, gestion-api | URI cluster MongoDB                                              |
| `MONGODB_DB_COWORK`    | vitrine-api, gestion-api | Base applicative (défaut `cowork_bdd`)                           |
| `MONGODB_DB_PRYSMA`    | gestion-api uniquement   | Base SSO (lecture seule, défaut `prysma_bdd`)                    |
| `ALLOWED_ORIGIN`       | vitrine-api, gestion-api | Origines CORS autorisées, séparées par des virgules (jamais `*`) |
| `GESTION_API_URL`      | vitrine-api              | URL de délégation vers gestion-api                               |
| `NEXT_PUBLIC_SITE_URL` | vitrine-web              | URL publique du site                                             |
| `NEXT_PUBLIC_API_URL`  | vitrine-web              | URL de vitrine-api (CSP `connect-src`)                           |
| `VITE_API_URL`         | gestion-web              | URL de gestion-api (bundle + CSP nginx)                          |

En production, `MONGODB_URI` doit utiliser `mongodb+srv://` ou `?tls=true`.

## Bases de données

- **cowork_bdd** — source de vérité applicative ; schémas dans `packages/db`.
- **prysma_bdd** — SSO Prysma, **lecture seule** ; accès exclusif à `gestion-api`.

## Commits

Conventional Commits via Husky + Commitlint :

```
feat(vitrine-api): add public endpoint
fix(db): handle connection timeout
chore(docker): update Nest runner
```

## Documentation

Voir [ARCHITECTURE.md](./ARCHITECTURE.md) pour la topologie détaillée, la sécurité et les choix techniques.
