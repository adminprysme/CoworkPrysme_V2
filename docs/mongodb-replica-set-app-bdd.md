# MongoDB partagé Coolify — replica set `rs0`

> **Contrainte infra (depuis juillet 2026)** : le conteneur Mongo **`app-bdd`** tourne en **replica set mono-nœud** (`rs0`). **Toute** application qui s'y connecte doit inclure `replicaSet=rs0` dans son URI (et ne doit **pas** utiliser `directConnection=true` si elle a besoin des transactions Mongo).

## Identité Coolify

| Élément              | Valeur                                                                      |
| -------------------- | --------------------------------------------------------------------------- |
| Ressource Coolify    | `app-bdd`                                                                   |
| Projet Coolify       | `prysme-centrale-d-application`                                             |
| Conteneur            | `a48ggo0osck4c4044gw4ogok` (image `mongo:7`)                                |
| Proxy stream (nginx) | `a48ggo0osck4c4044gw4ogok-proxy` → `0.0.0.0:27017`                          |
| Compose sur le VPS   | `/data/coolify/databases/a48ggo0osck4c4044gw4ogok/docker-compose.yml`       |
| Volume données       | `mongodb-db-a48ggo0osck4c4044gw4ogok` (~1,6 Go)                             |
| Replica set          | `rs0` — membre unique `127.0.0.1:27017` (PRIMARY)                           |
| Commande `mongod`    | `mongod --replSet rs0 --bind_ip_all --keyFile /data/configdb/mongo-keyfile` |

**Attention Coolify** : la commande `mongod --replSet …` a été ajoutée manuellement dans le compose. Un redeploy depuis l'UI Coolify peut l'écraser — persister la config dans Coolify ou versionner le compose.

## Ce n'est PAS un Mongo dédié au monorepo Cowork Prysme

Ce conteneur héberge **plusieurs dizaines de bases** utilisées par **de nombreuses applications** de l'écosystème Prysme / Maconciergerie / Horizonsolution. Le monorepo `coworkprysme_v2` n'utilise que **`cowork_bdd`** (R/W) et **`prysma_bdd`** (RO pour gestion-api), mais ce sont deux bases parmi d'autres sur la même instance.

### Bases présentes sur l'instance (juillet 2026)

| Base                    | Taille approx. | Remarque                                                              |
| ----------------------- | -------------- | --------------------------------------------------------------------- |
| `prysma_bdd`            | ~326 MB        | Partagée (annuaire, accès, comm, analytics, legacy cowork, monorepo…) |
| `db_cowork`             | ~265 MB        | **Legacy** prod `api.coworkprysme.eu` (≠ `cowork_bdd` du monorepo)    |
| `dev_prysmapp`          | ~269 MB        | Copie / legacy sur cette instance ; dev actif Neoma → autre conteneur |
| `db_catalogue`          | ~61 MB         | Catalogue Maconciergerie                                              |
| `prysme_communication`  | ~59 MB         | API comm + Neoma                                                      |
| `prysme_analytics`      | ~65 MB         | Analytics (via connexion partagée)                                    |
| `hs_pointage`           | ~24 MB         | Suivi-scan                                                            |
| `cowork_bdd`            | ~2 MB          | **Monorepo** Cowork Prysme v2                                         |
| `resa-exec-db`          | ~13 MB         | Réservation événementiel                                              |
| `academy_db`            | ~8 MB          | Academy                                                               |
| `espace_client`         | ~8 MB          | Espace client / Neoma / Comm                                          |
| `DB_centraleachats`     | ~3 MB          | Centrale achats                                                       |
| `dev_neoma`             | ~3 MB          | Legacy sur cette instance                                             |
| `db_orchestra`          | ~2 MB          | Orchestra                                                             |
| `espace_client_sandbox` | ~4 MB          | Sandbox (aucune app Coolify active repérée)                           |
| `prysme_access`         | ~1 MB          | Prysm'app accès                                                       |
| `prysme_archi`          | ~1 MB          | Archi                                                                 |
| `mon-portail`           | ~1 MB          | Open/Close                                                            |
| `rh-system`             | ~0 MB          | RH                                                                    |
| `sisens`                | ~0 MB          | Sisens                                                                |

## Applications Coolify connectées à ce conteneur

Toutes les URIs repérées dans `/data/coolify/applications/*/.env` utilisent encore **`directConnection=true`** et **aucune** n'inclut `replicaSet=rs0` (vérifié juillet 2026).

| FQDN / service                          | Bases Mongo utilisées                                   |
| --------------------------------------- | ------------------------------------------------------- |
| `api.coworkprysme.eu`                   | `db_cowork`, `prysma_bdd` (**legacy**, pas le monorepo) |
| `api-acces.prysme.eu`                   | `prysme_access`, `prysma_bdd`                           |
| `api-academy.prysme.eu`                 | `academy_db`, `prysma_bdd`                              |
| `api-analytics.prysme.eu`               | `prysma_bdd` (+ `prysme_analytics` côté code)           |
| `api-annuaire-interne.prysme.eu`        | `prysma_bdd`                                            |
| `api-app.prysme.eu`                     | `prysma_bdd`                                            |
| `api-archi.prysme.eu`                   | `prysme_archi`, `prysma_bdd`                            |
| `api-comm.prysme.eu`                    | `prysme_communication`, `espace_client`, `prysma_bdd`   |
| `api-neoma.maconciergerie.eu`           | `prysme_communication`, `espace_client`, `prysma_bdd`   |
| `api-catalogue.maconciergerie.eu`       | `db_catalogue`, `prysma_bdd`                            |
| `api-open-close.maconciergerie.eu`      | `mon-portail`, `prysma_bdd`                             |
| `centrale-achats.maconciergerie.eu/api` | `DB_centraleachats`                                     |
| `emploi-rh.prysme.eu/api`               | `rh-system`                                             |
| `resa-exec.monevenemenciel.eu/api`      | `resa-exec-db`                                          |
| `sisens.eu/api`                         | `sisens`                                                |
| `suivi-scan.horizonsolution.eu/api`     | `hs_pointage`, `prysma_bdd`                             |
| `api-orchestra.prysme.eu`               | `db_orchestra` (via `…-proxy:27017`)                    |

### Monorepo Cowork Prysme v2 (dev local)

Les fichiers `.env` du monorepo (`/`, `apps/vitrine/Backend`, `apps/gestion/Backend`) pointent vers `127.0.0.1:27017` avec **`replicaSet=rs0`** (sans `directConnection=true`) — **OK pour les transactions**.

Aucun déploiement Coolify du monorepo v2 (`cowork_bdd`) n'a été repéré à ce jour ; la prod publique `api.coworkprysme.eu` utilise encore **`db_cowork`**.

## Format d'URI attendu

### Depuis le VPS / dev local (via proxy nginx)

```
mongodb://USER:PASSWORD@127.0.0.1:27017/NOM_BASE?authSource=AUTH_DB&replicaSet=rs0
```

### Depuis le réseau Docker Coolify

```
mongodb://USER:PASSWORD@a48ggo0osck4c4044gw4ogok:27017/NOM_BASE?authSource=AUTH_DB&replicaSet=rs0
```

Orchestra passe par le proxy interne :

```
mongodb://USER:PASSWORD@a48ggo0osck4c4044gw4ogok-proxy:27017/NOM_BASE?authSource=admin&replicaSet=rs0
```

**À retirer** des anciennes chaînes : `directConnection=true` (incompatible avec la découverte du replica set ; bloque les transactions multi-documents).

## Risque pour les autres applications

| Scénario                                             | Risque après passage en RS                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| CRUD simple sans transaction                         | **Souvent OK** avec `directConnection=true` vers le PRIMARY — comportement non garanti à long terme |
| Transactions Mongo (`startSession`, multi-documents) | **Cassé** sans `replicaSet=rs0` dans l'URI                                                          |
| Nouveau projet branché sur `app-bdd`                 | **Doit** inclure `replicaSet=rs0` dès le départ                                                     |

État au moment de la migration : les autres services semblaient toujours se connecter (connexions PyMongo/Node visibles dans les logs), mais **aucune URI Coolify n'a été mise à jour**. Planifier une passe sur chaque `.env` Coolify concerné.

## Backup pré-migration

Archive locale : `backups/mongo-pre-replicaset-20260715-143347/` (`cowork_bdd` + `prysma_bdd`).

## Checklist — brancher un futur projet

1. Créer utilisateur + base sur `app-bdd` (via Coolify ou admin Mongo).
2. URI avec `replicaSet=rs0`, **sans** `directConnection=true`.
3. Si transactions nécessaires : tester `startSession()` en staging avant prod.
4. Ne pas supposer que l'instance n'héberge que votre projet — **instance partagée**.
