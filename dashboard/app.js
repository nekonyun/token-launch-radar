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

  /* Category filter options. */
  const cats = [...new Set(D.rows.map((r) => r.category).filter(Boolean))].sort();
  cats.forEach((c) => { const o = document.createElement('option'); o.value = c; o.textContent = c; $('cat').appendChild(o); });

  /* Board: filter + sort + render. */
  const state = { q: '', verdict: '', cat: '', sort: 'rank' };
  const SORTS = {
    rank: (a, b) => a.rank - b.rank,
    implied: (a, b) => b.implied_value_usd - a.implied_value_usd,
    tvl: (a, b) => b.tvl_usd - a.tvl_usd,
    drop: (a, b) => b.drop_per_1000_usd - a.drop_per_1000_usd,
    net: (a, b) => b.net_per_1000_usd - a.net_per_1000_usd,
    change: (a, b) => (b.change_7d ?? -1e9) - (a.change_7d ?? -1e9),
  };
  function visible() {
    const q = state.q.trim().toLowerCase();
    return D.rows.filter((r) => {
      if (state.verdict && r.verdict !== state.verdict) return false;
      if (state.cat && r.category !== state.cat) return false;
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
      return '<tr data-slug="' + esc(r.slug) + '">'
        + '<td class="rank num">' + r.rank + '</td>'
        + '<td><span class="pname">' + esc(r.name) + '</span><small>' + esc(r.slug) + '</small></td>'
        + '<td class="cat">' + esc(r.category || '—') + '</td>'
        + '<td class="cat">' + esc(r.chains.slice(0, 1).join(', ')) + (r.chains.length > 1 ? ' +' + (r.chains.length - 1) : '') + '</td>'
        + '<td class="num">' + money(r.tvl_usd) + '</td>'
        + '<td class="num">' + ch + '</td>'
        + '<td class="num">' + money(r.implied_value_usd) + '</td>'
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
  const v = D.validation;
  const fmt = (x) => '×' + x.toFixed(2);
  $('proofTable').querySelector('tbody').innerHTML = [
    ['Leave-one-out median miss', fmt(v.loo_median_miss), fmt(v.flat_median_miss)],
    ['Within 3× (leave-one-out)', (v.loo_within_3x * 100).toFixed(0) + '%', (v.flat_within_3x * 100).toFixed(0) + '%'],
    ['Walk-forward median miss', fmt(v.walkforward_median_miss), '—'],
    ['Within 3× (walk-forward)', (v.walkforward_within_3x * 100).toFixed(0) + '%', '—'],
  ].map((r) => '<tr><td>' + r[0] + '</td><td class="num">' + r[1] + '</td><td class="num">' + r[2] + '</td></tr>').join('');
  $('coverage').textContent = 'The board ranks ' + D.board_size + ' protocols: all ' + D.watchlist_size
    + ' on the watchlist, plus ' + D.early_size + ' more pre-token protocols the list leaves out,'
    + ' chosen by TVL on the same rule. ' + D.live_size + ' traded protocols are shown on the Live Tokens tab.';

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
      s += '<line x1="' + X(gx) + '" y1="' + T + '" x2="' + X(gx) + '" y2="' + (H - B) + '" stroke="#221f1a" stroke-width="1"/>';
      s += '<text x="' + X(gx) + '" y="' + (H - B + 18) + '" fill="#6b655c" font-size="10" text-anchor="' + (gx === x1 ? 'end' : gx === x0 ? 'start' : 'middle') + '">' + money(Math.pow(10, gx)) + '</text>';
    }
    for (let gy = y0; gy <= y1; gy++) {
      s += '<line x1="' + L + '" y1="' + Y(gy) + '" x2="' + (W - R) + '" y2="' + Y(gy) + '" stroke="#221f1a" stroke-width="1"/>';
      s += '<text x="' + (L - 6) + '" y="' + (Y(gy) + 3) + '" fill="#6b655c" font-size="10" text-anchor="end">' + money(Math.pow(10, gy)) + '</text>';
    }
    let path = '';
    for (let i = 0; i <= 40; i++) {
      const x = x0 + ((x1 - x0) * i) / 40;
      const y = D.model.intercept + D.model.slope * x;
      path += (i === 0 ? 'M' : 'L') + X(x).toFixed(1) + ' ' + Y(y).toFixed(1) + ' ';
    }
    s += '<path d="' + path + '" fill="none" stroke="#d29a5b" stroke-width="2"/>';
    D.comps.forEach((c) => {
      s += '<circle cx="' + X(lg(c.tvl_usd)).toFixed(1) + '" cy="' + Y(lg(c.mcap_usd)).toFixed(1) + '" r="2.6" fill="#e8c07a" opacity="0.55"/>';
    });
    D.rows.slice(0, 10).forEach((r, i) => {
      s += '<circle cx="' + X(lg(r.tvl_usd)).toFixed(1) + '" cy="' + Y(lg(r.implied_value_usd)).toFixed(1) + '" r="6" fill="none" stroke="#e8c07a" stroke-width="1.6"/>';
      const dy = i % 2 === 0 ? -9 : 11;
      s += '<text x="' + (X(lg(r.tvl_usd)) + 8) + '" y="' + (Y(lg(r.implied_value_usd)) + dy) + '" fill="#f2ede6" font-size="10">#' + r.rank + '</text>';
    });
    $('chart').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Market cap against TVL, log scales, with the fitted curve">' + s + '</svg>';
  })();

  /* Detail dialog. */
  const dlg = $('detail');
  function openDetail(slug) {
    const r = D.rows.find((x) => x.slug === slug); if (!r) return;
    const ch = r.change_7d === null ? 'not reported' : pct(r.change_7d) + ' over 7 days';
    const age = r.age_days === null ? 'not listed' : r.age_days + ' days since listing';
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
    $('view-method').hidden = view !== 'method';
  }
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => show(t.dataset.view)));

  /* Deep links for screenshots: ?view=method, ?verdict=FARM, ?q=..., ?detail=slug. */
  const q = new URLSearchParams(location.search);
  if (q.get('verdict')) {
    state.verdict = q.get('verdict');
    document.querySelectorAll('#verdictChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.verdict === state.verdict));
  }
  if (q.get('q')) { state.q = q.get('q'); $('q').value = state.q; }
  if (q.get('view')) show(q.get('view'));
  renderBoard();
  if (q.get('detail')) openDetail(q.get('detail'));
})();
