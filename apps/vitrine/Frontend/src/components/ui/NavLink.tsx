"use client";

import Link, { useLinkStatus } from "next/link";

interface NavLinkProps extends Omit<React.ComponentProps<typeof Link>, "children"> {
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  isActive?: boolean;
}

function NavLinkLabel({
  children,
  className,
  activeClassName,
  pendingClassName,
  isActive,
}: Pick<
  NavLinkProps,
  "children" | "className" | "activeClassName" | "pendingClassName" | "isActive"
>) {
  const { pending } = useLinkStatus();

  return (
    <span
      className={[className, isActive ? activeClassName : "", pending ? pendingClassName : ""]
        .filter(Boolean)
        .join(" ")}
      aria-busy={pending || undefined}
    >
      {children}
    </span>
  );
}

export function NavLink({
  children,
  className,
  activeClassName,
  pendingClassName,
  isActive,
  ...linkProps
}: NavLinkProps) {
  return (
    <Link {...linkProps} prefetch={linkProps.prefetch ?? true}>
      <NavLinkLabel
        className={className}
        activeClassName={activeClassName}
        pendingClassName={pendingClassName}
        isActive={isActive}
      >
        {children}
      </NavLinkLabel>
    </Link>
  );
}
