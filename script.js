// script.js - Vendor Dashboard (Leaflet + Chart.js)
// Keep this file in the same directory as index.html and style.css

let mapInstance = null;
let mapMarkersLayer = null;
let mainChart = null;
let chartCanvas = null;
let vendors = []; // array of vendor objects

// Sample demo data (used if user doesn't upload CSV)
const sampleVendors = [
  { name: "Blue Coffee", lat: 40.73061, lon: -73.935242, sales: 12500, city: "NY" },
  { name: "Green Grocery", lat: 34.052235, lon: -118.243683, sales: 8600, city: "LA" },
  { name: "Red Bakery", lat: 41.878113, lon: -87.629799, sales: 4300, city: "Chicago" },
  { name: "Sun Electronics", lat: 29.760427, lon: -95.369803, sales: 16400, city: "Houston" },
  { name: "Oak Furnishings", lat: 37.774929, lon: -122.419416, sales: 9700, city: "San Francisco" }
];

// Utility: render HTML for vendor popup
function renderRowCard(row){
  const sales = (row.sales !== undefined) ? Number(row.sales).toLocaleString() : "—";
  const city = row.city || row.cityName || "";
  return `
    <div class="vendor-popup">
      <div class="title">${row.name || 'Vendor'}</div>
      <div class="meta">${city} • ${row.lat?.toFixed(4) || ''}, ${row.lon?.toFixed(4) || ''}</div>
      <div class="kpi">
        <div class="pill">Sales: $${sales}</div>
      </div>
    </div>
  `;
}

// Add markers with hover popup & highlight
function addMarker(lat, lon, row){
  const defaultOpts = { radius: 6, color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.95, weight: 1 };
  const hoverOpts   = { radius: 10, color: '#ef4444', fillColor: '#ff7b7b', fillOpacity: 1, weight: 2 };

  const marker = L.circleMarker([lat, lon], defaultOpts);

  const html = renderRowCard(row);
  marker.bindPopup(html, { maxWidth: 320, closeButton: true });

  marker.on('mouseover', function(){
    try {
      this.openPopup();
      if (this.setStyle) this.setStyle(hoverOpts);
      const c = mapInstance.getContainer(); if (c) c.style.cursor = 'pointer';
      if (this.bringToFront) this.bringToFront();
    } catch(e){}
  });

  marker.on('mouseout', function(){
    try {
      this.closePopup();
      if (this.setStyle) this.setStyle(defaultOpts);
      const c = mapInstance.getContainer(); if (c) c.style.cursor = '';
    } catch(e){}
  });

  marker.on('click', function(){
    try {
      this.openPopup();
      if (this.setStyle) this.setStyle(hoverOpts);
      if (this.bringToFront) this.bringToFront();
      // dispatch event to highlight chart
      const ev = new CustomEvent('vendorMarkerClicked', { detail: { row } });
      window.dispatchEvent(ev);
    } catch(e){}
  });

  marker.addTo(mapMarkersLayer);
  marker._row = row;
  return marker;
}

// Initialize Leaflet map
function initMap(){
  if (mapInstance) return;
  mapInstance = L.map('map', { zoomControl:true }).setView([37.0902, -95.7129], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapInstance);

  mapMarkersLayer = L.layerGroup().addTo(mapInstance);

  // accessibility and cursor tweaks
  const mc = mapInstance.getContainer();
  if (mc) { mc.tabIndex = 0; mc.style.cursor = ''; }
  mapInstance.on('movestart', ()=>{ const c = mapInstance.getContainer(); if(c) c.style.cursor='grabbing'; });
  mapInstance.on('moveend', ()=>{ const c = mapInstance.getContainer(); if(c) c.style.cursor=''; });
}

// Place vendors on map and fit bounds
function plotVendorsOnMap(list){
  if (!mapInstance) initMap();
  mapMarkersLayer.clearLayers();
  const layerMarkers = [];
  list.forEach(v => {
    if (isFinite(+v.lat) && isFinite(+v.lon)) {
      const m = addMarker(+v.lat, +v.lon, v);
      layerMarkers.push(m);
    }
  });
  if (layerMarkers.length) {
    const grp = L.featureGroup(layerMarkers);
    mapInstance.fitBounds(grp.getBounds().pad(0.2));
  }
}

// Chart rendering
function renderChartForVendors(list){
  chartCanvas = document.getElementById('mainChart');
  const ctx = chartCanvas.getContext('2d');

  const labels = list.map(v => v.name || 'Vendor');
  const data = list.map(v => Number(v.sales) || 0);

  const config = {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Sales ($)',
        data,
        backgroundColor: labels.map(()=> 'rgba(37,99,235,0.85)'),
        borderColor: labels.map(()=> 'rgba(37,99,235,1)'),
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `$ ${Number(ctx.raw).toLocaleString()}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, minRotation: 0 } },
        y: { beginAtZero: true, grid: { color: 'rgba(15,23,42,0.04)' }, ticks: { callback: v => `$${v.toLocaleString()}` } }
      }
    }
  };

  if (mainChart) { try { mainChart.destroy(); } catch(e){} }

  mainChart = new Chart(ctx, config);

  // small reflow fix after render
  setTimeout(()=>{ try { mainChart.resize(); mainChart.update(); }catch(e){} }, 120);
}

// Highlight a bar by vendor name (used when map marker clicked)
function highlightBarForVendor(vendorName){
  if (!mainChart) return;
  const idx = mainChart.data.labels.findIndex(l => l === vendorName);
  if (idx === -1) return;
  // reduce opacity of all bars, then emphasize the selected one
  mainChart.data.datasets[0].backgroundColor = mainChart.data.labels.map((_,i)=> i === idx ? 'rgba(239,68,68,0.95)' : 'rgba(107,114,128,0.2)');
  mainChart.update();
  // scroll canvas into view
  chartCanvas && chartCanvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// File (CSV) parsing simple: expects header line name,lat,lon,sales (order not strict)
function parseCSV(text){
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(',').map(h=>h.trim().toLowerCase());
  const rows = [];
  for (let i=1;i<lines.length;i++){
    const cols = lines[i].split(',').map(c=>c.trim());
    if (cols.length < 2) continue;
    const obj = {};
    header.forEach((h,idx)=> obj[h] = (cols[idx] !== undefined ? cols[idx] : ''));
    // try to coerce lat/lon/sales into numbers
    if (obj.lat) obj.lat = parseFloat(obj.lat);
    if (obj.lon) obj.lon = parseFloat(obj.lon);
    if (obj.sales) obj.sales = Number(obj.sales);
    rows.push(obj);
  }
  return rows;
}

// Wire UI
function wireUi(){
  // file input
  const fi = document.getElementById('fileInput');
  if (fi) {
    fi.addEventListener('change', (ev)=>{
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = parseCSV(reader.result);
          if (parsed.length) {
            vendors = parsed;
            renderChartForVendors(vendors);
            plotVendorsOnMap(vendors);
            document.getElementById('chartTitle').textContent = 'Sales by Vendor (Uploaded CSV)';
          } else {
            alert('CSV parsed no rows — ensure first row is a header like: name,lat,lon,sales');
          }
        } catch (err) { alert('Error parsing file: '+err.message); }
      };
      reader.readAsText(f);
    });
  }

  // fullscreen button
  const fsBtn = document.getElementById('fullscreenChart');
  if (fsBtn) {
    fsBtn.addEventListener('click', toggleFullscreenChart);
  }

  // when marker clicked, highlight chart
  window.addEventListener('vendorMarkerClicked', (e)=>{
    const row = e.detail && e.detail.row;
    if (row && row.name) highlightBarForVendor(row.name);
  });
}

// Fullscreen handling: toggles .fullscreen on chart card and puts map into the right column
function toggleFullscreenChart(){
  const chartCard = document.querySelector('.chart-card');
  if (!chartCard) return;
  const isFS = chartCard.classList.toggle('fullscreen');

  const btn = document.getElementById('fullscreenChart');
  if (btn) {
    const i = btn.querySelector('i');
    if (i) {
      i.classList.toggle('fa-compress', isFS);
      i.classList.toggle('fa-expand', !isFS);
    }
  }

  // if entering fullscreen, create an inner map placeholder in the chart-card (so map remains visible)
  if (isFS) {
    // create map container inside chart-card if not already
    let inner = document.getElementById('popupMap');
    if (!inner) {
      inner = document.createElement('div');
      inner.id = 'popupMap';
      // append to chart-card as second column
      chartCard.appendChild(inner);
      // move existing global map into this new container
      const oldMapDom = document.getElementById('map');
      if (oldMapDom && oldMapDom._leaflet_id) {
        // move DOM node (Leaflet map needs resize)
        inner.appendChild(oldMapDom);
      } else {
        // create a fresh map clone in the popupMap (we'll reinit)
        inner.innerHTML = '';
      }
    }
    // ensure map resizes properly after transition
    setTimeout(()=>{ if (mapInstance) mapInstance.invalidateSize(); }, 260);
  } else {
    // leaving fullscreen: move the #map element back into its original aside .map-card
    const originalAside = document.querySelector('.map-card');
    const popup = document.getElementById('popupMap');
    const mapEl = document.getElementById('map');
    if (mapEl && originalAside) {
      // ensure mapEl is a child of the aside
      originalAside.appendChild(mapEl);
      if (mapInstance) setTimeout(()=>mapInstance.invalidateSize(), 200);
    }
    // remove popupMap container if present
    if (popup && popup.parentElement) {
      try { popup.parentElement.removeChild(popup); } catch(e){}
    }
  }

  // small delay to reflow chart
  setTimeout(()=>{ if (mainChart) try { mainChart.resize(); mainChart.update(); } catch(e){} }, 220);
}

// Boot the app with sample data
function boot(){
  initMap();
  vendors = [...sampleVendors];
  renderChartForVendors(vendors);
  plotVendorsOnMap(vendors);
  wireUi();
}

// Start
document.addEventListener('DOMContentLoaded', boot);
