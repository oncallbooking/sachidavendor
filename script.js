/**
 * script.js
 * Excel upload + auto visualization integrated into the existing vendor dashboard.
 *
 * Features implemented:
 * - Drag & drop / file input for .xlsx and .csv
 * - SheetJS (xlsx) used to parse Excel client-side
 * - Auto-detection of headers and numeric/categorical columns
 * - Chart.js rendering: pie, bar, line, bubble (auto suggestions)
 * - Leaflet map centered on India; geocoding via Nominatim (if needed)
 * - Filters, preview table (10-20 rows), export processed data (SheetJS), and print
 * - Basic persistence via localStorage (last dataset)
 *
 * Note: Keep vendor map/filter functionality intact — this is additive.
 */

/* =========================
   Globals & Helpers
   ========================= */
let workbook = null;
let currentSheetName = null;
let currentData = []; // array of row objects
let originalData = []; // copy as loaded
let detectedMeta = { headers: [], numeric: [], categorical: [] };
let mainChart = null;
let mapInstance = null;
let mapMarkersLayer = null;
let lastChartType = 'auto';

// DOM elements
const openUploadBtn = document.getElementById('openUploadBtn');
const uploadModal = new bootstrap.Modal(document.getElementById('uploadModal'));
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const chooseFileBtn = document.getElementById('chooseFileBtn');
const loadFileBtn = document.getElementById('loadFileBtn');
const sheetSelect = document.getElementById('sheetSelect');
const sheetList = document.getElementById('sheetList');
const sheetPreview = document.getElementById('sheetPreview');
const uploadErrors = document.getElementById('uploadErrors');
const chartTypeSelect = document.getElementById('chartTypeSelect');
const refreshChartsBtn = document.getElementById('refreshCharts');
const topNInput = document.getElementById('topN');
const previewTableWrapper = document.getElementById('previewTableWrapper');
const previewTableContainer = document.getElementById('previewTableContainer');
const mainChartCanvas = document.getElementById('mainChart');
const downloadChartBtn = document.getElementById('downloadChartBtn');
const tableSearch = document.getElementById('tableSearch');
const dataTableContainer = document.getElementById('dataTableContainer');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const downloadDataBtn = document.getElementById('downloadDataBtn');
const printDashboardBtn = document.getElementById('printDashboardBtn');
const mapStatus = document.getElementById('mapStatus');
const mapEl = document.getElementById('map');
const filterControls = document.getElementById('filterControls');

// init
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  wireUi();
  tryReloadFromLocal();
});

/* =========================
   UI wiring
   ========================= */
function wireUi() {
  openUploadBtn.addEventListener('click', () => {
    uploadErrors.style.display = 'none';
    fileInput.value = '';
    sheetSelect.innerHTML = '';
    sheetPreview.style.display = 'none';
    loadFileBtn.disabled = true;
    uploadModal.show();
  });

  chooseFileBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileChosen);

  ;['dragenter','dragover'].forEach(ev => {
    dropZone.addEventListener(ev, e => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });
  ;['dragleave','drop'].forEach(ev => {
    dropZone.addEventListener(ev, e => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', e => {
    const files = (e.dataTransfer && e.dataTransfer.files) || [];
    if (files.length) {
      fileInput.files = files;
      handleFileChosen();
    }
  });

  loadFileBtn.addEventListener('click', () => {
    // load workbook -> populate sheet select -> pick first sheet by default
    if (!workbook) return showUploadError('No file loaded.');
    populateSheetSelect();
    uploadModal.hide();
    // automatically load the first sheet
    const firstSheet = sheetSelect.querySelector('option')?.value;
    if (firstSheet) {
      sheetSelect.value = firstSheet;
      loadSheetToVisualizer(firstSheet);
    }
  });

  sheetSelect.addEventListener('change', () => {
    const s = sheetSelect.value;
    if (s) loadSheetToVisualizer(s);
  });

  refreshChartsBtn.addEventListener('click', () => {
    if (!currentData.length) return alert('No data loaded');
    renderCurrentChart();
  });

  chartTypeSelect.addEventListener('change', () => renderCurrentChart());
  topNInput.addEventListener('change', () => renderCurrentChart());

  downloadChartBtn.addEventListener('click', () => {
    if (!mainChart) return;
    const link = document.createElement('a');
    link.download = `chart-${(new Date()).toISOString()}.png`;
    link.href = mainChart.toBase64Image();
    link.click();
  });

  tableSearch.addEventListener('input', () => renderDataTable());
  exportCsvBtn.addEventListener('click', () => exportProcessedData());
  downloadDataBtn.addEventListener('click', () => exportProcessedData());

  printDashboardBtn.addEventListener('click', () => window.print());
}

/* =========================
   File handling
   ========================= */
function handleFileChosen() {
  uploadErrors.style.display = 'none';
  const f = fileInput.files[0];
  if (!f) return;
  const name = f.name.toLowerCase();
  if (!(/\.(xlsx|xls|csv)$/i.test(name))) {
    return showUploadError('Only .xlsx, .xls, and .csv files are supported.');
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    const data = ev.target.result;
    try {
      if (name.endsWith('.csv')) {
        // parse CSV using PapaParse
        const text = data instanceof ArrayBuffer ? new TextDecoder().decode(data) : data;
        const parsed = Papa.parse(text, { header: true, dynamicTyping: true });
        workbook = { Sheets: { Sheet1: XLSX.utils.sheet_to_json(XLSX.utils.aoa_to_sheet(parsed.data.map(r => Object.values(r)))) }, SheetNames: ['Sheet1'] };
        // simpler: convert parsed.data to object array
        const aoa = [Object.keys(parsed.data[0] || {})].concat(parsed.data.map(r => Object.values(r)));
        workbook = { Sheets: { Sheet1: XLSX.utils.aoa_to_sheet(aoa) }, SheetNames: ['Sheet1'] };
      } else {
        // xlsx parsing
        const arr = new Uint8Array(data);
        workbook = XLSX.read(arr, { type: 'array' });
      }

      // show sheet preview
      sheetPreview.style.display = 'block';
      sheetList.innerHTML = '';
      workbook.SheetNames.forEach((s,i) => {
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';
        item.textContent = s;
        const badge = document.createElement('span');
        badge.className = 'badge bg-primary rounded-pill';
        badge.textContent = 'Sheet ' + (i+1);
        item.appendChild(badge);
        sheetList.appendChild(item);
      });
      loadFileBtn.disabled = false;
      populateSheetSelect(); // immediate selection if desired
      showUploadMessage('File loaded. Choose sheet to view.');
      // store raw workbook in memory but not persist full binary in localStorage
    } catch (err) {
      console.error(err);
      showUploadError('Failed to parse file. Make sure file is valid and not corrupted.');
    }
  };

  if (name.endsWith('.csv')) {
    reader.readAsText(f);
  } else {
    reader.readAsArrayBuffer(f);
  }
}

function showUploadError(msg) {
  uploadErrors.style.display = 'block';
  uploadErrors.textContent = msg;
}

function showUploadMessage(msg) {
  uploadErrors.style.display = 'block';
  uploadErrors.classList.remove('text-danger');
  uploadErrors.classList.add('text-success');
  uploadErrors.textContent = msg;
  setTimeout(() => {
    uploadErrors.style.display = 'none';
    uploadErrors.classList.remove('text-success');
    uploadErrors.classList.add('text-danger');
  }, 2500);
}

function populateSheetSelect() {
  if (!workbook) return;
  sheetSelect.innerHTML = '';
  workbook.SheetNames.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sheetSelect.appendChild(opt);
  });
  sheetSelect.disabled = false;
}

/* =========================
   Load sheet into visualizer
   ========================= */
function loadSheetToVisualizer(sheetName) {
  if (!workbook || !workbook.Sheets[sheetName]) return;
  currentSheetName = sheetName;
  // convert to JSON (array of objects) using SheetJS
  try {
    const ws = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws, { defval: null });
    if (!json || !json.length) {
      alert('Sheet is empty or no rows found.');
      return;
    }
    originalData = json.map(r => ({...r}));
    currentData = originalData.slice();
    detectColumns(currentData);
    renderDataTable();
    renderFilters();
    renderCurrentChart();
    attemptMapPlot(currentData);
    // enable exports
    exportCsvBtn.disabled = false;
    downloadDataBtn.disabled = false;
    // persist minimal dataset (headers + first 200 rows) to localStorage
    try {
      const mini = { sheet: sheetName, preview: currentData.slice(0,200) };
      localStorage.setItem('lastDatasetPreview', JSON.stringify(mini));
    } catch(e){ /* ignore */ }
  } catch (err) {
    console.error(err);
    alert('Failed to load sheet to visualizer: ' + err.message);
  }
}

/* =========================
   Column detection & meta
   ========================= */
function detectColumns(data) {
  const headers = Object.keys(data[0] || {});
  const numeric = [];
  const categorical = [];

  headers.forEach(h => {
    let numericCount = 0, totalCount = 0;
    for (let i=0;i<data.length && i<200;i++){
      const v = data[i][h];
      if (v === null || v === undefined || v === '') { totalCount++; continue; }
      totalCount++;
      if (typeof v === 'number' && !isNaN(v)) numericCount++;
      else if ( !isNaN(parseFloat(v)) && isFinite(v) ) numericCount++;
    }
    if (totalCount>0 && numericCount/totalCount > 0.6) numeric.push(h);
    else categorical.push(h);
  });

  detectedMeta.headers = headers;
  detectedMeta.numeric = numeric;
  detectedMeta.categorical = categorical;
}

/* =========================
   Rendering charts
   ========================= */
function renderCurrentChart() {
  if (!currentData.length) return;
  const chartType = chartTypeSelect.value === 'auto' ? autoSuggestChart() : chartTypeSelect.value;
  lastChartType = chartType;
  previewTableWrapper.style.display = chartType === 'table' ? 'block' : 'none';
  if (chartType === 'table') {
    renderPreviewTable();
    if (mainChart) { mainChart.destroy(); mainChart = null; downloadChartBtn.disabled = true; }
    return;
  }
  const ctx = mainChartCanvas.getContext('2d');

  // choose fields automatically
  const { xField, yField, categoryField } = chooseFieldsForChart(chartType);

  // create dataset according to chosen fields
  let chartConfig = null;
  try {
    if (chartType === 'pie') chartConfig = generatePieConfig(categoryField);
    else if (chartType === 'bar') chartConfig = generateBarConfig(xField, yField);
    else if (chartType === 'line') chartConfig = generateLineConfig(xField, yField);
    else if (chartType === 'bubble') chartConfig = generateBubbleConfig();
  } catch (err) {
    console.error(err);
    alert('Failed to generate chart: ' + err.message);
    return;
  }

  // destroy previous
  if (mainChart) { try { mainChart.destroy(); } catch(e){} }
  mainChart = new Chart(ctx, chartConfig);
  downloadChartBtn.disabled = false;
}

/* heuristics: choose fields */
function chooseFieldsForChart(type) {
  const numeric = detectedMeta.numeric;
  const cat = detectedMeta.categorical;
  let xField = null, yField = null, categoryField = null;

  if (type === 'pie') {
    categoryField = cat[0] || detectedMeta.headers[0];
  } else if (type === 'bar') {
    // bar: category vs numeric
    categoryField = cat[0] || detectedMeta.headers[0];
    yField = numeric[0] || detectedMeta.headers[1] || categoryField;
    xField = categoryField;
  } else if (type === 'line') {
    // line: try to use date-like header or first numeric sequence
    const dateLike = detectedMeta.headers.find(h => /date|time|month|year/i.test(h));
    xField = dateLike || detectedMeta.headers[0];
    yField = numeric[0] || detectedMeta.headers[1] || detectedMeta.headers[0];
  } else if (type === 'bubble') {
    // need 3 numeric fields ideally
    xField = numeric[0] || detectedMeta.headers[0];
    yField = numeric[1] || numeric[0] || detectedMeta.headers[1] || detectedMeta.headers[0];
    categoryField = detectedMeta.headers.find(h => ![xField,yField].includes(h)) || detectedMeta.headers[0];
  }

  return { xField, yField, categoryField };
}

/* Auto-suggest chart type */
function autoSuggestChart() {
  if (detectedMeta.categorical.length >= 1 && detectedMeta.numeric.length >= 1) return 'bar';
  if (detectedMeta.numeric.length >= 2) return 'bubble';
  if (detectedMeta.categorical.length >= 1 && detectedMeta.numeric.length === 0) return 'pie';
  return 'table';
}

/* Chart generators */
function generatePieConfig(categoryField) {
  const topN = Number(topNInput.value) || 10;
  const counts = {};
  currentData.forEach(r => {
    const k = (r[categoryField] ?? 'Unknown') + '';
    counts[k] = (counts[k] || 0) + 1;
  });
  const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0, topN);
  const labels = entries.map(e=>e[0]);
  const values = entries.map(e=>e[1]);
  return {
    type: 'pie',
    data: { labels, datasets: [{ data: values, label: categoryField }] },
    options: {
      responsive: true,
      plugins: {
        title: { display:true, text: `Distribution by ${categoryField}` },
        legend: { position:'right' }
      }
    }
  };
}

function generateBarConfig(xField, yField) {
  const topN = Number(topNInput.value) || 10;
  // aggregate numeric by category
  const agg = {};
  currentData.forEach(r => {
    const cat = (r[xField] ?? 'Unknown') + '';
    const val = parseFloat(r[yField]) || 0;
    agg[cat] = (agg[cat] || 0) + val;
  });
  const entries = Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,topN);
  const labels = entries.map(e=>e[0]);
  const values = entries.map(e=>e[1]);
  return {
    type: 'bar',
    data: { labels, datasets: [{ label: yField, data: values }] },
    options: {
      responsive: true,
      plugins: { title: { display:true, text: `${yField} by ${xField}` }, legend: { display:false } },
      scales: { x: { ticks:{ autoSkip: false } }, y: { beginAtZero:true } }
    }
  };
}

function generateLineConfig(xField, yField) {
  // sort by xField if it looks like a date or numeric
  const rows = currentData.slice();
  rows.sort((a,b)=>{
    const va = a[xField], vb = b[xField];
    const na = Date.parse(va) || parseFloat(va) || 0;
    const nb = Date.parse(vb) || parseFloat(vb) || 0;
    return na - nb;
  });
  const labels = rows.map(r => (r[xField] ?? '') + '').slice(0,1000);
  const values = rows.map(r => parseFloat(r[yField]) || 0).slice(0,1000);
  return {
    type: 'line',
    data: { labels, datasets: [{ label: yField, data: values, fill:false, tension:0.2 }] },
    options: {
      responsive: true,
      plugins: { title: { display:true, text: `${yField} over ${xField}` }, legend: { display:false } },
      scales: { y: { beginAtZero: true } }
    }
  };
}

function generateBubbleConfig() {
  // bubble: need x,y,r
  const numeric = detectedMeta.numeric;
  const xField = numeric[0] || detectedMeta.headers[0];
  const yField = numeric[1] || numeric[0] || detectedMeta.headers[1] || detectedMeta.headers[0];
  const rField = numeric[2] || numeric[0] || detectedMeta.headers[2] || detectedMeta.headers[0];

  const points = currentData.map(r => {
    const x = parseFloat(r[xField]) || 0;
    const y = parseFloat(r[yField]) || 0;
    const rsize = Math.max(2, Math.min(40, Math.abs(parseFloat(r[rField]) || 1)));
    return { x, y, r: rsize };
  }).slice(0,500);

  return {
    type: 'bubble',
    data: { datasets: [{ label: `${yField} vs ${xField} (size=${rField})`, data: points }] },
    options: {
      responsive: true,
      plugins: { title: { display:true, text: 'Bubble: multi-metric comparison' } },
      scales: { x: { beginAtZero:true }, y: { beginAtZero:true } }
    }
  };
}

/* =========================
   Data preview & table
   ========================= */
function renderPreviewTable() {
  const previewRows = currentData.slice(0, 20);
  previewTableContainer.innerHTML = renderTableFromRows(previewRows);
}

function renderDataTable() {
  const q = (tableSearch.value || '').toLowerCase().trim();
  const rows = currentData.filter(r => {
    if (!q) return true;
    return Object.values(r).some(v => (v === null || v === undefined) ? false : ('' + v).toLowerCase().includes(q));
  });
  dataTableContainer.innerHTML = renderTableFromRows(rows);
  // enable export if rows exist
  exportCsvBtn.disabled = rows.length === 0;
}

function renderTableFromRows(rows) {
  if (!rows || !rows.length) return '<div class="p-3 text-muted">No data</div>';
  const headers = Object.keys(rows[0]);
  let html = '<table class="table table-sm"><thead><tr>';
  headers.forEach(h => html += `<th>${escapeHtml(h)}</th>`);
  html += '</tr></thead><tbody>';
  rows.forEach(r => {
    html += '<tr>';
    headers.forEach(h => html += `<td>${escapeHtml(r[h])}</td>`);
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

/* simple escape */
function escapeHtml(v){ if (v===null || v===undefined) return ''; return (''+v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

/* =========================
   Export processed data (CSV/XLSX)
   ========================= */
function exportProcessedData() {
  if (!currentData || !currentData.length) return alert('No data to export');
  // convert to worksheet
  const ws = XLSX.utils.json_to_sheet(currentData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, currentSheetName || 'Sheet1');
  XLSX.writeFile(wb, `processed-${(new Date()).toISOString().slice(0,19)}.xlsx`);
}

/* =========================
   Map (Leaflet) + geocoding
   ========================= */
function initMap() {
  mapInstance = L.map('map', { zoomControl:true }).setView([22.0, 80.0], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapInstance);
  mapMarkersLayer = L.layerGroup().addTo(mapInstance);
}

/**
 * Attempt to plot points on the India map:
 * - If lat/lon columns exist, plot directly
 * - Else, if state/city-like column exists, geocode unique values via Nominatim
 */
async function attemptMapPlot(rows) {
  mapStatus.textContent = 'Checking for location fields...';
  mapMarkersLayer.clearLayers();

  // detect lat/lon
  const headers = detectedMeta.headers;
  const latKeys = headers.filter(h => /lat|latitude/i.test(h));
  const lonKeys = headers.filter(h => /lon|lng|longitude/i.test(h));
  if (latKeys.length && lonKeys.length) {
    const latK = latKeys[0], lonK = lonKeys[0];
    rows.forEach(r => {
      const lat = parseFloat(r[latK]);
      const lon = parseFloat(r[lonK]);
      if (isFinite(lat) && isFinite(lon)) {
        addMarker(lat, lon, r);
      }
    });
    mapStatus.textContent = 'Plotted lat/lon points';
    fitMapToMarkers();
    return;
  }

  // else find city/state fields
  const placeField = headers.find(h => /city|town|village|state|district|place|location/i.test(h));
  if (!placeField) {
    mapStatus.textContent = 'No location fields found';
    return;
  }

  mapStatus.textContent = `Geocoding unique values in "${placeField}" (this may take a few seconds)`;
  const uniquePlaces = Array.from(new Set(rows.map(r => (r[placeField]||'').toString()).filter(Boolean))).slice(0, 60);
  const geocoded = [];
  for (let i=0;i<uniquePlaces.length;i++){
    const name = uniquePlaces[i];
    try {
      // Nominatim usage policy: throttle requests. Use 1 request every 1000ms to be kinder (may be slow).
      // We add country=India to bias results.
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name + ' India')}&limit=1&addressdetails=1`;
      // small delay between requests to avoid rate limits
      // we use a simple promise delay
      await delay(600); // 600ms delay — adjustable
      const resp = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (!resp.ok) continue;
      const json = await resp.json();
      if (json && json[0]) {
        const lat = parseFloat(json[0].lat), lon = parseFloat(json[0].lon);
        geocoded.push({ name, lat, lon });
      }
    } catch (err) {
      console.warn('geocode failed', name, err);
    }
  }

  // map rows to geocoded coordinates
  rows.forEach(r => {
    const name = (r[placeField]||'').toString();
    const geo = geocoded.find(g => g.name === name);
    if (geo) addMarker(geo.lat, geo.lon, r);
  });

  if (mapMarkersLayer.getLayers().length) {
    mapStatus.textContent = 'Plotted place-based points';
    fitMapToMarkers();
  } else {
    mapStatus.textContent = 'Geocoding found no points (try adding latitude/longitude columns)';
  }
}

function addMarker(lat, lon, row) {
  const marker = L.circleMarker([lat, lon], { radius:6, color:'#3b82f6', fillColor:'#60a5fa', fillOpacity:0.8 });
  const html = renderRowCard(row);
  marker.bindPopup(html, { maxWidth: 320 });
  marker.addTo(mapMarkersLayer);
}

function fitMapToMarkers() {
  if (!mapMarkersLayer || !mapMarkersLayer.getLayers().length) return;
  const group = L.featureGroup(mapMarkersLayer.getLayers());
  mapInstance.fitBounds(group.getBounds().pad(0.2));
}

/* small helper to render row details in popup */
function renderRowCard(row) {
  const lines = Object.entries(row).map(([k,v]) => `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</div>`).join('');
  return `<div style="font-size:0.9rem">${lines}</div>`;
}

function delay(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

/* =========================
   Filters rendering
   ========================= */
function renderFilters() {
  filterControls.innerHTML = '';
  if (!detectedMeta.headers.length) {
    filterControls.innerHTML = '<p class="text-muted small">Upload data to see filters</p>';
    return;
  }
  // create simple filter for first two categorical columns (if present)
  detectedMeta.categorical.slice(0,3).forEach(col => {
    const wrapper = document.createElement('div');
    wrapper.className = 'mb-2';
    const label = document.createElement('label'); label.className = 'form-label small mb-1'; label.textContent = col;
    const sel = document.createElement('select'); sel.className = 'form-select form-select-sm';
    const vals = Array.from(new Set(originalData.map(r => r[col]||'').slice(0,200))).slice(0,40);
    const any = document.createElement('option'); any.value=''; any.textContent = 'All';
    sel.appendChild(any);
    vals.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); });
    sel.addEventListener('change', () => applyFilters());
    wrapper.appendChild(label); wrapper.appendChild(sel);
    filterControls.appendChild(wrapper);
  });
}

/* Apply filters to currentData */
function applyFilters() {
  // read selects
  const selects = filterControls.querySelectorAll('select');
  const criteria = [];
  selects.forEach(sel => {
    const val = sel.value;
    const label = sel.previousElementSibling?.textContent;
    if (val && label) criteria.push({ col: label, val });
  });

  currentData = originalData.filter(r => {
    return criteria.every(c => (r[c.col]??'')+'' === (c.val+''));
  });
  renderDataTable();
  renderCurrentChart();
  attemptMapPlot(currentData);
}

/* =========================
   Small utilities (reload)
   ========================= */
function tryReloadFromLocal(){
  try {
    const raw = localStorage.getItem('lastDatasetPreview');
    if (!raw) return;
    const p = JSON.parse(raw);
    // show small preview message
    console.info('Found saved dataset preview from previous session:', p.sheet);
    // Not automatically loading full dataset (no workbook saved), but we can show hint
  } catch(e){}
}

/* =========================
   Misc helpers
   ========================= */

/* escape in HTML already implemented above */

/* =========================
   End of file
   ========================= */
