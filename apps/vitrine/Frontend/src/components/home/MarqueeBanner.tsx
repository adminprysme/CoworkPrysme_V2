import styles from "./MarqueeBanner.module.css";

interface MarqueeBannerProps {
  enabled: boolean;
  text: string;
}

const REPETITIONS_PER_GROUP = 12;

function MarqueeGroup({ text }: { text: string }) {
  return (
    <span className={styles.group}>
      {Array.from({ length: REPETITIONS_PER_GROUP }).map((_, index) => (
        <span key={index} className={styles.segment}>
          <span className={styles.phrase}>{text}</span>
          <span className={styles.separator} aria-hidden="true">
            ·
          </span>
        </span>
      ))}
    </span>
  );
}

export function MarqueeBanner({ enabled, text }: MarqueeBannerProps) {
  if (!enabled || text.trim().length === 0) {
    return null;
  }

  const plainText = text.trim();

  return (
    <div className={styles.banner} aria-hidden="true">
      <div className={styles.track}>
        <MarqueeGroup text={plainText} />
        <MarqueeGroup text={plainText} />
      </div>
      <p className={styles.staticText}>{plainText}</p>
    </div>
  );
}
