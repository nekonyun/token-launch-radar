/* Token Launch Radar — dashboard logic. Reads window.RADAR from data.js; no network. */
(function () {
  'use strict';
  const D = window.RADAR;
  const $ = (id) => document.getElementById(id);
  const money = (n) => {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K';
    return '$' + n.toFixed(2);
  };
  const money2 = (n) => (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2);
  const pct = (n) => n === null || n === undefined ? '—' : (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* Ledger line: the board at a glance. */
  const counts = { FARM: 0, THIN: 0, SKIP: 0 };
  D.rows.forEach((r) => { counts[r.verdict]++; });
  const top = D.rows[0];
  $('ledgerLine').innerHTML = [
    ['Ranked', D.board_size + ' protocols'],
    ['Top value', money(top.implied_value_usd)],
    ['Farm', counts.FARM + ' rows'],
    ['Thin', counts.THIN + ' rows'],
    ['Skip', counts.SKIP + ' rows'],
    ['Snapshot', D.as_of],
  ].map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('');
  $('modelVersion').textContent = D.model_version;

  /* Proof line + formula + filter: filled from the fitted model itself, so the page
     can never disagree with the code that scored it. */
  const v = D.validation;
  const fmt = (x) => '×' + x.toFixed(2);
  const pct0 = (x) => (x * 100).toFixed(0) + '%';
  $('proofLine').innerHTML = 'Out of sample: leave-one-out miss <b>' + fmt(v.loo_median_miss) + '</b> (' + pct0(v.loo_within_3x) + ' within 3×)'
    + ' &middot; walk-forward <b>' + fmt(v.walkforward_median_miss) + '</b> (' + pct0(v.walkforward_within_3x) + ' within 3×)'
    + ' &middot; flat multiple <b>' + fmt(v.flat_median_miss) + '</b> (' + pct0(v.flat_within_3x) + ' within 3×)';
  const m = D.model;
  const sa = m.comps_set_aside;
  const tradedTotal = m.comps_used + sa.zero_or_negative_mcap + sa.ratio_outside_band + sa.cex;
  $('formula').textContent = 'log10(implied value) = ' + m.intercept.toFixed(4) + ' + ' + m.slope.toFixed(4)
    + ' · log10(TVL) + category offset ±0.25 + growth ±0.15 + tenure 0 (tested, not priced)';
  $('formulaText').textContent = 'The curve is a Theil–Sen fit of log market cap against log TVL over the '
    + m.comps_used + ' traded protocols that survive the filter below. Category offsets are the mean residual per category, shrunk toward zero and capped at ±0.25 in log10. Growth is the fitted slope on the 7-day TVL change ('
    + m.growth_slope.toFixed(4) + ' per 1%), clamped to ±0.15. Tenure (days listed) was tested in five forms and left out: every form worsens leave-one-out, so the model does not price age. Nothing is hard-coded by name: the fit is recomputed from the snapshot on every run. The flat multiple is '
    + v.flat_multiple.toFixed(2) + '×.';
  $('filterText').textContent = 'Of ' + tradedTotal + ' traded protocols, ' + sa.zero_or_negative_mcap
    + ' are set aside for a zero or negative market cap, ' + sa.ratio_outside_band
    + ' for a market-cap-to-TVL ratio outside 0.01–10, and ' + sa.cex
    + ' for being exchanges. A token at 400× its TVL is not priced on TVL at all; a token at 0.001× is effectively dead. The filter is stated here so the reader can disagree with it.';

  /* Category filter options. */
  const cats = [...new Set(D.rows.map((r) => r.category).filter(Boolean))].sort();
  cats.forEach((c) => { const o = document.createElement('option'); o.value = c; o.textContent = c; $('cat').appendChild(o); });

  /* Board: filter + sort + render. */
  const state = { q: '', verdict: '', cat: '', sort: 'rank', fees: false, raise: false, token: false };
  const SORTS = {
    rank: (a, b) => a.rank - b.rank,
    implied: (a, b) => b.implied_value_usd - a.implied_value_usd,
    tvl: (a, b) => b.tvl_usd - a.tvl_usd,
    drop: (a, b) => b.drop_per_1000_usd - a.drop_per_1000_usd,
    net: (a, b) => b.net_per_1000_usd - a.net_per_1000_usd,
    change: (a, b) => (b.change_7d ?? -1e9) - (a.change_7d ?? -1e9),
    fees: (a, b) => (b.fees_30d_usd ?? -1) - (a.fees_30d_usd ?? -1),
    ps: (a, b) => (a.ps_implied ?? 1e18) - (b.ps_implied ?? 1e18),
    growth30: (a, b) => (b.tvl_growth_30d_pct ?? -1e9) - (a.tvl_growth_30d_pct ?? -1e9),
  };
  function sparkline(vals, w, h) {
    if (!vals || vals.length < 2) return '—';
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    const pts = vals.map((v, i) => ((i / (vals.length - 1)) * w).toFixed(1) + ',' + (h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)).join(' ');
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="#a855f7" stroke-width="1.5"/></svg>';
  }
  function visible() {
    const q = state.q.trim().toLowerCase();
    return D.rows.filter((r) => {
      if (state.verdict && r.verdict !== state.verdict) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.fees && !(r.fees_30d_usd > 0)) return false;
      if (state.raise && !(r.raises && r.raises.length > 0)) return false;
      if (state.token && !(r.token_born && (r.token_born.verdict === 'likely_token' || r.token_born.verdict === 'parent_token_trades' || r.token_born.verdict === 'token_is_product'))) return false;
      if (q) {
        const hay = (r.name + ' ' + (r.category || '') + ' ' + r.chains.join(' ') + ' ' + r.slug).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort(SORTS[state.sort]);
  }
  function renderBoard() {
    const list = visible();
    $('count').textContent = list.length + ' of ' + D.rows.length + ' rows shown';
    $('rows').innerHTML = list.map((r) => {
      const ch = r.change_7d === null ? '—' : '<span class="' + (r.change_7d >= 0 ? 'up' : 'down') + '">' + pct(r.change_7d) + '</span>';
      const g30 = r.tvl_growth_30d_pct === null || r.tvl_growth_30d_pct === undefined ? '—' : '<span class="' + (r.tvl_growth_30d_pct >= 0 ? 'up' : 'down') + '">' + pct(r.tvl_growth_30d_pct) + '</span>';
      const ps = r.ps_implied === null || r.ps_implied === undefined ? '—' : r.ps_implied.toFixed(2) + '×';
      return '<tr data-slug="' + esc(r.slug) + '">'
        + '<td class="rank num">' + r.rank + '</td>'
        + '<td><span class="pname">' + esc(r.name) + '</span><small>' + esc(r.slug) + '</small></td>'
        + '<td class="cat">' + esc(r.category || '—') + '</td>'
        + '<td class="cat">' + esc(r.chains.slice(0, 1).join(', ')) + (r.chains.length > 1 ? ' +' + (r.chains.length - 1) : '') + '</td>'
        + '<td class="num">' + money(r.tvl_usd) + '</td>'
        + '<td class="num">' + ch + '</td>'
        + '<td class="num">' + money(r.implied_value_usd) + '</td>'
        + '<td class="num">' + (r.fees_30d_usd === null || r.fees_30d_usd === undefined ? '—' : money(r.fees_30d_usd)) + '</td>'
        + '<td class="num">' + ps + '</td>'
        + '<td class="num">' + g30 + '</td>'
        + '<td>' + sparkline(r.tvl_spark_90d, 58, 22) + '</td>'
        + '<td class="num">' + money2(r.drop_per_1000_usd) + '</td>'
        + '<td class="num">' + money2(r.net_per_1000_usd) + '</td>'
        + '<td><span class="verdict ' + r.verdict + '">' + r.verdict + '</span></td>'
        + '<td class="num">' + r.rank_low + '&ndash;' + r.rank_high + '</td></tr>';
    }).join('');
  }
  $('q').addEventListener('input', (e) => { state.q = e.target.value; renderBoard(); });
  $('cat').addEventListener('change', (e) => { state.cat = e.target.value; renderBoard(); });
  $('sort').addEventListener('change', (e) => { state.sort = e.target.value; renderBoard(); });
  $('verdictChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-verdict]'); if (!b) return;
    document.querySelectorAll('#verdictChips .chip').forEach((c) => c.classList.remove('active'));
    b.classList.add('active'); state.verdict = b.dataset.verdict; renderBoard();
  });
  $('enrichChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-enrich]'); if (!b) return;
    b.classList.toggle('active');
    state[b.dataset.enrich] = b.classList.contains('active'); renderBoard();
  });

  /* Launch watch. */
  $('launchRows').innerHTML = D.launch_watch.map((p) => '<tr><td><span class="pname">' + esc(p.name) + '</span><small>' + esc(p.address.slice(0, 10)) + '…' + esc(p.address.slice(-4)) + '</small></td>'
    + '<td class="cat">' + esc(p.network) + '</td>'
    + '<td class="cat">' + esc(p.pool_created_at.replace('T', ' ').replace('Z', '')) + '</td>'
    + '<td class="num">' + money(p.fdv_usd) + '</td>'
    + '<td class="num">' + (p.reserve_in_usd === null || p.reserve_in_usd === undefined ? '—' : money(Number(p.reserve_in_usd))) + '</td></tr>').join('');
  $('launchNote').textContent = D.launch_watch.length + ' pools pass the filter (born within 48h, FDV $100K+). A new pool is not a board row and not a recommendation: most are meme launches that go nowhere.';

  /* Live tokens. */
  $('liveRows').innerHTML = D.live.map((p) => {
    const ratio = p.mcap_usd ? (p.mcap_usd / p.tvl_usd).toFixed(3) : '—';
    const ch = p.change_7d === null ? '—' : '<span class="' + (p.change_7d >= 0 ? 'up' : 'down') + '">' + pct(p.change_7d) + '</span>';
    return '<tr><td><span class="pname">' + esc(p.name) + '</span><small>' + esc(p.slug) + '</small></td>'
      + '<td class="cat">' + esc(p.category || '—') + '</td>'
      + '<td class="cat">' + esc(p.chains.slice(0, 2).join(', ')) + '</td>'
      + '<td class="num">' + money(p.tvl_usd) + '</td>'
      + '<td class="num">' + money(p.mcap_usd || 0) + '</td>'
      + '<td class="num">' + ratio + '</td>'
      + '<td class="num">' + ch + '</td></tr>';
  }).join('');

  /* Method: proof table + coverage. */
  $('proofTable').querySelector('tbody').innerHTML = [
    ['Leave-one-out median miss', fmt(v.loo_median_miss), fmt(v.flat_median_miss)],
    ['Within 3× (leave-one-out)', pct0(v.loo_within_3x), pct0(v.flat_within_3x)],
    ['Walk-forward median miss', fmt(v.walkforward_median_miss), '—'],
    ['Within 3× (walk-forward)', pct0(v.walkforward_within_3x), '—'],
  ].map((r) => '<tr><td>' + r[0] + '</td><td class="num">' + r[1] + '</td><td class="num">' + r[2] + '</td></tr>').join('');
  $('coverage').textContent = 'The board ranks ' + D.board_size + ' protocols: all ' + D.watchlist_size
    + ' on the watchlist, plus ' + D.early_size + ' more pre-token protocols the list leaves out,'
    + ' chosen by TVL on the same rule. ' + D.live_size + ' traded protocols are shown on the Live Tokens tab.';

  /* Method: v3 experiments table + provenance + token-born coverage. */
  $('experimentTable').querySelector('tbody').innerHTML = D.experiments.map((x) => '<tr><td>' + esc(x.signal) + '</td><td class="num">' + esc(x.slope) + '</td><td class="num">' + esc(x.loo) + '</td><td class="num">' + esc(x.wf) + '</td><td>' + esc(x.decision) + '</td></tr>').join('');
  const em = D.enrichment_meta;
  const tb = em.watchlist_token_born;
  $('provenance').textContent = 'Fees, TVL history and raises come from the DefiLlama free API, fetched 18 Nov 2026 and reconstructed point-in-time to 14 Nov 2026 (fees are sums of daily fees; DefiLlama exposes no daily revenue series, so these are fees, not revenue). TVL reconstructed to 14 Nov 2026 matches the snapshot within 0.31% at the median across the 104 comps. '
    + D.tvl_sanity + ' ' + em.comps_fees_365d_gt0 + ' of 104 comps and 115 of 198 board rows have positive annualized fees; 75 of 104 comps have a fees adapter at all.';
  $('tokenBorn').textContent = 'Every watchlist protocol was checked on DexScreener (18 Nov 2026), with GeckoTerminal as a second source for the 11 name matches: '
    + (tb.likely_token || 0) + ' likely already have a token trading, '
    + (tb.parent_token_trades || 0) + ' have a parent token trading, '
    + (tb.token_is_product || 0) + ' is a token that is itself the product (USDD), '
    + (tb.possible_weak || 0) + ' are weak name-only matches, and '
    + (tb.no_pool || 0) + ' have no matching pool. A name match is labelled "likely", never certain: two different AXIS tokens trade, for example. See each protocol’s detail view for its evidence.';

  /* Method: log-log scatter, comps against the fitted curve, top ten ringed. */
  (function chart() {
    const W = 560, H = 360, L = 56, R = 12, T = 14, B = 40;
    const lg = Math.log10;
    const xs = D.comps.map((c) => lg(c.tvl_usd));
    const ys = D.comps.map((c) => lg(c.mcap_usd));
    const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs));
    const y0 = Math.floor(Math.min(...ys, ...D.rows.slice(0, 10).map((r) => lg(r.implied_value_usd)))), y1 = Math.ceil(Math.max(...ys));
    const X = (x) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
    const Y = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
    let s = '';
    for (let gx = x0; gx <= x1; gx++) {
      s += '<line x1="' + X(gx) + '" y1="' + T + '" x2="' + X(gx) + '" y2="' + (H - B) + '" stroke="#2b2144" stroke-width="1"/>';
      s += '<text x="' + X(gx) + '" y="' + (H - B + 18) + '" fill="#a79ec7" font-size="10" text-anchor="' + (gx === x1 ? 'end' : gx === x0 ? 'start' : 'middle') + '">' + money(Math.pow(10, gx)) + '</text>';
    }
    for (let gy = y0; gy <= y1; gy++) {
      s += '<line x1="' + L + '" y1="' + Y(gy) + '" x2="' + (W - R) + '" y2="' + Y(gy) + '" stroke="#2b2144" stroke-width="1"/>';
      s += '<text x="' + (L - 6) + '" y="' + (Y(gy) + 3) + '" fill="#a79ec7" font-size="10" text-anchor="end">' + money(Math.pow(10, gy)) + '</text>';
    }
    let path = '';
    for (let i = 0; i <= 40; i++) {
      const x = x0 + ((x1 - x0) * i) / 40;
      const y = D.model.intercept + D.model.slope * x;
      path += (i === 0 ? 'M' : 'L') + X(x).toFixed(1) + ' ' + Y(y).toFixed(1) + ' ';
    }
    s += '<path d="' + path + '" fill="none" stroke="#f5f2ff" stroke-width="2.5"/>';
    D.comps.forEach((c) => {
      s += '<circle cx="' + X(lg(c.tvl_usd)).toFixed(1) + '" cy="' + Y(lg(c.mcap_usd)).toFixed(1) + '" r="2.6" fill="#8b7fc0" opacity="0.8"/>';
    });
    D.rows.slice(0, 10).forEach((r, i) => {
      s += '<circle cx="' + X(lg(r.tvl_usd)).toFixed(1) + '" cy="' + Y(lg(r.implied_value_usd)).toFixed(1) + '" r="6" fill="none" stroke="#a855f7" stroke-width="1.8"/>';
      const dy = i % 2 === 0 ? -9 : 11;
      s += '<text x="' + (X(lg(r.tvl_usd)) + 8) + '" y="' + (Y(lg(r.implied_value_usd)) + dy) + '" fill="#f5f2ff" font-size="10">#' + r.rank + '</text>';
    });
    $('chart').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Market cap against TVL, log scales, with the fitted curve">' + s + '</svg>';
  })();

  /* Detail dialog. */
  const dlg = $('detail');
  const TOKEN_LABEL = { likely_token: 'Likely has a token', parent_token_trades: 'Parent token trades', token_is_product: 'Token is the product', possible_weak: 'Possible token (weak)', no_pool: 'No pool found' };
  function fmtDate(ms) {
    if (!ms) return '—';
    const d = new Date(ms);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }
  function openDetail(slug) {
    const r = D.rows.find((x) => x.slug === slug); if (!r) return;
    const ch = r.change_7d === null ? 'not reported' : pct(r.change_7d) + ' over 7 days';
    const age = r.age_days === null ? 'not listed' : r.age_days + ' days since listing';
    const feesLine = (r.fees_30d_usd === null || r.fees_30d_usd === undefined)
      ? 'No fees adapter found (as of 18 Nov 2026).'
      : 'Fees 30d to 14 Nov 2026: ' + money(r.fees_30d_usd) + ' · annualized: ' + money(r.fees_365d_usd) + ' · P/S implied: ' + (r.ps_implied === null ? '—' : r.ps_implied.toFixed(2) + '×') + ' (implied value / annualized fees).';
    const jump = r.tvl_max_1d_jump_pct === null || r.tvl_max_1d_jump_pct === undefined ? ''
      : (r.tvl_max_1d_jump_pct > 50 ? ' ⚠️ Biggest 1-day TVL jump in 90d: +' + r.tvl_max_1d_jump_pct.toFixed(1) + '% — treat the TVL as possibly pumped for a day.'
        : ' Biggest 1-day TVL jump in 90d: +' + r.tvl_max_1d_jump_pct.toFixed(1) + '%.');
    const dd = r.tvl_max_drawdown_90d_pct === null || r.tvl_max_drawdown_90d_pct === undefined ? ''
      : ' Max drawdown 90d: ' + r.tvl_max_drawdown_90d_pct.toFixed(1) + '%.';
    const growthLine = 'TVL growth 30d: ' + (r.tvl_growth_30d_pct === null || r.tvl_growth_30d_pct === undefined ? '—' : pct(r.tvl_growth_30d_pct))
      + ' · 90d: ' + (r.tvl_growth_90d_pct === null || r.tvl_growth_90d_pct === undefined ? '—' : pct(r.tvl_growth_90d_pct)) + '.' + jump + dd;
    const raisesLine = (!r.raises || r.raises.length === 0)
      ? 'No raises recorded before 14 Nov 2026.'
      : r.raises.map((x) => esc(x.date) + ' · ' + esc(x.round || 'round') + ' · $' + (x.amount_usd_m === null ? '?' : x.amount_usd_m) + 'M' + (x.lead && x.lead.length ? ' · led by ' + esc(x.lead.join(', ')) : '')).join('<br>') + '<br>Total raised: $' + (r.raises_total_usd_m === null || r.raises_total_usd_m === undefined ? '?' : r.raises_total_usd_m) + 'M.';
    const tb = r.token_born;
    const tokenLine = !tb ? 'Token check runs on watchlist protocols only.'
      : '<strong>' + esc(TOKEN_LABEL[tb.verdict] || tb.verdict) + '</strong> (checked ' + esc(tb.checked) + ', sources: ' + esc(tb.sources.join(' + ')) + '). ' + esc(tb.note)
        + (tb.evidence ? '<br>Evidence: ' + esc(tb.evidence.token_symbol || '') + ' ' + esc(tb.evidence.token_name || '') + ' on ' + esc(tb.evidence.chain || '') + '/' + esc(tb.evidence.dex || '') + ', liquidity ' + (tb.evidence.liquidity_usd === null || tb.evidence.liquidity_usd === undefined ? '—' : money(tb.evidence.liquidity_usd)) + ', pool created ' + fmtDate(tb.evidence.pair_created_at_ms) + ', token ' + esc((tb.evidence.token_address || '').slice(0, 10)) + '…' : '');
    const devLine = (!r.github_orgs || r.github_orgs.length === 0)
      ? 'No GitHub org listed by DefiLlama. Dev activity (commits) was not measured: only 6 of 104 comps map to an exact repository.'
      : 'GitHub orgs (DefiLlama): ' + esc(r.github_orgs.join(', ')) + '. Commit counts were not measured: only 6 of 104 comps map to an exact repository.';
    $('detailBody').innerHTML = '<h2><small>Rank #' + r.rank + ' &middot; ' + esc(r.category || '') + '</small>' + esc(r.name) + '</h2>'
      + '<p class="lede">' + esc(r.chains.join(', ')) + ' &middot; TVL ' + money(r.tvl_usd) + ' &middot; ' + ch + ' &middot; ' + age + '</p>'
      + '<dl class="kv">'
      + '<div><dt>Implied value</dt><dd>' + money(r.implied_value_usd) + '</dd></div>'
      + '<div><dt>Rank range (200 refits + full fit)</dt><dd>#' + r.rank_low + '&ndash;#' + r.rank_high + '</dd></div>'
      + '<div><dt>Curve, log10</dt><dd>' + r.curve_log10.toFixed(4) + '</dd></div>'
      + '<div><dt>Category offset</dt><dd>' + (r.category_offset >= 0 ? '+' : '') + r.category_offset.toFixed(4) + '</dd></div>'
      + '<div><dt>Growth, log10</dt><dd>' + (r.growth_log10 >= 0 ? '+' : '') + r.growth_log10.toFixed(4) + '</dd></div>'
      + '<div><dt>Drop per $1,000</dt><dd>' + money2(r.drop_per_1000_usd) + '</dd></div>'
      + '<div><dt>Net per $1,000</dt><dd>' + money2(r.net_per_1000_usd) + ' (' + r.transactions + ' tx, ' + money2(r.total_cost_usd) + ' gas)</dd></div>'
      + '</dl>'
      + '<h3>Cash flow (fees, as of 14 Nov 2026)</h3><p>' + feesLine + '</p>'
      + '<h3>Funding (raises to 14 Nov 2026)</h3><p>' + raisesLine + '</p>'
      + '<h3>TVL history (90d to 14 Nov 2026)</h3><p>' + sparkline(r.tvl_spark_90d, 320, 48) + '<br>' + growthLine + '</p>'
      + '<h3>Token already born? (checked 18 Nov 2026)</h3><p>' + tokenLine + '</p>'
      + '<h3>Dev activity</h3><p>' + devLine + '</p>'
      + '<h3>Farm plan &middot; <span class="verdict ' + r.verdict + '">' + r.verdict + '</span></h3>'
      + '<ol class="steps">' + r.farm_steps.map((st) => {
        const mm = st.match(/^(.*) Cost: (.*)\. Time: (.*)\.$/);
        const text = mm ? mm[1] : st;
        const meta = mm ? esc(mm[2]) + ' &middot; ' + esc(mm[3]) : '';
        return '<li>' + esc(text) + (meta ? '<div class="meta">' + meta + '</div>' : '') + '</li>';
      }).join('') + '</ol>';
    dlg.showModal();
  }
  $('rows').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-slug]'); if (tr) openDetail(tr.dataset.slug);
  });
  $('closeDetail').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  /* Tabs. */
  function show(view) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
    $('view-board').hidden = view !== 'board';
    $('view-live').hidden = view !== 'live';
    $('view-launch').hidden = view !== 'launch';
    $('view-method').hidden = view !== 'method';
  }
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => show(t.dataset.view)));

  /* Deep links for screenshots: ?view=method, ?verdict=FARM, ?q=..., ?detail=slug, ?fees=1&raise=1&token=1. */
  const q = new URLSearchParams(location.search);
  if (q.get('verdict')) {
    state.verdict = q.get('verdict');
    document.querySelectorAll('#verdictChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.verdict === state.verdict));
  }
  ['fees', 'raise', 'token'].forEach((k) => {
    if (q.get(k)) {
      state[k] = true;
      document.querySelectorAll('#enrichChips .chip').forEach((c) => { if (c.dataset.enrich === k) c.classList.add('active'); });
    }
  });
  if (q.get('q')) { state.q = q.get('q'); $('q').value = state.q; }
  if (q.get('view')) show(q.get('view'));
  renderBoard();
  if (q.get('detail')) openDetail(q.get('detail'));
})();
