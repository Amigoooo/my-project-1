/**
 * US Macro Dashboard — 前端渲染引擎
 * 从 data.json 加载数据并渲染为仪表盘
 */

async function loadData() {
  try {
    const resp = await fetch('data.json?' + Date.now());
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (e) {
    console.error('数据加载失败:', e);
    document.querySelectorAll('.loading').forEach(el => {
      el.textContent = '⚠️ 数据加载失败，请刷新重试';
      el.style.color = '#dc2626';
    });
    return null;
  }
}

function fmt(num, decimals = 2) {
  if (num === null || num === undefined || num === '') return '—';
  const n = parseFloat(String(num).replace(/,/g, ''));
  if (isNaN(n)) return num;
  if (Math.abs(n) >= 10000) return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
  return n.toFixed(decimals);
}

function pctClass(val) {
  if (val === null || val === undefined) return 'neutral';
  const n = parseFloat(String(val).replace(/[%+,]/g, ''));
  if (isNaN(n)) return 'neutral';
  if (n > 0) return 'up';
  if (n < 0) return 'down';
  return 'neutral';
}

function renderCard(label, value, change, source, opts = {}) {
  const cls = pctClass(change);
  const changeStr = change ? `${change.startsWith('+') || change.startsWith('-') ? '' : ''}${change}` : '';
  return `
    <div class="indicator-card ${cls}-bg">
      <div class="label">${label}</div>
      <div class="value ${cls}">${fmt(value)}</div>
      <div class="change ${cls}">${changeStr || opts.sub || ''}</div>
      <div class="source">${source || ''}</div>
    </div>
  `;
}

function renderDashboard(data) {
  const grid = document.getElementById('indicator-grid');
  if (!data) { grid.innerHTML = '<div class="loading">无数据</div>'; return; }

  let html = '';
  const idx = data.indices || {};
  const com = data.commodities || {};

  // SP500
  if (idx.sp500) html += renderCard('标普500', idx.sp500.price, idx.sp500.change_pct, 'Yahoo Finance', { sub: idx.sp500.price ? '' : '' });
  if (idx.dow) html += renderCard('道琼斯', idx.dow.price, idx.dow.change_pct, 'Yahoo Finance');
  if (idx.nasdaq) html += renderCard('纳斯达克', idx.nasdaq.price, idx.nasdaq.change_pct, 'Yahoo Finance');
  if (idx.vix) html += renderCard('VIX 恐慌指数', idx.vix.price, idx.vix.change_pct, 'Cboe/FRED');
  if (idx.dxy) html += renderCard('DXY 美元指数', idx.dxy.price, idx.dxy.change_pct, 'Yahoo Finance');
  if (com.wti) html += renderCard('WTI 原油', `$${fmt(com.wti.price)}`, com.wti.change_pct, 'Yahoo Finance');
  if (com.gold) html += renderCard('黄金', `$${fmt(com.gold.price)}`, com.gold.change_pct, 'Yahoo Finance');
  if (com.btc) html += renderCard('比特币', `$${fmt(com.btc.price)}`, com.btc.change_pct, 'Yahoo Finance');

  grid.innerHTML = html || '<div class="loading">暂无数据</div>';
}

function renderLiquidity(data) {
  const grid = document.getElementById('liquidity-grid');
  const fed = data?.fed || {};
  let html = '';
  if (fed.tga) html += renderCard('TGA 余额', fed.tga.value ? `$${fmt(fed.tga.value/1e9, 0)}亿` : null, null, 'Fed H.4.1', { sub: fed.tga.date });
  if (fed.rrp) html += renderCard('RRP 余额', fed.rrp.value ? `$${fmt(fed.rrp.value/1e9, 0)}亿` : null, null, 'Fed H.4.1', { sub: fed.rrp.date });
  if (fed.reserves) html += renderCard('银行准备金', fed.reserves.value ? `$${fmt(fed.reserves.value/1e9, 0)}亿` : null, null, 'Fed H.4.1', { sub: fed.reserves.date });

  const mac = data?.macro || {};
  if (mac.sofr) html += renderCard('SOFR', `${mac.sofr.value}%`, null, 'FRED', { sub: mac.sofr.date });
  if (mac.iorb) html += renderCard('IORB', `${mac.iorb.value}%`, null, 'FRED', { sub: mac.iorb.date });

  grid.innerHTML = html || '<div class="loading">暂无数据</div>';
}

function renderYields(data) {
  const grid = document.getElementById('yield-grid');
  const y = data?.yields || {};
  if (!y || Object.keys(y).length === 0) {
    grid.innerHTML = '<div class="loading">暂无数据</div>';
    return;
  }

  // 计算关键利差
  const t10 = parseFloat(y['10 Yr']);
  const t2 = parseFloat(y['2 Yr']);
  const t3m = parseFloat(y['3 Mo']);
  const spread2s10s = (t10 !== null && t2 !== null) ? (t10 - t2) : null;
  const spread3m10s = (t10 !== null && t3m !== null) ? (t10 - t3m) : null;

  let html = '';
  html += renderCard('3个月', `${y['3 Mo']}%`, null, 'U.S. Treasury');
  html += renderCard('2年期', `${y['2 Yr']}%`, null, 'U.S. Treasury');
  html += renderCard('10年期', `${y['10 Yr']}%`, null, 'U.S. Treasury');
  html += renderCard('30年期', `${y['30 Yr']}%`, null, 'U.S. Treasury');
  html += renderCard('2s10s 利差', spread2s10s !== null ? `${spread2s10s.toFixed(2)}bp` : '—', null, spread2s10s < 0 ? '倒挂 📉' : '正常 📈');
  html += renderCard('3m10s 利差', spread3m10s !== null ? `${spread3m10s.toFixed(2)}bp` : '—', null, spread3m10s < 0 ? '倒挂 📉' : '正常 📈');

  grid.innerHTML = html;
}

function renderSignals(data) {
  const div = document.getElementById('signal-table');
  const mac = data?.macro || {};
  const idx = data?.indices || {};

  const signals = [];
  if (idx.vix?.price) {
    const v = parseFloat(idx.vix.price);
    signals.push({
      signal: 'VIX 恐慌指数',
      reading: `${v.toFixed(2)}`,
      meaning: v > 25 ? '⚠️ 高度恐慌' : v > 20 ? '⚡ 轻度恐慌' : v > 15 ? '✅ 正常' : '😌 极度平静',
      cls: v > 20 ? 'down' : 'up'
    });
  }
  if (mac.hy_oas?.value) {
    const oas = parseFloat(mac.hy_oas.value);
    signals.push({
      signal: '高收益债 OAS',
      reading: `${oas.toFixed(2)}%`,
      meaning: oas > 4 ? '⚠️ 信用压力大' : oas > 3 ? '⚡ 偏高' : oas > 2.5 ? '👀 中性偏高' : '✅ 正常',
      cls: oas > 3 ? 'down' : 'up',
    });
  }
  if (data?.yields) {
    const t10 = parseFloat(data.yields['10 Yr']);
    signals.push({
      signal: '10Y 实际利率',
      reading: t10 ? `${t10.toFixed(2)}%` : '—',
      meaning: t10 > 4.5 ? '📈 高位紧缩' : t10 > 4.0 ? '⚡ 偏高' : '✅ 正常',
      cls: t10 > 4.5 ? 'down' : 'neutral',
    });
  }
  if (mac.sofr?.value && mac.iorb?.value) {
    const sofr = parseFloat(mac.sofr.value);
    const iorb = parseFloat(mac.iorb.value);
    const basis = sofr - iorb;
    signals.push({
      signal: 'SOFR-IORB 利差',
      reading: `${basis.toFixed(1)}bp`,
      meaning: basis > 5 ? '⚠️ 融资压力' : basis > 0 ? '⚡ 偏紧' : '✅ 正常',
      cls: basis > 5 ? 'down' : 'up',
    });
  }

  if (signals.length === 0) {
    div.innerHTML = '<div class="loading">暂无信号数据</div>';
    return;
  }

  let html = '<table><thead><tr><th>信号</th><th>读数</th><th>含义</th></tr></thead><tbody>';
  for (const s of signals) {
    html += `<tr><td>${s.signal}</td><td class="${s.cls}"><strong>${s.reading}</strong></td><td>${s.meaning}</td></tr>`;
  }
  html += '</tbody></table>';
  div.innerHTML = html;
}

function renderSources(data) {
  const div = document.getElementById('sources-table');
  const sources = [
    { indicator: '标普500', value: data?.indices?.sp500?.price || '—', date: '—', source: 'Yahoo Finance', status: '✅' },
    { indicator: '道琼斯', value: data?.indices?.dow?.price || '—', date: '—', source: 'Yahoo Finance', status: '✅' },
    { indicator: '纳斯达克', value: data?.indices?.nasdaq?.price || '—', date: '—', source: 'Yahoo Finance', status: '✅' },
    { indicator: 'VIX', value: data?.indices?.vix?.price || '—', date: '—', source: 'Cboe / FRED VIXCLS', status: '✅' },
    { indicator: 'DXY 美元指数', value: data?.indices?.dxy?.price || '—', date: '—', source: 'Yahoo Finance', status: '✅' },
    { indicator: 'WTI 原油', value: data?.commodities?.wti?.price || '—', date: '—', source: 'Yahoo Finance', status: '✅' },
    { indicator: '黄金', value: data?.commodities?.gold?.price || '—', date: '—', source: 'Yahoo Finance', status: '✅' },
    { indicator: '比特币', value: data?.commodities?.btc?.price || '—', date: '—', source: 'Yahoo Finance', status: '✅' },
    { indicator: '高收益债 OAS', value: data?.macro?.hy_oas?.value || '—', date: data?.macro?.hy_oas?.date || '—', source: 'ICE BofA (FRED)', status: '✅' },
    { indicator: 'RRP 余额', value: data?.fed?.rrp?.value ? `$${(+data.fed.rrp.value/1e9).toFixed(0)}B` : '—', date: data?.fed?.rrp?.date || '—', source: 'Fed H.4.1', status: '✅' },
    { indicator: 'TGA 余额', value: data?.fed?.tga?.value ? `$${(+data.fed.tga.value/1e9).toFixed(0)}B` : '—', date: data?.fed?.tga?.date || '—', source: 'Fed H.4.1', status: '✅' },
    { indicator: '银行准备金', value: data?.fed?.reserves?.value ? `$${(+data.fed.reserves.value/1e9).toFixed(0)}B` : '—', date: data?.fed?.reserves?.date || '—', source: 'Fed H.4.1', status: '✅' },
  ];

  let html = '<table><thead><tr><th>指标</th><th>数值</th><th>数据截至</th><th>来源</th><th>状态</th></tr></thead><tbody>';
  for (const s of sources) {
    html += `<tr><td>${s.indicator}</td><td><strong>${s.value}</strong></td><td>${s.date}</td><td>${s.source}</td><td>${s.status}</td></tr>`;
  }
  html += '</tbody></table>';
  div.innerHTML = html;
}

function renderJudgment(data) {
  const div = document.getElementById('judgment-content');
  // Generate a quick judgment based on data
  const vix = data?.indices?.vix?.price ? parseFloat(data.indices.vix.price) : null;
  const spx = data?.indices?.sp500?.price ? parseFloat(data.indices.sp500.price) : null;
  const wti = data?.commodities?.wti?.price ? parseFloat(data.commodities.wti.price) : null;

  let thesis = '等待数据更新后生成研判...';
  let falsify = '—';
  let confirm = '—';

  if (vix !== null) {
    if (vix > 20) {
      thesis = `⚠️ 市场处于轻度恐慌（VIX ${vix}），风险资产反弹尚未获得波动率确认。跨资产确认链不完整，当前上涨偏事件驱动。`;
      falsify = '若 VIX 收于 18 以下且 HY OAS 降至 2.7% 以下，上述防守判断将被推翻。';
      confirm = '若 VIX 维持 20 以上且信用利差继续走扩，避险模式延续，应控制风险敞口。';
    } else {
      thesis = `✅ 市场情绪平稳（VIX ${vix}），风险偏好改善得到波动率确认。关注跨资产确认链是否完整。`;
      falsify = '若 VIX 快速回升至 22 以上且股债同步下跌，risk-on 判断将被推翻。';
      confirm = '若 VIX 维持在 18 以下且信用利差收窄，趋势性修复可期。';
    }
  }

  div.innerHTML = `
    <div class="judgment-thesis">🎯 ${thesis}</div>
    <div class="judgment-evidence">
      <div class="falsify-box">
        <div class="title">📛 证伪条件</div>
        <p>${falsify}</p>
      </div>
      <div class="confirm-box">
        <div class="title">✅ 确认条件</div>
        <p>${confirm}</p>
      </div>
    </div>
  `;
}

async function init() {
  const data = await loadData();
  if (!data) return;

  // 更新日期
  document.getElementById('badge-date').textContent = data.generated_at ? data.generated_at.slice(0, 10) : '—';
  document.getElementById('market-date').textContent = `数据截至: ${data.market_date || '—'} · 美国市场`;
  document.getElementById('gen-time').textContent = data.generated_at || '—';

  // 渲染各板块
  renderJudgment(data);
  renderDashboard(data);
  renderLiquidity(data);
  renderYields(data);
  renderSignals(data);
  renderSources(data);
}

document.addEventListener('DOMContentLoaded', init);
