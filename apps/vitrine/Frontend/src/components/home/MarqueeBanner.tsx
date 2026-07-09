import styles from "./MarqueeBanner.module.css";

interface MarqueeBannerProps {
  enabled: boolean;
  text: string;
}

export function MarqueeBanner({ enabled, text }: MarqueeBannerProps) {
  if (!enabled || text.trim().length === 0) {
    return null;
  }

  return (
    <div className={styles.banner} aria-hidden="true">
      <div className={styles.track}>
        {Array.from({ length: 4 }).map((_, index) => (
          <span key={index} className={styles.item}>
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
