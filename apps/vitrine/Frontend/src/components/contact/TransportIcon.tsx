import type { ReactNode } from "react";

import type { TransportIconId } from "@/config/contact-page";

const ICONS: Record<TransportIconId, ReactNode> = {
  bus: (
    <path
      d="M5 6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v9a2 2 0 0 1-2 2h-1.2l-1.3 2H9.5l-1.3-2H7a2 2 0 0 1-2-2V6Zm2 0v3h10V6H7Zm1 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
      fill="currentColor"
    />
  ),
  tram: (
    <path
      d="M7 4h10a2 2 0 0 1 2 2v8a3 3 0 0 1-3 3h-1.5l-1.2 2H9.7l-1.2-2H7a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2Zm0 4v5h10V8H7Zm2 9a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm6 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"
      fill="currentColor"
    />
  ),
  metro: (
    <path
      d="M12 3 4 8v8l8 5 8-5V8l-8-5Zm0 3.2 4.5 2.8v4l-4.5 2.8-4.5-2.8v-4L12 6.2Z"
      fill="currentColor"
    />
  ),
  taxi: (
    <path
      d="M6 7h12l1 3H5l1-3Zm-1 5h14v2.5a1.5 1.5 0 0 1-1.5 1.5H9.2l-1 1.5H7.5L6.5 16H6A1.5 1.5 0 0 1 4.5 14.5V12Zm3.5 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
      fill="currentColor"
    />
  ),
  bike: (
    <path
      d="M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM6.5 13.5A3.5 3.5 0 1 0 10 17H14a3.5 3.5 0 1 0 0-3.5h-1.2l-1.3-2.5H9.1l-.6 1.1H6.5Z"
      fill="currentColor"
    />
  ),
  car: (
    <path
      d="M7 8h10l1.5 3.5H5.5L7 8Zm-2.5 6H19v2a1.5 1.5 0 0 1-1.5 1.5h-1.1l-.9 1.5h-1.7l-.9-1.5H9.1l-.9 1.5H6.5l-.9-1.5H4A1.5 1.5 0 0 1 2.5 16v-2ZM8 18.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm8 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"
      fill="currentColor"
    />
  ),
  parking: (
    <path d="M9 4h4a5 5 0 0 1 0 10H11v3H9V4Zm2 2v4h2a2 2 0 0 0 0-4h-2Z" fill="currentColor" />
  ),
};

interface TransportIconProps {
  type: TransportIconId;
}

export function TransportIcon({ type }: TransportIconProps) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      {ICONS[type]}
    </svg>
  );
}
