"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { shortHash } from "@/lib/format";
import { useT, type DictKey } from "@/lib/i18n";
import type { ChainStatus } from "@/lib/types";

const GITHUB_URL = "https://github.com/zhuang768/ForeSure";

const PAGES: { href: string; k: DictKey }[] = [
  { href: "/", k: "nav.home" },
  { href: "/generator", k: "nav.generator" },
  { href: "/history", k: "nav.history" },
  { href: "/overview", k: "nav.overview" },
];

/** Thin line icon for a fact row (network, contract, source, event). Shared with the homepage start section. */
export function FactIcon({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg className={`shrink-0 text-primary ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export const FACT_ICON = {
  globe: "M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.5-2.5 3.75-5.5 3.75-9S14.5 5.5 12 3m0 18c-2.5-2.5-3.75-5.5-3.75-9S9.5 5.5 12 3M3.6 9h16.8M3.6 15h16.8",
  doc: "M9 12h6m-6 4h6M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z",
  code: "M16 18l6-6-6-6M8 6l-6 6 6 6",
  flag: "M4 21V4m0 0h12l-2 4 2 4H4",
};

/** Shared site footer: brand column, attestation facts and page links. */
export default function SiteFooter({ chain }: { chain?: ChainStatus | null }) {
  const t = useT();
  const pathname = usePathname() ?? "/";
  const current = PAGES.find((p) => p.href !== "/" && pathname.startsWith(p.href)) ?? PAGES[0];
  const contract = chain?.contract_address ?? null;
  const explorer = contract ? `https://sepolia.etherscan.io/address/${contract}` : null;

  return (
    <footer className="mt-auto border-t border-border bg-surface/70 backdrop-blur">
      <div className="mx-auto grid max-w-[1800px] gap-10 px-5 py-12 md:grid-cols-[1.4fr_1fr_0.8fr]">
        {/* brand column sits a step in from the page edge, like the hero and start sections */}
        <div className="lg:pl-16 xl:pl-24">
          <BrandLogo decorative className="h-12 w-auto" />
          <p className="t-body mt-4 max-w-md text-muted">{t("footer.tagline")}</p>
        </div>

        <div>
          <div className="label">{t("footer.infoTitle")}</div>
          <ul className="t-body mt-4 flex flex-col gap-3">
            <li className="flex items-center gap-2.5">
              <FactIcon d={FACT_ICON.globe} />
              <span className="text-muted">{t("footer.network")}</span>
              <span className="font-medium text-text">Ethereum Sepolia</span>
            </li>
            <li className="flex items-center gap-2.5">
              <FactIcon d={FACT_ICON.doc} />
              <span className="text-muted">{t("footer.contract")}</span>
              {explorer ? (
                <a href={explorer} target="_blank" rel="noreferrer" className="mono font-medium text-primary-ink underline-offset-4 hover:underline">
                  {shortHash(contract)}
                </a>
              ) : (
                <span className="mono text-muted">—</span>
              )}
            </li>
            <li className="flex items-center gap-2.5">
              <FactIcon d={FACT_ICON.code} />
              <span className="text-muted">{t("footer.source")}</span>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="font-medium text-text underline-offset-4 hover:underline">
                github.com/zhuang768/ForeSure
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <FactIcon d={FACT_ICON.flag} />
              <span className="text-text">{t("footer.event")}</span>
            </li>
          </ul>
        </div>

        <div>
          <div className="label">{t("footer.navTitle")}</div>
          <ul className="t-body mt-4 flex flex-col gap-2">
            {PAGES.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  className={`transition-colors hover:text-text ${p.href === current.href ? "font-semibold text-text" : "text-muted"}`}
                >
                  {t(p.k)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border/70">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2 px-5 py-4 text-sm text-muted">
          <span>{t("footer.rights")}</span>
          <span className="mono">SHA-256 · Sepolia</span>
        </div>
      </div>
    </footer>
  );
}
