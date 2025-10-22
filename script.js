/**
 * Enterprise Data Visualization Dashboard
 * Premium JavaScript Implementation
 * Features: 10+ Chart Types, AI Insights, Advanced Analytics
 */

// ===================================
// Global State Management
// ===================================

const AppState = {
    workbook: null,
    currentSheet: null,
    rawData: [],
    filteredData: [],
    metadata: {
        headers: [],
        numeric: [],
        categorical: [],
        temporal: []
    },
    charts: {
        main: null,
        heatmap: null,
        treemap: null
    },
    map: null,
    mapMarkers: null,
    currentTheme: 'light',
    currentColorScheme: 'default',
    filters: {},
    pagination: {
        currentPage: 1,
        rowsPerPage: 25
    }
};

// Color Schemes
const ColorSchemes = {
    default: ['#2563eb', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
    corporate: ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'],
    sunset: ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'],
    forest: ['#047857', '#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
    royal: ['#6d28d9', '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'],
    minimal: ['#374151', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb'],
    vibrant: ['#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444']
};

// ===================================
// Initialization
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    initializeMap();
    loadSavedPreferences();
});

function initializeApp() {
    console.log('🚀 Enterprise DataViz Pro - Initializing...');
    
    // Check for saved data
    try {
        const savedData = localStorage.getItem('lastDataset');
        if (savedData) {
            const data = JSON.parse(savedData);
            console.log('📦 Found saved dataset:', data.length, 'rows');
        }
    } catch (e) {
        console.log('No saved data found');
    }
}

function setupEventListeners() {
    // Theme Toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // Upload Button
    document.getElementById('uploadBtn').addEventListener('click', openUploadModal);
    document.getElementById('closeModal').addEventListener('click', closeUploadModal);
    
    // File Input
    const fileInput = document.getElementById('fileInput');
    const dropzone = document.getElementById('dropzone');
    
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag & Drop
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', handleDragOver);
    dropzone.addEventListener('dragleave', handleDragLeave);
    dropzone.addEventListener('drop', handleDrop);
    
    // Chart Controls
    document.getElementById('chartType').addEventListener('change', updateVisualization);
    document.getElementById('sheetSelect').addEventListener('change', handleSheetChange);
    document.getElementById('topN').addEventListener('change', updateVisualization);
    document.getElementById('chartColorScheme').addEventListener('change', handleColorSchemeChange);
    document.getElementById('refreshChart').addEventListener('click', updateVisualization);
    
    // Export Buttons
    document.getElementById('exportPNG').addEventListener('click', exportChartAsPNG);
    document.getElementById('exportExcel').addEventListener('click', exportAsExcel);
    document.getElementById('exportPDF').addEventListener('click', exportAsPDF);
    document.getElementById('printDashboard').addEventListener('click', () => window.print());
    
    // Table Controls
    document.getElementById('tableSearch').addEventListener('input', handleTableSearch);
    document.getElementById('rowsPerPage').addEventListener('change', handleRowsPerPageChange);
    document.getElementById('globalSearch').addEventListener('input', handleGlobalSearch);
    
    // Color Scheme Modal
    document.getElementById('colorSchemeBtn').addEventListener('click', openColorSchemeModal);
    
    // Clear Filters
    document.getElementById('clearFilters').addEventListener('click', clearAllFilters);
    
    // Sidebar Toggle (Mobile)
    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
    
    // Chart Actions
    document.getElementById('fullscreenChart').addEventListener('click', toggleFullscreen);
    document.getElementById('downloadChart').addEventListener('click', exportChartAsPNG);
}

// ===================================
// Theme Management
// ===================================

function toggleTheme() {
    const body = document.body;
    const icon = document.querySelector('#themeToggle i');
    
    if (body.classList.contains('theme-light')) {
        body.classList.remove('theme-light');
        body.classList.add('theme-dark');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
        AppState.currentTheme = 'dark';
    } else {
        body.classList.remove('theme-dark');
        body.classList.add('theme-light');
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
        AppState.currentTheme = 'light';
    }
    
    localStorage.setItem('theme', AppState.currentTheme);
    updateVisualization();
}

function openColorSchemeModal() {
    const modal = document.getElementById('colorSchemeModal');
    modal.classList.add('active');
    
    // Setup theme options
    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', function() {
            const theme = this.getAttribute('data-theme');
            applyColorScheme(theme);
            closeColorSchemeModal();
        });
    });
}

function closeColorSchemeModal() {
    document.getElementById('colorSchemeModal').classList.remove('active');
}

function applyColorScheme(scheme) {
    document.getElementById('chartColorScheme').value = scheme;
    AppState.currentColorScheme = scheme;
    localStorage.setItem('colorScheme', scheme);
    updateVisualization();
}

// ===================================
// File Upload & Processing
// ===================================

function openUploadModal() {
    document.getElementById('uploadModal').classList.add('active');
}

function closeUploadModal() {
    document.getElementById('uploadModal').classList.remove('active');
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processFile(file);
    }
}

function processFile(file) {
    const fileName = file.name.toLowerCase();
    
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
        alert('Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file');
        return;
    }
    
    showProgress();
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            
            if (fileName.endsWith('.csv')) {
                // Parse CSV
                const text = new TextDecoder().decode(data);
                parseCSV(text);
            } else {
                // Parse Excel
                parseExcel(data);
            }
        } catch (error) {
            console.error('Error processing file:', error);
            alert('Error processing file. Please ensure it\'s a valid Excel or CSV file.');
            hideProgress();
        }
    };
    
    if (fileName.endsWith('.csv')) {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
}

function parseCSV(text) {
    Papa.parse(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
            AppState.workbook = {
                SheetNames: ['Sheet1'],
                Sheets: {
                    'Sheet1': results.data
                }
            };
            showSheetSelector();
        },
        error: (error) => {
            console.error('CSV Parse Error:', error);
            alert('Error parsing CSV file');
            hideProgress();
        }
    });
}

function parseExcel(data) {
    try {
        const workbook = XLSX.read(data, { type: 'array' });
        AppState.workbook = workbook;
        showSheetSelector();
    } catch (error) {
        console.error('Excel Parse Error:', error);
        alert('Error parsing Excel file');
        hideProgress();
    }
}

function showProgress() {
    document.getElementById('uploadProgress').style.display = 'block';
    document.getElementById('dropzone').style.display = 'none';
    
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        document.getElementById('progressFill').style.width = progress + '%';
        
        if (progress >= 90) {
            clearInterval(interval);
        }
    }, 100);
}

function hideProgress() {
    document.getElementById('uploadProgress').style.display = 'none';
    document.getElementById('dropzone').style.display = 'block';
    document.getElementById('progressFill').style.width = '0%';
}

function showSheetSelector() {
    hideProgress();
    
    const sheetSelector = document.getElementById('sheetSelector');
    const sheetList = document.getElementById('sheetList');
    
    sheetList.innerHTML = '';
    
    AppState.workbook.SheetNames.forEach((sheetName, index) => {
        const sheetItem = document.createElement('div');
        sheetItem.className = 'sheet-item' + (index === 0 ? ' selected' : '');
        sheetItem.innerHTML = `
            <input type="checkbox" id="sheet-${index}" ${index === 0 ? 'checked' : ''}>
            <label for="sheet-${index}" style="flex: 1; cursor: pointer;">
                <strong>${sheetName}</strong>
            </label>
        `;
        
        sheetItem.addEventListener('click', function(e) {
            if (e.target.tagName !== 'INPUT') {
                const checkbox = this.querySelector('input');
                checkbox.checked = !checkbox.checked;
            }
            this.classList.toggle('selected');
        });
        
        sheetList.appendChild(sheetItem);
    });
    
    sheetSelector.style.display = 'block';
    
    document.getElementById('loadSelectedSheets').onclick = loadSelectedSheets;
}

function loadSelectedSheets() {
    const selectedSheets = [];
    
    document.querySelectorAll('.sheet-item input:checked').forEach((checkbox, index) => {
        const sheetIndex = parseInt(checkbox.id.split('-')[1]);
        selectedSheets.push(AppState.workbook.SheetNames[sheetIndex]);
    });
    
    if (selectedSheets.length === 0) {
        alert('Please select at least one sheet');
        return;
    }
    
    // Load first selected sheet
    loadSheetData(selectedSheets[0]);
    
    // Populate sheet selector dropdown
    const sheetSelect = document.getElementById('sheetSelect');
    sheetSelect.innerHTML = '';
    selectedSheets.forEach(sheetName => {
        const option = document.createElement('option');
        option.value = sheetName;
        option.textContent = sheetName;
        sheetSelect.appendChild(option);
    });
    
    closeUploadModal();
    
    // Show dashboard
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('chartsGrid').style.display = 'grid';
    document.getElementById('tableSection').style.display = 'block';
    document.getElementById('controlsPanel').style.display = 'flex';
    document.getElementById('quickStats').style.display = 'block';
    document.getElementById('filtersSection').style.display = 'block';
    document.getElementById('exportSection').style.display = 'block';
    document.getElementById('insightsSection').style.display = 'block';
}

function loadSheetData(sheetName) {
    AppState.currentSheet = sheetName;
    const worksheet = AppState.workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
    
    if (jsonData.length === 0) {
        alert('Sheet is empty or has no data');
        return;
    }
    
    AppState.rawData = jsonData;
    AppState.filteredData = [...jsonData];
    
    // Analyze data
    analyzeData();
    
    // Update UI
    updateDashboard();
    
    // Save to localStorage
    try {
        localStorage.setItem('lastDataset', JSON.stringify(jsonData.slice(0, 100)));
    } catch (e) {
        console.log('Could not save to localStorage');
    }
}

// ===================================
// Data Analysis
// ===================================

function analyzeData() {
    const data = AppState.rawData;
    const headers = Object.keys(data[0] || {});
    
    const numeric = [];
    const categorical = [];
    const temporal = [];
    
    headers.forEach(header => {
        let numCount = 0;
        let dateCount = 0;
        const sampleSize = Math.min(100, data.length);
        
        for (let i = 0; i < sampleSize; i++) {
            const value = data[i][header];
            
            if (value === null || value === undefined || value === '') continue;
            
            // Check if numeric
            if (typeof value === 'number' || (!isNaN(parseFloat(value)) && isFinite(value))) {
                numCount++;
            }
            
            // Check if date
            if (isDateLike(value)) {
                dateCount++;
            }
        }
        
        if (numCount / sampleSize > 0.6) {
            numeric.push(header);
        } else if (dateCount / sampleSize > 0.5) {
            temporal.push(header);
        } else {
            categorical.push(header);
        }
    });
    
    AppState.metadata = { headers, numeric, categorical, temporal };
    
    console.log('📊 Data Analysis:', AppState.metadata);
}

function isDateLike(value) {
    if (!value) return false;
    const datePatterns = [
        /^\d{4}-\d{2}-\d{2}/,
        /^\d{2}\/\d{2}\/\d{4}/,
        /^\d{2}-\d{2}-\d{4}/
    ];
    return datePatterns.some(pattern => pattern.test(String(value)));
}

// ===================================
// Dashboard Update
// ===================================

function updateDashboard() {
    updateStats();
    createFilters();
    updateVisualization();
    renderDataTable();
    generateInsights();
    updateMapData();
    
    document.getElementById('dashboardTitle').textContent = 'Data Analytics Dashboard';
    document.getElementById('dashboardSubtitle').textContent = `Analyzing ${AppState.currentSheet}`;
}

function updateStats() {
    document.getElementById('rowCount').textContent = AppState.filteredData.length.toLocaleString();
    document.getElementById('colCount').textContent = AppState.metadata.headers.length;
}

// ===================================
// Filters
// ===================================

function createFilters() {
    const filterContainer = document.getElementById('filterContainer');
    filterContainer.innerHTML = '';
    
    // Create filters for categorical columns
    AppState.metadata.categorical.slice(0, 5).forEach(column => {
        const uniqueValues = [...new Set(AppState.rawData.map(row => row[column]))].filter(v => v);
        
        if (uniqueValues.length > 1 && uniqueValues.length < 50) {
            const filterGroup = document.createElement('div');
            filterGroup.className = 'filter-group';
            
            filterGroup.innerHTML = `
                <label>${column}</label>
                <select class="filter-select" data-column="${column}">
                    <option value="">All</option>
                    ${uniqueValues.map(v => `<option value="${v}">${v}</option>`).join('')}
                </select>
            `;
            
            filterGroup.querySelector('select').addEventListener('change', handleFilterChange);
            filterContainer.appendChild(filterGroup);
        }
    });
    
    // Create filters for numeric columns (range)
    AppState.metadata.numeric.slice(0, 3).forEach(column => {
        const values = AppState.rawData.map(row => parseFloat(row[column])).filter(v => !isNaN(v));
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        const filterGroup = document.createElement('div');
        filterGroup.className = 'filter-group';
        
        filterGroup.innerHTML = `
            <label>${column} Range</label>
            <input type="number" class="filter-range-min" data-column="${column}" placeholder="Min" value="${min}" step="any">
            <input type="number" class="filter-range-max" data-column="${column}" placeholder="Max" value="${max}" step="any" style="margin-top: 4px;">
        `;
        
        filterGroup.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', handleFilterChange);
        });
        
        filterContainer.appendChild(filterGroup);
    });
}

function handleFilterChange(e) {
    const column = e.target.getAttribute('data-column');
    
    if (e.target.classList.contains('filter-select')) {
        const value = e.target.value;
        if (value) {
            AppState.filters[column] = value;
        } else {
            delete AppState.filters[column];
        }
    } else if (e.target.classList.contains('filter-range-min')) {
        if (!AppState.filters[column]) AppState.filters[column] = {};
        AppState.filters[column].min = parseFloat(e.target.value);
    } else if (e.target.classList.contains('filter-range-max')) {
        if (!AppState.filters[column]) AppState.filters[column] = {};
        AppState.filters[column].max = parseFloat(e.target.value);
    }
    
    applyFilters();
}

function applyFilters() {
    AppState.filteredData = AppState.rawData.filter(row => {
        return Object.keys(AppState.filters).every(column => {
            const filterValue = AppState.filters[column];
            const rowValue = row[column];
            
            if (typeof filterValue === 'object') {
                const numValue = parseFloat(rowValue);
                if (isNaN(numValue)) return false;
                if (filterValue.min !== undefined && numValue < filterValue.min) return false;
                if (filterValue.max !== undefined && numValue > filterValue.max) return false;
                return true;
            } else {
                return String(rowValue) === String(filterValue);
            }
        });
    });
    
    updateStats();
    updateVisualization();
    renderDataTable();
}

function clearAllFilters() {
    AppState.filters = {};
    AppState.filteredData = [...AppState.rawData];
    
    document.querySelectorAll('.filter-select').forEach(select => select.value = '');
    
    updateStats();
    updateVisualization();
    renderDataTable();
}

// ===================================
// Visualization
// ===================================

function updateVisualization() {
    const chartType = document.getElementById('chartType').value;
    const selectedType = chartType === 'auto' ? autoDetectChartType() : chartType;
    
    console.log('📈 Rendering chart type:', selectedType);
    
    // Hide all chart containers
    document.getElementById('mainChart').style.display = 'none';
    document.getElementById('heatmapContainer').style.display = 'none';
    document.getElementById('treemapContainer').style.display = 'none';
    
    // Destroy existing charts
    if (AppState.charts.main) {
        AppState.charts.main.destroy();
        AppState.charts.main = null;
    }
    
    // Render appropriate chart
    switch (selectedType) {
        case 'bar':
            renderBarChart();
            break;
        case 'line':
            renderLineChart();
            break;
        case 'pie':
            renderPieChart();
            break;
        case 'histogram':
            renderHistogram();
            break;
        case 'scatter':
            renderScatterPlot();
            break;
        case 'area':
            renderAreaChart();
            break;
        case 'boxplot':
            renderBoxPlot();
            break;
        case 'heatmap':
            renderHeatmap();
            break;
        case 'bubble':
            renderBubbleChart();
            break;
        case 'treemap':
            renderTreeMap();
            break;
        default:
            renderBarChart();
    }
}

function autoDetectChartType() {
    const { numeric, categorical, headers } = AppState.metadata;
    
    if (categorical.length > 0 && numeric.length > 0) {
        return 'bar';
    } else if (numeric.length >= 2) {
        return 'scatter';
    } else if (categorical.length > 0) {
        return 'pie';
    } else {
        return 'line';
    }
}

function getColorPalette() {
    const scheme = AppState.currentColorScheme || 'default';
    return ColorSchemes[scheme] || ColorSchemes.default;
}

// Chart Rendering Functions

function renderBarChart() {
    document.getElementById('mainChart').style.display = 'block';
    const canvas = document.getElementById('mainChart');
    const ctx = canvas.getContext('2d');
    
    const topN = parseInt(document.getElementById('topN').value) || 10;
    const categoryCol = AppState.metadata.categorical[0] || AppState.metadata.headers[0];
    const valueCol = AppState.metadata.numeric[0] || AppState.metadata.headers[1];
    
    // Aggregate data
    const aggregated = {};
    AppState.filteredData.forEach(row => {
        const cat = row[categoryCol];
        const val = parseFloat(row[valueCol]) || 0;
        aggregated[cat] = (aggregated[cat] || 0) + val;
    });
    
    // Sort and take top N
    const sorted = Object.entries(aggregated)
        .sort(([,a], [,b]) => b - a)
        .slice(0, topN);
    
    const labels = sorted.map(([label]) => label);
    const data = sorted.map(([, value]) => value);
    
    const colors = getColorPalette();
    
    AppState.charts.main = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: valueCol,
                data: data,
                backgroundColor: colors,
                borderRadius: 8,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: `${valueCol} by ${categoryCol} (Top ${topN})`,
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
    
    document.getElementById('chartTitle').textContent = 'Bar Chart Analysis';
}

function renderLineChart() {
    document.getElementById('mainChart').style.display = 'block';
    const canvas = document.getElementById('mainChart');
    const ctx = canvas.getContext('2d');
    
    const xCol = AppState.metadata.temporal[0] || AppState.metadata.headers[0];
    const yCol = AppState.metadata.numeric[0] || AppState.metadata.headers[1];
    
    const data = AppState.filteredData.slice(0, 50).map(row => ({
        x: row[xCol],
        y: parseFloat(row[yCol]) || 0
    }));
    
    const colors = getColorPalette();
    
    AppState.charts.main = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: yCol,
                data: data,
                borderColor: colors[0],
                backgroundColor: colors[0] + '20',
                tension: 0.4,
                fill: false,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                title: {
                    display: true,
                    text: `${yCol} Trend`,
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { type: 'category', grid: { display: false } }
            }
        }
    });
    
    document.getElementById('chartTitle').textContent = 'Line Chart Trend Analysis';
}

function renderPieChart() {
    document.getElementById('mainChart').style.display = 'block';
    const canvas = document.getElementById('mainChart');
    const ctx = canvas.getContext('2d');
    
    const topN = parseInt(document.getElementById('topN').value) || 10;
    const categoryCol = AppState.metadata.categorical[0] || AppState.metadata.headers[0];
    
    // Count occurrences
    const counts = {};
    AppState.filteredData.forEach(row => {
        const cat = row[categoryCol];
        counts[cat] = (counts[cat] || 0) + 1;
    });
    
    const sorted = Object.entries(counts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, topN);
    
    const labels = sorted.map(([label]) => label);
    const data = sorted.map(([, value]) => value);
    
    const colors = getColorPalette();
    
    AppState.charts.main = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' },
                title: {
                    display: true,
                    text: `${categoryCol} Distribution`,
                    font: { size: 16, weight: 'bold' }
                }
            }
        }
    });
    
    document.getElementById('chartTitle').textContent = 'Pie Chart Distribution';
}

function renderHistogram() {
    document.getElementById('mainChart').style.display = 'block';
    const canvas = document.getElementById('mainChart');
    const ctx = canvas.getContext('2d');
    
    const numCol = AppState.metadata.numeric[0];
    if (!numCol) {
        alert('No numeric column found for histogram');
        return;
    }
    
    const values = AppState.filteredData
        .map(row => parseFloat(row[numCol]))
        .filter(v => !isNaN(v));
    
    // Create bins
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binCount = 20;
    const binSize = (max - min) / binCount;
    
    const bins = new Array(binCount).fill(0);
    const binLabels = [];
    
    for (let i = 0; i < binCount; i++) {
        const binStart = min + (i * binSize);
        const binEnd = binStart + binSize;
        binLabels.push(`${binStart.toFixed(1)}-${binEnd.toFixed(1)}`);
        
        values.forEach(v => {
            if (v >= binStart && v < binEnd) bins[i]++;
        });
    }
    
    const colors = getColorPalette();
    
    AppState.charts.main = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: binLabels,
            datasets: [{
                label: 'Frequency',
                data: bins,
                backgroundColor: colors[0],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: `${numCol} Distribution (Histogram)`,
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Frequency' } },
                x: { title: { display: true, text: numCol } }
            }
        }
    });
    
    document.getElementById('chartTitle').textContent = 'Histogram Distribution';
}

function renderScatterPlot() {
    document.getElementById('mainChart').style.display = 'block';
    const canvas = document.getElementById('mainChart');
    const ctx = canvas.getContext('2d');
    
    const xCol = AppState.metadata.numeric[0];
    const yCol = AppState.metadata.numeric[1] || AppState.metadata.numeric[0];
    
    if (!xCol || !yCol) {
        alert('Need at least 2 numeric columns for scatter plot');
        return;
    }
    
    const data = AppState.filteredData.slice(0, 500).map(row => ({
        x: parseFloat(row[xCol]) || 0,
        y: parseFloat(row[yCol]) || 0
    }));
    
    const colors = getColorPalette();
    
    AppState.charts.main = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: `${xCol} vs ${yCol}`,
                data: data,
                backgroundColor: colors[0] + '80',
                borderColor: colors[0],
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                title: {
                    display: true,
                    text: `${xCol} vs ${yCol} Correlation`,
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                x: { title: { display: true, text: xCol } },
                y: { title: { display: true, text: yCol } }
            }
        }
    });
    
    document.getElementById('chartTitle').textContent = 'Scatter Plot Analysis';
}

function renderAreaChart() {
    document.getElementById('mainChart').style.display = 'block';
    const canvas = document.getElementById('mainChart');
    const ctx = canvas.getContext('2d');
    
    const xCol = AppState.metadata.headers[0];
    const yCol = AppState.metadata.numeric[0];
    
    const data = AppState.filteredData.slice(0, 50).map(row => ({
        x: row[xCol],
        y: parseFloat(row[yCol]) || 0
    }));
    
    const colors = getColorPalette();
    
    AppState.charts.main = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: yCol,
                data: data,
                borderColor: colors[0],
                backgroundColor: colors[0] + '40',
                tension: 0.4,
                fill: true,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                title: {
                    display: true,
                    text: `${yCol} Area Chart`,
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                y: { beginAtZero: true },
                x: { type: 'category' }
            }
        }
    });
    
    document.getElementById('chartTitle').textContent = 'Area Chart Analysis';
}

function renderBoxPlot() {
    document.getElementById('mainChart').style.display = 'block';
    const canvas = document.getElementById('mainChart');
    const ctx = canvas.getContext('2d');
    
    const numericCols = AppState.metadata.numeric.slice(0, 5);
    
    if (numericCols.length === 0) {
        alert('No numeric columns found for box plot');
        return;
    }
    
    const datasets = numericCols.map((col, idx) => {
        const values = AppState.filteredData
            .map(row => parseFloat(row[col]))
            .filter(v => !isNaN(v))
            .sort((a, b) => a - b);
        
        const q1 = values[Math.floor(values.length * 0.25)];
        const median = values[Math.floor(values.length * 0.5)];
        const q3 = values[Math.floor(values.length * 0.75)];
        const min = values[0];
        const max = values[values.length - 1];
        
        const colors = getColorPalette();
        
        return {
            label: col,
            data: [{
                min: min,
                q1: q1,
                median: median,
                q3: q3,
                max: max
            }],
            backgroundColor: colors[idx % colors.length] + '60',
            borderColor: colors[idx % colors.length],
            borderWidth: 2
        };
    });
    
    AppState.charts.main = new Chart(ctx, {
        type: 'boxplot',
        data: {
            labels: ['Distribution'],
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                title: {
                    display: true,
                    text: 'Box Plot - Statistical Distribution',
                    font: { size: 16, weight: 'bold' }
                }
            }
        }
    });
    
    document.getElementById('chartTitle').textContent = 'Box Plot Analysis';
}

function renderHeatmap() {
    document.getElementById('heatmapContainer').style.display = 'block';
    const canvas = document.getElementById('mainChart');
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    
    // Create correlation matrix for numeric columns
    const numericCols = AppState.metadata.numeric.slice(0, 8);
    
    if (numericCols.length < 2) {
        alert('Need at least 2 numeric columns for heatmap');
        return;
    }
    
    const correlationData = [];
    
    numericCols.forEach((col1, i) => {
        numericCols.forEach((col2, j) => {
            const correlation = calculateCorrelation(col1, col2);
            correlationData.push({
                x: col2,
                y: col1,
                v: correlation
            });
        });
    });
    
    const colors = getColorPalette();
    
    AppState.charts.main = new Chart(ctx, {
        type: 'matrix',
        data: {
            datasets: [{
                label: 'Correlation',
                data: correlationData,
                backgroundColor(c) {
                    const value = c.dataset.data[c.dataIndex].v;
                    const alpha = Math.abs(value);
                    return value > 0 ? `rgba(16, 185, 129, ${alpha})` : `rgba(239, 68, 68, ${alpha})`;
                },
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.1)',
                width: ({ chart }) => (chart.chartArea || {}).width / numericCols.length - 1,
                height: ({ chart }) => (chart.chartArea || {}).height / numericCols.length - 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Correlation Heatmap',
                    font: { size: 16, weight: 'bold' }
                },
                tooltip: {
                    callbacks: {
                        title() { return ''; },
                        label(context) {
                            const v = context.dataset.data[context.dataIndex];
                            return [v.y + ' × ' + v.x, 'Correlation: ' + v.v.toFixed(2)];
                        }
                    }
                }
            },
            scales: {
                x: { type: 'category', labels: numericCols, offset: true },
                y: { type: 'category', labels: numericCols, offset: true }
            }
        }
    });
    
    document.getElementById('chartTitle').textContent = 'Heatmap - Correlation Matrix';
}

function calculateCorrelation(col1, col2) {
    const values1 = AppState.filteredData.map(row => parseFloat(row[col1])).filter(v => !isNaN(v));
    const values2 = AppState.filteredData.map(row => parseFloat(row[col2])).filter(v => !isNaN(v));
    
    const n = Math.min(values1.length, values2.length);
    const mean1 = values1.reduce((a, b) => a + b, 0) / n;
    const mean2 = values2.reduce((a, b) => a + b, 0) / n;
    
    let num = 0, den1 = 0, den2 = 0;
    
    for (let i = 0; i < n; i++) {
        const diff1 = values1[i] - mean1;
        const diff2 = values2[i] - mean2;
        num += diff1 * diff2;
        den1 += diff1 * diff1;
        den2 += diff2 * diff2;
    }
    
    return num / Math.sqrt(den1 * den2) || 0;
}

function renderBubbleChart() {
    document.getElementById('mainChart').style.display = 'block';
    const canvas = document.getElementById('mainChart');
    const ctx = canvas.getContext('2d');
    
    const xCol = AppState.metadata.numeric[0];
    const yCol = AppState.metadata.numeric[1];
    const sizeCol = AppState.metadata.numeric[2] || AppState.metadata.numeric[0];
    
    if (!xCol || !yCol) {
        alert('Need at least 2 numeric columns for bubble chart');
        return;
    }
    
    const data = AppState.filteredData.slice(0, 200).map(row => ({
        x: parseFloat(row[xCol]) || 0,
        y: parseFloat(row[yCol]) || 0,
        r: Math.max(5, Math.min(20, (parseFloat(row[sizeCol]) || 1) / 10))
    }));
    
    const colors = getColorPalette();
    
    AppState.charts.main = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Data Points',
                data: data,
                backgroundColor: colors[0] + '60',
                borderColor: colors[0],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: `Bubble Chart: ${xCol} vs ${yCol} (size: ${sizeCol})`,
                    font: { size: 16, weight: 'bold' }
                }
            },
            scales: {
                x: { title: { display: true, text: xCol } },
                y: { title: { display: true, text: yCol } }
            }
        }
    });
    
    document.getElementById('chartTitle').textContent = 'Bubble Chart Analysis';
}

function renderTreeMap() {
    document.getElementById('mainChart').style.display = 'block';
    const canvas = document.getElementById('mainChart');
    const ctx = canvas.getContext('2d');
    
    const categoryCol = AppState.metadata.categorical[0] || AppState.metadata.headers[0];
    const valueCol = AppState.metadata.numeric[0] || AppState.metadata.headers[1];
    
    // Aggregate data
    const aggregated = {};
    AppState.filteredData.forEach(row => {
        const cat = row[categoryCol];
        const val = parseFloat(row[valueCol]) || 1;
        aggregated[cat] = (aggregated[cat] || 0) + val;
    });
    
    const treeData = Object.entries(aggregated).map(([label, value]) => ({
        label: label,
        value: value
    }));
    
    const colors = getColorPalette();
    
    AppState.charts.main = new Chart(ctx, {
        type: 'treemap',
        data: {
            datasets: [{
                label: valueCol,
                tree: treeData,
                key: 'value',
                groups: ['label'],
                backgroundColor(ctx) {
                    return colors[ctx.dataIndex % colors.length] + '80';
                },
                borderColor: '#fff',
                borderWidth: 2,
                spacing: 1,
                labels: {
                    display: true,
                    formatter: (ctx) => ctx.raw._data.label,
                    color: '#fff',
                    font: { size: 14, weight: 'bold' }
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: `Tree Map: ${categoryCol} by ${valueCol}`,
                    font: { size: 16, weight: 'bold' }
                }
            }
        }
    });
    
    document.getElementById('chartTitle').textContent = 'Tree Map Visualization';
}

// ===================================
// Map Functions
// ===================================

function initializeMap() {
    const mapElement = document.getElementById('indiaMap');
    
    AppState.map = L.map(mapElement).setView([20.5937, 78.9629], 5);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(AppState.map);
    
    AppState.mapMarkers = L.layerGroup().addTo(AppState.map);
}

function updateMapData() {
    if (!AppState.map) return;
    
    AppState.mapMarkers.clearLayers();
    
    // Look for location columns
    const locationCols = AppState.metadata.headers.filter(h => 
        /city|state|location|place|address/i.test(h)
    );
    
    if (locationCols.length === 0) {
        document.getElementById('mapStatus').textContent = 'No location data';
        return;
    }
    
    document.getElementById('mapStatus').textContent = 'Plotting locations...';
    
    // Sample data for performance
    const sampleData = AppState.filteredData.slice(0, 50);
    
    // Add markers (simplified - in production you'd use geocoding API)
    const indianCities = {
        'mumbai': [19.0760, 72.8777],
        'delhi': [28.7041, 77.1025],
        'bangalore': [12.9716, 77.5946],
        'hyderabad': [17.3850, 78.4867],
        'chennai': [13.0827, 80.2707],
        'kolkata': [22.5726, 88.3639],
        'pune': [18.5204, 73.8567],
        'ahmedabad': [23.0225, 72.5714]
    };
    
    let markerCount = 0;
    
    sampleData.forEach(row => {
        const locationValue = row[locationCols[0]];
        if (locationValue) {
            const cityName = String(locationValue).toLowerCase();
            const coords = indianCities[cityName];
            
            if (coords) {
                L.marker(coords)
                    .bindPopup(`<strong>${locationValue}</strong><br>${JSON.stringify(row).slice(0, 100)}...`)
                    .addTo(AppState.mapMarkers);
                markerCount++;
            }
        }
    });
    
    document.getElementById('mapStatus').textContent = `${markerCount} locations`;
}

// ===================================
// Data Table
// ===================================

function renderDataTable() {
    const dataTable = document.getElementById('dataTable');
    const { currentPage, rowsPerPage } = AppState.pagination;
    
    const startIdx = (currentPage - 1) * rowsPerPage;
    const endIdx = startIdx + rowsPerPage;
    const pageData = AppState.filteredData.slice(startIdx, endIdx);
    
    if (pageData.length === 0) {
        dataTable.innerHTML = '<p class="text-center">No data to display</p>';
        return;
    }
    
    let html = '<table><thead><tr>';
    
    AppState.metadata.headers.forEach(header => {
        html += `<th>${header}</th>`;
    });
    
    html += '</tr></thead><tbody>';
    
    pageData.forEach(row => {
        html += '<tr>';
        AppState.metadata.headers.forEach(header => {
            const value = row[header];
            html += `<td>${value !== null && value !== undefined ? value : ''}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    
    dataTable.innerHTML = html;
    
    renderPagination();
}

function renderPagination() {
    const paginationDiv = document.getElementById('tablePagination');
    const totalPages = Math.ceil(AppState.filteredData.length / AppState.pagination.rowsPerPage);
    
    let html = `
        <div>Showing ${((AppState.pagination.currentPage - 1) * AppState.pagination.rowsPerPage) + 1} 
        to ${Math.min(AppState.pagination.currentPage * AppState.pagination.rowsPerPage, AppState.filteredData.length)} 
        of ${AppState.filteredData.length} rows</div>
        <div class="pagination-controls">
    `;
    
    html += `<button class="pagination-btn" onclick="changePage(1)" ${AppState.pagination.currentPage === 1 ? 'disabled' : ''}>
        <i class="fas fa-angle-double-left"></i>
    </button>`;
    
    html += `<button class="pagination-btn" onclick="changePage(${AppState.pagination.currentPage - 1})" 
        ${AppState.pagination.currentPage === 1 ? 'disabled' : ''}>
        <i class="fas fa-angle-left"></i>
    </button>`;
    
    html += `<span style="padding: 0 12px;">${AppState.pagination.currentPage} / ${totalPages}</span>`;
    
    html += `<button class="pagination-btn" onclick="changePage(${AppState.pagination.currentPage + 1})" 
        ${AppState.pagination.currentPage === totalPages ? 'disabled' : ''}>
        <i class="fas fa-angle-right"></i>
    </button>`;
    
    html += `<button class="pagination-btn" onclick="changePage(${totalPages})" 
        ${AppState.pagination.currentPage === totalPages ? 'disabled' : ''}>
        <i class="fas fa-angle-double-right"></i>
    </button>`;
    
    html += '</div>';
    
    paginationDiv.innerHTML = html;
}

function changePage(page) {
    const totalPages = Math.ceil(AppState.filteredData.length / AppState.pagination.rowsPerPage);
    if (page < 1 || page > totalPages) return;
    
    AppState.pagination.currentPage = page;
    renderDataTable();
}

function handleTableSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    
    if (!searchTerm) {
        AppState.filteredData = [...AppState.rawData];
    } else {
        AppState.filteredData = AppState.rawData.filter(row => {
            return Object.values(row).some(value => 
                String(value).toLowerCase().includes(searchTerm)
            );
        });
    }
    
    AppState.pagination.currentPage = 1;
    renderDataTable();
}

function handleRowsPerPageChange(e) {
    AppState.pagination.rowsPerPage = parseInt(e.target.value);
    AppState.pagination.currentPage = 1;
    renderDataTable();
}

function handleGlobalSearch(e) {
    handleTableSearch(e);
}

// ===================================
// Insights Generation
// ===================================

function generateInsights() {
    const insights = [];
    
    // Data size insight
    insights.push(`📊 Dataset contains ${AppState.rawData.length.toLocaleString()} records across ${AppState.metadata.headers.length} fields`);
    
    // Numeric insights
    if (AppState.metadata.numeric.length > 0) {
        const numCol = AppState.metadata.numeric[0];
        const values = AppState.rawData.map(r => parseFloat(r[numCol])).filter(v => !isNaN(v));
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        insights.push(`📈 Average ${numCol}: ${avg.toFixed(2)}`);
    }
    
    // Categorical insights
    if (AppState.metadata.categorical.length > 0) {
        const catCol = AppState.metadata.categorical[0];
        const unique = new Set(AppState.rawData.map(r => r[catCol])).size;
        insights.push(`🏷️ ${catCol} has ${unique} unique values`);
    }
    
    // Missing data insight
    const totalCells = AppState.rawData.length * AppState.metadata.headers.length;
    let missingCount = 0;
    AppState.rawData.forEach(row => {
        AppState.metadata.headers.forEach(header => {
            if (row[header] === null || row[header] === undefined || row[header] === '') {
                missingCount++;
            }
        });
    });
    const missingPercent = (missingCount / totalCells * 100).toFixed(1);
    insights.push(`⚠️ ${missingPercent}% of data cells are empty or missing`);
    
    // Render insights
    const container = document.getElementById('insightsContainer');
    container.innerHTML = insights.map(insight => 
        `<div class="insight-item">${insight}</div>`
    ).join('');
}

// ===================================
// Export Functions
// ===================================

function exportChartAsPNG() {
    if (!AppState.charts.main) {
        alert('No chart to export');
        return;
    }
    
    const link = document.createElement('a');
    link.download = `chart-${Date.now()}.png`;
    link.href = AppState.charts.main.toBase64Image();
    link.click();
}

function exportAsExcel() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(AppState.filteredData);
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `export-${Date.now()}.xlsx`);
}

function exportAsPDF() {
    alert('PDF export feature coming soon! For now, use Print to save as PDF.');
    window.print();
}

// ===================================
// Utility Functions
// ===================================

function handleSheetChange(e) {
    const sheetName = e.target.value;
    loadSheetData(sheetName);
}

function handleColorSchemeChange(e) {
    AppState.currentColorScheme = e.target.value;
    updateVisualization();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function toggleFullscreen() {
    const chartCard = document.querySelector('.chart-primary');
    if (!document.fullscreenElement) {
        chartCard.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function loadSavedPreferences() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.getElementById('themeToggle').click();
    }
    
    const savedScheme = localStorage.getItem('colorScheme');
    if (savedScheme) {
        AppState.currentColorScheme = savedScheme;
        document.getElementById('chartColorScheme').value = savedScheme;
    }
}

// ===================================
// Initialize
// ===================================

console.log('✅ Enterprise DataViz Pro - Ready');
