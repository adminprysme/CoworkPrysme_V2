import { useEffect, useRef, useState } from "react";
import { IconCheck } from "@tabler/icons-react";

import styles from "./SSOTransition.module.css";

const LOGO_URL = "/prysme-logo.png";

const SSO_STEPS = [
  { text: "Connexion sécurisée...", progress: 20 },
  { text: "Validation du token...", progress: 40 },
  { text: "Authentification...", progress: 60 },
  { text: "Chargement de votre profil...", progress: 80 },
  { text: "Bienvenue !", progress: 100 },
] as const;

/** Per-step dwell so 0→last is always visible (~3.5–4s total with hold). */
const STEP_DURATION_MS = 700;
const COMPLETE_HOLD_MS = 900;
const LAST_STEP_INDEX = SSO_STEPS.length - 1;

type SSOTransitionProps = {
  onComplete: () => void;
  userName?: string;
  /** Auth finished successfully — required before onComplete, not for advancing steps. */
  authSucceeded: boolean;
};

export function SSOTransition({ onComplete, userName, authSucceeded }: SSOTransitionProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [animationDone, setAnimationDone] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const completionFiredRef = useRef(false);

  // Always advance through every step on a fixed timeline — never skip for fast auth.
  useEffect(() => {
    const timers: number[] = [];

    for (let step = 1; step <= LAST_STEP_INDEX; step += 1) {
      timers.push(
        window.setTimeout(() => {
          setCurrentStep(step);
          if (step === LAST_STEP_INDEX) {
            setAnimationDone(true);
          }
        }, step * STEP_DURATION_MS),
      );
    }

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  // Navigate only after full animation + hold, and only once auth has succeeded.
  useEffect(() => {
    if (!animationDone || !authSucceeded || completionFiredRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      if (completionFiredRef.current) {
        return;
      }
      completionFiredRef.current = true;
      onCompleteRef.current();
    }, COMPLETE_HOLD_MS);

    return () => window.clearTimeout(timeout);
  }, [animationDone, authSucceeded]);

  const isWelcome = currentStep === LAST_STEP_INDEX;
  const currentProgress = SSO_STEPS[currentStep]?.progress ?? 0;
  const currentText =
    isWelcome && userName ? `Bienvenue ${userName} !` : (SSO_STEPS[currentStep]?.text ?? "");

  return (
    <div className={styles.container} role="status" aria-live="polite">
      <div className={`${styles.bgCircle} ${styles.bgCircle1}`} aria-hidden="true" />
      <div className={`${styles.bgCircle} ${styles.bgCircle2}`} aria-hidden="true" />
      <div className={`${styles.bgCircle} ${styles.bgCircle3}`} aria-hidden="true" />

      <div className={styles.logoWrapper}>
        <div className={styles.logoHalo} aria-hidden="true" />
        <div className={`${styles.logoHalo} ${styles.logoHalo2}`} aria-hidden="true" />
        <img src={LOGO_URL} alt="" className={styles.logo} />
      </div>

      <div className={styles.card}>
        <h1 className={styles.title}>GESTION</h1>
        <p className={styles.subtitle}>Connexion via Centrale Prysma</p>

        <div className={styles.progressContainer}>
          <div className={styles.progressBar} style={{ width: `${currentProgress}%` }} />
        </div>

        <div className={styles.status}>
          {isWelcome ? (
            <div className={styles.checkWrapper}>
              <IconCheck className={styles.checkIcon} stroke={3} aria-hidden="true" />
            </div>
          ) : (
            <div className={styles.spinner} aria-hidden="true" />
          )}
          <span className={`${styles.statusText} ${isWelcome ? styles.statusTextSuccess : ""}`}>
            {currentText}
          </span>
        </div>

        <div className={styles.steps} aria-hidden="true">
          {SSO_STEPS.map((_, index) => (
            <div
              key={index}
              className={`${styles.stepDot} ${index <= currentStep ? styles.stepDotActive : ""}`}
            />
          ))}
        </div>
      </div>

      <p className={styles.footer}>Authentification sécurisée SSO</p>
    </div>
  );
}
