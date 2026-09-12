"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { describeChain, type ChainTone } from "@/lib/chainPill";
import { translate, useLang, useT, type DictKey, type Lang } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import type { ChainStatus } from "@/lib/types";
import BrandLogo from "@/components/BrandLogo";

/**
 * A label whose box is as wide as the longer of its two translations, so switching language does not
 * change the button's width and the header controls stay put. The hidden twin is stacked in the same
 * grid cell and is invisible but still takes up space.
 */
function StableLabel({ k, lang, prefix = "" }: { k: DictKey; lang: Lang; prefix?: string }) {
  const other: Lang = lang === "zh" ? "en" : "zh";
  return (
    <span className="grid whitespace-nowrap">
      <span className="[grid-area:1/1]">
        {prefix}
        {translate(lang, k)}
      </span>
      <span className="invisible [grid-area:1/1]" aria-hidden>
        {prefix}
        {translate(other, k)}
      </span>
    </span>
  );
}

const NAV: { href: string; k: DictKey }[] = [
  { href: "/", k: "nav.home" },
  { href: "/generator", k: "nav.generator" },
  { href: "/history", k: "nav.history" },
  { href: "/overview", k: "nav.overview" },
];

const SEG = "inline-flex items-center rounded-md border border-border bg-surface-2 p-0.5 text-xs";
const SEG_ON = "bg-primary text-white shadow-xs";
const SEG_OFF = "text-muted hover:text-text";
const CHAIN_PILL: Record<ChainTone, string> = {
  onchain: "pill bg-primary-soft text-primary-ink",
  mock: "pill bg-warn-soft text-warn",
  offline: "pill border border-border bg-surface-2 text-muted",
};

/** Shared top bar: logo, page links, chain status, language / theme toggles, primary CTA. */
export default function AppHeader({ chain }: { chain: ChainStatus | null | undefined }) {
  const t = useT();
  const { lang, setLang } = useLang();
  const { theme, setTheme } = usePrefs();
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const onGenerator = isActive("/generator");

  // Green only when the backend reports a real Sepolia connection; mock mode and "no backend" say so.
  const chainState = describeChain(chain);
  const chainPill = chainState ? (
    <span className={CHAIN_PILL[chainState.tone]}>
      <StableLabel k={chainState.key} lang={lang} prefix="● " />
    </span>
  ) : null;

  const langToggle = (
    <div className={SEG} role="group" aria-label="Language">
      <button
        type="button"
        onClick={() => setLang("zh")}
        className={`rounded px-2 py-0.5 text-xs font-semibold transition-all ${lang === "zh" ? SEG_ON : SEG_OFF}`}
        aria-pressed={lang === "zh"}
        aria-label="繁體中文"
        title="繁體中文"
      >
        中
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`rounded px-2 py-0.5 text-xs font-semibold transition-all ${lang === "en" ? SEG_ON : SEG_OFF}`}
        aria-pressed={lang === "en"}
        aria-label="English"
        title="English"
      >
        EN
      </button>
    </div>
  );

  const themeToggle = (
    <div className={SEG} role="group" aria-label={lang === "zh" ? "主題" : "Theme"}>
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={`inline-flex items-center rounded px-2 py-0.5 transition-all ${theme === "light" ? "bg-surface text-text shadow-xs" : SEG_OFF}`}
        aria-pressed={theme === "light"}
        aria-label={t("header.theme.light")}
        title={t("header.theme.light")}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <circle cx="12" cy="12" r="5" />
          <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={`inline-flex items-center rounded px-2 py-0.5 transition-all ${theme === "dark" ? "bg-surface text-text shadow-xs" : SEG_OFF}`}
        aria-pressed={theme === "dark"}
        aria-label={t("header.theme.dark")}
        title={t("header.theme.dark")}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </button>
    </div>
  );

  // Always rendered so the right-hand group keeps the same width on every page; on the generator
  // page it is invisible (the page has its own start button) but still takes up its space.
  const cta = (
    <Link
      href="/generator"
      className={`btn btn-primary px-3.5 py-1.5 text-xs font-semibold shadow-sm ${onGenerator ? "invisible" : ""}`}
      aria-hidden={onGenerator || undefined}
      tabIndex={onGenerator ? -1 : undefined}
    >
      <StableLabel k="header.run" lang={lang} prefix="▶ " />
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-bg/75 backdrop-blur-md">
      <div className="mx-auto grid min-h-[66px] max-w-[1800px] grid-cols-[1fr_auto] items-center gap-4 px-5 xl:grid-cols-[1fr_auto_1fr]">
        <Link
          href="/"
          aria-label={t("app.title")}
          className="flex shrink-0 items-center justify-self-start rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <BrandLogo decorative className="h-10 w-auto" />
        </Link>

        {/* Plain labels here (no hidden twin) so the visible gaps between links are equal; the grid keeps the
            group centred, so a language switch only grows it symmetrically by a few pixels. */}
        <nav className="hidden items-center gap-9 justify-self-center xl:flex" aria-label="primary">
          {NAV.map((n) => {
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`relative whitespace-nowrap py-1 text-base font-medium transition-colors ${active ? "text-text" : "text-muted hover:text-text"}`}
              >
                {t(n.k)}
                {active ? <span className="absolute -bottom-1 left-0 h-0.5 w-full rounded bg-primary" aria-hidden /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center justify-end gap-2 justify-self-end xl:flex">
          {chainPill}
          {langToggle}
          {themeToggle}
          {cta}
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-md text-text xl:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={t("nav.menu")}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
            {open ? (
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" d="M3 7h18M3 12h18M3 17h18" />
            )}
          </svg>
        </button>
      </div>

      {open ? (
        <div id="mobile-menu" className="border-t border-border/60 bg-surface/95 backdrop-blur xl:hidden">
          <div className="mx-auto flex max-w-[1800px] flex-col gap-5 px-5 py-5">
            <nav className="flex flex-col" aria-label="primary mobile">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={isActive(n.href) ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`border-b border-border/60 py-3 text-base font-medium ${isActive(n.href) ? "text-primary-ink" : "text-text"}`}
                >
                  {t(n.k)}
                </Link>
              ))}
            </nav>
            <div className="flex flex-wrap items-center gap-2">
              {chainPill}
              {langToggle}
              {themeToggle}
            </div>
            {onGenerator ? null : <div className="flex">{cta}</div>}
          </div>
        </div>
      ) : null}
    </header>
  );
}
