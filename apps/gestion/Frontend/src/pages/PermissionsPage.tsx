import { useCallback, useEffect, useState } from "react";

import { Navigate } from "react-router-dom";

import { useAuth } from "../app/AuthProvider.js";
import {
  fetchPermissionsCompanies,
  fetchPermissionsSecteurs,
  fetchPermissionsUsers,
  PERMISSIONS_PAGE_SIZES,
  type PermissionsPagination,
  type PermissionsPageSize,
  type PermissionsUserRow,
  type PrysmaCompanyOption,
  type PrysmaSecteurOption,
} from "../lib/permissions.js";
import styles from "./PermissionsPage.module.css";

const ROLE_LABELS: Record<PermissionsUserRow["role"], string> = {
  none: "Aucun accès",
  admin: "Administrateur",
  manager: "Gestionnaire",
};

function UserAvatar({ photo, name }: { photo?: string; name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (photo) {
    return <img src={photo} alt="" className={styles.avatar} />;
  }

  return (
    <span className={styles.avatarFallback} aria-hidden="true">
      {initials || "?"}
    </span>
  );
}

export function PermissionsPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<PrysmaCompanyOption[]>([]);
  const [secteurs, setSecteurs] = useState<PrysmaSecteurOption[]>([]);
  const [users, setUsers] = useState<PermissionsUserRow[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [secteurId, setSecteurId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PermissionsPageSize>(25);
  const [pagination, setPagination] = useState<PermissionsPagination>({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  });
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingSecteurs, setLoadingSecteurs] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    async function loadCompanies() {
      setLoadingCompanies(true);
      setError(null);
      try {
        const response = await fetchPermissionsCompanies();
        if (!cancelled) {
          setCompanies(response.companies);
        }
      } catch {
        if (!cancelled) {
          setError("Impossible de charger les entreprises.");
        }
      } finally {
        if (!cancelled) {
          setLoadingCompanies(false);
        }
      }
    }

    void loadCompanies();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!companyId) {
      setSecteurs([]);
      setSecteurId("");
      return;
    }

    let cancelled = false;

    async function loadSecteurs() {
      setLoadingSecteurs(true);
      setError(null);
      try {
        const response = await fetchPermissionsSecteurs(companyId);
        if (!cancelled) {
          setSecteurs(response.secteurs);
          setSecteurId((current) =>
            response.secteurs.some((secteur) => secteur.id === current) ? current : "",
          );
        }
      } catch {
        if (!cancelled) {
          setSecteurs([]);
          setSecteurId("");
          setError("Impossible de charger les secteurs.");
        }
      } finally {
        if (!cancelled) {
          setLoadingSecteurs(false);
        }
      }
    }

    void loadSecteurs();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setError(null);
    try {
      const response = await fetchPermissionsUsers({
        companyId: companyId || undefined,
        secteurId: secteurId || undefined,
        search: search || undefined,
        page,
        pageSize,
      });
      setUsers(response.users);
      setPagination(response.pagination);
    } catch {
      setUsers([]);
      setPagination({ page: 1, pageSize, total: 0, totalPages: 1 });
      setError("Impossible de charger les utilisateurs.");
    } finally {
      setLoadingUsers(false);
    }
  }, [companyId, secteurId, search, page, pageSize]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  if (!user) {
    return null;
  }

  if (user.profile.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const rangeStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const rangeEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Permissions</h1>
        <p className={styles.subtitle}>Utilisateurs Prysm&apos;app et rôles Gestion</p>
      </header>

      <section className={styles.toolbar} aria-label="Filtres">
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Entreprise</span>
          <select
            className={styles.select}
            value={companyId}
            disabled={loadingCompanies}
            onChange={(event) => {
              setCompanyId(event.target.value);
              setSecteurId("");
              setPage(1);
            }}
          >
            <option value="">Toutes les entreprises</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Secteur</span>
          <select
            className={styles.select}
            value={secteurId}
            disabled={!companyId || loadingSecteurs}
            onChange={(event) => {
              setSecteurId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">
              {!companyId
                ? "Choisir une entreprise d'abord"
                : loadingSecteurs
                  ? "Chargement…"
                  : "Tous les secteurs"}
            </option>
            {secteurs.map((secteur) => (
              <option key={secteur.id} value={secteur.id}>
                {secteur.name}
              </option>
            ))}
          </select>
        </label>

        <label className={[styles.field, styles.searchField].join(" ")}>
          <span className={styles.fieldLabel}>Recherche</span>
          <input
            className={styles.input}
            type="search"
            value={searchInput}
            placeholder="Nom, identifiant, e-mail…"
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Photo</th>
              <th scope="col">Nom affiché</th>
              <th scope="col">Entreprise</th>
              <th scope="col">Poste</th>
              <th scope="col">Rôle</th>
            </tr>
          </thead>
          <tbody>
            {loadingUsers ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  Chargement des utilisateurs…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  Aucun utilisateur trouvé.
                </td>
              </tr>
            ) : (
              users.map((row) => (
                <tr key={row.id}>
                  <td>
                    <UserAvatar photo={row.photo} name={row.displayName} />
                  </td>
                  <td>{row.displayName}</td>
                  <td>{row.companyName ?? "—"}</td>
                  <td>{row.position ?? "—"}</td>
                  <td>
                    <span
                      className={[
                        styles.roleBadge,
                        row.role === "admin" ? styles.roleAdmin : "",
                        row.role === "manager" ? styles.roleManager : "",
                        row.role === "none" ? styles.roleNone : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {ROLE_LABELS[row.role]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loadingUsers ? (
        <footer className={styles.pagination} aria-label="Pagination">
          <label className={styles.pageSizeField}>
            <span className={styles.fieldLabel}>Par page</span>
            <select
              className={styles.select}
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value) as PermissionsPageSize);
                setPage(1);
              }}
            >
              {PERMISSIONS_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <p className={styles.count}>
            {pagination.total === 0
              ? "Aucun utilisateur"
              : `Affichage ${rangeStart}–${rangeEnd} sur ${pagination.total}`}
          </p>

          <div className={styles.pageControls}>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={pagination.page <= 1 || loadingUsers}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Précédent
            </button>
            <span className={styles.pageIndicator}>
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={pagination.page >= pagination.totalPages || loadingUsers}
              onClick={() => setPage((current) => current + 1)}
            >
              Suivant
            </button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
