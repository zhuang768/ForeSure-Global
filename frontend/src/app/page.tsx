"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import BrandLogo from "@/components/BrandLogo";
import HomeHero from "@/components/HomeHero";
import AgentsSection from "@/components/AgentsSection";
import Reveal from "@/components/Reveal";
import SiteFooter from "@/components/SiteFooter";
import { chainStatus, listRuns } from "@/lib/api";
import { fmtStamp, shortHash } from "@/lib/format";
import { useLang, useT, type DictKey } from "@/lib/i18n";
import { pickShowcaseRuns, wrapIndex } from "@/lib/showcase";
import type { ChainStatus, RunSummary } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* static content                                                      */
/* ------------------------------------------------------------------ */

type Advantage = { code: [string, string]; title: DictKey; desc: DictKey; image: string };
const ADVANTAGES: Advantage[] = [
  {
    code: ["LIVE MARKET", "SENSING"],
    title: "intro.tech1Title",
    desc: "intro.tech1Desc",
    image: "/illustrations/advantages/taiwan-sensing.webp",
  },
  {
    code: ["ANTI-HALLUCINATION", "DEBATE"],
    title: "intro.tech2Title",
    desc: "intro.tech2Desc",
    image: "/illustrations/advantages/agent-review.webp",
  },
  {
    code: ["PARAMETRIC", "SMART TRIGGER"],
    title: "intro.tech3Title",
    desc: "intro.tech3Desc",
    image: "/illustrations/advantages/parametric-trigger.webp",
  },
  {
    code: ["ETHEREUM", "IMMUTABLE AUDIT"],
    title: "intro.tech4Title",
    desc: "intro.tech4Desc",
    image: "/illustrations/advantages/onchain-ledger.webp",
  },
];

/* ------------------------------------------------------------------ */
/* small building blocks                                               */
/* ------------------------------------------------------------------ */

function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1400px] px-5 ${className}`}>{children}</div>;
}

/** Ghost English label behind a centered section title, like an editorial magazine spread. */
function SectionHead({ ghost, title, lead }: { ghost: string; title: string; lead?: string }) {
  return (
    <Reveal className="relative flex flex-col items-center text-center">
      <div className="ghost" aria-hidden>
        {ghost}
      </div>
      <h2 className="t-h2 -mt-8 text-text sm:-mt-10">
        {title}
      </h2>
      {lead ? <p className="t-lead mt-5 max-w-3xl text-muted">{lead}</p> : null}
    </Reveal>
  );
}

/** 01 / 04 carousel of the four architectural advantages: big English code left-aligned, local title, description. */
function AdvantageSlider({ lang, t }: { lang: "zh" | "en"; t: (k: DictKey) => string }) {
  const [i, setI] = useState(0);
  const n = ADVANTAGES.length;
  const adv = ADVANTAGES[i];
  const go = (d: number) => setI((cur) => wrapIndex(cur + d, n));
  const pad = (v: number) => String(v).padStart(2, "0");
  return (
    <div
      className="mt-14 grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14"
      role="region"
      aria-roledescription={lang === "zh" ? "輪播" : "carousel"}
      aria-label={t("intro.techTitle")}
    >
      <div className="relative mx-auto aspect-[4/5] w-full max-w-[440px] overflow-hidden rounded-[28px] border border-border bg-[#e8ede7] lg:max-w-none" aria-hidden="true">
        {ADVANTAGES.map((item, index) => (
          <Image
            key={item.image}
            src={item.image}
            alt=""
            fill
            unoptimized
            className={`object-cover transition-opacity duration-500 ${index === i ? "opacity-100" : "opacity-0"}`}
          />
        ))}
        <span className="absolute left-5 top-5 rounded-full border border-white/60 bg-white/65 px-3 py-1 font-mono text-xs text-[#234434] backdrop-blur-md">
          {pad(i + 1)} / {pad(n)}
        </span>
      </div>
      <div className="min-w-0">
        <div aria-live="polite" aria-atomic="true">
          <div key={`t${i}`} className="slide-in">
            <div className="t-en uppercase text-primary">
              {adv.code[0]}
              <br />
              {adv.code[1]}
            </div>
            <h3 className="t-h2s mt-6 text-text">{t(adv.title)}</h3>
            <p className="t-lead mt-5 max-w-lg text-muted">{t(adv.desc)}</p>
          </div>
        </div>
        <div className="mt-10 flex items-center gap-4">
          <button
            type="button"
            onClick={() => go(-1)}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-text transition-colors hover:border-primary hover:text-primary"
            aria-label={lang === "zh" ? "上一項" : "Previous"}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <span className="font-mono text-base text-muted">
            <span className="text-text">{pad(i + 1)}</span> / {pad(n)}
          </span>
          <button
            type="button"
            onClick={() => go(1)}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-text transition-colors hover:border-primary hover:text-primary"
            aria-label={lang === "zh" ? "下一項" : "Next"}
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function DecisionRow({ run, lang, delay }: { run: RunSummary; lang: "zh" | "en"; delay: number }) {
  const anchored = !!run.tx_hash && !run.chain_is_mock;
  return (
    <Reveal delay={delay}>
      <article className="grid gap-5 border-b border-border py-8 md:grid-cols-[minmax(200px,300px)_1fr] md:gap-10">
        <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary-soft via-surface to-surface-2">
          <BrandLogo variant="mark" decorative className="h-16 w-auto opacity-80" />
          <span className={`absolute left-3 top-3 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${anchored ? "bg-primary text-white" : "bg-surface-2 text-muted"}`}>
            {anchored ? "ON-CHAIN" : "PENDING"}
          </span>
        </div>
        <div className="min-w-0">
          <div className="t-body text-primary-ink md:text-right">{fmtStamp(run.timestamp)}</div>
          <h3 className="t-h3 mt-3 text-text">{run.product_name}</h3>
          {run.news_title ? (
            <p className="t-body mt-3 text-muted">
              {lang === "zh" ? "觸發新聞：" : "Triggering news: "}
              {run.news_title}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            {anchored ? (
              <span className="pill bg-primary-soft text-primary-ink">
                ✓ Sepolia <span className="mono">{shortHash(run.tx_hash)}</span>
              </span>
            ) : null}
            {run.grounding_status === "pass" ? (
              <span className="pill bg-surface-2 text-muted">{lang === "zh" ? "幻覺檢測通過" : "Grounding passed"}</span>
            ) : null}
            <Link href={`/overview?id=${encodeURIComponent(run.decision_id)}`} className="ml-auto font-medium text-text underline-offset-4 hover:underline">
              {lang === "zh" ? "查看決策 →" : "View decision →"}
            </Link>
          </div>
        </div>
      </article>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function IntroPage() {
  const t = useT();
  const { lang } = useLang();
  const [chain, setChain] = useState<ChainStatus | null | undefined>(undefined);
  const [runs, setRuns] = useState<RunSummary[] | undefined>(undefined);

  useEffect(() => {
    chainStatus()
      .then(setChain)
      .catch(() => setChain(null));
    listRuns(20)
      .then(setRuns)
      .catch(() => setRuns([]));
  }, []);

  const zh = lang === "zh";
  const showcase = runs ? pickShowcaseRuns(runs, 3) : undefined;

  const metrics: [string, string, string][] = [
    ["PARAM // LATENCY", "~85s", zh ? "時事爬取、三方辯論與精算定價" : "News, debate & pricing"],
    ["PARAM // CONSENSUS", "3 Agents", zh ? "PM × 核保 × 精算 跨角色博弈" : "PM, Underwriter & Actuary"],
    ["PARAM // ATTESTATION", "100%", zh ? "SHA-256 決策指紋寫入 Sepolia" : "SHA-256 proof on Sepolia"],
    ["PARAM // REPOSITORY", "20+", zh ? "涵蓋氣候、科技、供應鏈新興風險" : "Climate, cyber & supply chains"],
  ];

  return (
    <>
      <AppHeader chain={chain} />
      <main className="relative flex-1 overflow-hidden">
        {/* soft brand-coloured glows the glass cards can blur */}
        <div className="blob -left-40 top-[-10rem] h-[36rem] w-[36rem] bg-primary/25" aria-hidden />
        <div className="blob -right-48 top-[38%] h-[32rem] w-[32rem] bg-role-pm/10" aria-hidden />
        <div className="blob bottom-[8%] left-[30%] h-[30rem] w-[30rem] bg-primary/15" aria-hidden />

        {/* ---------------- hero ---------------- */}
        <HomeHero />

        {/* ---------------- agents ---------------- */}
        <AgentsSection />

        {/* ---------------- advantages (carousel) ---------------- */}
        <section id="advantages" className="scroll-mt-16 py-20 md:py-28">
          <Container>
            <SectionHead
              ghost="ADVANTAGES"
              title={t("intro.techTitle")}
              lead={zh ? "從時事感測到鏈上存證，四個環節各自解決一個傳統流程做不到的事。" : "Four stages, each removing one thing the traditional workflow cannot do."}
            />
            <Reveal delay={100}>
              <AdvantageSlider lang={lang} t={t} />
            </Reveal>
          </Container>
        </section>

        {/* ---------------- paradigm shift (2x2 metrics) ---------------- */}
        <section className="py-20 md:py-28">
          <Container>
            <SectionHead
              ghost="SHIFT"
              title={zh ? "沒有歷史理賠數據，也能定價" : "Pricing without historical loss data"}
              lead={
                zh
                  ? "傳統流程做不到的四件事，未然用即時新聞、三方辯論與鏈上存證補上。"
                  : "Four things the traditional workflow cannot do, covered by live news, a three-agent debate and on-chain proof."
              }
            />
            <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
              {metrics.map(([label, value, desc], i) => (
                <Reveal key={label} delay={i * 80}>
                  <div className="glass glass-lift h-full p-6 md:p-7">
                    <div className="font-mono text-xs uppercase leading-5 tracking-wider text-muted">{label}</div>
                    <div className="mt-4 font-mono text-4xl font-semibold leading-9 tabular-nums text-primary">{value}</div>
                    <p className="t-body mt-2 text-muted">{desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* ---------------- latest decisions (news list) ---------------- */}
        <section className="py-20 md:py-28">
          <Container>
            <SectionHead
              ghost="DECISIONS"
              title={zh ? "最新決策與鏈上存證" : "Latest decisions & on-chain audit"}
              lead={zh ? "每一筆提案都附上觸發新聞、三方辯論紀錄與以太坊 Sepolia 交易雜湊。" : "Every proposal ships with its triggering news, the debate transcript and an Ethereum Sepolia transaction hash."}
            />
            <div className="mx-auto mt-10 max-w-5xl border-t border-border">
              {showcase === undefined ? (
                [0, 1, 2].map((k) => (
                  <div key={k} className="grid gap-5 border-b border-border py-8 md:grid-cols-[minmax(200px,300px)_1fr] md:gap-10" aria-hidden>
                    <div className="aspect-[16/10] rounded-2xl bg-surface-2 pulse" />
                    <div className="flex flex-col gap-3">
                      <div className="h-4 w-32 rounded bg-surface-2 pulse" />
                      <div className="h-7 w-3/4 rounded bg-surface-2 pulse" />
                      <div className="h-4 w-full rounded bg-surface-2 pulse" />
                    </div>
                  </div>
                ))
              ) : showcase.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">{t("queue.empty")}</p>
              ) : (
                showcase.map((r, i) => <DecisionRow key={r.decision_id} run={r} lang={lang} delay={i * 100} />)
              )}
              <div className="flex justify-end py-6">
                <Link href="/history" className="btn btn-secondary text-base font-medium">
                  {t("intro.ctaHistory")} →
                </Link>
              </div>
            </div>
          </Container>
        </section>

        {/* ---------------- start (contact-style: heading in the left column, steps on the right) ---------------- */}
        <section className="py-20 md:py-28">
          <Container>
            <Reveal className="flex justify-center">
              <div className="ghost" aria-hidden>
                START
              </div>
            </Reveal>
            <div className="-mt-10 grid items-start gap-12 lg:grid-cols-2 lg:gap-x-24 xl:gap-x-40">
              {/* left column sits a step in from the container edge so the margin reads as breathing room */}
              {/* the section title, vertically centred against the steps on the right */}
              <Reveal className="lg:self-center lg:pl-16 xl:pl-24">
                <h2 className="t-h2 text-text">
                  {zh ? "準備好體驗" : "Ready to try"}{" "}
                  <span className="whitespace-nowrap text-[1.2em] font-semibold text-primary-ink">ForeSure 未然</span>
                  {zh ? " 了嗎？" : "?"}
                </h2>
                <p className="t-lead mt-5 text-muted">
                  {zh ? "立即啟動 85 秒即時時事新聞感測、多代理人對抗辯論與以太坊 Sepolia 存證流程。" : "Launch 85-second live telemetry, multi-agent adversarial debate, and Ethereum Sepolia attestation."}
                </p>
              </Reveal>

              <Reveal delay={120} className="lg:pt-3">
                <h3 className="t-h3 text-text">{zh ? "流程" : "Process"}</h3>
                <ol className="mt-5 flex flex-col gap-4">
                  {[
                    [zh ? "抓取即時新聞並比對既有商品" : "Fetch live news, match existing products", "~10s"],
                    [zh ? "PM、核保、精算三方辯論並定價" : "PM, Underwriter and Actuary debate & price", "~60s"],
                    [zh ? "SHA-256 指紋寫入 Sepolia 並可公開查驗" : "Anchor the SHA-256 fingerprint on Sepolia", "~15s"],
                  ].map(([step, secs], i) => (
                    <li key={step} className="flex min-h-12 items-center gap-4 rounded-full border border-border bg-surface/70 px-5 py-2">
                      <span className="font-mono text-sm font-semibold text-primary-ink">{String(i + 1).padStart(2, "0")}</span>
                      <span className="t-body flex-1 font-medium text-text">{step}</span>
                      <span className="font-mono text-sm text-muted">{secs}</span>
                    </li>
                  ))}
                </ol>
                <Link
                  href="/generator"
                  className="mt-7 flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-primary to-primary-ink text-base font-medium text-white shadow-md transition-transform hover:scale-[1.01]"
                >
                  ▶ {t("intro.ctaLive")}
                </Link>
                <Link
                  href="/history"
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-full border border-border bg-surface text-base font-medium text-text transition-colors hover:border-primary"
                >
                  {t("intro.ctaHistory")}
                </Link>
              </Reveal>
            </div>
          </Container>
        </section>
      </main>

      {/* floating back-to-top; the header already carries the run CTA, so no second one down here */}
      <div className="fixed bottom-6 right-5 z-30 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="glass flex h-13 w-13 items-center justify-center text-text shadow-md transition-transform hover:scale-105"
          aria-label={t("footer.top")}
          title={t("footer.top")}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      <SiteFooter chain={chain} />
    </>
  );
}
