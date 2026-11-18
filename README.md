# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/nekonyun/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/nekonyun/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Launch Radar — a midnight-ledger dashboard ranking 198 pre-token protocols by implied launch value, from a sealed DefiLlama snapshot of 14 November 2026 (758 protocols, $50M floor). The value model is a Theil-Sen log-log fit of market cap against TVL over 112 traded protocols, with category, 7-day growth and tenure adjustments, and every row carries a concrete farm plan with costs and times plus a rank range from 200 refits. Validation, out of sample: leave-one-out median miss ×3.37 (46% within 3×), walk-forward ×2.89 (51% within 3×), against a flat 0.25× TVL multiple at ×4.26 (36%).

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

Node 22 or later, standard library only, no network. The run is deterministic: two runs produce byte-identical `board.json`, `data.js` and `dossier.json`. Locally, point `--input` at the snapshot file instead, e.g. `--input ../input/snapshot.json`.

## What is in here

- `main.ts` — reads the snapshot, fits the model, validates it, builds the board and writes the outputs.
- `lib/model.ts` — the model: snapshot parsing, Theil-Sen fit, category/growth/tenure adjustments, leave-one-out and walk-forward validation, 200-refit rank ranges, farm plans and verdicts.
- `vendor/makefun-board.ts` — the kit's dossier builder, vendored verbatim.
- `dashboard/` — the static offline dashboard (`index.html`, `app.css`, `app.js`, 24,741 bytes total): sortable and filterable board, detail view per protocol, live-token view, method and validation panel with a log-log scatter of the fit.
- `screenshots/` — board, detail and filtered views, 1400×900 each.
- `board.json` — the 198-row board the run produces. `data.js` — the same data as a script the dashboard reads. `dossier.json` — the kit's dossier, byte-identical to `buildDossier` output.
- `.makefun/owner.json` — the make.fun wallet that owns this entry.

## The model, in one paragraph

`log10(implied value) = 2.0371 + 0.6541 · log10(TVL)`, plus a category offset (mean residual per category, shrunk and capped at ±0.25), a growth term from the 7-day TVL change (clamped ±0.15) and a tenure term from days listed (capped at 1,095 days, clamped ±0.10). Of 144 traded protocols, 16 are set aside for a zero or negative market cap, 7 for a market-cap-to-TVL ratio outside 0.005–20, and 9 for being exchanges. The board ranks all 40 watchlist protocols plus 158 more pre-token protocols the watchlist leaves out, chosen by TVL on the same rule — the watchlist is a floor, never a ceiling — so it also ranks the snapshot's largest pre-token protocol, Sentora Curator, which the list itself omits. Farm verdicts: the airdrop pool is 10% of implied value shared pro-rata across TVL; a $1,000 ticket's drop is set against the whole plan's gas (per-transaction gas by main chain, times setup plus one transaction a week through the hold plus the claim). FARM if the net is $25 or more, THIN if $0 or more, SKIP if the drop does not cover the gas.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
