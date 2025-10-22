:root{
  --bg: #f6f7fb;
  --card: #ffffff;
  --muted: #6b7280;
  --accent: #2563eb;
  --glass: rgba(255,255,255,0.6);
  --shadow: 0 8px 28px rgba(16,24,40,0.08);
  --rounded: 12px;
  --max-width: 1200px;
  --gap: 18px;
}

/* Resetish */
* { box-sizing: border-box; }
html,body { height:100%; margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; background:var(--bg); color:#0f172a; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }
a { color: inherit; text-decoration: none; }

/* Header */
.site-header{
  max-width:var(--max-width);
  margin:20px auto;
  padding:14px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
}
.brand { display:flex; align-items:center; gap:12px; }
.logo { width:56px; height:56px; object-fit:cover; border-radius:10px; box-shadow: var(--shadow); border: 1px solid rgba(0,0,0,0.04); }
.brand-info h1 { margin:0; font-size:1.1rem; letter-spacing: -0.2px; }
.brand-info .muted { margin:0; color:var(--muted); font-size:0.85rem; }

/* Buttons */
.btn { background:var(--card); border:1px solid rgba(15,23,42,0.06); padding:8px 12px; border-radius:10px; display:inline-flex; gap:8px; align-items:center; cursor:pointer; box-shadow:none; font-weight:600; }
.btn .fa { font-size:0.9rem; }
.btn.subtle { background: linear-gradient(180deg,#fff,#fbfdff); }
.btn.file-btn { position:relative; overflow:hidden; }
.btn.file-btn input { position:absolute; left:0; top:0; opacity:0; width:100%; height:100%; cursor:pointer; }

/* Layout */
.main-grid{
  max-width:var(--max-width);
  margin:0 auto 38px;
  padding:0 14px;
  display:grid;
  grid-template-columns: 1fr 420px;
  gap: var(--gap);
}
@media (max-width:1000px){
  .main-grid{ grid-template-columns: 1fr; padding:0 12px; }
}

/* Chart card */
.chart-card{
  background:var(--card);
  border-radius:var(--rounded);
  box-shadow:var(--shadow);
  padding:16px;
  display:flex;
  flex-direction:column;
  min-height:420px;
  overflow:hidden;
}
.chart-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
.chart-body { flex:1 1 auto; display:flex; flex-direction:column; min-height:320px; padding:6px; }
.chart-body canvas { width:100% !important; height:100% !important; }

/* Map card */
.map-card {
  background:var(--card);
  border-radius:var(--rounded);
  box-shadow:var(--shadow);
  overflow:hidden;
  display:flex;
  flex-direction:column;
  min-height:420px;
}
.map-head { padding:16px; border-bottom:1px solid rgba(15,23,42,0.04); }
.map-canvas { flex:1 1 auto; height:100%; min-height:360px; }

/* map canvas specific */
#map { width:100%; height:100%; }

/* Footer */
.site-footer { max-width:var(--max-width); margin:0 auto 40px; padding:10px 14px; color:var(--muted); font-size:0.9rem; text-align:center; }

/* small helpers */
.muted { color:var(--muted); }
.small { font-size:0.85rem; }
.accent { color:var(--accent); font-weight:700; }

/* Popup tweaks */
.leaflet-popup-content { font-size:0.95rem; line-height:1.3; color:#07203a; }
.vendor-popup .title { font-weight:700; margin-bottom:6px; }
.vendor-popup .meta { color:var(--muted); font-size:0.88rem; margin-bottom:8px; }
.vendor-popup .kpi { display:flex; gap:10px; margin-top:6px; }
.vendor-popup .kpi .pill { background:#f3f6ff; color:var(--accent); padding:6px 8px; border-radius:8px; font-weight:700; font-size:0.86rem; }

/* Fullscreen mode: chart-card gets .fullscreen toggled */
.chart-card.fullscreen {
  position:fixed;
  top:20px;
  left:20px;
  right:20px;
  bottom:20px;
  z-index:2200;
  display:grid;
  grid-template-columns: 1fr 420px;
  gap:16px;
  padding:18px;
  background:var(--card);
  border-radius:16px;
  box-shadow: 0 28px 64px rgba(2,6,23,0.4);
}
@media (max-width:900px){
  .chart-card.fullscreen { grid-template-columns:1fr; }
}

/* map inside fullscreen should fill */
.chart-card.fullscreen + .map-card { display:none; } /* when chart fullscreen, hide right column map-card (we show internal map) */
/* create a map placeholder inside chart-card when fullscreen via #popupMap (script will move/reuse map) */
#popupMap { width:100%; height:100%; border-radius:10px; }

/* utility code block look */
code { background: rgba(2,6,23,0.04); padding: 3px 6px; border-radius:6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", monospace; font-size:0.88rem; }

/* subtle focus */
[tabindex] { outline: none; }
[tabindex]:focus { box-shadow: 0 0 0 4px rgba(37,99,235,0.12); border-radius:8px; }
