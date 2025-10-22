/* script.js
   Fixed + functional integration for your uploaded index.html
   - Handles XLSX/CSV uploads (sheet selection)
   - Auto-detects columns, normalizes rows
   - Renders Chart.js main chart + Leaflet map (#indiaMap)
   - Basic filters, KPIs, exports
*/

(() => {
  // Helpers
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const noop = () => {};

  // Elements (as in your index.html)
  const uploadBtn = $('#uploadBtn');
  const fileInput = $('#fileInput');
  const uploadModal = $('#uploadModal');
  const closeModal = $('#closeModal');
  const sheetSelect = $('#sheetSelect');
  const loadSelectedSheets = $('#loadSelectedSheets');
  const welcomeScreen = $('#welcomeScreen');
  const chartsGrid = $('#chartsGrid');
  const controlsPanel = $('#controlsPanel');
  const chartTypeSel = $('#chartType');
  const topNInput = $('#topN');
  const chartTitle = $('#chartTitle');
  const mainChartCanvas = $('#mainChart');
  const indiaMapEl = $('#indiaMap');
  const mapStatus = $('#mapStatus');
  const downloadChartBtn = $('#downloadChart');
  const themeToggle = $('#themeToggle');
  const rowCountEl = $('#rowCount');
  const colCountEl = $('#colCount');
  const quickStats = $('#quickStats');
  const filtersSection = $('#filtersSection');
  const filterContainer = $('#filterContainer');
  const exportSection = $('#exportSection');
  const dataTableEl = $('#dataTable');
  const tableSection = $('#tableSection');

  // State
  let workbookSheets = []; // {name, data: array of objects}
  let currentRows = [];    // normalized rows
  let map, markersLayer;
  let mainChart;
  let currentTheme = localStorage.getItem('dv-theme') || 'light';

  // Column fuzzy map
  const colMap = {
    name: ['vendor', 'vendorname', 'name', 'supplier'],
    lat: ['lat','latitude','y'],
    lon: ['lon','lng','longitude','x'],
    city: ['city','town'],
    region: ['region','country','area'],
    spend: ['spend','totalspend','sales','amount','total_spend','total_spend_usd'],
    payments: ['payments','totalpayments','paid'],
    invoices: ['invoicecount','invoices','invoice_count','invoice'],
    paymentType: ['paymenttype','payment_method','payment'],
    hasPO: ['haspo','po','purchaseorder','has_purchase_order'],
    date: ['date','invoicedate','invoice_date','paymentdate']
  };

  function fuzzyFind(header) {
    if(!header) return null;
    const key = String(header).trim().toLowerCase().replace(/\s|\.|_/g,'');
    for(const k of Object.keys(colMap)) {
      if (colMap[k].includes(key)) return k;
    }
    // fallback heuristic
    if(/lat|lng|lon|longitude|latitude/.test(key)) return key.match(/lat/) ? 'lat' : 'lon';
    return null;
  }

  // UI wiring
  uploadBtn.addEventListener('click', ()=> uploadModal.style.display = 'flex');
  closeModal && closeModal.addEventListener('click', ()=> uploadModal.style.display = 'none');
  fileInput.addEventListener('change', handleFileInput);
  loadSelectedSheets && loadSelectedSheets.addEventListener('click', loadSelectedSheetData);
  downloadChartBtn && downloadChartBtn.addEventListener('click', ()=> {
    if (!mainChart) return alert('Chart not ready');
    const a = document.createElement('a'); a.href = mainChart.toBase64Image(); a.download = 'chart.png'; a.click();
  });

  themeToggle && themeToggle.addEventListener('click', ()=>{
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.classList.toggle('theme-dark', currentTheme==='dark');
    localStorage.setItem('dv-theme', currentTheme);
  });

  chartTypeSel && chartTypeSel.addEventListener('change', renderMainChart);
  topNInput && topNInput.addEventListener('change', renderMainChart);

  // File handling
  async function handleFileInput(e) {
    const file = e.target.files[0];
    if(!file) return;
    resetUIForUpload();
    const name = file.name.toLowerCase();
    if(name.endsWith('.csv')) {
      const text = await file.text();
      const parsed = Papa.parse(text, {header:true, skipEmptyLines:true});
      workbookSheets = [{ name: 'CSV', data: parsed.data }];
      populateSheetSelect();
    } else if(name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, {type:'array'});
      workbookSheets = wb.SheetNames.map(sn => {
        const ws = wb.Sheets[sn];
        return { name: sn, data: XLSX.utils.sheet_to_json(ws, {defval: ''}) };
      });
      populateSheetSelect();
    } else {
      alert('Unsupported file type. Please upload CSV or Excel (.xlsx/.xls).');
    }
  }

  function resetUIForUpload() {
    // show sheet selector container inside modal
    $('#sheetSelector').style.display = 'none';
    $('#uploadProgress').style.display = 'none';
    // clear previous
    sheetSelect.innerHTML = '';
  }

  function populateSheetSelect() {
    if(!sheetSelect) return;
    sheetSelect.innerHTML = '';
    workbookSheets.forEach((s, idx) => {
      const opt = document.createElement('option');
      opt.value = idx; opt.textContent = s.name;
      sheetSelect.appendChild(opt);
    });
    // show sheets UI in modal
    $('#sheetSelector').style.display = 'block';
    uploadModal.style.display = 'flex';
  }

  function loadSelectedSheetData(){
    const selIdx = Number(sheetSelect.value || 0);
    const sheet = workbookSheets[selIdx];
    if(!sheet) { alert('No sheet selected'); return; }
    currentRows = normalizeRows(sheet.data);
    uploadModal.style.display = 'none';
    postLoadUI();
  }

  // Normalize rows: attempt to map columns
  function normalizeRows(raw) {
    if(!raw || !raw.length) return [];
    const headers = Object.keys(raw[0]);
    // build mapping
    const mapping = {};
    headers.forEach(h => {
      const f = fuzzyFind(h);
      if(f) mapping[f] = h;
    });
    // fallback picks
    if(!mapping.name) mapping.name = headers.find(h=>/name|vendor|supplier/i.test(h)) || headers[0];
    if(!mapping.lat) mapping.lat = headers.find(h=>/lat|latitude/i.test(h));
    if(!mapping.lon) mapping.lon = headers.find(h=>/lon|lng|longitude/i.test(h));

    // sanitize rows
    const out = raw.map((r, i) => {
      const lat = Number(String(r[mapping.lat] ?? '').replace(/,/g,'')) || null;
      const lon = Number(String(r[mapping.lon] ?? '').replace(/,/g,'')) || null;
      const dateRaw = r[mapping.date] ?? r['InvoiceDate'] ?? r['Date'] ?? null;
      const parsedDate = dateRaw ? new Date(dateRaw) : null;
      return {
        __idx: i,
        name: String(r[mapping.name] ?? 'Unknown'),
        lat,
        lon,
        city: String(r[mapping.city] ?? ''),
        region: String(r[mapping.region] ?? ''),
        spend: Number(String(r[mapping.spend] ?? 0).replace(/[,₹$]/g,'')) || 0,
        payments: Number(String(r[mapping.payments] ?? 0).replace(/[,₹$]/g,'')) || 0,
        invoices: Number(String(r[mapping.invoices] ?? 0)) || 0,
        paymentType: String(r[mapping.paymentType] ?? r['PaymentType'] ?? 'Unknown'),
        hasPO: String(r[mapping.hasPO] ?? '').toLowerCase().startsWith('t') || String(r[mapping.hasPO]??'').toLowerCase()==='yes',
        date: isNaN(parsedDate) ? null : parsedDate,
        raw: r
      };
    });
    // filter out rows without lat/lon (inform user)
    const geocount = out.filter(r => r.lat !== null && r.lon !== null).length;
    if(geocount === 0) {
      mapStatus.textContent = 'No geolocation found';
    } else {
      mapStatus.textContent = `${geocount} geolocated rows`;
    }
    return out;
  }

  // After load: show UI sections, KPIs, charts, map
  function postLoadUI() {
    // hide welcome, show grids
    welcomeScreen.style.display = 'none';
    chartsGrid.style.display = 'grid';
    controlsPanel.style.display = 'flex';
    quickStats.style.display = 'block';
    filtersSection.style.display = 'block';
    exportSection.style.display = 'block';
    tableSection.style.display = 'block';

    rowCountEl.textContent = currentRows.length;
    colCountEl.textContent = Object.keys(currentRows[0]?.raw ?? {}).length || 0;

    buildFilters();
    renderKPIs();
    renderMainChart();
    renderMap();
    renderDataTable();
  }

  // KPIs
  function renderKPIs() {
    const totalVendors = new Set(currentRows.map(r=>r.name)).size;
    const totalInvoices = currentRows.reduce((s,r)=>s + (r.invoices||0), 0);
    const totalSpendM = currentRows.reduce((s,r)=>s + (r.spend||0), 0)/1_000_000;
    // Write into quickStats area
    $('#dashboardTitle').textContent = `Dataset: ${workbookSheets[sheetSelect.value||0].name}`;
    // Quick stat cards are already wired via rowCount/colCount; create small header KPIs
    // We'll add simple document-level elements:
    let kpiWrap = $('#kpiWrap');
    if(!kpiWrap) {
      kpiWrap = document.createElement('div'); kpiWrap.id = 'kpiWrap';
      kpiWrap.style.display = 'flex'; kpiWrap.style.gap='12px'; kpiWrap.style.margin='10px 0';
      $('.header-left').appendChild(kpiWrap);
    }
    kpiWrap.innerHTML = `
      <div style="background:#fff;padding:10px;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.06)">
        <div style="font-size:12px;color:#666">Vendors</div>
        <div style="font-weight:700">${totalVendors}</div>
      </div>
      <div style="background:#fff;padding:10px;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.06)">
        <div style="font-size:12px;color:#666">Invoices</div>
        <div style="font-weight:700">${totalInvoices}</div>
      </div>
      <div style="background:#fff;padding:10px;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.06)">
        <div style="font-size:12px;color:#666">Total Spend ($M)</div>
        <div style="font-weight:700">${totalSpendM.toFixed(2)}</div>
      </div>
    `;
  }

  // Build simple filters (region / paymentType)
  function buildFilters() {
    filterContainer.innerHTML = '';
    const regions = Array.from(new Set(currentRows.map(r=>r.region||'Unknown'))).sort();
    const ptypes = Array.from(new Set(currentRows.map(r=>r.paymentType||'Unknown'))).sort();

    const regWrap = document.createElement('div'); regWrap.className='filter-block';
    regWrap.innerHTML = `<div style="font-weight:600;margin-bottom:6px">Region</div>`;
    regions.forEach(r => {
      const id = 'f_reg_' + r.replace(/\s/g,'_');
      const row = document.createElement('div');
      row.innerHTML = `<label style="display:flex;align-items:center;gap:8px"><input type="checkbox" checked data-filter="region" value="${r}"> ${r}</label>`;
      regWrap.appendChild(row);
    });
    filterContainer.appendChild(regWrap);

    const payWrap = document.createElement('div'); payWrap.className='filter-block';
    payWrap.innerHTML = `<div style="font-weight:600;margin-bottom:6px">Payment Type</div>`;
    ptypes.forEach(p => {
      const row = document.createElement('div');
      row.innerHTML = `<label style="display:flex;align-items:center;gap:8px"><input type="checkbox" checked data-filter="paymentType" value="${p}"> ${p}</label>`;
      payWrap.appendChild(row);
    });
    filterContainer.appendChild(payWrap);

    // hook filters
    filterContainer.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', ()=>{
      applyFiltersAndRefresh();
    }));
  }

  function getActiveFilters() {
    const active = { region: null, paymentType: null };
    const regionChecks = Array.from(filterContainer.querySelectorAll('input[data-filter="region"]'));
    const activeRegions = regionChecks.filter(c=>c.checked).map(c=>c.value);
    const payChecks = Array.from(filterContainer.querySelectorAll('input[data-filter="paymentType"]'));
    const activePays = payChecks.filter(c=>c.checked).map(c=>c.value);
    active.region = activeRegions.length === 0 ? null : activeRegions;
    active.paymentType = activePays.length === 0 ? null : activePays;
    return active;
  }

  function applyFiltersAndRefresh() {
    const f = getActiveFilters();
    // filter rows
    const filtered = currentRows.filter(r => {
      if(f.region && !f.region.includes(r.region)) return false;
      if(f.paymentType && !f.paymentType.includes(r.paymentType)) return false;
      return true;
    });
    // use filtered for charts/map/table
    renderMainChart(filtered);
    renderMap(filtered);
    renderDataTable(filtered);
  }

  // Render main chart: auto detection
  function renderMainChart(rows = currentRows) {
    if(!rows) rows = currentRows;
    if(!rows || rows.length===0) {
      chartTitle.textContent = 'No data';
      return;
    }
    const type = chartTypeSel.value === 'auto' ? autoDetectChartType(rows) : chartTypeSel.value;
    chartTitle.textContent = type === 'bar' ? 'Top Vendors by Spend' : type === 'line' ? 'Payments Over Time' : 'Distribution';

    const ctx = mainChartCanvas.getContext('2d');
    // build datasets for common types
    if(mainChart) { mainChart.destroy(); mainChart = null; }

    if(type === 'bar') {
      // top N vendors by spend
      const topN = Math.max(5, Number(topNInput.value||10));
      const byVendor = {};
      rows.forEach(r => byVendor[r.name] = (byVendor[r.name] || 0) + (r.spend||0));
      const arr = Object.entries(byVendor).map(([k,v])=>({k,v})).sort((a,b)=>b.v-a.v).slice(0, topN);
      mainChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: arr.map(a=>a.k), datasets: [{ label: 'Spend', data: arr.map(a=>a.v) }] },
        options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
      });
      // hover sync
      mainChart.canvas.addEventListener('mousemove', (ev)=> {
        const points = mainChart.getElementsAtEventForMode(ev, 'nearest', { intersect: true }, false);
        if(points && points.length) {
          const idx = points[0].index;
          const vendorName = mainChart.data.labels[idx];
          highlightMapForVendor(vendorName);
        } else {
          renderMap(rows);
        }
      });
    } else if(type === 'line') {
      // payments over time (monthly)
      const monthly = {};
      rows.forEach(r => {
        if(!r.date) return;
        const m = `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,'0')}`;
        monthly[m] = (monthly[m]||0) + (r.payments||0);
      });
      const months = Object.keys(monthly).sort();
      mainChart = new Chart(ctx, {
        type: 'line',
        data: { labels: months, datasets: [{ label: 'Payments', data: months.map(m=>monthly[m]) }] },
        options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
      });
      mainChart.canvas.addEventListener('mousemove', (ev)=> {
        const pts = mainChart.getElementsAtEventForMode(ev, 'nearest', { intersect:true }, false);
        if(pts && pts.length) {
          const idx = pts[0].index; const month = mainChart.data.labels[idx];
          highlightMapForMonth(month);
        } else renderMap(rows);
      });
    } else {
      // default: pie by paymentType
      const byType = {};
      rows.forEach(r => byType[r.paymentType] = (byType[r.paymentType]||0) + (r.spend||0));
      const labels = Object.keys(byType);
      const data = labels.map(l=>byType[l]);
      mainChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data }] },
        options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}} }
      });
      mainChart.canvas.addEventListener('mousemove', (ev)=> {
        const p = mainChart.getElementsAtEventForMode(ev, 'nearest', { intersect:true }, false);
        if(p && p.length) {
          const idx = p[0].index; const label = mainChart.data.labels[idx];
          highlightMapByPaymentType(label);
        } else renderMap(rows);
      });
    }
  }

  function autoDetectChartType(rows) {
    // if there are dates -> line, else if many categories vendor names -> bar, else pie
    const hasDates = rows.some(r => r.date);
    if(hasDates) return 'line';
    const uniqueVendors = new Set(rows.map(r=>r.name)).size;
    if(uniqueVendors > Math.max(8, rows.length * 0.2)) return 'bar';
    return 'pie';
  }

  // Map rendering (Leaflet)
  function renderMap(rows = currentRows) {
    if(!rows) rows = currentRows;
    if(!indiaMapEl) return;
    if(!map) {
      map = L.map(indiaMapEl, {minZoom:2}).setView([22.0,78.0], 3);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(map);
      markersLayer = L.markerClusterGroup();
      map.addLayer(markersLayer);
    }
    markersLayer.clearLayers();
    rows.forEach(r => {
      if(r.lat === null || r.lon === null) return;
      const marker = L.circleMarker([r.lat, r.lon], { radius:6, color:'#2563eb', fillOpacity:0.9 });
      marker.bindTooltip(`<strong>${escapeHtml(r.name)}</strong><br>${escapeHtml(r.city)} • ${escapeHtml(r.region)}<br>Spend: $${(r.spend||0).toLocaleString()}`);
      marker.on('click', ()=> {
        L.popup({maxWidth:300})
          .setLatLng([r.lat,r.lon])
          .setContent(`<div style="min-width:220px">
            <h4 style="margin:0 0 6px 0">${escapeHtml(r.name)}</h4>
            <div><strong>City:</strong> ${escapeHtml(r.city)}</div>
            <div><strong>Region:</strong> ${escapeHtml(r.region)}</div>
            <div><strong>Spend:</strong> $${(r.spend||0).toLocaleString()}</div>
            <div><strong>Payment:</strong> ${escapeHtml(r.paymentType)}</div>
            <div><strong>Invoices:</strong> ${r.invoices}</div>
          </div>`).openOn(map);
      });
      marker.__vendorName = r.name;
      marker.__date = r.date ? `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,'0')}` : null;
      markersLayer.addLayer(marker);
    });
    // fit map to markers if any
    try {
      const all = markersLayer.getLayers();
      if(all.length === 1) map.setView(all[0].getLatLng(), 6);
      else if(all.length > 1) {
        const group = L.featureGroup(all);
        map.fitBounds(group.getBounds().pad(0.2));
      }
    } catch (e) { console.warn(e); }
  }

  // Map highlight helpers
  function highlightMapForVendor(name) {
    markersLayer.getLayers().forEach(m => {
      if(m.__vendorName === name) m.setStyle({ radius: 12, color:'#ff7600' });
      else m.setStyle({ radius:6, color:'#2563eb' });
    });
  }
  function highlightMapByPaymentType(pt) {
    markersLayer.getLayers().forEach(m => {
      const row = currentRows.find(r => r.name === m.__vendorName);
      if(row && row.paymentType === pt) m.setStyle({ radius: 12, color:'#ff7600' });
      else m.setStyle({ radius:6, color:'#2563eb' });
    });
  }
  function highlightMapForMonth(month) {
    markersLayer.getLayers().forEach(m => {
      if(m.__date === month) m.setStyle({ radius:12, color:'#ff7600' });
      else m.setStyle({ radius:6, color:'#2563eb' });
    });
  }

  // Table rendering (simple)
  function renderDataTable(rows = currentRows) {
    if(!rows) rows = currentRows;
    dataTableEl.innerHTML = '';
    if(!rows || rows.length === 0) { dataTableEl.innerHTML = '<div>No data</div>'; return; }
    const table = document.createElement('table'); table.style.width='100%'; table.style.borderCollapse='collapse';
    table.className = 'dv-table';
    const thead = document.createElement('thead'); const tbody = document.createElement('tbody');
    const cols = Object.keys(rows[0].raw);
    const trh = document.createElement('tr');
    cols.forEach(c => { const th = document.createElement('th'); th.textContent = c; trh.appendChild(th); });
    thead.appendChild(trh);
    rows.forEach(r => {
      const tr = document.createElement('tr');
      cols.forEach(c => {
        const td = document.createElement('td'); td.textContent = String(r.raw[c] ?? ''); td.style.padding='6px 8px'; tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(thead); table.appendChild(tbody);
    dataTableEl.appendChild(table);
  }

  // Utilities
  function escapeHtml(s) { if(!s) return ''; return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[ch])); }

  // Initialize small sample if no upload after 300ms so user sees layout
  setTimeout(()=>{
    if(welcomeScreen) {
      // nothing automatic here: user will upload; but you can pre-load sample if desired
    }
  },300);

})();
