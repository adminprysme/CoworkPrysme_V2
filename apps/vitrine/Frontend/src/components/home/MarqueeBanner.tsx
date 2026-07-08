import { HOME_CONTENT } from "@/config/home";
import styles from "./MarqueeBanner.module.css";

export function MarqueeBanner() {
  const text = HOME_CONTENT.marquee;

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
