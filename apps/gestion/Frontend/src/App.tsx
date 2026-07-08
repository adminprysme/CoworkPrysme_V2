import { AppRouter } from "./app/router.js";
import styles from "./App.module.css";
import "./styles/tokens.css";

export function App() {
  return (
    <div className={styles.root}>
      <AppRouter />
    </div>
  );
}
