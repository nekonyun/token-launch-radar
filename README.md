# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/nekonyun/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/nekonyun/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Launch Radar — a pixel dashboard ranking 198 pre-token protocols by implied launch value, from a sealed DefiLlama snapshot of 14 November 2026 (758 protocols, $50M floor). The value model is a Theil-Sen log-log fit of market cap against TVL over 104 traded protocols, with category and 7-day growth adjustments, and every row carries a concrete farm plan with costs and times plus a rank range from 200 refits. Tenure (days listed) was re-tested as a value term in five forms (log10, capped at 365/730 days, square-root of years, age buckets) and left out every time: each form worsens leave-one-out, and the fitted slope's sign flips across forms, so age prices the farm plan's hold length, not the launch value. Validation, out of sample: leave-one-out median miss ×2.96 (51% within 3×), walk-forward ×2.26 (62% within 3×), against the median-ratio flat multiple (0.26× TVL) at ×3.93 (38%).

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

Node 22 or later, standard library only, no network. The run is deterministic: two runs produce byte-identical `board.json`, `data.js` and `dossier.json`. Locally, point `--input` at the snapshot file instead, e.g. `--input ../input/snapshot.json`.

## What is in here

- `main.ts` — reads the snapshot, fits the model, validates it, builds the board and writes the outputs.
- `lib/model.ts` — the model: snapshot parsing, Theil-Sen fit, category and growth adjustments, leave-one-out and walk-forward validation, 200-refit rank ranges, farm plans and verdicts.
- `vendor/makefun-board.ts` — the kit's dossier builder, vendored verbatim.
- `dashboard/` — the static offline dashboard (`index.html`, `app.css`, `app.js`, 51,103 bytes total): sortable and filterable board, detail view per protocol, live-token view, method and validation panel with a log-log scatter of the fit. Near-black pixel style after the reference pin (vivid purple on near-black, chunky pixel type, Undertale-style dialog boxes, a field of purple pixel blooms), system monospace only, and PIP — an original pixel flower drawn as inline SVG — in the masthead. No characters.
- `screenshots/` — board, detail and filtered views (board and filtered 1400×900, detail 1400×1350 so the new enrichment panels fit).
- `board.json` — the 198-row board the run produces. `data.js` — the same data as a script the dashboard reads. `dossier.json` — the kit's dossier, byte-identical to `buildDossier` output.
- `.makefun/owner.json` — the make.fun wallet that owns this entry.

## The model, in one paragraph

`log10(implied value) = 2.2438 + 0.6258 · log10(TVL)`, plus a category offset (mean residual per category, shrunk and capped at ±0.25) and a growth term from the 7-day TVL change (clamped ±0.15). Tenure (days listed) was tried and dropped in v1 and re-tested in five forms for v2 — log10(age) slope −0.0304 (LOO ×3.14, walk-forward ×2.94), log10(min(age,365)) slope +0.2197 (LOO ×3.22, walk-forward ×2.26), log10(min(age,730)) slope −0.1735 (LOO ×3.22, walk-forward ×2.26), √(age in years) slope −0.0155 (LOO ×3.14, walk-forward ×2.35), age buckets +0.068/−0.018/+0.047 (LOO ×3.04, walk-forward ×2.18) — against the no-tenure baseline (LOO ×2.96, walk-forward ×2.26): every form worsens leave-one-out, so the model does not price age. Of 144 traded protocols, 16 are set aside for a zero or negative market cap, 15 for a market-cap-to-TVL ratio outside 0.01–10, and 9 for being exchanges. The board ranks all 40 watchlist protocols plus 158 more pre-token protocols the watchlist leaves out, chosen by TVL on the same rule — the watchlist is a floor, never a ceiling — so it also ranks the snapshot's largest pre-token protocol, Sentora Curator, which the list itself omits. Farm verdicts: the airdrop pool is 10% of implied value shared pro-rata across TVL; a $1,000 ticket's drop is set against the whole plan's gas (per-transaction gas by main chain, times setup plus one transaction a week through the hold plus the claim), with each step naming its cost — including the chain's gas token where it is a settled fact — and its time. FARM if the net is $25 or more, THIN if $0 or more, SKIP if the drop does not cover the gas.

## v3 — enrichment, model unchanged (18 Nov 2026)

v3 adds point-in-time enrichment (fees, TVL history, raises, token-born checks) baked into `lib/enrichment.json` + `lib/enrichment-provenance.json` and shown in the dashboard — and it re-tests the model against the new signals. The model stays **radar-3**: no signal passed the adoption bar (LOO < ×2.75 and walk-forward < ×2.26 and stable slopes per category). Fees as a log term: slope −0.0050, LOO ×3.18, walk-forward ×2.54 — and the slope flips sign by category (DEX −0.37, Lending −0.15, Liquid Staking +0.06, RWA −0.05, Yield +0.25), so fees do not price value on top of TVL; the implied P/S spread (median 5.7×, p10 0.7×, p90 61.5×) says the same. TVL growth 90d comes closest (LOO ×2.90, walk-forward ×2.13) but misses the ×2.75 bar. Raises (dummy and log amount) and TVL growth 30d / max drawdown also fail; dev activity was not fitted — only 6 of 104 comps map to an exact repository in the Electric Capital taxonomy, too thin to test honestly. All 13 experiments (baseline + 12 signals) are listed with their numbers in the Method panel.

The enrichment itself is point-in-time to the snapshot date, 14 Nov 2026: fees are sums of daily fees from DefiLlama (`/summary/fees/{slug}`) up to that date — labelled as fees, not revenue, because DefiLlama exposes no daily revenue series — and the reconstructed TVL at 14 Nov 2026 matches the snapshot TVL with a median absolute difference of 0.31% (103 comps; uranium.io has no reconstructed TVL). Coverage: 75 of 104 comps have a fees adapter (74 with positive 365-day fees), 41 have raises to 14 Nov 2026, 53 list a GitHub org. Every watchlist protocol was checked for an already-born token on DexScreener (18 Nov 2026) and cross-checked on GeckoTerminal: 6 likely have a token, 2 trade only a parent token, 1 is itself the token (USDD), 2 are possible but weak, 29 have no pool. A Launch Watch tab lists 6 pools created in the last 48 hours with FDV ≥ $100k (mostly meme noise, labelled as not board rows). The board itself is unchanged from v2 — same 198 rows, same verdicts (FARM 50 / THIN 74 / SKIP 74) — because the model did not change; what changed is the evidence around each row: fees 30d, implied P/S, TVL growth 30d and a 90-day TVL sparkline on the board, new filters and sorts, and cash-flow, funding, TVL-history, token-born and dev-activity panels in the detail view.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
