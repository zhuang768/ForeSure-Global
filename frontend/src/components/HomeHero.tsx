"use client";

import Link from "next/link";
import LeafHero from "./LeafHero";
import { useLang, useT } from "@/lib/i18n";
import styles from "./HomeHero.module.css";

export default function HomeHero() {
  const { lang } = useLang();
  const t = useT();
  const zh = lang === "zh";
  return (
    <section className={styles.hero} aria-labelledby="foresure-hero-title">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>FORESURE / 未然</p>
          <h1 id="foresure-hero-title" className={styles.title}>
            <span>{zh ? "預見風險，" : "Foresee risk."}</span>
            <span>{zh ? "保障未然。" : "Shape protection."}</span>
          </h1>
          <p className={styles.lead}>
            {zh ? <>讓 AI 從台灣事件中，<br />找到尚未被保障的風險。</> : <>Discover emerging risks in events across Taiwan.<br />Turn insight into thoughtful coverage.</>}
          </p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/generator">{t("nav.generator")}<span aria-hidden="true">→</span></Link>
            <Link className={styles.secondary} href="/history">{zh ? "查看歷史提案" : "Explore the archive"}</Link>
          </div>
        </div>
        <div className={styles.art}><LeafHero /></div>
        <p className={styles.caption}>{zh ? "感知風險 · 三方協作 · 形成保障" : "Sense risk · Collaborate · Shape coverage"}</p>
      </div>
    </section>
  );
}
