import type { ReactElement, SVGProps } from "react";

import type { TransportIconId } from "@/config/contact-page";

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconSvg({
  size,
  children,
}: {
  size: number;
  children: SVGProps<SVGSVGElement>["children"];
}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {children}
    </svg>
  );
}

const ICONS: Record<TransportIconId, (size: number) => ReactElement> = {
  transit: (size) => (
    <IconSvg size={size}>
      <path {...STROKE} d="M4 15h16" />
      <path {...STROKE} d="M4 15V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6" />
      <path {...STROKE} d="M8 7V5" />
      <path {...STROKE} d="M16 7V5" />
      <path {...STROKE} d="M7 15v3" />
      <path {...STROKE} d="M17 15v3" />
      <circle {...STROKE} cx="7.5" cy="19" r="1.5" />
      <circle {...STROKE} cx="16.5" cy="19" r="1.5" />
    </IconSvg>
  ),
  bus: (size) => (
    <IconSvg size={size}>
      <path {...STROKE} d="M8 6v6" />
      <path {...STROKE} d="M15 6v6" />
      <path {...STROKE} d="M2 12h20" />
      <path
        {...STROKE}
        d="M18 18h2.5s.4-1.2.7-2.1c.2-.7.1-1.4-.1-2L19.2 9.2A2 2 0 0 0 17.4 8H6.6A2 2 0 0 0 4.8 9.2L2.9 13.9c-.2.6-.3 1.3-.1 2 .3.9.7 2.1.7 2.1H6"
      />
      <circle {...STROKE} cx="7" cy="18" r="2" />
      <circle {...STROKE} cx="17" cy="18" r="2" />
    </IconSvg>
  ),
  tram: (size) => (
    <IconSvg size={size}>
      <path
        {...STROKE}
        d="M7 4h10a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2Z"
      />
      <path {...STROKE} d="M7 8h10" />
      <path {...STROKE} d="M9 17v2" />
      <path {...STROKE} d="M15 17v2" />
      <circle {...STROKE} cx="9" cy="19" r="1.25" />
      <circle {...STROKE} cx="15" cy="19" r="1.25" />
      <path {...STROKE} d="M12 4V2" />
    </IconSvg>
  ),
  metro: (size) => (
    <IconSvg size={size}>
      <path {...STROKE} d="M12 3 4 8v8l8 5 8-5V8l-8-5Z" />
      <path {...STROKE} d="M12 6.5 16.5 9v3.5L12 15.5 7.5 12.5V9L12 6.5Z" />
    </IconSvg>
  ),
  taxi: (size) => (
    <IconSvg size={size}>
      <path
        {...STROKE}
        d="M19 17h1.5c.6 0 1-.4 1-1v-2.8c0-.8-.6-1.5-1.4-1.7l-1.8-.5C16.8 10.5 14.5 10 12 10s-4.8.5-6.3 1l-1.8.5C2.6 11.7 2 12.4 2 13.2V16c0 .6.4 1 1 1H4"
      />
      <path {...STROKE} d="M9 17h6" />
      <circle {...STROKE} cx="7" cy="17" r="2" />
      <circle {...STROKE} cx="17" cy="17" r="2" />
      <path {...STROKE} d="M8 10V7l2-2h4l2 2v3" />
      <path {...STROKE} d="M12 5V3" />
    </IconSvg>
  ),
  bike: (size) => (
    <IconSvg size={size}>
      <circle {...STROKE} cx="5.5" cy="17.5" r="3.5" />
      <circle {...STROKE} cx="18.5" cy="17.5" r="3.5" />
      <circle {...STROKE} cx="15" cy="5" r="1" />
      <path {...STROKE} d="M12 17.5V14l-3-3 4-3 2 3h3" />
    </IconSvg>
  ),
  car: (size) => (
    <IconSvg size={size}>
      <path
        {...STROKE}
        d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"
      />
      <circle {...STROKE} cx="7" cy="17" r="2" />
      <path {...STROKE} d="M9 17h6" />
      <circle {...STROKE} cx="17" cy="17" r="2" />
    </IconSvg>
  ),
  parking: (size) => (
    <IconSvg size={size}>
      <rect {...STROKE} x="5" y="3" width="14" height="18" rx="2" />
      <path {...STROKE} d="M9 7h3.5a2.5 2.5 0 0 1 0 5H9V7Z" />
      <path {...STROKE} d="M9 12v5" />
    </IconSvg>
  ),
  walk: (size) => (
    <IconSvg size={size}>
      <circle {...STROKE} cx="12" cy="5" r="1.75" />
      <path {...STROKE} d="M9 10.5 7.5 14l-1.5 6" />
      <path {...STROKE} d="M15 10.5 16.5 14l1.5 6" />
      <path {...STROKE} d="M12 10.5V16l-2.5 4.5" />
      <path {...STROKE} d="M12 16l2.5 4.5" />
    </IconSvg>
  ),
};

interface TransportIconProps {
  type: TransportIconId;
  size?: number;
}

export function TransportIcon({ type, size = 20 }: TransportIconProps) {
  return ICONS[type](size);
}
