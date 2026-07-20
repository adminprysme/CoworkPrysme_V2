import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  IconCalendarPlus,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconFolder,
  IconMail,
  IconSettings,
} from "@tabler/icons-react";
import type { PlanningCalendarReservation, PlanningReservationDetail } from "@coworkprysme/shared";

import { fetchPlanningReservation } from "../../../lib/planning-api.js";
import {
  buildReservationRecapText,
  copyTextToClipboard,
  downloadReservationIcs,
} from "../reservation-clipboard.js";
import type { PlanningDrawerTab } from "./ReservationDetailDrawer.js";
import styles from "./ReservationContextMenu.module.css";

export interface ReservationContextMenuState {
  reservation: PlanningCalendarReservation;
  x: number;
  y: number;
}

interface ReservationContextMenuProps {
  state: ReservationContextMenuState | null;
  onClose: () => void;
  onOpenDetails: (reservationId: string, tab?: PlanningDrawerTab) => void;
}

type CopyKind = "reference" | "email" | "phone" | "recap" | null;

function resolveClientEmail(detail: PlanningReservationDetail | null): string | null {
  const fromClient = detail?.client.email?.trim();
  if (fromClient) return fromClient;
  return detail?.contacts.find((c) => c.email?.trim())?.email?.trim() || null;
}

function resolveClientPhone(detail: PlanningReservationDetail | null): string | null {
  const fromClient = detail?.client.phone?.trim();
  if (fromClient) return fromClient;
  return detail?.contacts.find((c) => c.phone?.trim())?.phone?.trim() || null;
}

export function ReservationContextMenu({
  state,
  onClose,
  onOpenDetails,
}: ReservationContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [detail, setDetail] = useState<PlanningReservationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copied, setCopied] = useState<CopyKind>(null);

  useEffect(() => {
    if (!state) {
      setDetail(null);
      setCopied(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetail(null);
    setCopied(null);
    void fetchPlanningReservation(state.reservation.id)
      .then((payload) => {
        if (!cancelled) setDetail(payload);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  useLayoutEffect(() => {
    if (!state || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const pad = 8;
    let left = state.x;
    let top = state.y;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, state.x - rect.width);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, state.y - rect.height);
    }
    left = Math.max(pad, Math.min(left, window.innerWidth - rect.width - pad));
    top = Math.max(pad, Math.min(top, window.innerHeight - rect.height - pad));
    setPos({ top, left });
  }, [state, detail, detailLoading, copied]);

  useEffect(() => {
    if (!state) return;

    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      }
    }
    function onScroll() {
      onClose();
    }

    window.addEventListener("mousedown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [state, onClose]);

  if (!state) return null;

  const reservation = state.reservation;
  const email = resolveClientEmail(detail);
  const phone = resolveClientPhone(detail);
  const showPhoneItem = !detailLoading && Boolean(phone);

  async function handleCopy(kind: Exclude<CopyKind, null>, text: string) {
    try {
      await copyTextToClipboard(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      /* ignore */
    }
  }

  function copyIcon(kind: Exclude<CopyKind, null>) {
    if (copied === kind) {
      return <IconCheck size={16} stroke={1.7} className={styles.iconCheck} aria-hidden />;
    }
    return <IconCopy size={16} stroke={1.6} className={styles.icon} aria-hidden />;
  }

  return (
    <div
      ref={menuRef}
      className={styles.menu}
      role="menu"
      aria-label="Actions de la réservation"
      style={{ top: pos.top, left: pos.left }}
    >
      <button
        type="button"
        role="menuitem"
        className={styles.item}
        onClick={() => {
          onOpenDetails(reservation.id, "summary");
          onClose();
        }}
      >
        <IconExternalLink size={16} stroke={1.6} className={styles.icon} aria-hidden />
        <span>Ouvrir les détails</span>
      </button>

      <div className={styles.separator} role="separator" />
      <p className={styles.sectionLabel}>Copier</p>

      <button
        type="button"
        role="menuitem"
        className={styles.item}
        onClick={() => void handleCopy("reference", reservation.reference)}
      >
        {copyIcon("reference")}
        <span>Copier la référence</span>
      </button>

      <button
        type="button"
        role="menuitem"
        className={styles.item}
        disabled={detailLoading || !email}
        title={!detailLoading && !email ? "Aucun email client" : undefined}
        onClick={() => {
          if (email) void handleCopy("email", email);
        }}
      >
        {copyIcon("email")}
        <span>Copier l'email du client</span>
      </button>

      {showPhoneItem ? (
        <button
          type="button"
          role="menuitem"
          className={styles.item}
          disabled={detailLoading || !phone}
          onClick={() => {
            if (phone) void handleCopy("phone", phone);
          }}
        >
          {copyIcon("phone")}
          <span>Copier le numéro du client</span>
        </button>
      ) : null}

      <button
        type="button"
        role="menuitem"
        className={styles.item}
        onClick={() => void handleCopy("recap", buildReservationRecapText({ reservation, detail }))}
      >
        {copyIcon("recap")}
        <span>Copier le récapitulatif</span>
      </button>

      <div className={styles.separator} role="separator" />
      <p className={styles.sectionLabel}>Accès rapide</p>

      <button
        type="button"
        role="menuitem"
        className={styles.item}
        disabled={detailLoading || !email}
        title={!detailLoading && !email ? "Aucun email client" : undefined}
        onClick={() => {
          if (!email) return;
          window.location.href = `mailto:${email}`;
          onClose();
        }}
      >
        <IconMail size={16} stroke={1.6} className={styles.icon} aria-hidden />
        <span>Envoyer un email au client</span>
      </button>

      <button
        type="button"
        role="menuitem"
        className={styles.item}
        onClick={() => {
          downloadReservationIcs({ reservation, detail });
          onClose();
        }}
      >
        <IconCalendarPlus size={16} stroke={1.6} className={styles.icon} aria-hidden />
        <span>Ajouter au calendrier Outlook</span>
      </button>

      <button
        type="button"
        role="menuitem"
        className={styles.item}
        onClick={() => {
          onOpenDetails(reservation.id, "manage");
          onClose();
        }}
      >
        <IconSettings size={16} stroke={1.6} className={styles.icon} aria-hidden />
        <span>Gérer la réservation</span>
      </button>

      <button
        type="button"
        role="menuitem"
        className={styles.item}
        onClick={() => {
          onOpenDetails(reservation.id, "documents");
          onClose();
        }}
      >
        <IconFolder size={16} stroke={1.6} className={styles.icon} aria-hidden />
        <span>Voir les documents</span>
      </button>

      <div className={styles.separator} role="separator" />

      <p className={styles.nativeHint} role="note">
        Maj + clic droit pour le menu du navigateur
      </p>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {copied === "reference"
          ? "Référence copiée"
          : copied === "email"
            ? "Email copié"
            : copied === "phone"
              ? "Numéro copié"
              : copied === "recap"
                ? "Récapitulatif copié"
                : ""}
      </span>
    </div>
  );
}
