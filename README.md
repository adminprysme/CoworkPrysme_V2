# Cowork Prysme

Monorepo pour les applications **vitrine** (site public SEO) et **gestion** (CRM interne), partageant une base MongoDB applicative unique.

## Prérequis

- **Node.js 24 LTS** (voir `.nvmrc`)
- **pnpm 10.8.x** (déclaré dans `packageManager` : `pnpm@10.8.1`)
- Accès au cluster MongoDB (URI fournie via `MONGODB_URI`)

## Structure

```
coworkprysme_v2/
├── apps/
│   ├── vitrine/     # Site public — Next.js, port 3000
│   └── gestion/     # CRM interne — Next.js, port 3001
├── packages/
│   ├── config/      # ESLint, Prettier, tsconfig partagés
│   ├── db/          # Mongoose, connexion unique, schémas
│   └── shared/      # Types et schémas Zod partagés
├── .env.example     # Variables MongoDB (cluster)
└── ARCHITECTURE.md  # Décisions et détails techniques
```

## Démarrage rapide

```bash
# Installer les dépendances
pnpm install

# Copier les variables d'environnement
cp .env.example .env
cp apps/vitrine/.env.example apps/vitrine/.env.local
cp apps/gestion/.env.example apps/gestion/.env.local
# Renseigner MONGODB_URI dans chaque fichier .env.local

# Compiler les packages partagés
pnpm build

# Lancer les deux apps en parallèle
pnpm dev
```

| App     | URL locale            | Health check    |
| ------- | --------------------- | --------------- |
| vitrine | http://localhost:3000 | GET /api/health |
| gestion | http://localhost:3001 | GET /api/health |

## Scripts racine

| Commande            | Description                         |
| ------------------- | ----------------------------------- |
| `pnpm dev`          | Démarre toutes les apps (Turborepo) |
| `pnpm build`        | Build packages + apps               |
| `pnpm lint`         | ESLint sur tout le monorepo         |
| `pnpm typecheck`    | Vérification TypeScript stricte     |
| `pnpm format`       | Formate avec Prettier               |
| `pnpm format:check` | Vérifie le formatage                |

## Variables d'environnement

| Variable            | Description                         | Défaut       |
| ------------------- | ----------------------------------- | ------------ |
| `MONGODB_URI`       | URI du cluster MongoDB              | —            |
| `MONGODB_DB_COWORK` | Base applicative (lecture/écriture) | `cowork_bdd` |
| `MONGODB_DB_PRYSMA` | Base SSO externe (lecture seule)    | `prysma_bdd` |

Les apps Next.js chargent leurs variables depuis `apps/<app>/.env.local`. Reprendre les mêmes valeurs MongoDB que le `.env` racine.

## Bases de données

- **cowork_bdd** — source de vérité applicative ; schémas Mongoose dans `packages/db` uniquement.
- **prysma_bdd** — SSO Prysma préexistant, **lecture seule** ; une seule connexion cluster, bascule via `useDb()`.

## Commits

Conventional Commits enforced via Husky + Commitlint :

```
feat(vitrine): add landing page
fix(db): handle connection timeout
chore: update dependencies
```

## Documentation

Voir [ARCHITECTURE.md](./ARCHITECTURE.md) pour les choix techniques détaillés.
