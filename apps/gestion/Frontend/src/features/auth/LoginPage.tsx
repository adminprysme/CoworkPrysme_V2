import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  AUTH_MODE,
  CENTRALE_HOME_URL,
  loginLocal,
  loginSso,
  type AuthMeResponse,
} from "../../lib/api.js";
import { useAuth } from "../../app/AuthProvider.js";
import { ThemeToggle } from "../../components/ThemeToggle.js";
import { SSOTransition } from "./SSOTransition.js";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setUser } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Show fullscreen transition on first paint when returning from Centrale.
  const [ssoPending, setSsoPending] = useState(
    () => AUTH_MODE === "sso" && Boolean(searchParams.get("sso_token")),
  );
  const [ssoAuthSucceeded, setSsoAuthSucceeded] = useState(false);
  const [ssoUserName, setSsoUserName] = useState<string | undefined>();
  const ssoMeRef = useRef<AuthMeResponse | null>(null);
  const ssoAttemptedTokenRef = useRef<string | null>(null);

  function handleCentraleLogin() {
    if (!CENTRALE_HOME_URL) {
      return;
    }
    window.location.href = CENTRALE_HOME_URL;
  }

  function handleSsoTransitionComplete() {
    const me = ssoMeRef.current;
    if (!me) {
      return;
    }
    // setUser only after animation — earlier would let PublicOnly eject /login
    // if sso_token were already cleared; keep token until this point.
    setUser(me);
    setSearchParams({}, { replace: true });
    navigate("/dashboard", { replace: true });
  }

  useEffect(() => {
    if (AUTH_MODE !== "sso") {
      return;
    }

    const token = searchParams.get("sso_token");
    if (!token) {
      return;
    }

    if (ssoAttemptedTokenRef.current === token) {
      return;
    }
    ssoAttemptedTokenRef.current = token;

    setSsoPending(true);
    setSsoAuthSucceeded(false);
    setSsoUserName(undefined);
    ssoMeRef.current = null;
    setError(null);

    void loginSso(token)
      .then((me) => {
        ssoMeRef.current = me;
        setSsoUserName(me.profile.displayName);
        setSsoAuthSucceeded(true);
        // Do NOT setUser here — PublicOnly would unmount the transition.
      })
      .catch((error: unknown) => {
        setError(
          error instanceof Error ? error.message : "Session expirée, reconnectez-vous via Centrale",
        );
        setSsoPending(false);
        setSsoAuthSucceeded(false);
        ssoMeRef.current = null;
        setSearchParams({}, { replace: true });
      });
  }, [searchParams, setSearchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const me = await loginLocal(username, password);
      setUser(me);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Identifiants invalides");
    } finally {
      setLoading(false);
    }
  }

  if (AUTH_MODE === "sso" && ssoPending) {
    return (
      <SSOTransition
        authSucceeded={ssoAuthSucceeded}
        userName={ssoUserName}
        onComplete={handleSsoTransitionComplete}
      />
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />

      <div className={styles.themeToggle}>
        <ThemeToggle />
      </div>

      <div className={styles.card}>
        <div className={styles.cardAccent} aria-hidden="true" />

        <header className={styles.brand}>
          <img src="/logo-icon.png" alt="" className={styles.logoIcon} />
          <h1 className={styles.brandTitle}>GESTION</h1>
        </header>

        {AUTH_MODE === "local" ? (
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.label}>
              Identifiant
              <input
                className={styles.input}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="prenom.nom"
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
                placeholder="••••••••"
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
            {error ? (
              <p className={styles.error}>{error}</p>
            ) : (
              <p>Connectez-vous via Centrale Application.</p>
            )}
            {!CENTRALE_HOME_URL ? (
              <p className={styles.error}>URL Centrale non configurée (VITE_CENTRALE_HOME_URL).</p>
            ) : null}
            <button
              className={styles.button}
              type="button"
              disabled={!CENTRALE_HOME_URL}
              onClick={handleCentraleLogin}
            >
              Se connecter via Centrale
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
