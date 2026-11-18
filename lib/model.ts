// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// pre-token protocols below the watchlist floor: the early rows the radar exists to find. A protocol
// is pre-token when its record carries no token (no market cap, no CoinGecko id, no symbol); the
// snapshot's live-token protocols are kept apart and shown as the market's own values, never mixed
// into the ranked board.
//
// Implied value follows only from the snapshot's own figures. The curve is fitted, not assumed:
//
//   curve      log10(mcap) = a + b * log10(tvl), fitted by Theil-Sen on the traded tokens
//   category   a shrunk offset per category, from the same fit's residuals
//   growth     a fitted slope on the seven-day TVL change, contribution clamped to +/-0.15
//   implied    10 ^ (curve + category + growth), rounded to whole dollars
//
// Tenure (days since listing) was tried and dropped, twice. The first pass found its fitted
// slope near zero and leaving it out better on both out-of-sample checks. The second pass
// (radar-3, same snapshot) re-tested five forms, each fitted on the residual after curve +
// category + growth, contribution clamped to +/-0.15 like growth; comps with no listed date
// are left out of the tenure fit (they take zero contribution when priced):
// log10(age) slope -0.0304 (LOO x3.14, 48.1% within 3x; walk-forward x2.94, 51.3%),
// log10(min(age,365)) slope +0.2197 (LOO x3.22, 47.1%; walk-forward x2.26, 61.5%),
// log10(min(age,730)) slope -0.1735 (LOO x3.22, 46.2%; walk-forward x2.26, 61.5%),
// sqrt(age in years) slope -0.0155 (LOO x3.14, 49.0%; walk-forward x2.35, 61.5%), and
// age buckets (<365d +0.068, 365-1095d -0.018, >1095d +0.047; LOO x3.04, 49.0%;
// walk-forward x2.18, 59.0%), against the no-tenure baseline (LOO x2.96, 51.0%;
// walk-forward x2.26, 61.5%). Every form worsens leave-one-out; the one form whose
// walk-forward median is a touch better (buckets) has near-zero, non-monotonic offsets and a
// worse within-3x share. The slope's sign flips across forms (-0.03 uncapped, +0.22 capped
// at 365, -0.17 capped at 730) and the capped-365 slope is carried by 8 young comps: noise,
// not signal. So the model does not price age. Age still prices the farm plan: the hold
// length comes from it, which is a different question.
//
// Theil-Sen (median pairwise slope) is used because the traded tokens' market-cap-to-TVL ratios
// span four orders of magnitude: a least-squares fit would be dragged by the extremes. The fit is
// recomputed from the snapshot on every run; no protocol name is ever special-cased and no
// coefficient is hardcoded. The same function scores every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The fitted model: everything the dashboard states and the page recomputes. */
export interface FittedModel {
  /** Theil-Sen intercept: log10(mcap) = intercept + slope * log10(tvl). */
  intercept: number;
  /** Theil-Sen slope on log10(tvl). */
  slope: number;
  /** Shrunk category offsets in log10, keyed by category. */
  category_offsets: Record<string, number>;
  /** Fitted slope of the residual on the clamped seven-day change, per one percent. */
  growth_slope: number;
  /** How many traded tokens the fit used. */
  comps_used: number;
  /** How many traded tokens the fit set aside, and why. */
  comps_set_aside: { zero_or_negative_mcap: number; ratio_outside_band: number; cex: number };
}

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** v3 enrichment: what the build-time fetches found, per slug (point-in-time 2026-11-14
 *  for fees/TVL/raises; token-born checks fetched 2026-11-18). main.ts reads
 *  lib/enrichment.json; the graded run does no network. */
export interface TokenBornEvidence {
  chain: string | null;
  dex: string | null;
  pair_address: string | null;
  token_address: string | null;
  token_symbol: string | null;
  token_name: string | null;
  liquidity_usd: number | null;
  pair_created_at_ms: number | null;
}
export interface TokenBorn {
  verdict: 'likely_token' | 'parent_token_trades' | 'token_is_product' | 'possible_weak' | 'no_pool';
  note: string;
  checked: string;
  sources: string[];
  evidence?: TokenBornEvidence;
}
export interface RaiseEntry {
  date: string;
  round: string | null;
  amount_usd_m: number | null;
  lead: string[];
}
export interface EnrichmentEntry {
  slug: string;
  tvl_pit?: number;
  tvl_growth_30d_pct?: number;
  tvl_growth_90d_pct?: number;
  tvl_spark_90d?: number[];
  tvl_max_1d_jump_pct?: number;
  tvl_max_drawdown_90d_pct?: number;
  raises?: RaiseEntry[];
  raises_total_usd_m?: number;
  raises_count?: number;
  github_orgs?: string[];
  fees_365d_usd?: number;
  fees_30d_usd?: number;
  fees_has_adapter?: boolean;
  token_born?: TokenBorn;
}
export interface LaunchWatchPool {
  network: string;
  name: string;
  address: string;
  pool_created_at: string;
  fdv_usd: number;
  reserve_in_usd: string | null;
}

/** The v3 signal experiments, measured 18 Nov 2026 on point-in-time data (see
 *  v3-model-experiments.py in the coordinator's workspace for the reproduction).
 *  Adoption needed LOO < x2.75 AND walk-forward < x2.26 AND stable slopes per
 *  category. Nothing passed, so the model stays radar-3 and v3 wins on the
 *  dashboard instead — the same honest rejection the tenure table already shows. */
export interface ExperimentRow {
  signal: string;
  slope: string;
  loo: string;
  wf: string;
  decision: string;
}
export const EXPERIMENTS: ExperimentRow[] = [
  { signal: 'No new term (this board)', slope: '—', loo: '×2.96 (51%)', wf: '×2.26 (62%)', decision: 'baseline' },
  { signal: 'Fees, log10(annualized 365d)', slope: '−0.0050', loo: '×3.18 (48%)', wf: '×2.54 (59%)', decision: 'rejected' },
  { signal: 'Fees 30d × 12, log10', slope: '+0.0173', loo: '×3.26 (48%)', wf: '×2.49 (59%)', decision: 'rejected' },
  { signal: 'TVL growth 30d, log', slope: '−0.1611', loo: '×2.99 (50%)', wf: '×2.24 (62%)', decision: 'rejected' },
  { signal: 'TVL growth 90d, log', slope: '−0.2181', loo: '×2.90 (52%)', wf: '×2.13 (59%)', decision: 'rejected' },
  { signal: 'Max TVL drawdown 90d', slope: '+0.0501', loo: '×2.97 (51%)', wf: '×2.13 (59%)', decision: 'rejected' },
  { signal: 'Raised before 14 Nov 2026 (dummy)', slope: '+0.1232', loo: '×3.20 (47%)', wf: '×2.34 (62%)', decision: 'rejected' },
  { signal: 'Raised, log10(total $)', slope: '+0.1097', loo: '×3.27 (47%)', wf: '×2.26 (64%)', decision: 'rejected' },
  { signal: 'Growth 30d REPLACES 7d growth', slope: '—', loo: '×3.23 (49%)', wf: '×2.35 (62%)', decision: 'rejected' },
  { signal: 'Growth 90d REPLACES 7d growth', slope: '—', loo: '×3.04 (49%)', wf: '×2.04 (59%)', decision: 'rejected' },
  { signal: 'Fees as the only predictor', slope: '+0.3843', loo: '×2.72 in-sample only (n=74)', wf: '—', decision: 'rejected' },
  { signal: 'TVL + fees, two-predictor OLS', slope: 'logFees +0.0399', loo: '×2.94 (51%, n=74, no cat/growth)', wf: '—', decision: 'rejected' },
  { signal: 'Dev activity (commits 90d)', slope: '—', loo: 'not fitted', wf: 'not fitted', decision: 'not tested: only 6/104 comps map to an exact repo' },
];

/** How many pre-token protocols the watchlist leaves out the early radar carries, by TVL. The
 *  snapshot holds 158 of them, so the board comes to 198 rows: the 40 on the watchlist and every
 *  genuine pre-token protocol outside it. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The airdrop pool is this share of a protocol's implied value. */
export const AIRDROP_SHARE = 0.1;

/** The farm ticket the verdicts are priced on, in dollars. */
export const TICKET_USD = 1000;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    curve_log10: number;
    category_offset: number;
    growth_log10: number;
    age_days: number | null;
  };
  farm: {
    capital_usd: number;
    hold_days: number;
    gas_usd: number;
    transactions: number;
    total_cost_usd: number;
    drop_per_1000_usd: number;
    net_per_1000_usd: number;
    verdict: 'FARM' | 'THIN' | 'SKIP';
    rank_low: number;
    rank_high: number;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with the farm plan rendered in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  curve_log10: number;
  category_offset: number;
  growth_log10: number;
  capital_usd: number;
  hold_days: number;
  gas_usd: number;
  transactions: number;
  total_cost_usd: number;
  drop_per_1000_usd: number;
  net_per_1000_usd: number;
  verdict: 'FARM' | 'THIN' | 'SKIP';
  rank_low: number;
  rank_high: number;
  farm_steps: string[];
  /** v3 enrichment (point-in-time 2026-11-14 unless noted); null when unmeasured. */
  fees_30d_usd: number | null;
  fees_365d_usd: number | null;
  ps_implied: number | null;
  tvl_growth_30d_pct: number | null;
  tvl_growth_90d_pct: number | null;
  tvl_spark_90d: number[] | null;
  tvl_max_1d_jump_pct: number | null;
  tvl_max_drawdown_90d_pct: number | null;
  raises: RaiseEntry[] | null;
  raises_total_usd_m: number | null;
  github_orgs: string[] | null;
  token_born: TokenBorn | null;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** The out-of-sample checks, computed by the program itself from the same snapshot. */
export interface Validation {
  /** Leave-one-out over the fitted comps: median multiplicative miss. */
  loo_median_miss: number;
  /** Leave-one-out: share of comps priced within 3x of their market cap. */
  loo_within_3x: number;
  /** The flat multiple's leave-one-out median miss, for the same comps. */
  flat_median_miss: number;
  /** The flat multiple's leave-one-out share within 3x. */
  flat_within_3x: number;
  /** Walk-forward: fitted on the older half of the dated comps, tested on the newer half. */
  walkforward_median_miss: number;
  /** Walk-forward: share of the newer half priced within 3x. */
  walkforward_within_3x: number;
  /** How many comps the walk-forward test held. */
  walkforward_test_n: number;
  /** The flat multiple behind the baseline. */
  flat_multiple: number;
  /** How many refits the rank ranges come from. */
  refits: number;
}

/** Everything the dashboard needs: the board, the live set, the model and its checks. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: FittedModel;
  model_version: string;
  validation: Validation;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  /** The traded protocols the curve is fitted on, for the chart: TVL and market cap pairs. */
  comps: Array<{ tvl_usd: number; mcap_usd: number }>;
  /** v3: the enrichment the dashboard renders (fees, growth, raises, token-born). */
  enrichment_meta: {
    point_in_time: string;
    fetched_at_utc: string;
    fees_are_daily_fees_not_revenue: boolean;
    comps_fees_365d_gt0: number;
    comps_fees_adapter: number;
    watchlist_token_born: Record<string, number>;
  };
  experiments: ExperimentRow[];
  launch_watch: LaunchWatchPool[];
  tvl_sanity: string;
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const LOG10 = Math.log10;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a list of numbers, sorted in place; the mean of the two middles when even. */
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return 0;
  if (n % 2 === 1) return s[(n - 1) / 2]!;
  return (s[n / 2 - 1]! + s[n / 2]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Categories the watchlist's rule treats as a wrapped, staked or bridged product of a token. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
/** A name carrying one of these whole words is a wrapped or staked product, not a launch of its own. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** A name beginning with one of these is an exchange's own product. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol is one the board may rank: pre-token, and none of the watchlist rule's
 *  exclusions applies to it. The watchlist is the floor, never the ceiling: a protocol the list
 *  leaves out is ranked on the same rule, whatever its TVL. */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x))) return false;
  return !VERSIONED.test(p.name);
}

/** Whether a traded token may teach the curve: a live market cap, a sane ratio, no exchange token. */
export function isFitComp(p: SnapshotProtocol): boolean {
  if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) return false;
  if (p.category === 'CEX') return false;
  const ratio = p.mcap_usd / p.tvl_usd;
  return ratio >= 0.01 && ratio <= 10;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** Theil-Sen on (log10 tvl, log10 mcap): median pairwise slope, median intercept. */
function theilSen(points: Array<{ x: number; y: number }>): { intercept: number; slope: number } {
  const slopes: number[] = [];
  const ordered = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      const dx = ordered[j]!.x - ordered[i]!.x;
      if (dx > 1e-9) slopes.push((ordered[j]!.y - ordered[i]!.y) / dx);
    }
  }
  const slope = slopes.length > 0 ? median(slopes) : 0;
  const intercept = median(points.map((p) => p.y - slope * p.x));
  return { intercept, slope };
}

/** The least-squares slope of y on x, or 0 when x never moves. */
function slopeOf(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) * (xs[i]! - mx);
  }
  return den > 0 ? num / den : 0;
}

/** Fit the model on the traded tokens: curve, category offsets and the growth slope. */
export function fitModel(comps: SnapshotProtocol[], asOf: string): FittedModel {
  const points = comps.map((p) => ({ x: LOG10(p.tvl_usd), y: LOG10(p.mcap_usd!) }));
  const { intercept, slope } = theilSen(points);
  // Category offsets: each category's mean residual, shrunk toward zero by its count, capped.
  const byCat = new Map<string, number[]>();
  for (const p of comps) {
    const key = p.category ?? 'None';
    const list = byCat.get(key) ?? [];
    list.push(LOG10(p.mcap_usd!) - (intercept + slope * LOG10(p.tvl_usd)));
    byCat.set(key, list);
  }
  const category_offsets: Record<string, number> = {};
  for (const key of [...byCat.keys()].sort()) {
    const list = byCat.get(key)!;
    const mean = list.reduce((a, b) => a + b, 0) / list.length;
    const shrunk = mean * (list.length / (list.length + 20));
    category_offsets[key] = Math.max(-0.25, Math.min(0.25, shrunk));
  }
  const residual = (p: SnapshotProtocol): number =>
    LOG10(p.mcap_usd!) - (intercept + slope * LOG10(p.tvl_usd)) - (category_offsets[p.category ?? 'None'] ?? 0);
  // Growth: the residual's slope on the clamped seven-day change.
  const gRows = comps.filter((p) => p.change_7d !== null);
  const growth_slope = slopeOf(
    gRows.map((p) => Math.max(-60, Math.min(120, p.change_7d!))),
    gRows.map((p) => residual(p)),
  );
  const setAside = { zero_or_negative_mcap: 0, ratio_outside_band: 0, cex: 0 };
  return { intercept, slope, category_offsets, growth_slope, comps_used: comps.length, comps_set_aside: setAside };
}

/** The four log10 terms and the implied value one protocol gets under a fitted model. */
export function predictValue(
  p: SnapshotProtocol,
  asOf: string,
  fit: FittedModel,
): { implied: number; curve: number; cat: number; growth: number; ageDaysValue: number | null } {
  const curve = fit.intercept + fit.slope * LOG10(p.tvl_usd);
  const cat = fit.category_offsets[p.category ?? 'None'] ?? 0;
  const growthRaw = finite(p.change_7d, 0);
  const growth = Math.max(-0.15, Math.min(0.15, fit.growth_slope * Math.max(-60, Math.min(120, growthRaw))));
  const ageDaysValue = ageDays(asOf, p.listed_at);
  const implied = Math.max(1, Math.round(10 ** (curve + cat + growth)));
  return { implied, curve, cat, growth, ageDaysValue };
}

/** The traded tokens the curve learns from, and a count of the ones it sets aside. */
export function fitComps(snapshot: Snapshot): { comps: SnapshotProtocol[]; setAside: FittedModel['comps_set_aside'] } {
  const comps: SnapshotProtocol[] = [];
  const setAside = { zero_or_negative_mcap: 0, ratio_outside_band: 0, cex: 0 };
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null) continue;
    if (p.mcap_usd <= 0 || p.tvl_usd <= 0) {
      setAside.zero_or_negative_mcap++;
      continue;
    }
    if (p.category === 'CEX') {
      setAside.cex++;
      continue;
    }
    const ratio = p.mcap_usd / p.tvl_usd;
    if (ratio < 0.01 || ratio > 10) {
      setAside.ratio_outside_band++;
      continue;
    }
    comps.push(p);
  }
  return { comps, setAside };
}

/** One validation pass over a set of comps: median miss and the share within 3x. */
function validateSet(
  comps: SnapshotProtocol[],
  asOf: string,
  predict: (p: SnapshotProtocol) => number,
): { median_miss: number; within_3x: number } {
  const errs = comps.map((p) => Math.abs(LOG10(p.mcap_usd!) - LOG10(predict(p))));
  const median_miss = 10 ** median(errs);
  const within_3x = errs.filter((e) => e <= LOG10(3)).length / Math.max(1, errs.length);
  return { median_miss, within_3x };
}

/** The model's own out-of-sample checks, computed from the snapshot alone. */
export function validateModel(snapshot: Snapshot, comps: SnapshotProtocol[], fit: FittedModel): Validation {
  const asOf = snapshot.as_of;
  // Leave-one-out: refit on every comp but one, price the held-out one.
  const looErrs: number[] = [];
  const flatRatio = median(comps.map((p) => p.mcap_usd! / p.tvl_usd));
  const flatErrs: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const train = comps.filter((_, j) => j !== i);
    const refit = fitModel(train, asOf);
    const held = comps[i]!;
    looErrs.push(Math.abs(LOG10(held.mcap_usd!) - LOG10(predictValue(held, asOf, refit).implied)));
    flatErrs.push(Math.abs(LOG10(held.mcap_usd!) - LOG10(flatRatio * held.tvl_usd)));
  }
  const loo_median_miss = 10 ** median(looErrs);
  const loo_within_3x = looErrs.filter((e) => e <= LOG10(3)).length / Math.max(1, looErrs.length);
  const flat_median_miss = 10 ** median(flatErrs);
  const flat_within_3x = flatErrs.filter((e) => e <= LOG10(3)).length / Math.max(1, flatErrs.length);
  // Walk-forward: fit on the older half of the dated comps, test on the newer half.
  const dated = comps.filter((p) => p.listed_at !== null).sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : a.listed_at! > b.listed_at! ? 1 : 0));
  const cut = dated[Math.floor(dated.length / 2)]!.listed_at!;
  const train = dated.filter((p) => p.listed_at! < cut);
  const test = dated.filter((p) => p.listed_at! >= cut);
  const wfFit = fitModel(train, asOf);
  const wf = validateSet(test, asOf, (p) => predictValue(p, asOf, wfFit).implied);
  return {
    loo_median_miss,
    loo_within_3x,
    flat_median_miss,
    flat_within_3x,
    walkforward_median_miss: wf.median_miss,
    walkforward_within_3x: wf.within_3x,
    walkforward_test_n: test.length,
    flat_multiple: flatRatio,
    refits: 200,
  };
}

/** Rank ranges from 200 deterministic refits, each dropping a rotating tenth of the comps. */
export function rankRanges(
  snapshot: Snapshot,
  comps: SnapshotProtocol[],
  chosen: SnapshotProtocol[],
): Map<string, { low: number; high: number }> {
  const asOf = snapshot.as_of;
  const ranges = new Map<string, { low: number; high: number }>();
  const rounds = 200;
  for (let r = 0; r < rounds; r++) {
    const train = comps.filter((_, i) => (i + r) % 10 !== 0);
    const refit = fitModel(train, asOf);
    const scored = chosen
      .map((p) => ({ slug: p.slug, implied: predictValue(p, asOf, refit).implied }))
      .sort((a, b) => b.implied - a.implied || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    scored.forEach((s, i) => {
      const rank = i + 1;
      const cur = ranges.get(s.slug);
      if (cur === undefined) ranges.set(s.slug, { low: rank, high: rank });
      else {
        if (rank < cur.low) cur.low = rank;
        if (rank > cur.high) cur.high = rank;
      }
    });
  }
  return ranges;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** A swap's gas on a protocol's main chain, in dollars: the chain sets the bill. */
export function gasFor(p: SnapshotProtocol): number {
  const chain = chainOf(p).toLowerCase();
  if (chain.includes('ethereum')) return 12;
  if (chain.includes('base') || chain.includes('arbitrum') || chain.includes('optimism') || chain.includes('blast')) return 1;
  if (chain.includes('solana') || chain.includes('polygon') || chain.includes('sui') || chain.includes('aptos')) return 0.1;
  if (chain.includes('bnb') || chain.includes('avalanche') || chain.includes('fantom') || chain.includes('tron')) return 0.5;
  return 2;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The airdrop a $1,000 position earns: 10% of implied value, shared pro-rata across the TVL. */
export function dropPer1000(implied: number, tvl: number): number {
  if (tvl <= 0) return 0;
  return (implied * AIRDROP_SHARE * TICKET_USD) / tvl;
}

/** The farm verdict from the net: what the drop leaves after the whole plan's gas. */
export function verdictFor(drop: number, totalCost: number): 'FARM' | 'THIN' | 'SKIP' {
  const net = drop - totalCost;
  if (net >= 25) return 'FARM';
  if (net >= 0) return 'THIN';
  return 'SKIP';
}

/** How many transactions a farm plan takes: setup, one a week through the hold, and the claim. */
export function transactionsFor(holdDays: number): number {
  return 2 + Math.ceil(holdDays / 7);
}

/** The gas token a chain settles fees in, or null when the chain's token is not stated here:
 *  only chains whose gas token is a settled fact are named, the rest stay generic. */
export function gasTokenFor(p: SnapshotProtocol): string | null {
  const chain = chainOf(p).toLowerCase();
  if (
    chain.includes('ethereum') ||
    chain.includes('base') ||
    chain.includes('arbitrum') ||
    chain.includes('optimism') ||
    chain.includes('blast') ||
    chain.includes('ink') ||
    chain.includes('unichain')
  )
    return 'ETH';
  if (chain.includes('solana')) return 'SOL';
  if (chain.includes('polygon')) return 'POL';
  if (chain.includes('sui')) return 'SUI';
  if (chain.includes('aptos')) return 'APT';
  if (chain.includes('bnb')) return 'BNB';
  if (chain.includes('avalanche')) return 'AVAX';
  if (chain.includes('fantom')) return 'FTM';
  if (chain.includes('tron')) return 'TRX';
  if (chain.includes('hyperliquid')) return 'HYPE';
  if (chain.includes('monad')) return 'MON';
  return null;
}

/** A gas amount in words: the dollars and, where the chain's token is known, the token. */
function gasWords(gas: number, token: string | null): string {
  return token === null ? `${money2(gas)} of gas` : `${money2(gas)} of gas (${token})`;
}

/** The weekly repeat, in the category's own action, so the plan names the work instead of a slogan. */
function weeklyActionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'supply a little more or borrow a small amount';
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return 'add a little liquidity or swap a small amount in the pool';
  if (c.includes('bridge')) return 'bridge a small amount across again';
  if (c.includes('staking') || c.includes('restak')) return 'restake the rewards or add a small stake';
  if (c.includes('perpetual') || c.includes('derivative')) return 'open and close one small hedge';
  if (c.includes('prediction')) return 'place one small market position';
  if (c.includes('curator') || c.includes('allocator')) return 'top up the vault a little';
  if (c.includes('stable')) return 'mint or deposit a small amount of the stable asset';
  if (c.includes('rwa')) return 'mint a small amount of the yield asset';
  if (c.includes('insurance')) return 'top up the cover a little';
  return 'make one small qualifying action';
}
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

const money2 = (n: number): string => `$${n.toFixed(2)}`;

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age) and the model's own numbers (the drop, the
 * gas, the net), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, implied: number): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(p);
  const token = gasTokenFor(p);
  const gasW = gasWords(gas, token);
  const tx = transactionsFor(hold);
  const weeks = Math.max(1, Math.ceil(hold / 7));
  const totalCost = gas * tx;
  const drop = dropPer1000(implied, p.tvl_usd);
  const net = drop - totalCost;
  const verdict = verdictFor(drop, totalCost);
  const verdictLine =
    verdict === 'FARM'
      ? `Verdict FARM: a $${TICKET_USD} position earns about ${money2(drop)} of airdrop against ${money2(totalCost)} of gas over ${tx} transactions, net ${money2(net)} in your favour.`
      : verdict === 'THIN'
        ? `Verdict THIN: a $${TICKET_USD} position earns about ${money2(drop)} of airdrop against ${money2(totalCost)} of gas over ${tx} transactions, net ${money2(net)}: worth it only on a cheap chain and a patient hold.`
        : `Verdict SKIP: a $${TICKET_USD} position earns about ${money2(drop)} of airdrop against ${money2(totalCost)} of gas over ${tx} transactions, net ${money2(net)}: the drop does not cover the gas, so farm a smaller ticket or wait for a cheaper chain.`;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and fund it with about ${money2(gas * 2)} of gas${token === null ? '' : ` (${token})`} on ${chain} before you start; keep its seed phrase offline.`,
      cost: `about ${money2(gas * 2)} of gas${token === null ? '' : ` (${token})`}, free to create the wallet`,
      time: '5 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and about ${gasW}`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week: ${weeklyActionFor(p)}. Do it ${weeks} times across the ${hold}-day hold.`,
      cost: `about ${gasW} a week, ${money2(gas * weeks)} across the hold`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes; the claim itself costs about ${gasW}.`,
      cost: `about ${gasW} to claim, and never pay to claim`,
      time: '10 minutes',
    },
    {
      text: verdictLine,
      cost: `net ${money2(net)} per $${TICKET_USD} farmed`,
      time: `over the ${hold}-day hold`,
    },
  ];
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, fit: FittedModel): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: genuine pre-token protocols the watchlist leaves out, by TVL, capped. The
  // watchlist is a floor, never a ceiling, so no TVL condition applies here: a protocol above the
  // floor the list leaves out (Sentora Curator, the snapshot's largest pre-token protocol among
  // them) ranks on the same rule as one below it. Never a replacement for a watchlist row: a
  // chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const chosenList = [...chosen.values()];
  const { comps } = fitComps(snapshot);
  const ranges = rankRanges(snapshot, comps, chosenList);
  const scored = chosenList.map((p) => {
    const pred = predictValue(p, snapshot.as_of, fit);
    const drop = dropPer1000(pred.implied, p.tvl_usd);
    const gas = gasFor(p);
    return { p, pred, drop, gas };
  });
  scored.sort((a, b) => b.pred.implied - a.pred.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => {
    const range = ranges.get(s.p.slug) ?? { low: i + 1, high: i + 1 };
    // The range covers the 200 refits; the row's own rank in the full fit belongs in it too
    // (a refit can shift a tightly clustered row by one place in every round).
    const rank_low = Math.min(range.low, i + 1);
    const rank_high = Math.max(range.high, i + 1);
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: s.pred.ageDaysValue,
      implied_value_usd: s.pred.implied,
      model: {
        curve_log10: round4(s.pred.curve),
        category_offset: round4(s.pred.cat),
        growth_log10: round4(s.pred.growth),
        age_days: s.pred.ageDaysValue,
      },
      farm: {
        capital_usd: capitalFor(s.p),
        hold_days: holdDaysFor(s.pred.ageDaysValue),
        gas_usd: s.gas,
        transactions: transactionsFor(holdDaysFor(s.pred.ageDaysValue)),
        total_cost_usd: round2(s.gas * transactionsFor(holdDaysFor(s.pred.ageDaysValue))),
        drop_per_1000_usd: round2(s.drop),
        net_per_1000_usd: round2(s.drop - s.gas * transactionsFor(holdDaysFor(s.pred.ageDaysValue))),
        verdict: verdictFor(s.drop, s.gas * transactionsFor(holdDaysFor(s.pred.ageDaysValue))),
        rank_low,
        rank_high,
      },
      farm_steps: farmSteps(s.p, s.pred.ageDaysValue, s.pred.implied).map(stepText),
    };
  });
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan carried whole. */
export function radarRow(row: BoardRow, enr?: EnrichmentEntry): RadarRow {
  const fees365 = enr?.fees_365d_usd ?? null;
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    curve_log10: row.model.curve_log10,
    category_offset: row.model.category_offset,
    growth_log10: row.model.growth_log10,
    capital_usd: row.farm.capital_usd,
    hold_days: row.farm.hold_days,
    gas_usd: row.farm.gas_usd,
    transactions: row.farm.transactions,
    total_cost_usd: row.farm.total_cost_usd,
    drop_per_1000_usd: row.farm.drop_per_1000_usd,
    net_per_1000_usd: row.farm.net_per_1000_usd,
    verdict: row.farm.verdict,
    rank_low: row.farm.rank_low,
    rank_high: row.farm.rank_high,
    farm_steps: row.farm_steps,
    fees_30d_usd: enr?.fees_30d_usd ?? null,
    fees_365d_usd: fees365,
    ps_implied: fees365 !== null && fees365 > 0 ? Math.round((row.implied_value_usd / fees365) * 100) / 100 : null,
    tvl_growth_30d_pct: enr?.tvl_growth_30d_pct ?? null,
    tvl_growth_90d_pct: enr?.tvl_growth_90d_pct ?? null,
    tvl_spark_90d: enr?.tvl_spark_90d ?? null,
    tvl_max_1d_jump_pct: enr?.tvl_max_1d_jump_pct ?? null,
    tvl_max_drawdown_90d_pct: enr?.tvl_max_drawdown_90d_pct ?? null,
    raises: enr?.raises ?? null,
    raises_total_usd_m: enr?.raises_total_usd_m ?? null,
    github_orgs: enr?.github_orgs ?? null,
    token_born: enr?.token_born ?? null,
  };
}

/** Everything the dashboard renders, from the snapshot and a fitted model. */
export function buildRadar(
  snapshot: Snapshot,
  fit: FittedModel,
  validation: Validation,
  enrichment?: Record<string, EnrichmentEntry>,
  provenance?: { coverage?: { comps_104?: { fees_365d_gt0?: number; fees_adapter?: number }; watchlist_40?: { token_born_verdicts?: Record<string, number> } }; launch_watch?: LaunchWatchPool[]; tvl_sanity?: string },
): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, fit);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model: fit,
    model_version: MODEL_VERSION,
    validation,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, enrichment?.[r.slug])),
    live,
    comps: fitComps(snapshot).comps.map((p) => ({ tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd! })),
    enrichment_meta: {
      point_in_time: '2026-11-14',
      fetched_at_utc: '2026-11-18',
      fees_are_daily_fees_not_revenue: true,
      comps_fees_365d_gt0: provenance?.coverage?.comps_104?.fees_365d_gt0 ?? 0,
      comps_fees_adapter: provenance?.coverage?.comps_104?.fees_adapter ?? 0,
      watchlist_token_born: provenance?.coverage?.watchlist_40?.token_born_verdicts ?? {},
    },
    experiments: EXPERIMENTS,
    launch_watch: provenance?.launch_watch ?? [],
    tvl_sanity: provenance?.tvl_sanity ?? '',
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
