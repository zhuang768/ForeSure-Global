"use client";

import { useEffect, useRef, useState } from "react";
import BrandLogo from "./BrandLogo";
import { useLang } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import type { LeafScene } from "@/lib/leafScene";
import styles from "./LeafHero.module.css";

export default function LeafHero() {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<LeafScene | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const { theme } = usePrefs();
  const { lang } = useLang();

  useEffect(() => {
    let cancelled = false;
    let mounted: LeafScene | null = null;
    // Load WebGL only on this page; the rest of the app remains usable during loading.
    import("@/lib/leafScene").then(({ createLeafScene }) => {
      if (cancelled || !host.current) return;
      try {
        mounted = createLeafScene(host.current, setReady);
        scene.current = mounted;
      } catch {
        // The supplied logo remains visible when WebGL is unavailable.
        host.current.querySelector("canvas")?.remove();
        setReady(false);
      }
    }).catch(() => { if (!cancelled) setReady(false); });
    return () => { cancelled = true; mounted?.dispose(); scene.current = null; };
  }, []);

  useEffect(() => { scene.current?.setTheme(theme); }, [theme]);

  return (
    <div className={styles.scene} data-ready={ready}>
      <div className={styles.fallback} aria-hidden="true">
        <BrandLogo variant="mark" decorative className={styles.fallbackLogo} />
      </div>
      <div ref={host} className={styles.canvas} aria-hidden="true" />
      {ready && (
        <div className={styles.controls} aria-label={lang === "zh" ? "葉片動畫" : "Leaf animation"}>
          <button type="button" aria-pressed={paused} onClick={() => {
            scene.current?.setPaused(!paused);
            setPaused(!paused);
          }}>
            {lang === "zh" ? paused ? "繼續動畫" : "暫停動畫" : paused ? "Resume motion" : "Pause motion"}
          </button>
          <span aria-hidden="true">/</span>
          <button type="button" onClick={() => { scene.current?.replay(); setPaused(false); }}>
            {lang === "zh" ? "重播飄落" : "Replay entrance"}
          </button>
        </div>
      )}
    </div>
  );
}
