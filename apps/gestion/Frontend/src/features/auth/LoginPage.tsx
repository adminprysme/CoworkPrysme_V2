import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { AUTH_MODE, loginLocal, loginSso } from "../../lib/api.js";
import { useAuth } from "../../app/AuthProvider.js";
import { ThemeToggle } from "../../components/ThemeToggle.js";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setUser } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ssoPending, setSsoPending] = useState(false);

  useEffect(() => {
    if (AUTH_MODE !== "sso") {
      return;
    }

    const token = searchParams.get("sso_token");
    if (!token) {
      return;
    }

    setSsoPending(true);
    setError(null);

    void loginSso(token)
      .then((me) => {
        setUser(me);
        setSearchParams({});
        navigate("/dashboard", { replace: true });
      })
      .catch(() => {
        setError("Session expirée, reconnectez-vous via Centrale");
      })
      .finally(() => {
        setSsoPending(false);
      });
  }, [navigate, searchParams, setSearchParams, setUser]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const me = await loginLocal(username, password);
      setUser(me);
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Identifiants invalides");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.themeToggle}>
        <ThemeToggle />
      </div>
      <div className={styles.card}>
        <img src="/logo-full.png" alt="Cowork Prysme" className={styles.logo} />
        <p className={styles.subtitle}>Espace de gestion interne</p>

        {AUTH_MODE === "local" ? (
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.label}>
              Identifiant
              <input
                className={styles.input}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label className={styles.label}>
              Mot de passe
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error ? <p className={styles.error}>{error}</p> : null}
            <button className={styles.button} type="submit" disabled={loading}>
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        ) : (
          <div className={styles.ssoBox}>
            {ssoPending ? (
              <p>Connexion en cours…</p>
            ) : error ? (
              <p className={styles.error}>{error}</p>
            ) : (
              <p>Connectez-vous via Centrale Application.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
