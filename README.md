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
│   ├── vitrine/
│   │   ├── Frontend/   # @coworkprysme/vitrine-web — Next.js, port 3001
│   │   └── Backend/    # @coworkprysme/vitrine-api  — NestJS, port 8002
│   └── gestion/
│       ├── Frontend/   # @coworkprysme/gestion-web — Vite SPA, port 3002
│       └── Backend/    # @coworkprysme/gestion-api  — NestJS, port 8003
├── packages/
│   ├── config/         # ESLint, Prettier, tsconfig partagés
│   ├── db/             # Mongoose singleton, schémas, health checks
│   └── shared/         # Schémas Zod, contrats inter-services
├── .env.example
└── ARCHITECTURE.md
```

## Démarrage rapide

```bash
pnpm install

# Copier les variables par app (voir .env.example dans chaque dossier)
cp apps/vitrine/Frontend/.env.example apps/vitrine/Frontend/.env.local
cp apps/vitrine/Backend/.env.example apps/vitrine/Backend/.env
cp apps/gestion/Frontend/.env.example apps/gestion/Frontend/.env
cp apps/gestion/Backend/.env.example apps/gestion/Backend/.env

pnpm build
pnpm dev
```

| App (package)          | URL locale            | Health check    |
| ---------------------- | --------------------- | --------------- |
| vitrine-web (Frontend) | http://localhost:3001 | GET /api/health |
| vitrine-api (Backend)  | http://localhost:8002 | GET /health     |
| gestion-web (Frontend) | http://localhost:3002 | GET /api/health |
| gestion-api (Backend)  | http://localhost:8003 | GET /health     |

## Flux inter-services

```
vitrine-web  ──NEXT_PUBLIC_API_URL──►  vitrine-api  ──GESTION_API_URL──►  gestion-api
gestion-web  ──VITE_API_URL──────────►  gestion-api
vitrine-api  ──packages/db───────────►  cowork_bdd (readiness cowork seul)
gestion-api  ──packages/db───────────►  cowork_bdd + prysma_bdd (RO)
```

## Docker / Coolify

Chaque app possède un `Dockerfile` sous `apps/<env>/<Frontend|Backend>/Dockerfile`.

**Important Coolify** : le **contexte de build est la racine du monorepo** (`.`), pas le sous-dossier de l'app.

| App (package) | Dockerfile path                    | Port | Notes                                                                |
| ------------- | ---------------------------------- | ---- | -------------------------------------------------------------------- |
| vitrine-web   | `apps/vitrine/Frontend/Dockerfile` | 3001 | Build args + runtime : `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL` |
| vitrine-api   | `apps/vitrine/Backend/Dockerfile`  | 8002 | `pnpm deploy --prod`, `ALLOWED_ORIGIN` (liste CSV)                   |
| gestion-web   | `apps/gestion/Frontend/Dockerfile` | 3002 | Build arg : `VITE_API_URL` (injecté dans CSP nginx)                  |
| gestion-api   | `apps/gestion/Backend/Dockerfile`  | 8003 | `pnpm deploy --prod`, `ALLOWED_ORIGIN` (liste CSV)                   |

Build local :

```bash
docker build -f apps/vitrine/Frontend/Dockerfile -t vitrine-web .
docker build -f apps/vitrine/Backend/Dockerfile -t vitrine-api .
docker build -f apps/gestion/Frontend/Dockerfile -t gestion-web .
docker build -f apps/gestion/Backend/Dockerfile -t gestion-api .
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

| Variable                           | Apps concernées          | Description                                                                                                          |
| ---------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`                      | vitrine-api, gestion-api | URI cluster MongoDB                                                                                                  |
| `MONGODB_INTERNAL_NETWORK_TRUSTED` | vitrine-api, gestion-api | Opt-in prod : `true` pour autoriser `mongodb://` sans TLS/srv sur réseau interne Docker (jamais pour un hôte public) |
| `MONGODB_DB_COWORK`                | vitrine-api, gestion-api | Base applicative (défaut `cowork_bdd`)                                                                               |
| `MONGODB_DB_PRYSMA`                | gestion-api uniquement   | Base SSO (lecture seule, défaut `prysma_bdd`)                                                                        |
| `ALLOWED_ORIGIN`                   | vitrine-api, gestion-api | Origines CORS autorisées, séparées par des virgules (jamais `*`)                                                     |
| `GESTION_API_URL`                  | vitrine-api              | URL de délégation vers gestion-api                                                                                   |
| `NEXT_PUBLIC_SITE_URL`             | vitrine-web              | URL publique du site                                                                                                 |
| `NEXT_PUBLIC_API_URL`              | vitrine-web              | URL de vitrine-api (CSP `connect-src`)                                                                               |
| `VITE_API_URL`                     | gestion-web              | URL de gestion-api (bundle + CSP nginx)                                                                              |

En production, `MONGODB_URI` doit utiliser `mongodb+srv://`, `?tls=true`, **ou** être accompagné de `MONGODB_INTERNAL_NETWORK_TRUSTED=true` lorsque l’URI pointe vers le Mongo Docker interne partagé (`app-bdd`) sans TLS. Ne jamais poser ce flag pour une URI vers Internet / IP publique.

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
