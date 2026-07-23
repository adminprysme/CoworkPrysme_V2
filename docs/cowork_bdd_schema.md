# Conception du schéma `cowork_bdd` — Cowork Prysme V2

Document de conception **maintenu** du schéma `cowork_bdd`. Il cartographie le domaine applicatif (CDC + évolutions tunnel paiement / Qonto). Source de vérité code : `packages/db` (schemas Mongoose).

`cowork_bdd` est la base applicative partagée : **`gestion-api` y écrit** (source de toute la logique métier), **`vitrine-api` y lit** (données publiques/SEO) et écrit le tunnel de réservation / paiements. `prysma_bdd` (SSO staff) reste externe et en lecture seule.

---

## 0. Conventions transverses

- **Identifiants** : `_id` en `ObjectId`. Les relations se font par référence (`ObjectId`), pas par embedding, dès que la donnée est interrogée indépendamment ou non bornée.
- **Montants** : **toujours en centimes entiers** (`Int`), jamais en flottant. Un champ `currency` (`"EUR"`) par document monétaire.
- **Dates** : `Date` (UTC) partout. Champs `createdAt` / `updatedAt` systématiques.
- **Snapshots** : les documents historiques (réservations, factures) **figent** au moment de leur création le nom de l'espace, le prix et le taux de TVA appliqués. On ne dépend jamais d'une jointure live pour un document passé, car espaces et tarifs évoluent.
- **Soft-delete** : via un champ `status` (`active` / `inactive` / `archived`) plutôt qu'une suppression physique, sauf droit à l'oubli RGPD.
- **Embed vs référence** : on embarque ce qui est borné et lu avec le parent (équipements d'un espace, lignes d'une facture) ; on référence ce qui est non borné ou interrogé seul (réservations d'un client, paiements d'une facture).

---

## 1. Décisions structurantes (à lire avant les collections)

Ces cinq points conditionnent la solidité de tout le projet. Ils se conçoivent **dans le modèle**, pas après.

### 1.1 Le lock n'est PAS une réservation

Le verrou 10 min (§3.3) est une collection **distincte** `slotLocks`, avec un **index TTL Mongo** qui la purge automatiquement. Une réservation `pending` (jaune) et un lock sont deux choses différentes : le lock protège un créneau _pendant que le client remplit le tunnel_, avant même qu'une réservation existe. Confondre les deux est l'erreur classique qui casse le parcours.

### 1.2 Anti-double-réservation — le point le plus délicat

MongoDB ne sait pas exprimer nativement une contrainte d'unicité sur des **plages qui se chevauchent**. La stratégie retenue :

1. **Le lock sert de mutex** : un index **unique** sur `slotLocks (spaceId, startAt, endAt)` garantit que deux clients ne peuvent pas verrouiller le même créneau exact simultanément (§4.2 « verrou côté client »).
2. **La confirmation se fait dans une transaction Mongo** : on vérifie qu'aucune réservation `pending` / `awaiting_payment` / `confirmed` ne chevauche (`startAt < newEnd AND endAt > newStart`), puis on insère — le tout atomiquement. Cela couvre les durées variables (heure, jour, semaine, mois) que l'index unique seul ne couvre pas, et le « conflit bloquant à la création » côté gestionnaire (§4.2). Les acquires de lock concurrentes sur intervalles chevauchants sont sérialisées via `slotLockGates` (§3).

> **Implication infra Coolify** : les transactions Mongo exigent un **replica set** (un nœud unique configuré en replica set suffit). À prévoir dans le déploiement Mongo — un `mongod` standalone ne permet pas les transactions. Le TTL, lui, fonctionne sans replica set.

> **Note TTL** : le moniteur TTL de Mongo passe ~toutes les 60 s. Un lock peut donc survivre jusqu'à ~1 min après son expiration théorique. On traite donc aussi un lock comme invalide **à la lecture** si `expiresAt < now`, sans attendre la purge.

### 1.3 Facturation multi-TVA au niveau de la ligne

La TVA se porte **par ligne** de facture/devis, pas au niveau du document (§3.11). Chaque ligne stocke son `vatRate`, son HT, sa TVA et son TTC. Le document agrège une **ventilation par taux** (`vatBreakdown[]`). La remise « 1 achetée = 1 offerte » est portée par un flag `promoEligible` sur le **service** et n'est jamais applicable aux salles, bureaux ni stationnement (garde-fou à coder dans le moteur).

### 1.4 Auth : deux mondes séparés

- **Clients** : `clientAccounts` (email + hash de mot de passe) créés depuis la vitrine. Liés au `cardex` à la 1ʳᵉ réservation.
- **Staff/Admin** : `staffProfiles` liés à une identité **Prysm'app** (SSO). **Aucun mot de passe staff dans `cowork_bdd`** — seulement le `prysmAppUserId` et les permissions. L'authentification interroge `prysma_bdd` (lecture seule).

### 1.5 RGPD dès la conception (§4.5)

Le `cardex` porte `lastReservationAt` (base du calcul de rétention 3 ans), `anonymizedAt`, et un statut de rétention. Les **factures sont exclues** de l'effacement (conservation légale 10 ans) — le droit à l'oubli anonymise le cardex sans toucher aux factures. Toute modif du cardex est journalisée dans `auditLogs`. Le consentement (politique de confidentialité) est enregistré à la création de compte.

---

## 2. Domaine STRUCTURE (espaces)

### `buildings`

Bâtiments du coworking (le CDC parle de bâtiments au pluriel).

| Champ                    | Type     | Note                                                                           |
| ------------------------ | -------- | ------------------------------------------------------------------------------ |
| `_id`                    | ObjectId |                                                                                |
| `name`, `description`    | String   |                                                                                |
| `address`                | Object   | `{ street, zip, city, country, accessInfo }` (plan d'accès transports/voiture) |
| `accessCode`             | String   | code serrure bâtiment courant (envoyé J-1)                                     |
| `openingHours`           | Object   | horaires par défaut hebdo, surchargeables par espace                           |
| `status`                 | Enum     | `active` / `inactive`                                                          |
| `createdAt`, `updatedAt` | Date     |                                                                                |

### `spaces`

Salles de réunion **et** bureaux privatifs, distingués par `type` (discriminator).

| Champ                 | Type                 | Note                                                                 |
| --------------------- | -------------------- | -------------------------------------------------------------------- |
| `_id`                 | ObjectId             |                                                                      |
| `buildingId`          | ObjectId → buildings |                                                                      |
| `type`                | Enum                 | `meeting_room` / `private_office`                                    |
| `name`, `description` | String               |                                                                      |
| `floor`               | String/Int           | pour le filtre « par étage » du planning                             |
| `capacity`            | Int                  | filtre « max N personnes »                                           |
| `equipments`          | [Object]             | embarqué : `{ key, label }` (vidéoprojecteur, paperboard…)           |
| `photos`              | [Object]             | embarqué : `{ storageKey, alt, order }` (fichiers en object storage) |
| `openingHours`        | Object               | plages horaires configurables (surcharge le bâtiment) §3.2           |
| `accessCode`          | String               | code serrure de l'espace (envoyé J-1)                                |
| `status`              | Enum                 | `active` / `inactive` — seuls les `active` alimentent la vitrine     |
| `seo`                 | Object               | `{ slug, metaTitle, metaDescription }` pour les pages dynamiques     |

**Index** : `{ buildingId: 1, type: 1, status: 1 }`, `{ "seo.slug": 1 }` unique.

### `slotClosures`

Créneaux ouverts/fermés exceptionnels : jours fériés, fermetures, ouvertures spéciales (§4.2 « ouvrir/fermer des créneaux »).

| Champ              | Type                     | Note                                                   |
| ------------------ | ------------------------ | ------------------------------------------------------ |
| `scope`            | Object                   | `{ buildingId?, spaceId?, spaceType? }` — nul = global |
| `kind`             | Enum                     | `closed` / `open_exception`                            |
| `startAt`, `endAt` | Date                     |                                                        |
| `reason`           | String                   |                                                        |
| `createdBy`        | ObjectId → staffProfiles |                                                        |

**Index** : `{ "scope.spaceId": 1, startAt: 1, endAt: 1 }`.

---

## 3. Domaine RÉSERVATION

### `reservations` — cœur du système

Machine à états ; les couleurs du planning (§3.3) sont dérivées de `status`.

| Champ                       | Type                      | Note                                                                                           |
| --------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| `_id`                       | ObjectId                  |                                                                                                |
| `reference`                 | String                    | n° lisible (ex. `RES-2026-00042`), unique                                                      |
| `spaceId`                   | ObjectId → spaces         |                                                                                                |
| `spaceSnapshot`             | Object                    | nom + type figés (§ snapshot)                                                                  |
| `buildingId`                | ObjectId → buildings      |                                                                                                |
| `clientAccountId`           | ObjectId → clientAccounts | nul si créée par le staff pour un walk-in                                                      |
| `cardexId`                  | ObjectId → cardex         |                                                                                                |
| `quoteId`                   | ObjectId → quotes?        | présent si créée depuis accept devis (clé de groupe Option A)                                  |
| `type`                      | Enum                      | `meeting_room` / `private_office` / `long_term` / `recurring`                                  |
| `startAt`, `endAt`          | Date                      |                                                                                                |
| `durationClass`             | Enum                      | `hourly` / `halfday` / `daily` / `weekly` / `monthly` — pilote les règles d'annulation (§3.10) |
| `partySize`                 | Int                       | nombre de personnes                                                                            |
| `status`                    | Enum                      | `pending` / **`awaiting_payment`** / `confirmed` / `cancelled` / `completed` / `no_show`       |
| `statusHistory`             | [Object]                  | `{ from, to, at, by, reason }` — traçabilité                                                   |
| `services`                  | [Object]                  | services ajoutés, snapshot `{ serviceId, label, qty, unitPriceHT, vatRate }`                   |
| `discountCodeId`            | ObjectId → discountCodes  | code promo/préférentiel appliqué                                                               |
| `pricing`                   | Object                    | `{ subtotalHT, totalVAT, totalTTC, discountTotal }` snapshot                                   |
| `cgvAcceptedAt`             | Date                      | acceptation CGV (§3.6 étape 4)                                                                 |
| `withdrawalAcknowledgedAt`  | Date                      | acknowledgement droit de rétractation (tunnel)                                                 |
| `awaitingPaymentExpiresAt`  | Date                      | présent si `status = awaiting_payment` — au-delà, le hold peut être annulé                     |
| `awaitingPaymentMethod`     | Enum                      | `card` / `bank_transfer` — distingue expiry Stripe vs relances virement                        |
| `stripePaymentIntentId`     | String                    | dernier PaymentIntent carte (annulation à l'expiry)                                            |
| `bankTransferRemindersSent` | [Enum]                    | paliers déjà envoyés : `j2` / `j4` / `j6` (pas de J+8 — J+8 = fenêtre d'expiration)            |
| `createdChannel`            | Enum                      | `online` / `staff` / `phone`                                                                   |
| `createdAt`, `updatedAt`    | Date                      |                                                                                                |

> **Hold paiement** : à la confirm tunnel, statut `awaiting_payment` (carte ou virement éligible). Les statuts qui **occupent** le créneau sont `pending` / `awaiting_payment` / `confirmed`. Le mode client `"proforma"` / « paiement différé » a été **retiré** ; ne pas confondre avec `invoice.type: "proforma"` (type de document).

**Index critiques** :

- `{ spaceId: 1, startAt: 1, endAt: 1, status: 1 }` — détection de chevauchement (§1.2) et rendu planning.
- `{ cardexId: 1, startAt: -1 }` — historique client, duplication de réservation.
- `{ quoteId: 1 }` — réservations issues d’un devis (Option A).
- `{ reference: 1 }` unique.
- `{ status: 1, awaitingPaymentExpiresAt: 1 }` (partiel `awaiting_payment`) — sweeper d'expiration.
- `{ status: 1, awaitingPaymentMethod: 1, "statusHistory.at": 1 }` (partiel virement) — relances bank_transfer.

### `slotLocks` — verrou temporaire 10 min (§1.1)

| Champ              | Type              | Note                                       |
| ------------------ | ----------------- | ------------------------------------------ |
| `spaceId`          | ObjectId → spaces |                                            |
| `startAt`, `endAt` | Date              | créneau verrouillé                         |
| `sessionId`        | String            | session anonyme du visiteur (avant compte) |
| `clientAccountId`  | ObjectId          | si déjà connecté                           |
| `expiresAt`        | Date              | = création + 10 min                        |
| `createdAt`        | Date              |                                            |

**Index** :

- `{ expiresAt: 1 }` avec `expireAfterSeconds: 0` → **purge TTL automatique**.
- `{ spaceId: 1, startAt: 1, endAt: 1 }` **unique** → mutex anti-collision pour le **même** tuple exact (§1.2).

### `slotLockGates` — fence d'écriture par espace

Document technique (1 par `spaceId`) touché dans la **transaction** `acquireLock` pour sérialiser les acquires concurrents sur des intervalles qui se chevauchent (l'index unique de `slotLocks` ne couvre que le tuple exact).

| Champ       | Type              | Note                    |
| ----------- | ----------------- | ----------------------- |
| `spaceId`   | ObjectId → spaces | unique                  |
| `updatedAt` | Date              | bumped à chaque acquire |

**Index** : `{ spaceId: 1 }` unique.

---

## 4. Domaine CLIENT

### `clientAccounts` — authentification client

| Champ                      | Type                     | Note                                                                                                                                                                                            |
| -------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email`                    | String                   | unique                                                                                                                                                                                          |
| `passwordHash`             | String                   | bcrypt/argon2 — jamais en clair                                                                                                                                                                 |
| `cardexId`                 | ObjectId → cardex        | nul jusqu'à la 1ʳᵉ réservation                                                                                                                                                                  |
| `role`                     | Enum                     | `owner` / `member` — owner = `Cardex.clientAccountId`                                                                                                                                           |
| `emailVerifiedAt`          | Date                     |                                                                                                                                                                                                 |
| `consent`                  | Object                   | `{ privacyPolicyVersion, acceptedAt }` (§4.5 RGPD)                                                                                                                                              |
| `marketingConsent`         | Object                   | opt-in marketing (tunnel)                                                                                                                                                                       |
| `status`                   | Enum                     | `active` / `locked` (désactivé staff) / `anonymized` (RGPD futur) / `pending_activation` (bootstrap staff-accept devis — MDP non défini ; auth `ACCOUNT_PENDING_ACTIVATION` ≠ `ACCOUNT_LOCKED`) |
| `lockedAt`                 | Date                     | renseigné à la désactivation staff                                                                                                                                                              |
| `lockedByStaffProfileId`   | ObjectId → staffProfiles | auteur de la désactivation                                                                                                                                                                      |
| `lockReason`               | String                   | motif optionnel (max 500)                                                                                                                                                                       |
| `unlockedAt`               | Date                     | dernière réactivation                                                                                                                                                                           |
| `unlockedByStaffProfileId` | ObjectId → staffProfiles | auteur de la réactivation                                                                                                                                                                       |

**Index** : `{ email: 1 }` unique, `{ cardexId: 1, role: 1 }`, `{ cardexId: 1, status: 1 }`.

Historique complet des lock/unlock/transfert de propriété : `auditLogs` (pas de sous-collection).

### `cardex` — fiche client, source de vérité (§4.5)

| Champ                    | Type                       | Note                                                                                                                                                                                                                                |
| ------------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`                    | ObjectId                   |                                                                                                                                                                                                                                     |
| `clientAccountId`        | ObjectId → clientAccounts  | lien 1:1                                                                                                                                                                                                                            |
| `identity`               | Object                     | nom, prénom, téléphone                                                                                                                                                                                                              |
| `company`                | Object                     | raison sociale, SIRET, TVA intracom, adresse facturation                                                                                                                                                                            |
| `documents`              | [Object]                   | uploads staff Contrats/Autres : `{ _id, category: contract\|other, clientVisible, label?, originalFilename, contentType, sizeBytes, storageKey, uploadedAt, uploadedByStaffProfileId }` — factures = collection `invoices`, pas ici |
| `preferentialCodeIds`    | [ObjectId] → discountCodes | codes tarifaires négociés (§3.8)                                                                                                                                                                                                    |
| `billingSummary`         | Object                     | `{ depositsTotal, balanceDue }` (dénormalisé, recalculé)                                                                                                                                                                            |
| `lastReservationAt`      | Date                       | **base du calcul de rétention 3 ans**                                                                                                                                                                                               |
| `retentionStatus`        | Enum                       | `active` / `pending_anonymization` / `anonymized`                                                                                                                                                                                   |
| `anonymizedAt`           | Date                       | droit à l'oubli                                                                                                                                                                                                                     |
| `createdAt`, `updatedAt` | Date                       |                                                                                                                                                                                                                                     |

**Index** : `{ clientAccountId: 1 }` unique, `{ lastReservationAt: 1 }` (balayage rétention), `{ "company.siret": 1 }`.

---

## 5. Domaine STAFF & sécurité

### `staffProfiles` — staff/admin via SSO Prysm'app (§4.1, §4.4)

| Champ                  | Type   | Note                                                                       |
| ---------------------- | ------ | -------------------------------------------------------------------------- |
| `prysmAppUserId`       | String | identité SSO — **pas de mot de passe stocké ici**                          |
| `displayName`, `email` | String | affichage (email récupérable depuis Prysm'app)                             |
| `role`                 | Enum   | `manager` / `admin`                                                        |
| `permissions`          | Object | par module : `{ planning, billing, clients, stats, spaces, promo }` = bool |
| `scope`                | Object | restriction périmètre : `{ buildingIds:[], spaceTypes:[] }` (§4.4)         |
| `status`               | Enum   | `active` / `revoked`                                                       |

**Index** : `{ prysmAppUserId: 1 }` unique.

### `auditLogs` — traçabilité unifiée (§4.4 + §4.5)

Journal des actions staff **et** des modifications de cardex.

| Champ    | Type   | Note                                                    |
| -------- | ------ | ------------------------------------------------------- |
| `actor`  | Object | `{ kind: staff/client/system, id }`                     |
| `action` | String | `reservation.cancel`, `cardex.update`, `invoice.issue`… |
| `entity` | Object | `{ type, id }`                                          |
| `diff`   | Object | champs modifiés `{ field: { before, after } }`          |
| `reason` | String | motif (obligatoire ex. annulation staff §4.2)           |
| `at`     | Date   |                                                         |

**Index** : `{ "entity.type": 1, "entity.id": 1, at: -1 }`, `{ "actor.id": 1, at: -1 }`.

---

## 6. Domaine TARIFICATION

### `tariffs` — grille tarifaire (§2.1, §4.3)

| Champ                  | Type        | Note                                                       |
| ---------------------- | ----------- | ---------------------------------------------------------- |
| `scope`                | Object      | `{ spaceId? , spaceType? }` — tarif par espace ou par type |
| `durationClass`        | Enum        | `hourly` / `halfday` / `daily` / `weekly` / `monthly`      |
| `priceHT`              | Int (cents) |                                                            |
| `vatRate`              | Number      | taux applicable (multi-TVA §3.11)                          |
| `subscription`         | Object      | abonnements (grille publique vitrine)                      |
| `validFrom`, `validTo` | Date        | versionnage tarifaire                                      |
| `status`               | Enum        | `active` / `inactive`                                      |

**Index** : `{ "scope.spaceId": 1, durationClass: 1, status: 1 }`.

### `services` — services complémentaires (§3.6 étape 2)

| Champ           | Type        | Note                                                                                     |
| --------------- | ----------- | ---------------------------------------------------------------------------------------- |
| `key`, `label`  | String      | café, paperboard, vidéoprojecteur, parking, impression…                                  |
| `priceHT`       | Int (cents) |                                                                                          |
| `vatRate`       | Number      | TVA propre au service                                                                    |
| `promoEligible` | Bool        | **éligible « 1 achetée = 1 offerte »** — jamais vrai pour parking/salles/bureaux (§3.11) |
| `status`        | Enum        | `active` / `inactive`                                                                    |

### `discountCodes` — codes promo + préférentiels (§3.8, §4.7)

Collection unifiée avec un discriminant `kind`. _(À valider : voir §9 — on pourrait les séparer.)_

| Champ                  | Type       | Note                                                                   |
| ---------------------- | ---------- | ---------------------------------------------------------------------- |
| `code`                 | String     | unique (ex. `CODE20`, `WELCOME`)                                       |
| `kind`                 | Enum       | `promo` (public, système NEOMA) / `preferential` (négocié, lié cardex) |
| `discountType`         | Enum       | `percentage` / `fixed_amount` / `buy_one_get_one`                      |
| `value`                | Int/Number | 20 (%) ou 5000 (cents) selon type                                      |
| `perimeter`            | Object     | `{ appliesTo: order/space/service, serviceKeys?:[] }` (§4.7)           |
| `cardexId`             | ObjectId   | renseigné si `kind = preferential` (§3.8)                              |
| `stackable`            | Bool       | cumul avec d'autres promos (§4.7)                                      |
| `expiresAt`            | Date       | **obligatoire** (§4.7)                                                 |
| `maxUses`, `usedCount` | Int        |                                                                        |
| `status`               | Enum       | `active` / `expired` / `disabled`                                      |

**Index** : `{ code: 1 }` unique, `{ cardexId: 1 }`, `{ expiresAt: 1 }`.

---

## 7. Domaine FACTURATION (§4.6)

### `quotes` — devis

Cycle de vie : `draft` → `sent` → `accepted` / `refused` / `expired` (§4.6 + chantier Devis).

| Champ                                               | Type          | Note                                                                                                                                     |
| --------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `reference`                                         | String        | unique                                                                                                                                   |
| `cardexId`                                          | ObjectId?     | **optionnel** jusqu’à accept / bootstrap staff                                                                                           |
| `clientAccountId`                                   | ObjectId?     | contact principal ; optionnel jusqu’à accept                                                                                             |
| `prospect`                                          | Object?       | identité pré-cardex (`email`, nom, téléphone, company, `billingAddress`) — alias produit `clientDraft`                                   |
| `reservationId`                                     | ObjectId?     | **déprécié** — préférer `reservationIds`                                                                                                 |
| `reservationIds`                                    | [ObjectId]    | rempli à l’accept (Option A multi-espaces)                                                                                               |
| `lines`                                             | [Object]      | `QuoteLine` : base billing + `spaceId`/`buildingId`/`startAt`/`endAt` + `calculated*` / `forcedUnitPriceHT` + `priceSource` auto\|forced |
| `vatBreakdown`                                      | [Object]      | ventilation par taux `{ rate, baseHT, vat }` (§1.3)                                                                                      |
| `totals`                                            | Object        | `{ ht, vat, ttc, discountTotal }`                                                                                                        |
| `depositPercent`                                    | Number        | 0–100 ; montants acompte dérivés serveur                                                                                                 |
| `depositAmountHT` / `depositAmountTTC`              | Int (cents)?  | snapshot                                                                                                                                 |
| `depositVatBreakdown`                               | [Object]?     | ventilation TVA acompte (PDF facture)                                                                                                    |
| `paymentSituation`                                  | Enum?         | `immediate` / `on_quote` / `deposit` / `net_30`                                                                                          |
| `paymentMethodPreferred`                            | Enum?         | `card` / `bank_transfer` / `direct_debit` (stub UI)                                                                                      |
| `status`                                            | Enum          | `draft` / `sent` / `accepted` / `refused` / `expired`                                                                                    |
| `validUntil`                                        | Date          | validité devis **et** borne TTL `awaiting_payment` post-accept                                                                           |
| `internalNote`                                      | String?       | **staff-only** — jamais PDF/email client                                                                                                 |
| `publicConditions` / `paymentTermsLabel`            | String?       | conditions client                                                                                                                        |
| `sentAt` / `acceptedAt` / `refusedAt` / `expiredAt` | Date?         | traçabilité                                                                                                                              |
| `createdByStaffProfileId`                           | ObjectId?     | auteur staff                                                                                                                             |
| `acceptTokenHash` / `acceptTokenExpiresAt`          | String?/Date? | token accept client (hash opaque)                                                                                                        |
| `acceptedBy`                                        | Object?       | `{ kind: client\|staff, clientAccountId?, staffProfileId? }`                                                                             |

**Index** : `{ reference: 1 }` unique, `{ cardexId: 1, createdAt: -1 }`, `{ status: 1, validUntil: 1 }`, `{ acceptTokenHash: 1 }` unique sparse.

### `invoices` — proforma → acquittée

Une seule collection, cycle de vie par `status` (la proforma se **complète** jusqu'à fin de séjour via le post-master, §4.6).

| Champ                       | Type        | Note                                                                         |
| --------------------------- | ----------- | ---------------------------------------------------------------------------- |
| `reference`                 | String      | unique                                                                       |
| `type`                      | Enum        | `proforma` / `final`                                                         |
| `cardexId`, `reservationId` | ObjectId    | `reservationId` = primaire (compat)                                          |
| `quoteId`                   | ObjectId?   | discriminant devis-derived (A1)                                              |
| `reservationIds`            | [ObjectId]? | groupe A1 multi-espaces                                                      |
| `lines`                     | [Object]    | idem devis ; ajout possible via **post-master** tant que `status = proforma` |
| `vatBreakdown`              | [Object]    | multi-TVA ventilée (§1.3)                                                    |
| `totals`                    | Object      | `{ ht, vat, ttc, discountTotal, paidTotal, balanceDue }`                     |
| `paymentSituation`          | Enum        | `immediate` / `on_quote` / `deposit` / `net_30` (§4.6)                       |
| `status`                    | Enum        | `proforma` / `issued` / `partially_paid` / `paid` / `overdue` / `cancelled`  |
| `dueDate`                   | Date        | pilote les relances et le journal des débiteurs                              |
| `pdfStorageKey`             | String      | PDF généré                                                                   |
| `issuedAt`, `paidAt`        | Date        |                                                                              |

**Index** : `{ reference: 1 }` unique, `{ cardexId: 1, issuedAt: -1 }`, `{ status: 1, dueDate: 1 }` (débiteurs/relances), `{ quoteId: 1 }` (devis-derived).

### `payments` — règlements (§4.6)

| Champ            | Type                | Note                                                                                   |
| ---------------- | ------------------- | -------------------------------------------------------------------------------------- |
| `invoiceId`      | ObjectId → invoices |                                                                                        |
| `cardexId`       | ObjectId            |                                                                                        |
| `kind`           | Enum                | `deposit` / `balance` / `full`                                                         |
| `method`         | Enum                | `card` / `transfer` / `direct_debit` / `cash`                                          |
| `amount`         | Int (cents)         |                                                                                        |
| `reconciliation` | Object              | `{ status: pending/matched, qontoTxId }` — rapprochement Qonto semi-auto (§3.11, §4.9) |
| `receivedAt`     | Date                |                                                                                        |

**Index** : `{ invoiceId: 1 }`, `{ "reconciliation.status": 1 }`, `{ "reconciliation.qontoTxId": 1 }` (partiel).

> **Post-master** (§4.6) : ce n'est pas une collection — c'est l'opération d'ajout de lignes à une `invoice` en statut `proforma` jusqu'à la fin du séjour. Tracée dans `auditLogs`.
> **Journal des débiteurs** (p.2) : ce n'est pas une collection — c'est une requête sur `invoices { status: overdue/partially_paid }`.

### `qontoOAuthCredentials` — tokens OAuth Qonto (chiffrés)

Une seule org ; refresh tokens rotatifs. Champs : `key`, blobs chiffrés access/refresh, `expiresAt`, timestamps. Index `{ key: 1 }` unique.

### `qontoTransferCandidates` — suggestions de rapprochement virement

Snapshots crédits Qonto pour aide à `mark-received` (semi-auto).

| Champ                  | Type     | Note                                                 |
| ---------------------- | -------- | ---------------------------------------------------- |
| `qontoTxId`            | String   | unique                                               |
| `amount`, `settledAt`  | Int/Date |                                                      |
| `label` / counterparty | String   | libellé brut                                         |
| `reservationReference` | String?  | `RES-…` extrait / suggéré                            |
| `matchStatus`          | Enum     | statut de matching                                   |
| `consumedAt`           | Date?    | set quand le staff confirme mark-received avec ce tx |

**Index** : `{ qontoTxId: 1 }` unique, `{ reservationReference: 1, consumedAt: 1 }`, `{ matchStatus: 1, consumedAt: 1 }`.

---

## 8. Domaine PÉRIPHÉRIQUE (phases ultérieures)

Ces collections ne conditionnent pas le cœur ; elles sont listées pour la cohérence d'ensemble.

### `notifications` — emails auto + programmés (§3.9)

`{ cardexId, reservationId, template (confirmation/j-7/j-1/dunning/satisfaction), channel: email, scheduledFor, sentAt, status, payloadSnapshot }`. Les envois J-7 / J-1 / relance / satisfaction sont des jobs planifiés lisant cette collection. Index `{ status: 1, scheduledFor: 1 }`.

### `reviews` — avis clients (§2.1 « Avis clients »)

`{ cardexId?, author, rating, text, source: site/google, publishedAt, status: pending/approved }`. Alimente la page vitrine + rich snippets Google.

### `satisfactionSurveys` — questionnaire à 3 mois (§3.9)

`{ cardexId, reservationId, level (excellent→mauvais, 5 niveaux), answeredAt }`. _(À valider : fusionnable avec `reviews`.)_

### `newsOffers` — actualités & offres (§4.9)

`{ title, body, kind: news/offer, publishedFrom, publishedTo, status }`. Visible client + vitrine.

### `incidents` — pannes déclarées (§4.9)

`{ reportedBy (client/staff), spaceId?, buildingId?, description, status: open/in_progress/resolved, createdAt, resolvedAt }`.

### Statistiques (§4.8)

**Pas de collection dédiée par défaut** : ADR, REVPAR, REVPAC, taux d'occupation et CA sont **calculés** à la volée à partir de `reservations`, `invoices` et `spaces`, avec comparaison N vs N-1 et export CSV. Prévoir éventuellement une collection `statsSnapshots` **seulement** si les agrégations deviennent trop lourdes (optimisation tardive, pas maintenant).

---

## 9. Points à valider (décisions ouvertes)

1. **`discountCodes` unifié ou séparé ?** J'ai fusionné codes promo (§4.7) et préférentiels (§3.8) sous un `kind`, car structurellement identiques. On peut les séparer en deux collections si tu préfères une frontière nette. **Recommandation : unifié.**
2. **`satisfactionSurveys` vs `reviews`** — fusionner ou garder distincts (enquête déclenchée vs avis public) ? **Recommandation : distincts.**
3. **Codes d'accès serrures** — statiques sur `building`/`space` (modèle actuel) ou rotatifs par réservation ? Le CDC ne précise pas de rotation. **Recommandation : statiques pour l'instant**, snapshot dans la notif J-1.
4. **Réservations longue durée / récurrentes** (§3.2) — traitées uniquement par email au gestionnaire dans le CDC. Faut-il quand même tracer la demande dans une collection `reservationRequests` (lead) ? **Recommandation : oui, une collection légère** pour ne pas perdre le lead.
5. **Multi-bâtiments** — le CDC parle de bâtiments au pluriel ; le modèle est multi-bâtiments par défaut. À confirmer que c'est bien le besoin.

---

## 10. Récapitulatif des collections

**Cœur** : `buildings`, `spaces`, `slotClosures`, `reservations`, `slotLocks`, `slotLockGates`.
**Clients** : `clientAccounts`, `cardex`.
**Staff** : `staffProfiles`, `staffSessions`, `auditLogs`.
**Tarification** : `services`, `discountCodes` (+ tarifs embarqués / liés aux spaces selon implémentation).
**Facturation** : `quotes`, `invoices`, `payments`, `qontoOAuthCredentials`, `qontoTransferCandidates`, `referenceSequences`.
**Contenu vitrine** : `vitrineContent`.
**Périphérique** : `notifications`, `satisfactionSurveys`, (`reviews`, `newsOffers`, `incidents`, `statsSnapshots` optionnelles / futures).

**Ordre d'implémentation recommandé** : STRUCTURE → RÉSERVATION+LOCK (le cœur) → CLIENT → TARIFICATION → FACTURATION → PÉRIPHÉRIQUE. Chaque phase ne dépend que des précédentes.
