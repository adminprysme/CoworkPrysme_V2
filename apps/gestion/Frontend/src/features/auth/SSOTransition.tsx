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

const MAX_STEP_WITHOUT_AUTH = SSO_STEPS.length - 2;
const STEP_DURATION_MS = 600;
const COMPLETE_HOLD_MS = 800;

type SSOTransitionProps = {
  onComplete: () => void;
  userName?: string;
  /** When true, animation may finish on the welcome step and call onComplete. */
  authSucceeded: boolean;
};

export function SSOTransition({ onComplete, userName, authSucceeded }: SSOTransitionProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < MAX_STEP_WITHOUT_AUTH) {
          return prev + 1;
        }
        return prev;
      });
    }, STEP_DURATION_MS);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!authSucceeded || isComplete) {
      return;
    }
    if (currentStep < MAX_STEP_WITHOUT_AUTH) {
      return;
    }

    setCurrentStep(SSO_STEPS.length - 1);
    setIsComplete(true);
    const timeout = window.setTimeout(() => {
      onCompleteRef.current();
    }, COMPLETE_HOLD_MS);

    return () => window.clearTimeout(timeout);
  }, [authSucceeded, currentStep, isComplete]);

  const currentProgress = SSO_STEPS[currentStep]?.progress ?? 0;
  const currentText =
    isComplete && userName ? `Bienvenue ${userName} !` : (SSO_STEPS[currentStep]?.text ?? "");

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
          {isComplete ? (
            <div className={styles.checkWrapper}>
              <IconCheck className={styles.checkIcon} stroke={3} aria-hidden="true" />
            </div>
          ) : (
            <div className={styles.spinner} aria-hidden="true" />
          )}
          <span className={`${styles.statusText} ${isComplete ? styles.statusTextSuccess : ""}`}>
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
