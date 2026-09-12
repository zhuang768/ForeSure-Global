export type ChainStatus = {
  mode: "sepolia" | "mock";
  rpc_url: string | null;
  contract_address: string | null;
  submitter: string | null;
};

export type Health = { status: string; timestamp: number; chain: "sepolia" | "mock" };

export type NewsItem = {
  title: string;
  link: string;
  published: string;
  summary: string;
  source?: string;
  is_mock: boolean;
};

export type MatchedProduct = {
  id: string;
  name: string;
  category: string;
  description: string;
  distance: number;
};

/** Provenance of the actuarial figures (docs/API.md "精算依據"); absent on records made before 2026-09-05. */
export type ActuarialBasis = {
  peril?: string;
  probability_source?: string; // data source string, or "assumption"
  probability_source_en?: string; // English name of the same source; absent for "assumption"
  probability_method?: string;
  years_observed?: number | null;
  events_observed?: number | null;
  severe_events_observed?: number | null;
  annual_frequency?: number | null;
  low_sample?: boolean | null;
  loss_source?: string; // always "assumption" for now
  loss_method?: string;
  mean_households_per_severe_event?: number | null;
  assumed_loss_per_household_usd?: number | null;
  assumed_loss_note?: string;
  premium_method?: string;
  monte_carlo_gpu?: MonteCarloGpuData | null;
  vision_underwriting_gpu?: VisionUnderwritingData | null;
  bge_m3_retrieval_gpu?: BgeM3RetrievalData | null;
};

export type VisionUnderwritingData = {
  engine: string;
  backbone?: string;
  hardware?: string;
  device?: string;
  latency_ms?: number;
  image_source_reconciled?: string;
  severity_grade: string;
  estimated_inundation_depth_cm: number;
  structural_damage_index: number;
  fraud_anomaly_score: number;
  tamper_status: string;
  trigger_reconciliation: string;
  loss_adjustment_cost_reduction_pct: number;
  underwriting_action?: string;
};

export type BgeM3RetrievalData = {
  engine: string;
  acceleration?: string;
  device?: string;
  embedding_dimension: number;
  total_clauses_indexed?: number;
  retrieval_latency_ms: number;
  throughput_tokens_per_sec?: number;
  top_matches?: Array<{
    id: string;
    name: string;
    category: string;
    clause_snippet: string;
    dense_similarity: number;
    sparse_lexical_weight: number;
    hybrid_score: number;
  }>;
};

export type MonteCarloGpuData = {
  engine: string;
  hardware_signature?: string;
  peril?: string;
  iterations: number;
  elapsed_ms?: number;
  mean_annual_loss_usd?: number;
  var_90_usd?: number;
  var_95_usd?: number;
  var_99_usd?: number;
  var_99_5_usd: number;
  tvar_99_5_usd: number;
  solvency_capital_requirement_usd?: number;
  calibrated_markup_multiplier?: number;
  solvency_standard?: string;
  capital_adequacy_status?: string;
  tail_distribution_curve?: Array<{
    loss_usd: number;
    frequency: number;
    prob_pct: number;
  }>;
};

export type ActuarialData = {
  probability_pct: number;
  expected_loss_usd: number;
  premium_range_usd: [number, number];
  markup_multiplier: [number, number];
  basis?: ActuarialBasis | null;
};

/** Six sections, each in Traditional Chinese plus an English twin (`_en`, docs/API.md); `_en` is absent on records before 2026-09-05 13:00. */
export type Proposal = {
  product_name: string;
  target_audience: string;
  market_gap: string;
  coverage_details: string;
  exclusions: string;
  business_logic: string;
  product_name_en?: string;
  target_audience_en?: string;
  market_gap_en?: string;
  coverage_details_en?: string;
  exclusions_en?: string;
  business_logic_en?: string;
};

export type GroundingStatus = "pass" | "warn" | "fail";

export type GroundingFlag = {
  type: "unsupported_number" | "unverified_citation" | "missing_disclosure";
  severity: "high" | "medium";
  field: string;
  value: string | null;
  excerpt: string;
  message: string;
};

/** Rule-based hallucination check run after the debate (docs/API.md "幻覺檢測"); absent on records before 2026-09-05 15:00. */
export type Grounding = {
  status: GroundingStatus;
  checker_version: string;
  checked_claims: number;
  grounded_claims: number;
  flag_count: number;
  evidence_sources: string[];
  flags: GroundingFlag[];
};

/** One red-team case: an adversarial proposal (or a clean control) replayed through the grounding check. */
export type RedTeamCase = {
  id: string;
  title: string;
  attack: string;
  known_gap: boolean;
  description: string;
  expected_status: GroundingStatus | null;
  actual_status: GroundingStatus;
  expected_flag_types: string[];
  actual_flag_types: GroundingFlag["type"][];
  outcome: "detected" | "missed" | "clean" | "false_positive" | "known_gap";
  flags: GroundingFlag[];
};

/** Red-team bench report (docs/API.md "紅隊測試"); deterministic, so report_hash is stable across machines. */
export type RedTeamReport = {
  suite_version: string;
  checker_version: string;
  total_cases: number;
  attack_cases: number;
  control_cases: number;
  known_gap_cases: number;
  known_gaps_open: number;
  detected: number;
  missed: number;
  false_positives: number;
  detection_rate: number | null;
  false_positive_rate: number | null;
  report_hash: string;
  cases: RedTeamCase[];
};

export type Debate = { pm: string; underwriter: string };

export type ProposalData = {
  source_news: string;
  news_summary: string;
  news_link?: string;
  actuarial_data: ActuarialData;
  debate: Debate;
  proposal: Proposal;
  is_mock: boolean;
  model: string | null;
};

export type Receipt = {
  decision_id: string;
  payload: Record<string, unknown>;
  data_hash: string;
  blockchain_tx_hash: string | null;
  block_number: number | null;
  verification_url: string | null;
  network: string;
  is_mock: boolean;
  timestamp: string;
};

export type RunRecord = {
  decision_id: string;
  run_id?: string;
  timestamp: string;
  news: NewsItem;
  matched_products: MatchedProduct[];
  actuarial_data: ActuarialData;
  proposal_data: ProposalData;
  grounding?: Grounding | null;
  blockchain_receipt: Receipt;
  report_path: string;
};

export type RunSummary = {
  decision_id: string;
  run_id: string | null;
  timestamp: string;
  news_title: string | null;
  product_name: string | null;
  is_mock_proposal: boolean | null;
  grounding_status?: GroundingStatus | null;
  chain_is_mock: boolean | null;
  tx_hash: string | null;
  verification_url: string | null;
};

export type VerifyResult = {
  decision_id: string;
  local_hash_hex?: string;
  matched: boolean;
  onchain_timestamp?: number | null;
  submitter?: string | null;
  is_mock: boolean;
  reason?: string;
  error?: string;
  tampered_fields: string[];
  payload: Record<string, unknown>;
  stored_hash: string | null;
  tx_hash: string | null;
  verification_url: string | null;
};

export type Stage =
  | "news_fetched"
  | "news_selected"
  | "kb_matched"
  | "actuarial"
  | "pm"
  | "underwriter"
  | "actuary"
  | "grounding"
  | "report"
  | "chain_pending"
  | "chain_done"
  | "done"
  | "error";

export type RunEvent = { stage: Stage; data: unknown };

export type ActiveRun = { run_id: string; status: "running" | "finished" | "error"; events: RunEvent[] };
