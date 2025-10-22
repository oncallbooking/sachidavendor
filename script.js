/**
 * script.js
 * Main JavaScript for Sachidas Vendors Dashboard (Upload & Charts)
 *
 * - Uses Leaflet for map
 * - Chart.js for charts
 * - SheetJS (XLSX) for client-side Excel/CSV parsing
 *
 * Features:
 * - Sidebar Upload button opens modal
 * - Drag & drop or file select (.xlsx, .xls, .csv)
 * - Auto-detect headers & column types (numeric vs categorical)
 * - Render charts (pie, bar, line, bubble) using Chart.js
 * - Download chart PNG and print functionality
 * - Preview table showing first rows
 *
 * NOTE: This file is modular and well-commented.
 */

/* ============================
   Helper / Utility Functions
   ============================ */

/**
 * Simple DOM selector helpers
 */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/**
 * Infer column types by sampling values
 * @param {Array<Object>} rows - array of objects (header->value)
 * @param {Number} sampleSize - how many rows to sample
 * @returns {Object} mapping header -> 'numeric'|'categorical'
 */
function inferColumnTypes(rows, sampleSize = 30) {
  const types = {};
  if (!rows || rows.length === 0) return types;
  const headers = Object.keys(rows[0]);

  headers.forEach((h) => {
    let numericCount = 0;
    let totalCount = 0;
    for (let i = 0; i < Math.min(sampleSize, rows.length); i++) {
      const v = rows[i][h];
      if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) {
        continue;
      }
      totalCount++;
      // treat if value parses to finite number
      if (!isNaN(Number(String(v).replace(/,/g, '')))) {
        numericCount++;
      }
    }
    // if more than half non-empty that are numeric -> numeric
    types[h] = (totalCount > 0 && numericCount / totalCount >= 0.6) ? 'numeric' : 'categorical';
  });

  return types;
}

/**
 * Creates a shortened slug for ids
 */
function slugify(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
}

/**
 * Create a table showing first rows (limit)
 */
function renderTablePreview(rows = [], limit = 10) {
  const previewContainer = $('#tablePreview');
  previewContainer.innerHTML = '';

  if (!rows || rows.length === 0) {
    previewContainer.innerHTML = '<div class="text-sm text-slate-500">No data to preview.</div>';
    return;
  }

  const template = document.getElementById('tableTemplate');
  const table = template.content.cloneNode(true);
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  const headers = Object.keys(rows[0]);

  // header row
  const headerRow = document.createElement('tr');
  headers.forEach(h => {
    const th = document.createElement('th');
    th.className = 'px-2 py-1 text-left';
    th.textContent = h;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  // body rows
  const displayRows = rows.slice(0, limit);
  displayRows.forEach(r => {
    const tr = document.createElement('tr');
    headers.forEach(h => {
      const td = document.createElement('td');
      td.className = 'px-2 py-1';
      let cell = r[h];
      if (cell === null || cell === undefined) cell = '';
      td.textContent = String(cell);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  previewContainer.appendChild(table);
}

/**
 * Safe parse number (handles commas)
 */
function toNumber(v) {
  if (v === null || v === undefined) return NaN;
  const n = Number(String(v).replace(/,/g, '').trim());
  return isFinite(n) ? n : NaN;
}

/* ============================
   Map & Sample Data (placeholder)
   ============================ */

/**
 * Initialize Leaflet map with sample markers
 * We'll show a few sample vendor points across India.
 */
function initMap() {
  const map = L.map('map', { center: [22.0, 79.0], zoom: 5, minZoom: 3 });
  // Use OpenStreetMap tiles (works on GitHub Pages)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Sample vendor markers (minimal placeholder)
  const sampleVendors = [
    { name: 'Vendor A', lat: 19.07599, lng: 72.87766, category: 'Retail', city: 'Mumbai' },
    { name: 'Vendor B', lat: 28.70406, lng: 77.10249, category: 'Food', city: 'Delhi' },
    { name: 'Vendor C', lat: 12.9716, lng: 77.5946, category: 'Services', city: 'Bengaluru' },
    { name: 'Vendor D', lat: 13.0827, lng: 80.2707, category: 'Pharmacy', city: 'Chennai' },
    { name: 'Vendor E', lat: 22.5726, lng: 88.3639, category: 'Retail', city: 'Kolkata' }
  ];

  sampleVendors.forEach(v => {
    const marker = L.circleMarker([v.lat, v.lng], { radius: 7, color: '#2563eb' }).addTo(map);
    marker.bindPopup(`<strong>${v.name}</strong><div class="text-xs">${v.category} — ${v.city}</div>`);
  });

  return map;
}

/* ============================
   Chart Helpers & State
   ============================ */

let uploadedRows = null;         // parsed rows [{header: value}, ...]
let columnTypes = {};           // inferred types
let chartInstance = null;       // Chart.js instance
let currentChartType = 'auto';  // selected chart type

/**
 * Destroy previous chart instance cleanly
 */
function destroyChart() {
  if (chartInstance) {
    try { chartInstance.destroy(); } catch (e) { /* ignore */ }
    chartInstance = null;
  }
}

/**
 * Render Chart.js chart according to specified options and data
 * Supports pie, bar, line, bubble
 */
function renderChartOfType(type, options = {}) {
  const canvas = document.getElementById('resultChart');
  destroyChart();

  const ctx = canvas.getContext('2d');

  // Build datasets & config depending on type
  const cfg = {
    type: type === 'bubble' ? 'bubble' : (type === 'pie' ? 'pie' : (type === 'bar' ? 'bar' : 'line')),
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: options.title || '' }
      },
      scales: {}
    }
  };

  // Provide default empty chart if no data
  if (!uploadedRows || uploadedRows.length === 0) {
    cfg.options.plugins.title.text = 'No data';
    chartInstance = new Chart(ctx, cfg);
    return chartInstance;
  }

  try {
    if (type === 'pie') {
      const labelCol = options.labelCol;
      const valueCol = options.valueCol;
      if (!labelCol || !valueCol) {
        throw new Error('Please select label and value columns for pie chart.');
      }
      const labels = uploadedRows.map(r => r[labelCol] == null ? '' : String(r[labelCol]));
      const values = uploadedRows.map(r => toNumber(r[valueCol]) || 0);

      // aggregate by label (sum)
      const agg = {};
      for (let i = 0; i < labels.length; i++) {
        const k = labels[i] || 'Unknown';
        agg[k] = (agg[k] || 0) + (isFinite(values[i]) ? values[i] : 0);
      }
      cfg.data = { labels: Object.keys(agg), datasets: [{ data: Object.values(agg), label: valueCol }] };
      cfg.options.plugins.title.text = `${valueCol} by ${labelCol}`;
    } else if (type === 'bar') {
      const labelCol = options.labelCol;
      const valueCol = options.valueCol;
      if (!labelCol || !valueCol) {
        throw new Error('Please select label and value columns for bar chart.');
      }
      const labels = uploadedRows.map(r => r[labelCol] == null ? '' : String(r[labelCol]));
      const values = uploadedRows.map(r => toNumber(r[valueCol]) || 0);

      // aggregate by label (sum)
      const agg = {};
      for (let i = 0; i < labels.length; i++) {
        const k = labels[i] || 'Unknown';
        agg[k] = (agg[k] || 0) + (isFinite(values[i]) ? values[i] : 0);
      }
      cfg.data = { labels: Object.keys(agg), datasets: [{ label: valueCol, data: Object.values(agg), backgroundColor: undefined }] };
      cfg.options.plugins.title.text = `${valueCol} by ${labelCol}`;
      cfg.options.scales = { x: { beginAtZero: true }, y: { beginAtZero: true } };
    } else if (type === 'line') {
      const labelCol = options.labelCol;
      const valueCol = options.valueCol;
      // If labelCol is numeric/time, we can sort; else use row index
      const labels = uploadedRows.map((r, i) => labelCol ? (r[labelCol] == null ? i : String(r[labelCol])) : i);
      const values = uploadedRows.map(r => toNumber(r[valueCol]) || 0);
      cfg.data = { labels, datasets: [{ label: valueCol || 'Value', data: values, fill: false, tension: 0.2 }] };
      cfg.options.plugins.title.text = `${valueCol} over ${labelCol || 'index'}`;
      cfg.options.scales = { x: { display: true }, y: { beginAtZero: true } };
    } else if (type === 'bubble') {
      // requires xCol, yCol, sizeCol
      const xCol = options.xCol;
      const yCol = options.yCol;
      const sizeCol = options.sizeCol;
      if (!xCol || !yCol || !sizeCol) {
        throw new Error('Select X, Y and Size columns for bubble chart.');
      }
      const points = uploadedRows.map(r => {
        return {
          x: toNumber(r[xCol]) || 0,
          y: toNumber(r[yCol]) || 0,
          r: Math.max(3, (Math.abs(toNumber(r[sizeCol])) || 1) / 2) // scale size to radius
        };
      });
      cfg.data = { datasets: [{ label: `${yCol} vs ${xCol}`, data: points }] };
      cfg.options.plugins.title.text = `${yCol} vs ${xCol} (size: ${sizeCol})`;
      cfg.options.scales = { x: { beginAtZero: true }, y: { beginAtZero: true } };
    } else {
      // fallback empty
      cfg.options.plugins.title.text = 'Unsupported chart type';
    }

    chartInstance = new Chart(ctx, cfg);
    return chartInstance;
  } catch (err) {
    // Graceful error message on chart area
    destroyChart();
    const ctx2 = canvas.getContext('2d');
    ctx2.clearRect(0, 0, canvas.width, canvas.height);
    ctx2.font = '14px sans-serif';
    ctx2.fillStyle = '#9ca3af';
    ctx2.textAlign = 'center';
    ctx2.fillText(err.message || 'Error rendering chart', canvas.width / 2, canvas.height / 2);
    console.error(err);
  }
}

/* ============================
   File Upload & Parsing
   ============================ */

/**
 * Parse file (xlsx or csv) using SheetJS
 * Returns Promise resolving to array of row objects
 */
function parseFileToRows(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file provided'));

    const reader = new FileReader();
    const fname = file.name.toLowerCase();

    reader.onerror = (e) => {
      reject(new Error('Failed to read file'));
    };

    // For binary file types use readAsArrayBuffer
    reader.onload = (e) => {
      try {
        const data = e.target.result;

        // detect by extension
        if (fname.endsWith('.csv')) {
          // parse CSV (sheetjs can parse string)
          const text = new TextDecoder('utf-8').decode(data);
          const workbook = XLSX.read(text, { type: 'string', raw: false });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(sheet, { defval: null });
          resolve(json);
        } else {
          // try spreadsheet (xlsx/xls)
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(sheet, { defval: null });
          resolve(json);
        }
      } catch (err) {
        reject(err);
      }
    };

    // When reading .csv we need arrayBuffer then decode; easiest: always read as arraybuffer
    reader.readAsArrayBuffer(file);
  });
}

/* ============================
   UI Bindings & Event Wiring
   ============================ */

function setupUI() {
  const uploadModal = $('#uploadModal');
  const uploadBtn = $('#uploadBtn');
  const closeUploadModal = $('#closeUploadModal');
  const dropzone = $('#dropzone');
  const fileInput = $('#fileInput');
  const uploadFeedback = $('#uploadFeedback');
  const confirmUpload = $('#confirmUpload');
  const cancelUpload = $('#cancelUpload');
  const uploadedDataSection = $('#uploadedDataSection');
  const uploadedTabBtn = $('#uploadedTabBtn');
  const chartTypeSelect = $('#chartTypeSelect');
  const renderChartBtn = $('#renderChartBtn');
  const labelColumn = $('#labelColumn');
  const valueColumn = $('#valueColumn');
  const xColumn = $('#xColumn');
  const yColumn = $('#yColumn');
  const sizeColumn = $('#sizeColumn');
  const bubbleExtras = $('#bubbleExtras');
  const columnsList = $('#columnsList');
  const downloadChartBtn = $('#downloadChartBtn');
  const printChartBtn = $('#printChartBtn');
  const clearUploadBtn = $('#clearUploadBtn');

  // Modal open/close
  uploadBtn.addEventListener('click', () => {
    uploadModal.classList.remove('hidden');
  });
  closeUploadModal.addEventListener('click', () => uploadModal.classList.add('hidden'));
  cancelUpload.addEventListener('click', () => uploadModal.classList.add('hidden'));
  confirmUpload.addEventListener('click', () => uploadModal.classList.add('hidden'));

  // dropzone events
  ;['dragenter', 'dragover'].forEach(ev => {
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ;['dragleave', 'dragend', 'drop'].forEach(ev => {
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = (e.dataTransfer && e.dataTransfer.files) ? e.dataTransfer.files : [];
    handleFileSelection(files[0]);
  });

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const f = (e.target.files && e.target.files[0]) ? e.target.files[0] : null;
    if (f) handleFileSelection(f);
  });

  // uploaded data tab
  uploadedTabBtn.addEventListener('click', () => {
    // show tab
    uploadedDataSection.classList.remove('hidden');
    window.scrollTo({ top: uploadedDataSection.offsetTop - 20, behavior: 'smooth' });
  });

  // Chart type select
  chartTypeSelect.addEventListener('change', (e) => {
    currentChartType = e.target.value;
    // show/hide bubble extras
    bubbleExtras.classList.toggle('hidden', currentChartType !== 'bubble');
  });

  // Render chart button
  renderChartBtn.addEventListener('click', () => {
    if (!uploadedRows) {
      alert('Please upload a file first.');
      return;
    }
    const selectedType = chartTypeSelect.value === 'auto' ? autoDetectChartType() : chartTypeSelect.value;
    const opts = buildChartOptionsFromUI(selectedType);
    renderChartOfType(selectedType, opts);
  });

  // Download chart
  downloadChartBtn.addEventListener('click', () => {
    if (!chartInstance) {
      alert('No chart to download.');
      return;
    }
    try {
      const url = chartInstance.toBase64Image();
      const a = document.createElement('a');
      a.href = url;
      a.download = `chart-${Date.now()}.png`;
      a.click();
    } catch (err) {
      console.error(err);
      alert('Failed to download chart.');
    }
  });

  // Print chart
  printChartBtn.addEventListener('click', () => {
    if (!chartInstance) {
      alert('No chart to print.');
      return;
    }
    try {
      const img = chartInstance.toBase64Image();
      const w = window.open('', '_blank');
      if (!w) { alert('Popup blocked.'); return; }
      w.document.write(`<img src="${img}" style="max-width:100%"><script>window.print();</script>`);
      w.document.close();
    } catch (err) {
      console.error(err);
      alert('Failed to print chart.');
    }
  });

  // Clear uploaded data
  clearUploadBtn.addEventListener('click', () => {
    uploadedRows = null;
    columnTypes = {};
    destroyChart();
    $('#tablePreview').innerHTML = '';
    columnsList.innerHTML = '<p class="text-xs text-slate-400">Upload a file to detect columns</p>';
    $('#labelColumn').innerHTML = '';
    $('#valueColumn').innerHTML = '';
    $('#xColumn').innerHTML = '';
    $('#yColumn').innerHTML = '';
    $('#sizeColumn').innerHTML = '';
    uploadedDataSection.classList.add('hidden');
    alert('Cleared uploaded data and charts.');
  });

  // Simple sample chart in analytics (vendors by category)
  setTimeout(() => {
    try {
      const ctx = document.getElementById('sampleChart').getContext('2d');
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Retail', 'Food', 'Services', 'Pharmacy'],
          datasets: [{ data: [40, 30, 30, 20] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    } catch (e) { /* ignore */ }
  }, 200);
}

/**
 * Build chart options by reading UI selections
 */
function buildChartOptionsFromUI(type) {
  const opts = {};
  opts.labelCol = $('#labelColumn').value || null;
  opts.valueCol = $('#valueColumn').value || null;
  opts.xCol = $('#xColumn').value || null;
  opts.yCol = $('#yColumn').value || null;
  opts.sizeCol = $('#sizeColumn').value || null;
  opts.title = `${type.charAt(0).toUpperCase() + type.slice(1)} chart`;
  return opts;
}

/**
 * Auto-detect best chart type using heuristics:
 * - If there is at least one categorical + one numeric -> pie or bar
 * - If there are >=2 numeric columns -> bubble or line
 * Priority: bubble if 3 numeric, else bar if categorical, else line
 */
function autoDetectChartType() {
  if (!columnTypes) return 'bar';
  const headers = Object.keys(columnTypes || {});
  const numericCols = headers.filter(h => columnTypes[h] === 'numeric');
  const catCols = headers.filter(h => columnTypes[h] === 'categorical');

  if (numericCols.length >= 3) return 'bubble';
  if (catCols.length >= 1 && numericCols.length >= 1) return 'bar';
  if (numericCols.length >= 1) return 'line';
  return 'bar';
}

/* ============================
   File Handling Flow
   ============================ */

/**
 * Called when a file is selected/dropped
 */
function handleFileSelection(file) {
  const uploadFeedback = $('#uploadFeedback');
  uploadFeedback.classList.add('hidden');
  uploadFeedback.textContent = '';

  if (!file) {
    uploadFeedback.textContent = 'No file selected.';
    uploadFeedback.classList.remove('hidden');
    return;
  }

  const allowed = ['.csv', '.xls', '.xlsx'];
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowed.includes(ext)) {
    uploadFeedback.textContent = 'Unsupported file type. Please upload .xlsx, .xls, or .csv.';
    uploadFeedback.classList.remove('hidden');
    return;
  }

  // parse
  parseFileToRows(file).then(rows => {
    if (!rows || rows.length === 0) {
      uploadFeedback.textContent = 'File parsed but contains no rows.';
      uploadFeedback.classList.remove('hidden');
      return;
    }

    // set global state
    uploadedRows = rows;
    columnTypes = inferColumnTypes(rows);

    // populate UI
    populateColumnsUI(rows, columnTypes);

    // show preview & uploaded tab
    renderTablePreview(rows, 15);
    $('#uploadedDataSection').classList.remove('hidden');

    // auto-select reasonable columns
    autoSelectColumns();

    // close modal
    $('#uploadModal').classList.add('hidden');

    // give user feedback
    alert(`File "${file.name}" loaded — ${rows.length} rows detected, ${Object.keys(rows[0]).length} columns.`);
  }).catch(err => {
    console.error(err);
    uploadFeedback.textContent = 'Failed to parse file: ' + (err.message || 'Unknown error');
    uploadFeedback.classList.remove('hidden');
  });
}

/**
 * Populate the columns area and select boxes after upload
 */
function populateColumnsUI(rows, types) {
  const keys = Object.keys(rows[0]);
  const columnsList = $('#columnsList');
  columnsList.innerHTML = '';

  // show list with type badges
  keys.forEach(k => {
    const p = document.createElement('p');
    p.className = 'flex items-center justify-between';
    const left = document.createElement('span');
    left.textContent = k;
    const right = document.createElement('span');
    right.className = 'text-xs px-2 py-0.5 rounded-full border';
    right.textContent = types[k] || 'unknown';
    right.classList.add(types[k] === 'numeric' ? 'border-green-200 text-green-700' : 'border-slate-200 text-slate-600');
    p.appendChild(left);
    p.appendChild(right);
    columnsList.appendChild(p);
  });

  // fill select controls
  const fillSelect = (sel, includeAll = false) => {
    sel.innerHTML = '';
    keys.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = k + (types[k] ? ` (${types[k]})` : '');
      sel.appendChild(opt);
    });
  };

  fillSelect($('#labelColumn'));
  fillSelect($('#valueColumn'));
  fillSelect($('#xColumn'));
  fillSelect($('#yColumn'));
  fillSelect($('#sizeColumn'));
}

/**
 * Try to pick sensible defaults for label/value/x/y/size
 */
function autoSelectColumns() {
  if (!uploadedRows || !columnTypes) return;
  const headers = Object.keys(columnTypes);
  const numeric = headers.filter(h => columnTypes[h] === 'numeric');
  const categorical = headers.filter(h => columnTypes[h] === 'categorical');

  // heuristics:
  // - label: first categorical or first header
  // - value: first numeric
  // - bubble: x,y,size = first 3 numeric
  const labelCol = (categorical[0] || headers[0]) || '';
  const valueCol = (numeric[0] || headers[1] || headers[0]) || '';

  $('#labelColumn').value = labelCol;
  $('#valueColumn').value = valueCol;

  const xCol = numeric[0] || headers[0] || '';
  const yCol = numeric[1] || headers[1] || '';
  const sCol = numeric[2] || numeric[0] || '';

  $('#xColumn').value = xCol;
  $('#yColumn').value = yCol;
  $('#sizeColumn').value = sCol;

  // set chart type selector to auto (user can change)
  $('#chartTypeSelect').value = 'auto';
  currentChartType = 'auto';
}

/* ============================
   Startup
   ============================ */

window.addEventListener('DOMContentLoaded', () => {
  // initialize map
  initMap();

  // wire up UI
  setupUI();

  // small accessibility helpers: show uploaded tab if query param present
  if (location.search.includes('uploaded')) {
    $('#uploadedDataSection').classList.remove('hidden');
  }
});
