/* Global Vendor Intelligence Dashboard - script.js */

/* Basic helpers */
const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));

let vendors = []; // normalized vendor objects
let map, markerCluster, markers = [];
let tileLight, tileDark;
let charts = {};
let state = {mode: 'auto', theme: localStorage.getItem('gvid-theme') || 'light'};

/* Sample CSV dataset (used when user clicks "Load Sample") */
const sampleCSV = `VendorName,Latitude,Longitude,City,Region,TotalSpend,TotalPayments,InvoiceCount,PaymentType,HasPO,InvoiceDate
Acme Supplies,37.7749,-122.4194,San Francisco,North America,1250000,1200000,75,Credit,TRUE,2024-02-10
Global Components,51.5074,-0.1278,London,EMEA,980000,980000,40,Wire,TRUE,2024-03-14
Asia Parts Co,1.3521,103.8198,Singapore,APAC,420000,400000,28,Credit,FALSE,2024-01-20
Continental Traders,-33.8688,151.2093,Sydney,APAC,780000,770000,32,Wire,TRUE,2024-04-02
Nordic Supplies,59.3293,18.0686,Stockholm,EMEA,330000,330000,18,Card,FALSE,2024-05-12
`;

/* Column fuzzy mapping for auto-detection */
const colMap = {
  name: ['vendor', 'vendorname', 'name', 'supplier'],
  lat: ['lat','latitude','y'],
  lon: ['lon','lng','longitude','x'],
  city: ['city','town'],
  region: ['region','country','area'],
  spend: ['spend','totalspend','sales','amount','total_spend'],
  payments: ['payments','totalpayments','paid'],
  invoices: ['invoicecount','invoices','invoice_count','invoice'],
  paymentType: ['paymenttype','payment_method','payment'],
  hasPO: ['haspo','po','purchaseorder','has_purchase_order'],
  date: ['date','invoicedate','invoice_date']
};

function fuzzyFind(col){
  if(!col) return null;
  const key = col.trim().toLowerCase().replace(/\s|\.|_/g,'');
  for(const k in colMap){
    if(colMap[k].includes(key)) return k;
  }
  return null;
}

/* UI init */
function initUI(){
  qs('#file-input').addEventListener('change', handleFile);
  qs('#sample-btn').addEventListener('click', ()=>parseCSV(sampleCSV));
  qs('#theme-toggle').addEventListener('click', toggleTheme);
  qs('#mode-select').addEventListener('change', (e)=>{state.mode=e.target.value; renderAll();});
  qs('#fullscreen-btn').addEventListener('click', ()=>document.documentElement.requestFullscreen());
  qsa('.filter-checkbox').forEach(cb=>cb.addEventListener('change', renderAll));
  if(state.theme === 'dark') document.body.classList.add('dark');
}

/* Map init */
function initMap(){
  map = L.map('map', {minZoom:2, worldCopyJump:true}).setView([20,0],2);
  tileLight = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19});
  tileDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {maxZoom:19});
  (state.theme === 'dark' ? tileDark : tileLight).addTo(map);
  markerCluster = L.markerClusterGroup();
  map.addLayer(markerCluster);
}

/* Theme toggle persisted */
function toggleTheme(){
  if(document.body.classList.contains('dark')){
    document.body.classList.remove('dark');
    state.theme='light';
    try{ tileLight.addTo(map); tileDark.remove(); } catch(e){}
  } else {
    document.body.classList.add('dark');
    state.theme='dark';
    try{ tileDark.addTo(map); tileLight.remove(); } catch(e){}
  }
  localStorage.setItem('gvid-theme', state.theme);
}

/* File parsing (CSV/XLSX) */
async function handleFile(e){
  const file = e.target.files[0];
  if(!file) return;
  const name = file.name.toLowerCase();
  showLoading(true,'Parsing file...');
  if(name.endsWith('.csv')){
    const text = await file.text();
    parseCSV(text);
  } else if(name.endsWith('.xlsx') || name.endsWith('.xls')){
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const first = wb.Sheets[wb.SheetNames[0]];
    const csv = XLSX.utils.sheet_to_csv(first);
    parseCSV(csv);
  } else {
    alert('Unsupported file type');
  }
}

/* Minimal loading indicator (document title) */
function showLoading(show, msg=''){
  document.title = show ? `Loading... ${msg}` : 'Global Vendor Intelligence Dashboard';
}

/* Parse CSV and normalize rows */
function parseCSV(csvText){
  showLoading(true,'Parsing CSV');
  const parsed = Papa.parse(csvText.trim(), {header:true, skipEmptyLines:true});
  const raw = parsed.data;
  if(!raw || raw.length===0){ showLoading(false); alert('No rows found'); return; }

  const headers = Object.keys(raw[0]);
  const mapping = {};
  for(const h of headers){
    const f = fuzzyFind(h);
    if(f) mapping[f]=h;
  }

  if(!mapping.name){ mapping.name = headers.find(h=>/name|vendor|supplier/i.test(h)) || headers[0]; }
  if(!mapping.lat || !mapping.lon){
    const maybeLat = headers.find(h=>/lat|latitude/i.test(h));
    const maybeLon = headers.find(h=>/lon|lng|longitude/i.test(h));
    mapping.lat = mapping.lat || maybeLat;
    mapping.lon = mapping.lon || maybeLon;
  }

  vendors = raw.map((r,idx)=>{
    const v = {
      id: idx,
      name: r[mapping.name] || 'Unknown',
      lat: parseFloat(r[mapping.lat]) || null,
      lon: parseFloat(r[mapping.lon]) || null,
      city: r[mapping.city]||'',
      region: r[mapping.region]||'',
      spend: parseFloat(r[mapping.spend]) || 0,
      payments: parseFloat(r[mapping.payments]) || 0,
      invoices: parseInt(r[mapping.invoices]) || 0,
      paymentType: r[mapping.paymentType] || 'Unknown',
      hasPO: (String(r[mapping.hasPO]||'').toLowerCase().startsWith('t')),
      date: r[mapping.date] ? new Date(r[mapping.date]) : null,
      raw: r
    };
    return v;
  }).filter(v=>v.lat!==null && v.lon!==null);

  showLoading(false);
  if(vendors.length===0){ alert('No geolocated rows found. Ensure Lat/Lon columns are present.'); return; }

  renderAll();
}

/* Render pipeline */
function renderAll(){
  updateKPIs();
  renderMap();
  renderCharts();
}

/* KPIs */
function updateKPIs(){
  const totalV = vendors.length;
  const totalInvoices = vendors.reduce((s,v)=>s+ (v.invoices||0),0);
  const totalSpend = vendors.reduce((s,v)=>s+ (v.spend||0),0)/1_000_000;
  const totalPayments = vendors.reduce((s,v)=>s+ (v.payments||0),0)/1_000_000;
  const percentPO = Math.round((vendors.filter(v=>v.hasPO).length/Math.max(1,totalV))*100);
  animateValue('#total-vendors', totalV);
  animateValue('#total-invoices', totalInvoices);
  animateValue('#total-spend', Number(totalSpend.toFixed(2)));
  animateValue('#total-payments', Number(totalPayments.toFixed(2)));
  qs('#percent-po').textContent = percentPO + '%';
}

/* Simple counter animation */
function animateValue(selector, val){
  const el = qs(selector);
  if(!el) return;
  const start = Number(el.dataset.current) || 0;
  const end = Number(val);
  const dur = 400;
  const startTime = performance.now();
  function step(now){
    const t = Math.min(1, (now-startTime)/dur);
    const cur = Math.round((end-start)*t + start);
    el.textContent = cur;
    if(t<1) requestAnimationFrame(step);
    else el.dataset.current = end;
  }
  requestAnimationFrame(step);
}

/* Map rendering + clustering */
function renderMap(){
  if(!map) initMap();
  markerCluster.clearLayers();
  markers = [];
  vendors.forEach(v=>{
    const m = L.circleMarker([v.lat,v.lon],{radius:8,fillOpacity:0.9,color:state.theme==='dark'?'#60a5fa':'#2563eb',weight:1});
    m.bindTooltip(`<strong>${escapeHtml(v.name)}</strong><br>${escapeHtml(v.city)} — $${(v.spend||0).toLocaleString()}`);
    m.on('click', ()=>openPortfolio(v));
    m.vendorId = v.id;
    markers.push(m);
    markerCluster.addLayer(m);
  });
  try{
    const group = new L.featureGroup(markers);
    if(markers.length===1) map.setView(markers[0].getLatLng(),6);
    else map.fitBounds(group.getBounds().pad(0.2));
  } catch(e){}
}

/* Portfolio popup on click */
function openPortfolio(v){
  const html = `
    <div style="min-width:240px">
      <h3 style="margin:0 0 6px 0">${escapeHtml(v.name)}</h3>
      <div><strong>City:</strong> ${escapeHtml(v.city)}</div>
      <div><strong>Region:</strong> ${escapeHtml(v.region)}</div>
      <div><strong>Total Spend:</strong> $${(v.spend||0).toLocaleString()}</div>
      <div><strong>Total Payments:</strong> $${(v.payments||0).toLocaleString()}</div>
      <div><strong>Invoices:</strong> ${v.invoices}</div>
      <div><strong>Payment Type:</strong> ${escapeHtml(v.paymentType)}</div>
    </div>
  `;
  L.popup({maxWidth:320}).setLatLng([v.lat,v.lon]).setContent(html).openOn(map);
}

/* Charts rendering (Chart.js) */
function renderCharts(){
  const topN = 10;
  const sorted = vendors.slice().sort((a,b)=>b.spend - a.spend).slice(0,topN);
  const labels = sorted.map(v=>v.name);
  const data = sorted.map(v=>v.spend);

  if(charts.bar){ charts.bar.data.labels = labels; charts.bar.data.datasets[0].data = data; charts.bar.update(); }
  else{
    const ctx = qs('#barChart').getContext('2d');
    charts.bar = new Chart(ctx, {type:'bar',data:{labels, datasets:[{label:'Spend',data,backgroundColor:labels.map(()=>undefined)}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},onHover:barHover}});
  }

  const byPayment = vendors.reduce((acc,v)=>{acc[v.paymentType] = (acc[v.paymentType]||0)+v.spend; return acc;},{});
  const pLabels = Object.keys(byPayment);
  const pData = pLabels.map(k=>byPayment[k]);
  if(charts.pie){ charts.pie.data.labels = pLabels; charts.pie.data.datasets[0].data = pData; charts.pie.update(); }
  else{
    const ctx2 = qs('#pieChart').getContext('2d');
    charts.pie = new Chart(ctx2,{type:'doughnut',data:{labels:pLabels,datasets:[{data:pData}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},onHover:pieHover}});
  }

  const hasDates = vendors.some(v=>v.date);
  if(hasDates){
    const monthly = {};
    vendors.forEach(v=>{
      if(!v.date) return;
      const m = `${v.date.getFullYear()}-${(v.date.getMonth()+1).toString().padStart(2,'0')}`;
      monthly[m] = (monthly[m]||0) + (v.payments||0);
    });
    const months = Object.keys(monthly).sort();
    const payments = months.map(m=>monthly[m]);
    if(charts.line){ charts.line.data.labels = months; charts.line.data.datasets[0].data = payments; charts.line.update(); }
    else{
      const ctx3 = qs('#lineChart').getContext('2d');
      charts.line = new Chart(ctx3,{type:'line',data:{labels:months,datasets:[{label:'Payments',data:payments,fill:false, tension:0.3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},onHover:lineHover}});
    }
  } else {
    if(charts.line){ charts.line.data.labels = []; charts.line.data.datasets[0].data = []; charts.line.update(); }
  }
}

/* Map highlighting helpers */
function highlightVendorsByNames(names){
  markers.forEach(m=>m.setStyle({radius:8,opacity:1,fillOpacity:0.9}));
  const nameSet = new Set(names);
  markers.forEach(m=>{
    const v = vendors.find(x=>x.id===m.vendorId);
    if(v && nameSet.has(v.name)) m.setStyle({radius:14,fillOpacity:1});
  });
}

/* Chart hover handlers */
function barHover(evt, elems){
  if(!elems || elems.length===0){
    markers.forEach(m=>m.setStyle({radius:8,fillOpacity:0.9}));
    return;
  }
  const idx = elems[0].index;
  const label = charts.bar.data.labels[idx];
  const names = vendors.filter(v=>v.name===label).map(v=>v.name);
  highlightVendorsByNames(names);
}

function pieHover(evt, elems){
  if(!elems || elems.length===0){ renderMap(); return; }
  const idx = elems[0].index;
  const label = charts.pie.data.labels[idx];
  const names = vendors.filter(v=>v.paymentType===label).map(v=>v.name);
  highlightVendorsByNames(names);
}

function lineHover(evt, elems){
  if(!elems || elems.length===0) return;
  const idx = elems[0].index;
  const month = charts.line.data.labels[idx];
  const names = vendors.filter(v=>v.date && `${v.date.getFullYear()}-${(v.date.getMonth()+1).toString().padStart(2,'0')}`===month).map(v=>v.name);
  highlightVendorsByNames(names);
}

/* Escape user-provided text for HTML insertion */
function escapeHtml(str){
  if(!str) return '';
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[s]));
}

/* Chart export (PNG) */
function exportChartAsImage(chart, filename='chart.png'){
  if(!chart) return;
  const link = document.createElement('a');
  link.href = chart.toBase64Image();
  link.download = filename;
  link.click();
}

/* Map export (basic SVG -> PNG attempt) */
async function exportMapAsImage(filename='map.png'){
  try{
    const svg = document.querySelector('#map svg');
    if(svg){
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svg);
      const canvas = document.createElement('canvas');
      const bbox = svg.getBBox();
      canvas.width = Math.max(800, bbox.width);
      canvas.height = Math.max(400, bbox.height);
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const svgBlob = new Blob([svgStr], {type: 'image/svg+xml;charset=utf-8'});
      const url = URL.createObjectURL(svgBlob);
      await new Promise((res,rej)=>{ img.onload = ()=>res(); img.onerror = rej; img.src = url; });
      ctx.drawImage(img,0,0);
      const link = document.createElement('a'); link.href = canvas.toDataURL('image/png'); link.download = filename; link.click();
      URL.revokeObjectURL(url);
    } else {
      alert('Map snapshot not supported in this browser.');
    }
  } catch(e){ console.error(e); alert('Failed to export map.'); }
}

/* Init on DOM ready */
window.addEventListener('DOMContentLoaded', ()=>{
  initUI();
  initMap();
  document.addEventListener('keydown', (e)=>{
    if(e.ctrlKey && e.key === 'e'){ e.preventDefault(); if(charts.bar) exportChartAsImage(charts.bar,'bar-chart.png'); }
  });
  // show sample dataset by default so the UI is visible
  parseCSV(sampleCSV);
});
