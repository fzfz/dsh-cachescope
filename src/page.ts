/** Render the self-contained, desktop-only CacheScope dashboard. */
export function renderDashboardPage(nonce: string, refreshMs: number): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=1280">
  <title>DSH CacheScope</title>
  <style nonce="${nonce}">
    :root { color-scheme: light; --ink:#17212b; --muted:#667786; --line:#d9e2e8; --paper:#f6f8f9; --white:#fff; --blue:#087b9b; --blue-soft:#e5f4f7; --green:#087966; --green-strong:#12a585; --green-soft:#e3f4ef; --amber:#ad6415; --amber-soft:#fff1df; --red:#b72f3b; --red-strong:#df5260; --red-soft:#fce8ea; --shadow:0 12px 34px rgba(24,43,54,.08); }
    * { box-sizing:border-box; }
    body { margin:0; min-width:1220px; background:var(--paper); color:var(--ink); font:14px/1.45 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; }
    header { height:72px; padding:0 30px; display:flex; align-items:center; justify-content:space-between; background:#10242d; color:#f8fbfc; }
    h1 { margin:0; font-size:20px; letter-spacing:.01em; }
    .subtitle { color:#9fc0ca; font-size:12px; margin-top:3px; }
    .header-state { display:flex; gap:10px; align-items:center; }
    .pill { display:inline-flex; align-items:center; gap:7px; border:1px solid rgba(255,255,255,.18); border-radius:999px; padding:6px 10px; font-size:12px; color:#cce1e7; }
    .header-button { border-color:rgba(255,255,255,.22); background:transparent; color:#d7e8ed; }
    .header-button:hover { border-color:rgba(255,255,255,.42); background:rgba(255,255,255,.08); }
    .dot { width:7px; height:7px; border-radius:50%; background:#38d1a8; box-shadow:0 0 0 4px rgba(56,209,168,.12); }
    main { padding:22px 28px 30px; }
    .notice { display:grid; grid-template-columns:auto 1fr; gap:12px; align-items:start; padding:13px 16px; margin-bottom:16px; border:1px solid #edc995; background:#fff8ec; border-radius:8px; color:#6e4b1e; }
    .notice strong { color:#8c5513; }
    .notice p { margin:2px 0 0; color:#806038; }
    .kpis { display:grid; grid-template-columns:repeat(5,1fr); border:1px solid var(--line); border-radius:10px; background:var(--white); box-shadow:var(--shadow); overflow:hidden; margin-bottom:16px; }
    .kpi { padding:17px 20px 15px; border-right:1px solid var(--line); }
    .kpi:last-child { border-right:0; }
    .kpi-label { color:var(--muted); font-size:12px; margin-bottom:6px; }
    .kpi-value { font-size:27px; line-height:1.1; font-weight:720; font-variant-numeric:tabular-nums; letter-spacing:-.02em; }
    .kpi-note { margin-top:6px; color:#8a98a3; font-size:11px; }
    .correlation { display:flex; align-items:stretch; gap:14px; margin-bottom:16px; padding:10px 12px; border:1px solid var(--line); border-radius:10px; background:var(--white); box-shadow:var(--shadow); }
    .correlation-copy { width:230px; flex:none; display:flex; flex-direction:column; justify-content:center; }
    .correlation-copy strong { font-size:12px; }
    .correlation-copy span { margin-top:3px; color:var(--muted); font-size:10px; }
    .correlation-grid { flex:1; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }
    .correlation-cell { min-width:0; padding:7px 9px; border-radius:7px; background:#f2f5f6; color:#52636d; }
    .correlation-cell span { display:block; overflow:hidden; font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
    .correlation-cell strong { display:block; margin-top:2px; color:var(--ink); font-size:18px; font-variant-numeric:tabular-nums; }
    .correlation-cell.good { background:var(--green-soft); }
    .correlation-cell.warn { background:var(--amber-soft); }
    .correlation-cell.bad { background:var(--red-soft); }
    .workspace { height:max(400px,calc(100vh - 395px)); display:grid; grid-template-columns:minmax(620px,1.15fr) minmax(470px,.85fr); gap:16px; align-items:stretch; }
    .workspace.detail-focus { grid-template-columns:minmax(0,1fr); }
    .workspace.detail-focus .attempts-panel { display:none; }
    .panel { min-width:0; background:var(--white); border:1px solid var(--line); border-radius:10px; box-shadow:var(--shadow); overflow:hidden; }
    .attempts-panel { display:flex; min-height:0; flex-direction:column; }
    .panel-head { min-height:58px; padding:11px 16px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--line); }
    .panel-head > div:first-child { min-width:0; }
    .panel-title { font-weight:700; }
    .panel-sub { margin-top:2px; overflow:hidden; color:var(--muted); font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
    .filter-bar { display:flex; flex-wrap:wrap; gap:8px; padding:9px 10px; border-bottom:1px solid var(--line); background:#fbfcfd; }
    .filter-bar input[type="search"] { flex:1 1 230px; }
    .filter-bar select { flex:0 1 auto; }
    select, input[type="search"] { min-width:0; border:1px solid #cfd9df; background:#fff; color:#25343e; border-radius:6px; padding:7px 9px; font:inherit; font-size:12px; }
    select { padding-right:28px; }
    button { border:1px solid #cbd7dd; border-radius:6px; background:#fff; color:#314550; padding:6px 9px; font:inherit; font-size:11px; cursor:pointer; white-space:nowrap; }
    button:hover { border-color:#8eb2bf; background:#f2f8fa; }
    button:disabled { cursor:not-allowed; opacity:.5; }
    button:focus-visible, select:focus-visible, input:focus-visible, tbody tr:focus-visible, summary:focus-visible { outline:2px solid #1294b5; outline-offset:2px; }
    .button-quiet { background:transparent; }
    .table-wrap { flex:1; min-height:0; overflow:auto; overscroll-behavior:contain; scrollbar-gutter:stable; }
    table { width:100%; border-collapse:separate; border-spacing:0; font-size:12px; }
    th { position:sticky; top:0; z-index:1; text-align:left; color:#5e6f7c; font-weight:650; background:#f9fbfc; border-bottom:1px solid var(--line); padding:9px 10px; white-space:nowrap; }
    td { padding:10px; border-bottom:1px solid #edf1f3; vertical-align:top; font-variant-numeric:tabular-nums; }
    tbody tr { cursor:pointer; outline:none; }
    tbody tr:hover { background:#f2f8fa; }
    tbody tr.selected { background:#e6f4f7; box-shadow:inset 3px 0 var(--blue); }
    .model { max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; }
    .muted { color:var(--muted); }
    .badge { display:inline-block; padding:3px 7px; border-radius:5px; font-size:11px; white-space:nowrap; background:#edf2f4; color:#536572; }
    .badge.good { color:var(--green); background:var(--green-soft); }
    .badge.warn { color:var(--amber); background:var(--amber-soft); }
    .badge.bad { color:var(--red); background:#fbe9e9; }
    .detail { position:sticky; top:22px; min-height:0; display:flex; flex-direction:column; overflow:hidden; }
    .detail-scroll { flex:1; min-height:0; overflow:auto; overscroll-behavior:contain; scrollbar-gutter:stable; }
    .detail-body { padding:16px 18px 22px; }
    .empty { min-height:260px; display:grid; place-content:center; text-align:center; color:#82909a; padding:30px; }
    .detail-head-actions { display:flex; flex:none; align-items:center; gap:8px; margin-left:12px; }
    .detail-summary { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .detail-section { min-width:0; padding:12px; border:1px solid #e1e8ec; border-radius:8px; background:#fbfcfd; }
    .detail h3 { margin:0 0 10px; font-size:12px; letter-spacing:.03em; color:#526773; }
    dl { margin:0; display:grid; grid-template-columns:108px minmax(0,1fr); gap:7px 9px; }
    dt { color:var(--muted); }
    dd { margin:0; font-weight:600; word-break:normal; overflow-wrap:anywhere; }
    code { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:11px; }
    .provider-evidence { grid-column:1 / -1; padding:13px 14px; border:1px solid #d9e5e8; border-radius:8px; background:#f8fbfb; }
    .evidence-heading { display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:9px; }
    .evidence-heading strong { font-size:12px; }
    .evidence-heading span { color:var(--muted); font-size:10px; text-align:right; }
    .provider-token-meter { display:block; width:100%; height:12px; margin:0 0 9px; border-radius:999px; overflow:hidden; background:#dfe7ea; }
    .provider-token-meter .hit { fill:var(--green-strong); }
    .provider-token-meter .write { fill:#e4a33d; }
    .provider-token-meter .miss { fill:var(--red-strong); }
    .token-legend, .inference-legend { display:flex; flex-wrap:wrap; gap:7px 14px; align-items:center; }
    .token-legend-item, .inference-legend-item { display:inline-flex; align-items:center; gap:6px; color:#4e626d; font-size:11px; }
    .legend-swatch { width:9px; height:9px; border-radius:3px; background:#9aa9b0; }
    .legend-swatch.hit, .legend-swatch.stable { background:var(--green-strong); }
    .legend-swatch.write, .legend-swatch.downstream { background:#e4a33d; }
    .legend-swatch.miss, .legend-swatch.changed { background:var(--red-strong); }
    .legend-swatch.unknown { background:#8b9aa1; }
    .provider-evidence-note { margin:8px 0 0; color:var(--muted); font-size:10px; }
    .methodology { margin-top:12px; border:1px solid #dce8ec; border-radius:8px; background:#f2f8fa; color:#425963; }
    .methodology summary { cursor:pointer; padding:9px 11px; font-size:12px; font-weight:650; }
    .methodology p { margin:0; padding:0 11px 11px; font-size:12px; }
    .raw-section { margin-top:16px; padding-top:14px; border-top:1px solid var(--line); }
    .raw-head { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px 12px; margin-bottom:9px; }
    .raw-head h3 { flex:none; margin:0; white-space:nowrap; }
    .json-toolbar { display:flex; flex:none; flex-wrap:wrap; justify-content:flex-end; gap:6px; align-items:center; margin-left:auto; }
    .json-status { min-height:18px; margin:6px 0 0; color:var(--muted); font-size:11px; text-align:right; }
    .json-tree { border:1px solid #263c46; border-radius:8px; background:#101c22; color:#d7e5e9; padding:10px 11px; font:11px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; overflow:visible; }
    .json-tree details { margin:0; }
    .json-inference { margin-bottom:9px; padding:10px 11px; border:1px solid #d8e3e7; border-radius:7px; background:#f8fbfc; }
    .json-inference-title { display:flex; flex-wrap:wrap; align-items:baseline; justify-content:space-between; gap:6px 12px; margin-bottom:7px; }
    .json-inference-title strong { font-size:11px; }
    .json-inference-title span { color:var(--muted); font-size:10px; }
    .json-inference-warning { margin-top:7px; color:#6f5b3d; font-size:10px; }
    .json-tree summary { min-height:23px; display:grid; grid-template-columns:14px minmax(0,1fr) auto; column-gap:6px; align-items:start; cursor:pointer; border-radius:4px; padding:2px 5px; list-style:none; }
    .json-tree summary::-webkit-details-marker { display:none; }
    .json-tree summary::before { grid-column:1; content:'▸'; color:#8199a2; font-size:10px; line-height:1.7; transform-origin:center; transition:transform .12s ease; }
    .json-tree details[open] > summary::before { transform:rotate(90deg); }
    .json-tree summary:hover { background:#19313b; }
    .json-summary-line { min-width:0; grid-column:2; overflow-wrap:anywhere; }
    .cache-inference-tag { grid-column:3; align-self:start; margin-top:1px; padding:1px 5px; border-radius:4px; color:#62747c; background:#dfe7ea; font:9px/1.45 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; white-space:nowrap; }
    [data-cache-inference="stable"] > summary, .json-leaf[data-cache-inference="stable"] { background:rgba(18,165,133,.13); box-shadow:inset 3px 0 var(--green-strong); }
    [data-cache-inference="stable"] > summary .cache-inference-tag, .json-leaf[data-cache-inference="stable"] .cache-inference-tag { color:#c8f4e7; background:#176a59; }
    [data-cache-inference="changed"] > summary, .json-leaf[data-cache-inference="changed"] { background:rgba(223,82,96,.16); box-shadow:inset 3px 0 var(--red-strong); }
    [data-cache-inference="changed"] > summary .cache-inference-tag, .json-leaf[data-cache-inference="changed"] .cache-inference-tag { color:#ffe4e7; background:#943c46; }
    [data-cache-inference="downstream"] > summary, .json-leaf[data-cache-inference="downstream"] { background:rgba(228,163,61,.14); box-shadow:inset 3px 0 #e4a33d; }
    [data-cache-inference="downstream"] > summary .cache-inference-tag, .json-leaf[data-cache-inference="downstream"] .cache-inference-tag { color:#ffedc7; background:#78561f; }
    [data-cache-inference="unknown"] > summary, .json-leaf[data-cache-inference="unknown"] { background:rgba(139,154,161,.12); box-shadow:inset 3px 0 #7d9098; }
    [data-cache-inference="unknown"] > summary .cache-inference-tag, .json-leaf[data-cache-inference="unknown"] .cache-inference-tag { color:#e4ecef; background:#52666f; }
    .json-children { margin-left:12px; padding-left:8px; border-left:1px solid #29414b; }
    .json-leaf { display:grid; grid-template-columns:14px minmax(70px,max-content) minmax(0,1fr) auto; column-gap:6px; padding:2px 5px; border-radius:4px; }
    .json-leaf::before { grid-column:1; content:''; }
    .json-leaf > .json-key { grid-column:2; }
    .json-leaf > .json-string, .json-leaf > .json-number, .json-leaf > .json-boolean, .json-leaf > .json-null { grid-column:3; }
    .json-leaf > .cache-inference-tag { grid-column:4; }
    .json-leaf:hover { background:#19313b; }
    .json-key { color:#8ed2df; overflow-wrap:anywhere; }
    .json-meta { margin-left:7px; color:#718b95; font-size:10px; }
    .json-string { color:#b8dfb0; white-space:pre-wrap; overflow-wrap:anywhere; }
    .json-number { color:#f2c778; }
    .json-boolean { color:#e6a9d5; }
    .json-null { color:#889ba3; font-style:italic; }
    .json-long-value { margin:3px 5px 5px 25px; padding:8px; border-radius:5px; background:#0b161b; color:#b8dfb0; white-space:pre-wrap; overflow-wrap:anywhere; }
    .raw-empty { padding:18px; border:1px dashed #cdd9df; border-radius:8px; color:var(--muted); background:#fafcfd; }
    .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
    .error { color:var(--red); }
    @media (max-width:1400px) { main { padding-left:20px; padding-right:20px; } .workspace { grid-template-columns:minmax(600px,1.1fr) minmax(460px,.9fr); } .detail-summary { grid-template-columns:minmax(0,1fr); } }
  </style>
</head>
<body>
  <header>
    <div><h1>CacheScope</h1><div class="subtitle">DeepSeek Harness · 逐次调用、稳定前缀与 Prefill 代理指标</div></div>
    <div class="header-state"><span class="pill"><span class="dot"></span><span id="liveState" aria-live="polite">等待数据</span></span><span class="pill" id="captureMode">读取配置</span><button type="button" class="header-button" id="refreshNow">立即刷新</button><button type="button" class="header-button" id="togglePolling" aria-pressed="false">暂停刷新</button></div>
  </header>
  <main>
    <section class="notice"><strong>证据分层</strong><p id="evidenceNote">供应商 usage 决定真实缓存 Token；输入对比只用于解释“哪里发生了变化”。</p></section>
    <section class="kpis">
      <div class="kpi"><div class="kpi-label">Cache Read Token 加权占比 · 当前筛选</div><div class="kpi-value" id="cacheRatio">—</div><div class="kpi-note" id="cacheRatioNote">当前筛选仅统计 Harness usage 携带 cache_read 的调用</div></div>
      <div class="kpi"><div class="kpi-label">本地前缀友好率</div><div class="kpi-value" id="prefixRatio">—</div><div class="kpi-note" id="prefixRatioNote">排除首次观察与模型/参数变化</div></div>
      <div class="kpi"><div class="kpi-label">未缓存输入 Token</div><div class="kpi-value" id="inputTokens">0</div><div class="kpi-note" id="promptTokens">总 Prompt 0</div></div>
      <div class="kpi"><div class="kpi-label">中位 / P95 Call TTFT</div><div class="kpi-value" id="ttft">—</div><div class="kpi-note">含排队与网络，不等于纯 Prefill</div></div>
      <div class="kpi"><div class="kpi-label">模型成本（估算）</div><div class="kpi-value" id="cost">—</div><div class="kpi-note" id="costNote">需在插件配置中填写单价</div></div>
    </section>
    <section class="correlation" aria-label="Provider Cache Read 与本地前缀的交叉统计">
      <div class="correlation-copy"><strong>证据交叉 · 当前筛选</strong><span id="correlationNote">只统计同时具备本地可比基线与 Cache Read 字段的调用</span></div>
      <div class="correlation-grid">
        <div class="correlation-cell good"><span>前缀友好 · 有读取</span><strong id="friendlyWithRead">0</strong></div>
        <div class="correlation-cell warn"><span>前缀友好 · 读取为 0</span><strong id="friendlyWithoutRead">0</strong></div>
        <div class="correlation-cell warn"><span>前缀变化 · 仍有读取</span><strong id="changedWithRead">0</strong></div>
        <div class="correlation-cell bad"><span>前缀变化 · 读取为 0</span><strong id="changedWithoutRead">0</strong></div>
      </div>
    </section>
    <section class="workspace">
      <div class="panel attempts-panel">
        <div class="panel-head"><div><div class="panel-title">模型调用 Attempt</div><div class="panel-sub" id="countText">0 条记录</div></div><button type="button" class="button-quiet" id="copyDiagnostics">复制当前诊断</button><span class="sr-only" id="copyDiagnosticsStatus" aria-live="polite"></span></div>
        <div class="filter-bar"><label class="sr-only" for="queryFilter">搜索调用</label><input type="search" id="queryFilter" placeholder="搜索 Call / Session / Provider / Model"><label class="sr-only" for="sessionFilter">按 Session 筛选</label><select id="sessionFilter"><option value="">全部 Session</option></select><label class="sr-only" for="providerFilter">按 Provider 筛选</label><select id="providerFilter"><option value="">全部 Provider</option></select><label class="sr-only" for="modelFilter">按模型筛选</label><select id="modelFilter"><option value="">全部模型</option></select><label class="sr-only" for="purposeFilter">按用途筛选</label><select id="purposeFilter" data-default-purpose="conversation"><option value="">全部用途</option><option value="conversation" selected>对话</option><option value="compaction">压缩</option><option value="session-title">标题</option><option value="direct">直接调用</option></select><label class="sr-only" for="statusFilter">按调用状态筛选</label><select id="statusFilter"><option value="">全部状态</option><option value="running">运行中</option><option value="completed">已完成</option><option value="failed">失败</option><option value="cancelled">已取消</option><option value="consumer-stopped">消费端停止</option><option value="incomplete">未完成</option></select><label class="sr-only" for="evidenceFilter">按证据组合筛选</label><select id="evidenceFilter"><option value="">全部证据组合</option><option value="friendly-read">前缀友好 · 有读取</option><option value="friendly-zero">前缀友好 · 读取为 0</option><option value="changed-read">前缀变化 · 仍有读取</option><option value="changed-zero">前缀变化 · 读取为 0</option><option value="unresolved">不可交叉判断</option></select><label class="sr-only" for="sortOrder">调用排序</label><select id="sortOrder"><option value="newest">最新优先</option><option value="oldest">最早优先</option><option value="cache-desc">Cache 命中率高优先</option><option value="ttft-desc">TTFT 慢优先</option></select></div>
        <div class="table-wrap"><table aria-label="模型调用记录"><thead><tr><th scope="col">时间</th><th scope="col">Session / Call</th><th scope="col">模型</th><th scope="col">供应商缓存读取</th><th scope="col">未缓存 / Prompt</th><th scope="col">Call TTFT</th><th scope="col">DSH 输入变化</th></tr></thead><tbody id="attemptRows"></tbody></table></div>
      </div>
      <aside class="panel detail"><div class="panel-head"><div><div class="panel-title" id="detailTitle">调用详情</div><div class="panel-sub" id="detailSub">自动显示最新一条记录</div></div><div class="detail-head-actions"><button type="button" class="button-quiet" id="jumpToJson">查看输入</button><button type="button" class="button-quiet" id="focusDetail" aria-pressed="false">专注详情</button></div></div><div class="detail-scroll" id="detailScroll"><div id="detailBody" class="empty">这里会显示 Token 证据、分段指纹和本次完整逻辑输入。</div></div></aside>
    </section>
  </main>
  <script nonce="${nonce}">
    'use strict'
    const API = '/cachescope/api'
    const INPUT_API = '/cachescope/api/input'
    const REFRESH_MS = ${refreshMs}
    const state = { snapshot:null, selectedId:null, renderedDetailId:null, detailSignature:null, openJsonPaths:new Set(['$']), rawInput:null, rawLoadedKey:null, rawLoadingKey:null, rawErrorKey:null, rawLoadError:null, reloading:false, paused:false, lastUpdatedLabel:null }
    const byId = id => document.getElementById(id)
    const number = value => new Intl.NumberFormat('zh-CN').format(value || 0)
    const percent = value => value === undefined ? '—' : (value * 100).toFixed(1) + '%'
    const ms = value => value === undefined ? '—' : (value >= 1000 ? (value / 1000).toFixed(2) + ' s' : value.toFixed(1) + ' ms')
    const purposeName = { conversation:'对话', compaction:'压缩', 'session-title':'标题', direct:'直接调用' }
    const changeName = { 'first-observation':'首次观察', 'identical-input':'完全相同', 'append-only':'仅末尾追加', 'route-or-options-changed':'模型/参数变化', 'system-changed':'System 变化', 'tools-changed':'Tools 变化', 'history-rewritten':'历史被改写' }
    const rawName = { available:'已保留', disabled:'未启用', evicted:'已淘汰', 'too-large':'超过单次上限', unserializable:'无法 JSON 化' }
    const jsonBuilders = new WeakMap()

    function td(text, className) {
      const cell = document.createElement('td')
      cell.textContent = text
      if (className) cell.className = className
      return cell
    }
    function badge(text, kind) {
      const span = document.createElement('span')
      span.className = 'badge' + (kind ? ' ' + kind : '')
      span.textContent = text
      return span
    }
    function shortSession(value) {
      if (!value) return '无 Session'
      return value.length <= 17 ? value : value.slice(0, 8) + '…' + value.slice(-6)
    }
    function prefixKind(kind) {
      if (kind === 'append-only' || kind === 'identical-input') return 'good'
      if (kind === 'history-rewritten' || kind === 'system-changed' || kind === 'tools-changed') return 'warn'
      return ''
    }
    function evidenceBucket(item) {
      const comparablePrefix = item.diagnosis.kind !== 'first-observation' && item.diagnosis.kind !== 'route-or-options-changed'
      if (!comparablePrefix || !item.usage || item.usage.cacheReadTokens === undefined) return 'unresolved'
      const prefixFriendly = item.diagnosis.kind === 'identical-input' || item.diagnosis.kind === 'append-only'
      const hasRead = item.usage.cacheReadTokens > 0
      if (prefixFriendly) return hasRead ? 'friendly-read' : 'friendly-zero'
      return hasRead ? 'changed-read' : 'changed-zero'
    }
    function visibleAttempts() {
      if (!state.snapshot) return []
      const session = byId('sessionFilter').value
      const provider = byId('providerFilter').value
      const model = byId('modelFilter').value
      const purpose = byId('purposeFilter').value
      const status = byId('statusFilter').value
      const evidence = byId('evidenceFilter').value
      const query = byId('queryFilter').value.trim().toLocaleLowerCase()
      const attempts = state.snapshot.attempts.filter(item => {
        if (session && (item.sessionId || '') !== session) return false
        if (provider && item.provider !== provider) return false
        if (model && item.model !== model) return false
        if (purpose && item.purpose !== purpose) return false
        if (status && item.status !== status) return false
        if (evidence && evidenceBucket(item) !== evidence) return false
        if (!query) return true
        return [item.id, item.sessionId, item.provider, item.model, item.purpose, item.diagnosis.kind]
          .filter(Boolean)
          .join('\\n')
          .toLocaleLowerCase()
          .includes(query)
      })
      const sort = byId('sortOrder').value
      if (sort === 'oldest') return attempts.sort((a, b) => a.startedAt - b.startedAt)
      if (sort === 'cache-desc') return attempts.sort((a, b) => (b.usage && b.usage.cacheReadRatio !== undefined ? b.usage.cacheReadRatio : -1) - (a.usage && a.usage.cacheReadRatio !== undefined ? a.usage.cacheReadRatio : -1) || b.startedAt - a.startedAt)
      if (sort === 'ttft-desc') return attempts.sort((a, b) => (b.firstTokenMs === undefined ? -1 : b.firstTokenMs) - (a.firstTokenMs === undefined ? -1 : a.firstTokenMs) || b.startedAt - a.startedAt)
      return attempts.sort((a, b) => b.startedAt - a.startedAt)
    }
    function summarizeAttempts(items) {
      const summary = { attemptCount:items.length, comparablePrefixAttempts:0, prefixFriendlyAttempts:0, reportedCacheAttempts:0, promptTokens:0, inputTokens:0, cacheReadTokens:0, outputTokens:0, firstTokens:[], estimatedCost:0, pricedAttempts:0, currency:null, reportedPromptTokens:0, correlation:{ comparedAttempts:0, prefixFriendlyWithRead:0, prefixFriendlyWithoutRead:0, prefixChangedWithRead:0, prefixChangedWithoutRead:0 } }
      items.forEach(item => {
        const comparablePrefix = item.diagnosis.kind !== 'first-observation' && item.diagnosis.kind !== 'route-or-options-changed'
        const prefixFriendly = item.diagnosis.kind === 'identical-input' || item.diagnosis.kind === 'append-only'
        if (comparablePrefix) {
          summary.comparablePrefixAttempts++
          if (prefixFriendly) summary.prefixFriendlyAttempts++
        }
        if (comparablePrefix && item.usage && item.usage.cacheReadTokens !== undefined) {
          summary.correlation.comparedAttempts++
          const hasRead = item.usage.cacheReadTokens > 0
          if (prefixFriendly && hasRead) summary.correlation.prefixFriendlyWithRead++
          else if (prefixFriendly) summary.correlation.prefixFriendlyWithoutRead++
          else if (hasRead) summary.correlation.prefixChangedWithRead++
          else summary.correlation.prefixChangedWithoutRead++
        }
        if (item.firstTokenMs !== undefined) summary.firstTokens.push(item.firstTokenMs)
        if (item.usage) {
          summary.promptTokens += item.usage.promptTokens
          summary.inputTokens += item.usage.inputTokens
          summary.cacheReadTokens += item.usage.cacheReadTokens || 0
          summary.outputTokens += item.usage.outputTokens
          if (item.usage.cacheReadTokens !== undefined) {
            summary.reportedCacheAttempts++
            summary.reportedPromptTokens += item.usage.promptTokens
          }
        }
        if (item.cost) {
          summary.estimatedCost += item.cost.amount
          summary.pricedAttempts++
          summary.currency = item.cost.currency
        }
      })
      summary.firstTokens.sort((a, b) => a - b)
      const middle = Math.floor(summary.firstTokens.length / 2)
      summary.medianFirstTokenMs = summary.firstTokens.length === 0
        ? undefined
        : summary.firstTokens.length % 2 === 1
          ? summary.firstTokens[middle]
          : (summary.firstTokens[middle - 1] + summary.firstTokens[middle]) / 2
      summary.p95FirstTokenMs = summary.firstTokens.length === 0
        ? undefined
        : summary.firstTokens[Math.max(0, Math.ceil(summary.firstTokens.length * 0.95) - 1)]
      summary.cacheReadRatio = summary.reportedPromptTokens === 0 ? undefined : summary.cacheReadTokens / summary.reportedPromptTokens
      summary.prefixFriendlyRatio = summary.comparablePrefixAttempts === 0 ? undefined : summary.prefixFriendlyAttempts / summary.comparablePrefixAttempts
      return summary
    }
    function currentFilterLabel() {
      const purpose = byId('purposeFilter').value
      const session = byId('sessionFilter').value
      const provider = byId('providerFilter').value
      const model = byId('modelFilter').value
      const status = byId('statusFilter').value
      const evidence = byId('evidenceFilter').value
      const sort = byId('sortOrder').value
      const query = byId('queryFilter').value.trim()
      const parts = [purpose ? (purposeName[purpose] || purpose) : '全部用途']
      if (session) parts.push(shortSession(session))
      if (provider) parts.push(provider)
      if (model) parts.push(model)
      if (status) parts.push(byId('statusFilter').selectedOptions[0].textContent)
      if (evidence) parts.push(byId('evidenceFilter').selectedOptions[0].textContent)
      if (sort !== 'newest') parts.push(byId('sortOrder').selectedOptions[0].textContent)
      if (query) parts.push('搜索 “' + query + '”')
      return parts.join(' · ')
    }
    async function copyFilteredDiagnostics() {
      const status = byId('copyDiagnosticsStatus')
      if (!state.snapshot) {
        status.textContent = '暂无可复制的诊断数据'
        return
      }
      const attempts = visibleAttempts()
      const summary = { ...summarizeAttempts(attempts) }
      delete summary.firstTokens
      delete summary.reportedPromptTokens
      delete summary.pricedAttempts
      delete summary.currency
      const payload = {
        generatedAt: state.snapshot.generatedAt,
        filter: currentFilterLabel(),
        summary,
        attempts,
        notes: state.snapshot.notes,
      }
      try {
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
        status.textContent = '已复制当前筛选的诊断元数据，不包含完整输入正文'
      } catch {
        status.textContent = '复制失败，请检查浏览器剪贴板权限'
      }
    }
    function renderSummary() {
      const s = summarizeAttempts(visibleAttempts())
      byId('cacheRatio').textContent = percent(s.cacheReadRatio)
      byId('cacheRatioNote').textContent = '当前筛选：' + currentFilterLabel() + ' · ' + s.reportedCacheAttempts + ' / ' + s.attemptCount + ' 次调用携带 cache_read'
      byId('prefixRatio').textContent = percent(s.prefixFriendlyRatio)
      byId('prefixRatioNote').textContent = s.prefixFriendlyAttempts + ' / ' + s.comparablePrefixAttempts + ' 次可比较调用保持完整 System、Tools 与历史前缀'
      byId('friendlyWithRead').textContent = number(s.correlation.prefixFriendlyWithRead)
      byId('friendlyWithoutRead').textContent = number(s.correlation.prefixFriendlyWithoutRead)
      byId('changedWithRead').textContent = number(s.correlation.prefixChangedWithRead)
      byId('changedWithoutRead').textContent = number(s.correlation.prefixChangedWithoutRead)
      byId('correlationNote').textContent = '已交叉 ' + s.correlation.comparedAttempts + ' 次；首次观察、模型/参数变化与未携带 Cache Read 字段的调用不进入矩阵'
      byId('inputTokens').textContent = number(s.inputTokens)
      byId('promptTokens').textContent = '总 Prompt ' + number(s.promptTokens) + ' · Cache Read ' + number(s.cacheReadTokens)
      byId('ttft').textContent = ms(s.medianFirstTokenMs) + ' / ' + ms(s.p95FirstTokenMs)
      if (s.pricedAttempts > 0 && s.currency) {
        byId('cost').textContent = s.currency + ' ' + s.estimatedCost.toFixed(5)
        byId('costNote').textContent = '按插件配置单价估算，不是账单'
      } else {
        byId('cost').textContent = '—'
        byId('costNote').textContent = '需在插件配置中填写单价'
      }
      byId('captureMode').textContent = state.snapshot.captureInput === 'full' ? '完整输入 · 内存限量保留' : '仅元数据 · 不保留正文'
      byId('evidenceNote').textContent = state.snapshot.notes.cacheEvidence + ' ' + state.snapshot.notes.prefixEvidence
    }
    function renderFilterOptions(selectId, allLabel, values, label) {
      const select = byId(selectId)
      const selected = select.value
      select.replaceChildren()
      const all = document.createElement('option')
      all.value = ''
      all.textContent = allLabel
      select.append(all)
      values.forEach(value => {
        const option = document.createElement('option')
        option.value = value
        option.textContent = label(value)
        select.append(option)
      })
      if (values.includes(selected)) select.value = selected
    }
    function renderFilters() {
      const attempts = state.snapshot.attempts
      renderFilterOptions('sessionFilter', '全部 Session', Array.from(new Set(attempts.map(item => item.sessionId).filter(Boolean))), shortSession)
      renderFilterOptions('providerFilter', '全部 Provider', Array.from(new Set(attempts.map(item => item.provider))), value => value)
      renderFilterOptions('modelFilter', '全部模型', Array.from(new Set(attempts.map(item => item.model))), value => value)
    }
    function resetDetailState(id) {
      state.selectedId = id
      state.renderedDetailId = null
      state.detailSignature = null
      state.openJsonPaths = new Set(['$'])
      state.rawInput = null
      state.rawLoadedKey = null
      state.rawLoadingKey = null
      state.rawErrorKey = null
      state.rawLoadError = null
      byId('detailScroll').scrollTop = 0
    }
    function selectAttempt(item) {
      if (state.selectedId !== item.id) resetDetailState(item.id)
      renderRows()
      void ensureRawInput(item)
      renderDetail(item)
    }
    function rowSignature(item) {
      const usage = item.usage || {}
      return [item.startedAt, item.sessionId, item.purpose, item.provider, item.model, usage.inputTokens, usage.promptTokens, usage.cacheReadTokens, usage.cacheReadRatio, item.firstTokenMs, item.diagnosis.kind].join('|')
    }
    function attemptForRow(row) {
      return visibleAttempts().find(item => item.id === row.dataset.attemptId)
    }
    function createAttemptRow() {
      const row = document.createElement('tr')
      row.tabIndex = 0
      row.addEventListener('click', () => {
        const item = attemptForRow(row)
        if (item) selectAttempt(item)
      })
      row.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          const item = attemptForRow(row)
          if (item) selectAttempt(item)
        }
      })
      return row
    }
    function updateAttemptRow(row, item) {
      const selected = item.id === state.selectedId
      row.classList.toggle('selected', selected)
      row.setAttribute('aria-selected', String(selected))
      const signature = rowSignature(item)
      if (row.dataset.rowSignature === signature) return
      row.dataset.rowSignature = signature
      row.replaceChildren()
      row.append(td(new Date(item.startedAt).toLocaleTimeString('zh-CN', { hour12:false })))
      const identity = document.createElement('td')
      identity.title = item.sessionId || '无 Session'
      const top = document.createElement('div'); top.textContent = shortSession(item.sessionId)
      const sub = document.createElement('div'); sub.className = 'muted'; sub.textContent = item.id + ' · ' + (purposeName[item.purpose] || item.purpose)
      identity.append(top, sub); row.append(identity)
      const model = td(item.provider + ' / ' + item.model, 'model'); model.title = item.provider + ' / ' + item.model; row.append(model)
      const cache = document.createElement('td')
      if (!item.usage || item.usage.cacheState === 'no-read-reported') cache.append(badge('未携带', 'warn'))
      else cache.append(badge(percent(item.usage.cacheReadRatio), item.usage.cacheReadTokens > 0 ? 'good' : 'bad'))
      row.append(cache)
      row.append(td(item.usage ? number(item.usage.inputTokens) + ' / ' + number(item.usage.promptTokens) : '—'))
      row.append(td(ms(item.firstTokenMs)))
      const change = document.createElement('td'); change.append(badge(changeName[item.diagnosis.kind] || item.diagnosis.kind, prefixKind(item.diagnosis.kind))); row.append(change)
    }
    function renderRows() {
      const body = byId('attemptRows')
      const items = visibleAttempts()
      byId('countText').textContent = items.length + ' / ' + state.snapshot.attempts.length + ' 条记录 · 每次重试单独计数'
      const rows = new Map(Array.from(body.querySelectorAll('tr')).map(row => [row.dataset.attemptId, row]))
      items.forEach((item, index) => {
        const row = rows.get(item.id) || createAttemptRow()
        row.dataset.attemptId = item.id
        const current = body.children[index]
        if (current !== row) body.insertBefore(row, current || null)
        updateAttemptRow(row, item)
        rows.delete(item.id)
      })
      rows.forEach(row => { row.remove() })
    }
    function addFact(list, name, value) {
      const dt = document.createElement('dt'); dt.textContent = name
      const dd = document.createElement('dd'); dd.textContent = value
      list.append(dt, dd)
    }
    function factSection(parent, title) {
      const block = document.createElement('section'); block.className = 'detail-section'
      const heading = document.createElement('h3'); heading.textContent = title; block.append(heading)
      const list = document.createElement('dl'); block.append(list); parent.append(block); return list
    }
    function tokenLegendItem(kind, text) {
      const item = document.createElement('span'); item.className = 'token-legend-item'
      const swatch = document.createElement('span'); swatch.className = 'legend-swatch ' + kind
      const label = document.createElement('span'); label.textContent = text
      item.append(swatch, label)
      return item
    }
    function tokenRect(svg, kind, start, tokens, total) {
      if (tokens <= 0 || total <= 0) return
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.classList.add(kind)
      rect.dataset.cacheSegment = kind
      rect.setAttribute('x', String(start * 100 / total))
      rect.setAttribute('y', '0')
      rect.setAttribute('width', String(tokens * 100 / total))
      rect.setAttribute('height', '10')
      svg.append(rect)
    }
    function renderProviderEvidence(parent, item) {
      const block = document.createElement('section'); block.className = 'provider-evidence'; block.dataset.cacheEvidence = 'normalized-usage'
      const heading = document.createElement('div'); heading.className = 'evidence-heading'
      const title = document.createElement('strong'); title.textContent = '模型 Usage Token（本次调用）'
      const scope = document.createElement('span'); scope.textContent = 'Cache Read 取自 Provider adapter；其余为标准化 Token 桶'
      heading.append(title, scope); block.append(heading)
      const usage = item.usage
      if (!usage) {
        const missing = document.createElement('div'); missing.className = 'muted'; missing.textContent = '本次调用没有可用的 Token usage。'
        block.append(missing); parent.append(block); return
      }
      const readAvailable = usage.cacheState === 'read-reported'
      const hit = usage.cacheReadTokens || 0
      const write = usage.cacheWriteTokens || 0
      const miss = usage.inputTokens
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.classList.add('provider-token-meter')
      svg.setAttribute('viewBox', '0 0 100 10')
      svg.setAttribute('preserveAspectRatio', 'none')
      svg.setAttribute('role', 'img')
      svg.setAttribute('aria-label', (readAvailable ? 'Provider usage Cache Read ' + number(hit) + ' Token' : 'Harness usage 未携带 Cache Read') + '，适配器归一化未缓存 ' + number(miss) + ' Token，Cache Write ' + number(write) + ' Token')
      tokenRect(svg, 'hit', 0, hit, usage.promptTokens)
      tokenRect(svg, 'write', hit, write, usage.promptTokens)
      tokenRect(svg, 'miss', hit + write, miss, usage.promptTokens)
      block.append(svg)
      const legend = document.createElement('div'); legend.className = 'token-legend'
      legend.append(
        tokenLegendItem(readAvailable ? 'hit' : 'unknown', readAvailable ? 'Provider usage Cache Read ' + number(hit) + ' Token' : 'Cache Read 未携带（不视为 0）'),
        tokenLegendItem('miss', '适配器归一化未缓存 ' + number(miss) + ' Token'),
      )
      if (write > 0) legend.append(tokenLegendItem('write', 'Cache Write ' + number(write) + ' Token'))
      block.append(legend)
      const note = document.createElement('p'); note.className = 'provider-evidence-note'; note.textContent = '色条只展示 Token 桶占比，不对应输入位置。DeepSeek 的未缓存输入等价于 Prompt Token − Cache Read；供应商不返回逐字段 Token 位置。'
      block.append(note); parent.append(block)
    }
    function inferenceLegendItem(kind, text) {
      const item = document.createElement('span'); item.className = 'inference-legend-item'
      const swatch = document.createElement('span'); swatch.className = 'legend-swatch ' + kind
      const label = document.createElement('span'); label.textContent = text
      item.append(swatch, label)
      return item
    }
    function cacheInferenceForPath(item, path) {
      const diagnosis = item.diagnosis
      const firstObservation = diagnosis.kind === 'first-observation'
      const incomparableRoute = diagnosis.kind === 'route-or-options-changed'
      const message = /^\\$\\.messages\\[(\\d+)\\]$/.exec(path)
      const tool = /^\\$\\.tools\\[(\\d+)\\]$/.exec(path)
      const relevant = path === '$.system' || path === '$.tools' || path === '$.messages' || message || tool
      if (!relevant) return null
      if (firstObservation || incomparableRoute) return 'unknown'
      if (path === '$.system') return diagnosis.systemStable === false ? 'changed' : 'stable'
      if (path === '$.tools') {
        if (diagnosis.systemStable === false) return 'downstream'
        return diagnosis.previousToolCount === item.input.toolCount
          && diagnosis.stableToolCount === item.input.toolCount ? 'stable' : 'changed'
      }
      if (tool) {
        if (diagnosis.systemStable === false) return 'downstream'
        const index = Number(tool[1])
        if (index < (diagnosis.stableToolCount || 0)) return 'stable'
        if (index >= (diagnosis.previousToolCount || 0) || index === diagnosis.stableToolCount) return 'changed'
        return 'downstream'
      }
      if (diagnosis.systemStable === false) return 'downstream'
      const toolsRemainPrefix = diagnosis.previousToolCount === item.input.toolCount
        && diagnosis.stableToolCount === item.input.toolCount
      if (path === '$.messages') {
        if (!toolsRemainPrefix) return 'downstream'
        return diagnosis.previousMessageCount === item.input.messageCount
          && diagnosis.stableMessageCount === item.input.messageCount ? 'stable' : 'changed'
      }
      if (!toolsRemainPrefix) return 'downstream'
      const index = Number(message[1])
      if (index < diagnosis.stableMessageCount) return 'stable'
      if (index >= (diagnosis.previousMessageCount || 0) || index === diagnosis.stableMessageCount) return 'changed'
      return 'downstream'
    }
    function decorateCacheInference(node, item, path) {
      const status = cacheInferenceForPath(item, path)
      if (!status) return
      const labels = { stable:'稳定候选', changed:'本地新/变', downstream:'受前置影响', unknown:'无法比较' }
      node.dataset.cacheInference = status
      node.title = status === 'stable'
        ? 'DSH 推断为与本地比较调用相同的逻辑前缀候选；不是供应商确认命中。'
        : status === 'changed'
          ? '该节点是本地比较中的首个差异或新增节点；不能据此断言供应商未命中。'
          : status === 'downstream'
            ? '该节点位于更早的 System、Tool 或 Message 差异之后；节点本身不一定发生变化。'
            : '当前没有可比较的本地逻辑基线，无法定位供应商命中部分。'
      const tag = document.createElement('span'); tag.className = 'cache-inference-tag'; tag.textContent = labels[status]
      const target = node.matches('details') ? node.querySelector(':scope > summary') : node
      if (target) target.append(tag)
    }
    function renderInferenceLegend(parent, item) {
      const block = document.createElement('div'); block.className = 'json-inference'; block.dataset.cacheEvidence = 'dsh-inferred'
      const title = document.createElement('div'); title.className = 'json-inference-title'
      const strong = document.createElement('strong'); strong.textContent = 'DSH 输入结构定位（推断）'
      const compared = document.createElement('span'); compared.textContent = item.diagnosis.comparedTo ? '对比 ' + item.diagnosis.comparedTo : '没有本地比较基线'
      title.append(strong, compared); block.append(title)
      const legend = document.createElement('div'); legend.className = 'inference-legend'
      legend.append(
        inferenceLegendItem('stable', 'DSH 推断命中候选 / 稳定前缀'),
        inferenceLegendItem('changed', '本地首个差异 / 新增节点'),
        inferenceLegendItem('downstream', '受前置变化影响'),
        inferenceLegendItem('unknown', '无法比较'),
      )
      block.append(legend)
      const warning = document.createElement('div'); warning.className = 'json-inference-warning'
      warning.textContent = '颜色不是供应商逐字段命中或未命中位置；它只比较本进程中同 Session、同用途的相邻 DSH 逻辑输入。'
      if (item.diagnosis.kind === 'first-observation' && (item.usage && (item.usage.cacheReadTokens || 0) > 0)) {
        warning.textContent += ' 本次供应商虽报告命中，但缓存基线位于 DSH 当前可见范围之外。'
      }
      block.append(warning); parent.append(block)
    }
    function detailSignature(item) {
      const usage = item.usage || {}
      return [item.id, item.status, item.finishKind, item.firstTokenMs, item.durationMs, usage.inputTokens, usage.outputTokens, usage.cacheReadTokens, usage.cacheWriteTokens, item.diagnosis.kind, item.diagnosis.comparedTo, item.diagnosis.stableToolCount, item.diagnosis.stableMessageCount, item.rawState, item.input.overallFingerprint, state.rawLoadedKey, state.rawLoadingKey, state.rawErrorKey, state.rawLoadError].join('|')
    }
    function rawKey(item) {
      return item.id + '|' + item.input.overallFingerprint
    }
    function syncRawState(item) {
      const key = rawKey(item)
      const stale = (state.rawLoadedKey && state.rawLoadedKey !== key)
        || (state.rawLoadingKey && state.rawLoadingKey !== key)
        || (state.rawErrorKey && state.rawErrorKey !== key)
      if (stale) {
        state.rawInput = null
        state.rawLoadedKey = null
        state.rawLoadingKey = null
        state.rawErrorKey = null
        state.rawLoadError = null
        state.openJsonPaths = new Set(['$'])
      }
      if (item.rawState !== 'available') {
        state.rawInput = null
        state.rawLoadedKey = key
        state.rawLoadingKey = null
        state.rawErrorKey = null
        state.rawLoadError = null
      }
    }
    async function ensureRawInput(item) {
      syncRawState(item)
      const key = rawKey(item)
      if (item.rawState !== 'available' || state.rawLoadedKey === key || state.rawLoadingKey === key || state.rawErrorKey === key) return
      state.rawLoadingKey = key
      state.rawLoadError = null
      try {
        const response = await fetch(INPUT_API + '?id=' + encodeURIComponent(item.id), { cache:'no-store', credentials:'same-origin' })
        if (!response.ok) throw new Error('HTTP ' + response.status)
        const input = await response.json()
        const current = visibleAttempts().find(candidate => candidate.id === item.id)
        if (!current || state.selectedId !== item.id || current.input.overallFingerprint !== input.overallFingerprint) return
        current.rawState = input.rawState
        state.rawInput = input.rawInput === undefined ? null : input.rawInput
        state.rawLoadedKey = key
        state.rawErrorKey = null
        state.rawLoadError = null
      } catch (error) {
        const current = visibleAttempts().find(candidate => candidate.id === item.id)
        if (current && state.selectedId === item.id && current.input.overallFingerprint === item.input.overallFingerprint) {
          state.rawErrorKey = key
          state.rawLoadError = '完整输入读取失败 · ' + (error && error.message ? error.message : String(error))
        }
      } finally {
        if (state.rawLoadingKey === key) state.rawLoadingKey = null
        const current = visibleAttempts().find(candidate => candidate.id === state.selectedId)
        if (current) renderDetail(current)
      }
    }
    function pathFor(parent, key, arrayItem) {
      if (arrayItem) return parent + '[' + key + ']'
      return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? parent + '.' + key : parent + '[' + JSON.stringify(key) + ']'
    }
    function appendJsonKey(parent, label) {
      const key = document.createElement('span'); key.className = 'json-key'; key.textContent = label; parent.append(key)
    }
    function createJsonLeaf(label, value, depth, path, item) {
      if (typeof value === 'string' && value.length > 220) {
        const details = document.createElement('details')
        details.className = 'json-long'
        details.dataset.jsonDepth = String(depth)
        details.dataset.jsonPath = path
        const summary = document.createElement('summary')
        const content = document.createElement('span'); content.className = 'json-summary-line'
        appendJsonKey(content, label + ': ')
        const preview = document.createElement('span'); preview.className = 'json-string'; preview.textContent = JSON.stringify(value.slice(0, 180) + '…')
        const meta = document.createElement('span'); meta.className = 'json-meta'; meta.textContent = value.length + ' 字符'
        content.append(preview, meta); summary.append(content); details.append(summary)
        let built = false
        const materialize = () => {
          if (built) return
          built = true
          const full = document.createElement('div'); full.className = 'json-long-value'; full.textContent = value; details.append(full)
        }
        details.addEventListener('toggle', () => {
          if (details.open) { state.openJsonPaths.add(path); materialize() } else state.openJsonPaths.delete(path)
        })
        if (state.openJsonPaths.has(path)) { details.open = true; materialize() }
        decorateCacheInference(details, item, path)
        return details
      }
      const line = document.createElement('div'); line.className = 'json-leaf'; line.dataset.jsonDepth = String(depth); line.dataset.jsonPath = path
      appendJsonKey(line, label + ':')
      const rendered = document.createElement('span')
      if (value === null) { rendered.className = 'json-null'; rendered.textContent = 'null' }
      else if (typeof value === 'string') { rendered.className = 'json-string'; rendered.textContent = JSON.stringify(value) }
      else if (typeof value === 'number') { rendered.className = 'json-number'; rendered.textContent = String(value) }
      else if (typeof value === 'boolean') { rendered.className = 'json-boolean'; rendered.textContent = String(value) }
      else { rendered.className = 'json-null'; rendered.textContent = String(value) }
      line.append(rendered)
      decorateCacheInference(line, item, path)
      return line
    }
    function createJsonBranch(label, value, depth, path, item) {
      const details = document.createElement('details')
      details.className = 'json-branch'
      details.dataset.jsonDepth = String(depth)
      details.dataset.jsonPath = path
      const arrayValue = Array.isArray(value)
      const entryCount = arrayValue ? value.length : Object.keys(value).length
      const summary = document.createElement('summary')
      const content = document.createElement('span'); content.className = 'json-summary-line'
      appendJsonKey(content, label)
      const meta = document.createElement('span'); meta.className = 'json-meta'; meta.textContent = (arrayValue ? 'Array' : 'Object') + ' · ' + entryCount + ' 项'
      content.append(meta); summary.append(content); details.append(summary)
      const children = document.createElement('div'); children.className = 'json-children'; details.append(children)
      let built = false
      const materialize = () => {
        if (built) return
        built = true
        if (arrayValue) {
          value.forEach((child, index) => {
            const key = String(index)
            children.append(createJsonNode('[' + key + ']', child, depth + 1, pathFor(path, key, true), item))
          })
        } else {
          Object.entries(value).forEach(entry => {
            const key = entry[0]
            children.append(createJsonNode(key, entry[1], depth + 1, pathFor(path, key, false), item))
          })
        }
      }
      jsonBuilders.set(details, materialize)
      details.addEventListener('toggle', () => {
        if (details.open) { state.openJsonPaths.add(path); materialize() } else state.openJsonPaths.delete(path)
      })
      if (state.openJsonPaths.has(path)) { details.open = true; materialize() }
      decorateCacheInference(details, item, path)
      return details
    }
    function createJsonNode(label, value, depth, path, item) {
      return value !== null && typeof value === 'object' ? createJsonBranch(label, value, depth, path, item) : createJsonLeaf(label, value, depth, path, item)
    }
    function setJsonDepth(maxDepth) {
      const tree = byId('rawJsonTree')
      if (!tree) return
      state.openJsonPaths.clear()
      tree.querySelectorAll('details').forEach(details => { details.open = false })
      const root = tree.querySelector('details.json-branch')
      if (!root) return
      const queue = [root]
      while (queue.length) {
        const branch = queue.shift()
        const depth = Number(branch.dataset.jsonDepth)
        if (depth >= maxDepth) continue
        branch.open = true
        state.openJsonPaths.add(branch.dataset.jsonPath)
        const materialize = jsonBuilders.get(branch)
        if (materialize) materialize()
        const children = branch.querySelector(':scope > .json-children')
        if (children) Array.from(children.children).forEach(child => { if (child.matches('details.json-branch')) queue.push(child) })
      }
    }
    function collapseJson() {
      const tree = byId('rawJsonTree')
      if (!tree) return
      state.openJsonPaths.clear()
      tree.querySelectorAll('details').forEach(details => { details.open = false })
    }
    function jsonButton(action, label, run) {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.jsonAction = action
      button.setAttribute('aria-controls', 'rawJsonTree')
      button.textContent = label
      button.addEventListener('click', run)
      return button
    }
    function renderRawSection(root, item) {
      const section = document.createElement('section'); section.className = 'raw-section'
      const head = document.createElement('div'); head.className = 'raw-head'
      const title = document.createElement('h3'); title.textContent = '完整 DSH 逻辑输入 · ' + rawName[item.rawState]
      head.append(title)
      const key = rawKey(item)
      const hasRaw = state.rawLoadedKey === key && state.rawInput !== null
      if (hasRaw) {
        const toolbar = document.createElement('div'); toolbar.className = 'json-toolbar'
        toolbar.append(
          jsonButton('collapse', '全部收起', collapseJson),
          jsonButton('expand-one', '展开 1 层', () => { setJsonDepth(1) }),
          jsonButton('expand-two', '展开 2 层', () => { setJsonDepth(2) }),
          jsonButton('expand-three', '展开 3 层', () => { setJsonDepth(3) }),
          jsonButton('copy', '复制 JSON', async () => {
            const status = byId('jsonStatus')
            try {
              await navigator.clipboard.writeText(JSON.stringify(state.rawInput, null, 2))
              status.textContent = '已复制完整 JSON'
            } catch {
              status.textContent = '复制失败，请检查浏览器剪贴板权限'
            }
          }),
        )
        head.append(toolbar)
      }
      section.append(head)
      if (hasRaw) {
        renderInferenceLegend(section, item)
        const tree = document.createElement('div'); tree.id = 'rawJsonTree'; tree.className = 'json-tree'; tree.dataset.jsonTree = ''
        tree.append(createJsonNode('完整输入', state.rawInput, 0, '$', item))
        section.append(tree)
        const status = document.createElement('div'); status.id = 'jsonStatus'; status.className = 'json-status'; status.setAttribute('aria-live', 'polite'); status.textContent = '默认展开根层；深层内容按需生成'
        section.append(status)
      } else {
        const unavailable = document.createElement('div'); unavailable.className = 'raw-empty'
        if (state.rawLoadingKey === key) {
          unavailable.textContent = '正在按需读取这一次调用的完整输入…'
        } else if (state.rawErrorKey === key) {
          const message = document.createElement('span'); message.textContent = state.rawLoadError
          const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = '重试'; retry.style.marginLeft = '10px'
          retry.addEventListener('click', () => {
            state.rawErrorKey = null
            state.rawLoadError = null
            state.detailSignature = null
            void ensureRawInput(item)
            renderDetail(item)
          })
          unavailable.append(message, retry)
        } else if (item.rawState === 'available') {
          unavailable.textContent = '本次完整输入未返回。'
        } else {
          unavailable.textContent = '正文不可用。若需要查看，请将 captureInput 设为 full；已淘汰或超限的输入不会恢复。'
        }
        section.append(unavailable)
      }
      root.append(section)
    }
    function renderDetail(item) {
      const signature = detailSignature(item)
      if (state.renderedDetailId === item.id && state.detailSignature === signature) return
      const sameAttempt = state.renderedDetailId === item.id
      const scroll = byId('detailScroll')
      const scrollTop = sameAttempt ? scroll.scrollTop : 0
      const root = byId('detailBody')
      root.className = 'detail-body'
      root.replaceChildren()
      byId('detailTitle').textContent = item.id + ' · ' + (purposeName[item.purpose] || item.purpose)
      byId('detailSub').textContent = item.provider + '/' + item.model + ' · ' + shortSession(item.sessionId)
      byId('jumpToJson').disabled = false
      byId('focusDetail').disabled = false
      const summary = document.createElement('div'); summary.className = 'detail-summary'; root.append(summary)
      renderProviderEvidence(summary, item)
      let list = factSection(summary, '供应商 Usage 明细')
      addFact(list, '状态', item.status + (item.finishKind ? ' / ' + item.finishKind : ''))
      addFact(list, '用途', purposeName[item.purpose] || item.purpose)
      addFact(list, 'Cache Read', item.usage && item.usage.cacheReadTokens !== undefined ? number(item.usage.cacheReadTokens) + ' (' + percent(item.usage.cacheReadRatio) + ')' : 'Harness usage 未携带（不等于 0）')
      addFact(list, 'Cache Write', item.usage && item.usage.cacheWriteTokens !== undefined ? number(item.usage.cacheWriteTokens) : 'Harness usage 未携带')
      addFact(list, '适配器归一化未缓存', item.usage ? number(item.usage.inputTokens) : '—')
      addFact(list, 'Prompt 总量', item.usage ? number(item.usage.promptTokens) : '—')
      addFact(list, '输出 Token', item.usage ? number(item.usage.outputTokens) : '—')
      addFact(list, 'Call TTFT', ms(item.firstTokenMs))
      addFact(list, '总耗时', ms(item.durationMs))
      list = factSection(summary, '输入结构与前缀')
      addFact(list, '变化判断', changeName[item.diagnosis.kind] || item.diagnosis.kind)
      addFact(list, '本地比较基线', item.diagnosis.comparedTo || '无')
      const comparablePrefix = item.diagnosis.kind !== 'first-observation' && item.diagnosis.kind !== 'route-or-options-changed'
      addFact(list, '稳定 Tools', comparablePrefix ? number(item.diagnosis.stableToolCount) + ' / ' + number(item.input.toolCount) : '无法比较')
      addFact(list, '稳定消息', comparablePrefix ? number(item.diagnosis.stableMessageCount) + ' / ' + number(item.input.messageCount) : '无法比较')
      addFact(list, '消息 / Tools', item.input.messageCount + ' / ' + item.input.toolCount)
      addFact(list, 'System 字节', number(item.input.systemBytes))
      addFact(list, 'Tools 字节', number(item.input.toolsBytes))
      addFact(list, 'Messages 字节', number(item.input.messagesBytes))
      addFact(list, '总逻辑输入字节', number(item.input.totalBytes))
      addFact(list, '整体 HMAC', item.input.overallFingerprint.slice(0, 20) + '…')
      const methodology = document.createElement('details'); methodology.className = 'methodology'
      const methodologyTitle = document.createElement('summary'); methodologyTitle.textContent = '口径说明'
      const methodologyText = document.createElement('p'); methodologyText.textContent = state.snapshot.notes.cacheEvidence + ' 未缓存输入由标准化 Prompt 总量减去 Cache Read/Write 得到。' + ' ' + state.snapshot.notes.prefixEvidence + ' JSON 颜色只表示本地逻辑输入的稳定、差异或下游区域，不是供应商 Token offset。' + ' ' + state.snapshot.notes.timingEvidence
      methodology.append(methodologyTitle, methodologyText); root.append(methodology)
      renderRawSection(root, item)
      state.renderedDetailId = item.id
      state.detailSignature = signature
      scroll.scrollTop = scrollTop
    }
    function renderEmptyDetail() {
      state.renderedDetailId = null
      state.detailSignature = null
      state.rawInput = null
      state.rawLoadedKey = null
      state.rawLoadingKey = null
      state.rawErrorKey = null
      state.rawLoadError = null
      byId('detailTitle').textContent = '调用详情'
      byId('detailSub').textContent = '当前筛选下没有记录'
      byId('jumpToJson').disabled = true
      byId('focusDetail').disabled = true
      const root = byId('detailBody'); root.className = 'empty'; root.textContent = '这里会显示 Token 证据、分段指纹和本次完整逻辑输入。'
    }
    function renderWorkspace() {
      const items = visibleAttempts()
      let selected = items.find(item => item.id === state.selectedId)
      if (!selected && items.length) {
        resetDetailState(items[0].id)
        selected = items[0]
      } else if (!selected) {
        state.selectedId = null
      }
      renderRows()
      if (selected) {
        syncRawState(selected)
        void ensureRawInput(selected)
        renderDetail(selected)
      }
      else renderEmptyDetail()
    }
    function showLiveState(text) {
      byId('liveState').textContent = state.paused ? '已暂停 · ' + text : text
    }
    async function reload(force) {
      if (state.paused && !force) return
      if (state.reloading) return
      state.reloading = true
      try {
        const response = await fetch(API, { cache:'no-store', credentials:'same-origin' })
        if (!response.ok) throw new Error('HTTP ' + response.status)
        state.snapshot = await response.json()
        state.lastUpdatedLabel = new Date(state.snapshot.generatedAt).toLocaleTimeString('zh-CN', { hour12:false })
        showLiveState('已连接 · ' + state.lastUpdatedLabel)
        renderFilters(); renderSummary(); renderWorkspace()
      } catch (error) {
        showLiveState('连接失败 · ' + (error && error.message ? error.message : String(error)))
      } finally {
        state.reloading = false
      }
    }
    function renderFilteredWorkspace() { renderSummary(); renderWorkspace() }
    byId('sessionFilter').addEventListener('change', renderFilteredWorkspace)
    byId('providerFilter').addEventListener('change', renderFilteredWorkspace)
    byId('modelFilter').addEventListener('change', renderFilteredWorkspace)
    byId('purposeFilter').addEventListener('change', renderFilteredWorkspace)
    byId('statusFilter').addEventListener('change', renderFilteredWorkspace)
    byId('evidenceFilter').addEventListener('change', renderFilteredWorkspace)
    byId('sortOrder').addEventListener('change', renderFilteredWorkspace)
    byId('queryFilter').addEventListener('input', renderFilteredWorkspace)
    byId('copyDiagnostics').addEventListener('click', () => { void copyFilteredDiagnostics() })
    byId('refreshNow').addEventListener('click', () => { void reload(true) })
    byId('togglePolling').addEventListener('click', () => {
      state.paused = !state.paused
      const button = byId('togglePolling')
      button.textContent = state.paused ? '继续刷新' : '暂停刷新'
      button.setAttribute('aria-pressed', String(state.paused))
      if (state.paused) showLiveState(state.lastUpdatedLabel ? '已连接 · ' + state.lastUpdatedLabel : '等待数据')
      else void reload(true)
    })
    byId('jumpToJson').addEventListener('click', () => {
      const raw = document.querySelector('.raw-section')
      if (raw) raw.scrollIntoView({ block:'start' })
    })
    byId('focusDetail').addEventListener('click', () => {
      const workspace = document.querySelector('.workspace')
      const focused = workspace.classList.toggle('detail-focus')
      byId('focusDetail').textContent = focused ? '返回列表' : '专注详情'
      byId('focusDetail').setAttribute('aria-pressed', String(focused))
    })
    void reload(true)
    setInterval(() => { void reload(false) }, REFRESH_MS)
  </script>
</body>
</html>`
}
