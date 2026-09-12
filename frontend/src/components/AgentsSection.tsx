"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useT } from "@/lib/i18n";
import styles from "./AgentsSection.module.css";

const ROLES = [
  { id: "pm", code: "PM", name: "intro.pmRole", summary: "intro.pmSummary", description: "intro.pmDesc" },
  { id: "uw", code: "UW", name: "intro.uwRole", summary: "intro.uwSummary", description: "intro.uwDesc" },
  { id: "actuary", code: "ACT", name: "intro.actuaryRole", summary: "intro.actuarySummary", description: "intro.actuaryDesc" },
] as const;

type RoleId = (typeof ROLES)[number]["id"];

export default function AgentsSection() {
  const t = useT();
  const [openRole, setOpenRole] = useState<RoleId | null>("pm");

  return (
    <section id="agents" className={styles.section} aria-labelledby="agents-title">
      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>THREE PERSPECTIVES</p>
          <h2 id="agents-title" className={styles.title}>{t("intro.agentsTitle")}</h2>
          <p className={styles.subtitle}>{t("intro.agentsSubtitle")}</p>
        </header>
        <div className={styles.roles}>
          {ROLES.map((role) => {
            const open = openRole === role.id;
            const Icon = open ? Minus : Plus;
            return (
              <div key={role.id} className={styles.role}>
                <h3>
                  <button
                    id={`agent-${role.id}-toggle`}
                    className={styles.toggle}
                    type="button"
                    aria-expanded={open}
                    aria-controls={`agent-${role.id}-detail`}
                    onClick={() => setOpenRole((current) => current === role.id ? null : role.id)}
                  >
                    <span className={styles.code} aria-hidden="true">{role.code}</span>
                    <span className={styles.name}>{t(role.name)}</span>
                    <span className={styles.summary}>{t(role.summary)}</span>
                    <Icon className={styles.icon} size={24} strokeWidth={2} aria-hidden="true" />
                  </button>
                </h3>
                <div
                  id={`agent-${role.id}-detail`}
                  role="region"
                  aria-labelledby={`agent-${role.id}-toggle`}
                  hidden={!open}
                  className={styles.detail}
                >
                  <p>{t(role.description)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
