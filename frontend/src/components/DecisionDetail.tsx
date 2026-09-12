"use client";

import { useState, type ReactNode } from "react";
import AmdRocmStressCard from "@/components/AmdRocmStressCard";
import AmdRocmVisionCard from "@/components/AmdRocmVisionCard";
import ChainBadge from "@/components/ChainBadge";
import DebateFeed from "@/components/DebateFeed";
import GroundingBadge, { GroundingFlags } from "@/components/GroundingBadge";
import MatchedProducts from "@/components/MatchedProducts";
import ProposalCard, { NumberTiles } from "@/components/ProposalCard";
import { deriveBadgeState } from "@/lib/badge";
import { fmtStamp, shortHash } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { localizedField, localizedSource } from "@/lib/localize";
import type { RunRecord } from "@/lib/types";

type Tab = "summary" | "debate" | "pricing" | "audit";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 border-b border-border py-2 text-sm last:border-0">
      <div className="text-muted">{label}</div>
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

export default function DecisionDetail({ record, children }: { record: RunRecord; children?: ReactNode }) {
  const t = useT();
  const { lang } = useLang();
  const [tab, setTab] = useState<Tab>("summary");
  const receipt = record.blockchain_receipt;
  const pd = record.proposal_data;
  const badge = deriveBadgeState({ receipt });

  const tabs: [Tab, string][] = [
    ["summary", t("tab.summary")],
    ["debate", t("tab.debate")],
    ["pricing", t("tab.pricing")],
    ["audit", t("tab.audit")],
  ];

  return (
    <div className="card flex h-full flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="mono text-xs text-muted">
            {record.decision_id} · {fmtStamp(record.timestamp)}
          </div>
          <h2 className="truncate text-2xl font-bold leading-tight">{localizedField(pd.proposal, "product_name", lang)}</h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <GroundingBadge grounding={record.grounding} />
          <ChainBadge state={badge} url={receipt.verification_url} txHash={receipt.blockchain_tx_hash} />
        </div>
      </div>
      <div className="flex gap-5 border-b border-border px-5 text-sm">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 py-2.5 ${
              tab === key ? "border-primary font-bold text-text" : "border-transparent text-muted hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {tab === "summary" ? (
          <div className="flex flex-col gap-4">
            <ProposalCard proposal={pd.proposal} actuarial={record.actuarial_data} isMock={pd.is_mock} model={pd.model} />
            <div>
              <div className="label mb-1">{t("field.matched")}</div>
              <MatchedProducts items={record.matched_products} />
            </div>
            <div>
              <div className="label mb-1">{t("field.news")}</div>
              <a
                href={record.news.link || undefined}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary-ink hover:underline"
              >
                {record.news.title}
              </a>
              <p className="mt-1 text-xs text-muted">{record.news.summary}</p>
            </div>
          </div>
        ) : null}
        {tab === "debate" ? (
          <DebateFeed pm={pd.debate.pm} underwriter={pd.debate.underwriter} actuary={localizedField(pd.proposal, "business_logic", lang)} replayable />
        ) : null}
        {tab === "pricing" ? (
          <div className="flex flex-col gap-4">
            <NumberTiles actuarial={record.actuarial_data} />
            <div>
              <Row label={t("num.markup")}>
                <span className="mono">
                  {record.actuarial_data.markup_multiplier[0]}× – {record.actuarial_data.markup_multiplier[1]}×
                </span>
              </Row>
            </div>

            {/* AMD ROCm GPU 1,000,000 Runs Catastrophe Stress Testing */}
            <AmdRocmStressCard
              basis={record.actuarial_data.basis}
              expectedLossUsd={record.actuarial_data.expected_loss_usd}
            />

            {/* AMD ROCm Multi-Modal Vision Underwriting & BGE-M3 Clause Retrieval */}
            <AmdRocmVisionCard
              basis={record.actuarial_data.basis}
            />
            {record.actuarial_data.basis ? (
              <div>
                <Row label={t("basis.probability")}>
                  {record.actuarial_data.basis.probability_source === "assumption"
                    ? t("basis.assumption")
                    : localizedSource(record.actuarial_data.basis, lang)}
                </Row>
                {record.actuarial_data.basis.probability_method ? (
                  <Row label={t("basis.method")}>{record.actuarial_data.basis.probability_method}</Row>
                ) : null}
                {record.actuarial_data.basis.years_observed ? (
                  <Row label={t("basis.observed")}>
                    <span className="mono">
                      {record.actuarial_data.basis.years_observed} y · {record.actuarial_data.basis.events_observed ?? "—"} events ·{" "}
                      {record.actuarial_data.basis.severe_events_observed ?? "—"} severe
                    </span>
                    {record.actuarial_data.basis.low_sample ? (
                      <span className="pill ml-2 bg-warn-soft text-warn">{t("basis.lowSample")}</span>
                    ) : null}
                  </Row>
                ) : null}
                <Row label={t("basis.loss")}>
                  {record.actuarial_data.basis.assumed_loss_note ?? record.actuarial_data.basis.loss_method ?? t("basis.assumption")}
                </Row>
                {record.actuarial_data.basis.premium_method ? (
                  <Row label={t("basis.premium")}>{record.actuarial_data.basis.premium_method}</Row>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted">{t("num.source")}</p>
            )}
            <div>
              <div className="label mb-1">{t("field.businessLogic")}</div>
              <p className="whitespace-pre-line text-sm leading-relaxed">{localizedField(pd.proposal, "business_logic", lang)}</p>
            </div>
          </div>
        ) : null}
        {tab === "audit" ? (
          <div className="flex flex-col gap-4">
            <div>
              <Row label={t("audit.decision")}>
                <span className="mono">{receipt.decision_id}</span>
              </Row>
              <Row label={t("audit.hash")}>
                <span className="mono">{receipt.data_hash}</span>
              </Row>
              <Row label={t("audit.tx")}>
                {receipt.verification_url ? (
                  <a
                    href={receipt.verification_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mono text-primary-ink hover:underline"
                  >
                    {shortHash(receipt.blockchain_tx_hash)}
                  </a>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </Row>
              <Row label={t("audit.block")}>
                <span className="mono">{receipt.block_number ?? "—"}</span>
              </Row>
              <Row label={t("audit.network")}>{receipt.network}</Row>
              <Row label={t("audit.report")}>
                <span className="mono text-xs">{record.report_path}</span>
              </Row>
            </div>
            <div>
              <div className="label mb-2">{t("grounding.title")}</div>
              {record.grounding ? (
                <div className="flex flex-col gap-2">
                  <div>
                    <GroundingBadge grounding={record.grounding} />
                  </div>
                  <GroundingFlags grounding={record.grounding} />
                </div>
              ) : (
                <p className="text-xs text-muted">{t("grounding.legacy")}</p>
              )}
            </div>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
