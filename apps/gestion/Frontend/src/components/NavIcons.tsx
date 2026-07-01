import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function NavIcon({ id, className }: { id: string; className?: string }) {
  const p = base({ className });

  switch (id) {
    case "dashboard":
      return (
        <svg {...p}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
        </svg>
      );
    case "planning":
      return (
        <svg {...p}>
          <rect x="4" y="5" width="16" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M4 11h16" />
        </svg>
      );
    case "reservations":
      return (
        <svg {...p}>
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <rect x="5" y="7" width="14" height="13" rx="2" />
          <path d="M9 12h6M9 16h4" />
        </svg>
      );
    case "spaces":
      return (
        <svg {...p}>
          <path d="M4 20V8l8-4 8 4v12" />
          <path d="M9 20v-6h6v6" />
        </svg>
      );
    case "clients":
      return (
        <svg {...p}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="10" r="2.5" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 20c0-2.2 1.8-4 4-4" />
        </svg>
      );
    case "billing":
      return (
        <svg {...p}>
          <rect x="5" y="4" width="14" height="16" rx="2" />
          <path d="M9 9h6M9 13h6M9 17h4" />
        </svg>
      );
    case "promo":
      return (
        <svg {...p}>
          <path d="M14 9l-5 5M9.5 8.5h.01M14.5 13.5h.01" />
          <path d="M4 12V6a2 2 0 0 1 2-2h10l4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
        </svg>
      );
    case "stats":
      return (
        <svg {...p}>
          <path d="M5 19V9M12 19V5M19 19v-7" />
        </svg>
      );
    case "news":
      return (
        <svg {...p}>
          <path d="M6 6h12v12H6z" />
          <path d="M9 10h6M9 14h4" />
        </svg>
      );
    case "incidents":
      return (
        <svg {...p}>
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.3 4.7 2.6 18a1 1 0 0 0 .9 1.5h16.9a1 1 0 0 0 .9-1.5L13.7 4.7a1 1 0 0 0-1.8 0Z" />
        </svg>
      );
    case "administration":
      return (
        <svg {...p}>
          <circle cx="12" cy="8" r="3" />
          <path d="M6 20v-1a6 6 0 0 1 12 0v1" />
          <path d="M19 8l2 2M19 12h3" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

export function CollapseIcon({ className }: { className?: string }) {
  return (
    <svg {...base({ className })}>
      <path d="M9 6 4 12l5 6M20 6l-5 6 5 6" />
    </svg>
  );
}

export function MenuIcon({ className }: { className?: string }) {
  return (
    <svg {...base({ className })}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg {...base({ className })}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg {...base({ className })}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
