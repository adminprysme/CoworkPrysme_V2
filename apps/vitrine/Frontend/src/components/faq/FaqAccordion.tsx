"use client";

import Link from "next/link";
import { useId, useState } from "react";

import type { FaqGroup, FaqItem } from "@/config/faq-page";

import styles from "./FaqAccordion.module.css";

interface FaqAccordionProps {
  groups: FaqGroup[];
}

export function FaqAccordion({ groups }: FaqAccordionProps) {
  const baseId = useId();
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  function toggle(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className={styles.wrapper}>
      {groups.map((group) => (
        <section
          key={group.id}
          id={group.id}
          className={styles.group}
          aria-labelledby={`${baseId}-${group.id}-heading`}
        >
          <h2 id={`${baseId}-${group.id}-heading`} className={styles.groupTitle}>
            {group.title}
          </h2>
          <div className={styles.list}>
            {group.items.map((item) => (
              <FaqAccordionItem
                key={item.id}
                item={item}
                baseId={baseId}
                isOpen={openIds.has(item.id)}
                onToggle={() => toggle(item.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

interface FaqAccordionItemProps {
  item: FaqItem;
  baseId: string;
  isOpen: boolean;
  onToggle: () => void;
}

function FaqAccordionItem({ item, baseId, isOpen, onToggle }: FaqAccordionItemProps) {
  const triggerId = `${baseId}-${item.id}-trigger`;
  const panelId = `${baseId}-${item.id}-panel`;

  return (
    <article className={styles.item}>
      <h3 className={styles.questionWrap}>
        <button
          type="button"
          id={triggerId}
          className={styles.trigger}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span className={styles.question}>{item.question}</span>
          <span className={styles.icon} aria-hidden="true">
            {isOpen ? "−" : "+"}
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        className={styles.panel}
        hidden={!isOpen}
      >
        <p className={styles.lead}>{item.lead}</p>
        {item.detail ? <p className={styles.detail}>{item.detail}</p> : null}
        {item.links && item.links.length > 0 ? (
          <ul className={styles.links}>
            {item.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
