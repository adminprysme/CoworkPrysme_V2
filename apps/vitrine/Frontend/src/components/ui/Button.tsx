import Link from "next/link";

import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outlineLight";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonBaseProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

interface ButtonAsButton extends ButtonBaseProps {
  href?: undefined;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
}

interface ButtonAsLink extends ButtonBaseProps {
  href: string;
  type?: undefined;
  onClick?: undefined;
}

type ButtonProps = ButtonAsButton | ButtonAsLink;

function buildClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonBaseProps) {
  return [
    styles.button,
    styles[variant],
    size === "sm" ? styles.sm : "",
    size === "lg" ? styles.lg : "",
    fullWidth ? styles.fullWidth : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button(props: ButtonProps) {
  const className = buildClassName(props);

  if ("href" in props && props.href) {
    const { href, children } = props;
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  const { children, type = "button", onClick } = props;
  return (
    <button type={type} className={className} onClick={onClick}>
      {children}
    </button>
  );
}
