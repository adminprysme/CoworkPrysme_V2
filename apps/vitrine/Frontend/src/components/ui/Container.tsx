import styles from "./Container.module.css";

interface ContainerProps {
  children: React.ReactNode;
  narrow?: boolean;
  className?: string;
}

export function Container({ children, narrow = false, className }: ContainerProps) {
  return (
    <div
      className={[narrow ? styles.narrow : styles.container, className].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}
