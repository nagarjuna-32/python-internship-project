// Application State Management
let currentFilepath = null;
let currentFilename = null;
let analysisResults = null;
let cleaningReport = null;
let previewColumns = [];
let previewData = [];

// Chart.js Global Instances
let trendChart = null;
let categoryChart = null;
let distributionChart = null;

// DOM Elements
const themeToggleBtn = document.getElementById('themeToggleBtn');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const loadingSection = document.getElementById('loadingSection');
const loadingText = document.getElementById('loadingText');
const dashboardSection = document.getElementById('dashboardSection');
const reuploadBtn = document.getElementById('reuploadBtn');

// Meta elements
const metaFilename = document.getElementById('metaFilename');
const metaFileSummary = document.getElementById('metaFileSummary');

// Stats elements
const statTotalRecords = document.getElementById('statTotalRecords');
const statAuditDuplicates = document.getElementById('statAuditDuplicates');
const statNumericCols = document.getElementById('statNumericCols');
const statNumericColsList = document.getElementById('statNumericColsList');
const statCategoricalCols = document.getElementById('statCategoricalCols');
const statCategoricalColsList = document.getElementById('statCategoricalColsList');
const statImputedCells = document.getElementById('statImputedCells');
const statImputedSummary = document.getElementById('statImputedSummary');

// Table elements
const previewTableHeader = document.getElementById('previewTableHeader');
const previewTableBody = document.getElementById('previewTableBody');

// Insights list
const insightsList = document.getElementById('insightsList');

// Form controls
const pdfSettingsForm = document.getElementById('pdfSettingsForm');
const pdfTitle = document.getElementById('pdfTitle');
const pdfSubtitle = document.getElementById('pdfSubtitle');
const pdfAuthor = document.getElementById('pdfAuthor');
const pdfTheme = document.getElementById('pdfTheme');
const pdfGroupBy = document.getElementById('pdfGroupBy');
const pdfTarget = document.getElementById('pdfTarget');
const generatePdfBtn = document.getElementById('generatePdfBtn');

// 1. Theme Configuration & Toggling
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
    const icon = themeToggleBtn.querySelector('i');
    if (theme === 'light') {
        icon.className = 'fa-solid fa-sun';
    } else {
        icon.className = 'fa-solid fa-moon';
    }
}

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    // Redraw charts if loaded, to adjust grid/text colors
    if (analysisResults) {
        renderCharts();
    }
});

// Initialize on page load
initTheme();

// 2. Drag & Drop File Upload Handlers
dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileUpload(e.target.files[0]);
    }
});

// Prevent defaults on drag/drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Drag highlights
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('active'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('active'), false);
});

// Handle drop
dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
        handleFileUpload(files[0]);
    }
});

// Reupload button
reuploadBtn.addEventListener('click', () => {
    // Reset file input
    fileInput.value = '';
    // Show upload, hide dashboard
    dashboardSection.style.display = 'none';
    uploadSection.style.display = 'block';
    // Clear loaded state
    currentFilepath = null;
    currentFilename = null;
    analysisResults = null;
    destroyCharts();
});

// 3. API Communication: Ingest and Analyze
function handleFileUpload(file) {
    const allowedExtensions = /(\.csv|\.xlsx|\.xls|\.json)$/i;
    if (!allowedExtensions.exec(file.name)) {
        showToast('Invalid file format. Please upload CSV, JSON or Excel files.', 'error');
        return;
    }
    
    if (file.size > 16 * 1024 * 1024) { // 16MB
        showToast('File is too large. Maximum supported size is 16MB.', 'error');
        return;
    }
    
    // Show Loading
    uploadSection.style.display = 'none';
    loadingSection.style.display = 'flex';
    loadingText.textContent = `Uploading and ingesting "${file.name}"...`;
    
    const formData = new FormData();
    formData.append('file', file);
    
    fetch('/api/analyze', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Server Ingestion Error'); });
        }
        return response.json();
    })
    .then(data => {
        populateDashboard(data);
        showToast(`Successfully analyzed "${file.name}"!`);
    })
    .catch(error => {
        loadingSection.style.display = 'none';
        uploadSection.style.display = 'block';
        showToast(error.message, 'error');
        console.error(error);
    });
}

// 4. In-Memory Sample Ingestion
function loadSampleDataset(filename) {
    // Show Loading
    uploadSection.style.display = 'none';
    loadingSection.style.display = 'flex';
    loadingText.textContent = `Loading server sample "${filename}"...`;
    
    fetch(`/api/sample/${filename}`)
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Sample loading error'); });
        }
        return response.json();
    })
    .then(data => {
        populateDashboard(data);
        showToast(`Successfully loaded sample dataset "${filename}"!`);
    })
    .catch(error => {
        loadingSection.style.display = 'none';
        uploadSection.style.display = 'block';
        showToast(error.message, 'error');
        console.error(error);
    });
}

// 5. Populate Dashboard Data
function populateDashboard(data) {
    // Save state variables
    currentFilepath = data.filepath;
    currentFilename = data.filename;
    analysisResults = data.analysis_results;
    cleaningReport = data.cleaning_report;
    previewColumns = data.preview_columns;
    previewData = data.preview_data;
    
    // Hide Loading, Show Dashboard
    loadingSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    
    // A. Meta Info Banner
    metaFilename.textContent = currentFilename;
    const initialDesc = `${cleaningReport.initial_rows} initial rows | ${cleaningReport.initial_cols} columns`;
    const cleanDesc = `Sanitized into ${analysisResults.total_records} rows. Format: ${currentFilename.split('.').pop().toUpperCase()}`;
    metaFileSummary.innerHTML = `<b>Source:</b> ${initialDesc} <i class="fa-solid fa-arrow-right" style="margin: 0 5px; font-size: 10px;"></i> <b>Cleaned:</b> ${cleanDesc}`;
    
    // B. Summary Statistics Cards
    statTotalRecords.textContent = analysisResults.total_records.toLocaleString();
    statAuditDuplicates.innerHTML = cleaningReport.duplicates_removed > 0 
        ? `<span style="color: var(--color-error);"><i class="fa-solid fa-trash-can"></i> ${cleaningReport.duplicates_removed} duplicates removed</span>`
        : '<i class="fa-solid fa-circle-check"></i> No duplicates found';
        
    statNumericCols.textContent = analysisResults.numerical_cols.length;
    statNumericColsList.textContent = analysisResults.numerical_cols.join(', ') || 'None';
    statNumericColsList.title = analysisResults.numerical_cols.join(', ');
    
    statCategoricalCols.textContent = analysisResults.categorical_cols.length;
    statCategoricalColsList.textContent = analysisResults.categorical_cols.join(', ') || 'None';
    statCategoricalColsList.title = analysisResults.categorical_cols.join(', ');
    
    // Count missing cells resolved
    let totalImputed = 0;
    let imputedCols = [];
    for (const [col, details] of Object.entries(cleaningReport.imputed_columns)) {
        totalImputed += details.null_count;
        imputedCols.push(col);
    }
    statImputedCells.textContent = totalImputed.toLocaleString();
    statImputedSummary.textContent = totalImputed > 0 
        ? `Cleaned: ${imputedCols.join(', ')}` 
        : 'Perfect dataset! No null cells.';
    statImputedSummary.title = imputedCols.join(', ');
    
    // C. Cleaned Data Preview Table
    renderPreviewTable();
    
    // D. Dropdowns for report customizer
    populateDropdowns(data.numeric_columns, data.categorical_columns);
    
    // E. Render Dashboard Charts
    renderCharts();
    
    // F. Key Insights List
    renderInsights();
}

function renderPreviewTable() {
    // Header
    previewTableHeader.innerHTML = '';
    previewColumns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col.replace(/_/g, ' ');
        previewTableHeader.appendChild(th);
    });
    
    // Body
    previewTableBody.innerHTML = '';
    previewData.forEach(row => {
        const tr = document.createElement('tr');
        previewColumns.forEach(col => {
            const td = document.createElement('td');
            let val = row[col];
            if (val === null || val === undefined) {
                td.innerHTML = '<em style="color: var(--color-text-muted);">null</em>';
            } else if (typeof val === 'number') {
                td.textContent = val.toLocaleString(undefined, { maximumFractionDigits: 3 });
            } else {
                td.textContent = val;
            }
            tr.appendChild(td);
        });
        previewTableBody.appendChild(tr);
    });
}

function populateDropdowns(numericCols, categoricalCols) {
    // Populate GroupBy Select (Categorical)
    pdfGroupBy.innerHTML = '';
    if (categoricalCols.length > 0) {
        categoricalCols.forEach(col => {
            const opt = document.createElement('option');
            opt.value = col;
            opt.textContent = col.replace(/_/g, ' ').toUpperCase();
            pdfGroupBy.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No Category Found';
        pdfGroupBy.appendChild(opt);
    }
    
    // Populate Target Metric Select (Numerical)
    pdfTarget.innerHTML = '';
    if (numericCols.length > 0) {
        numericCols.forEach(col => {
            const opt = document.createElement('option');
            opt.value = col;
            opt.textContent = col.replace(/_/g, ' ').toUpperCase();
            pdfTarget.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No Metric Found';
        pdfTarget.appendChild(opt);
    }

    // Default select change event listeners to update interactive chart
    pdfGroupBy.onchange = () => updateInteractiveBreakdownChart();
    pdfTarget.onchange = () => updateInteractiveBreakdownChart();
}

function renderInsights() {
    insightsList.innerHTML = '';
    if (analysisResults.key_insights.length > 0) {
        analysisResults.key_insights.forEach(insight => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fa-solid fa-lightbulb"></i> <span>${insight}</span>`;
            insightsList.appendChild(li);
        });
    } else {
        insightsList.innerHTML = '<li><i class="fa-solid fa-circle-info"></i> No statistical insights could be generated.</li>';
    }
}

// 6. Interactive Visualizations (Chart.js)
function destroyCharts() {
    if (trendChart) { trendChart.destroy(); trendChart = null; }
    if (categoryChart) { categoryChart.destroy(); categoryChart = null; }
    if (distributionChart) { distributionChart.destroy(); distributionChart = null; }
}

function renderCharts() {
    destroyCharts();
    
    // Fetch grid/text colors based on active theme
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#9ca3af' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    
    // Chart Color Themes matching CSS
    const chartBlue = '#3b82f6';
    const chartViolet = '#8b5cf6';
    const chartEmerald = '#10b981';
    
    // 1. Trend Chart
    const trendWrapper = document.getElementById('trendChartWrapper');
    const trendCanvas = document.getElementById('trendChart');
    if (analysisResults.datetime_cols.length > 0 && Object.keys(analysisResults.trends).length > 0) {
        trendWrapper.style.display = 'flex';
        const dateCol = analysisResults.datetime_cols[0];
        const trendData = analysisResults.trends[dateCol].data;
        const targetCol = analysisResults.trends[dateCol].target_column;
        
        const labels = trendData.map(d => d.period);
        const values = trendData.map(d => d.sum);
        
        const ctx = trendCanvas.getContext('2d');
        
        // Gradient fill
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
        
        trendChart = new Chart(trendCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `Sum of ${targetCol.replace(/_/g, ' ')}`,
                    data: values,
                    borderColor: chartBlue,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2.5,
                    pointBackgroundColor: chartBlue,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `${targetCol.replace(/_/g, ' ').toUpperCase()} TREND OVER TIME`,
                        color: isDark ? '#f3f4f6' : '#1e293b',
                        font: { family: 'Outfit', size: 13, weight: '700' }
                    },
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: textColor, font: { size: 10 } }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: textColor, font: { size: 10 } }
                    }
                }
            }
        });
    } else {
        trendWrapper.style.display = 'none';
    }
    
    // 2. Category Breakdown Chart
    const catWrapper = document.getElementById('categoryChartWrapper');
    const catCanvas = document.getElementById('categoryChart');
    if (Object.keys(analysisResults.categorical_breakdowns).length > 0) {
        catWrapper.style.display = 'flex';
        updateInteractiveBreakdownChart(true); // Draw initial
    } else {
        catWrapper.style.display = 'none';
    }
    
    // 3. Distribution/Doughnut Chart
    const distWrapper = document.getElementById('distributionChartWrapper');
    const distCanvas = document.getElementById('distributionChart');
    if (analysisResults.categorical_cols.length > 0) {
        distWrapper.style.display = 'flex';
        const catCol = analysisResults.categorical_cols[0];
        
        // Count distribution of records in dataset per category
        const counts = {};
        previewData.forEach(row => {
            const val = row[catCol] || 'Unknown';
            counts[val] = (counts[val] || 0) + 1;
        });
        
        const labels = Object.keys(counts);
        const values = Object.values(counts);
        
        distributionChart = new Chart(distCanvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: [
                        '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', 
                        '#06b6d4', '#ec4899', '#f43f5e', '#a855f7', '#64748b'
                    ],
                    borderWidth: isDark ? 2 : 1,
                    borderColor: isDark ? '#111827' : '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `RECORD SHARE BY ${catCol.replace(/_/g, ' ').toUpperCase()} (PREVIEW)`,
                        color: isDark ? '#f3f4f6' : '#1e293b',
                        font: { family: 'Outfit', size: 13, weight: '700' }
                    },
                    legend: {
                        position: 'right',
                        labels: { color: textColor, font: { size: 9 }, boxWidth: 12 }
                    }
                },
                cutout: '60%'
            }
        });
    } else {
        distWrapper.style.display = 'none';
    }
}

function updateInteractiveBreakdownChart(initialCall = false) {
    if (!analysisResults || Object.keys(analysisResults.categorical_breakdowns).length === 0) return;
    
    // If not initial call, we want to destroy the old category chart instance
    if (!initialCall && categoryChart) {
        categoryChart.destroy();
    }
    
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#9ca3af' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    const chartViolet = '#8b5cf6';
    
    // Read from dropdown selects (or use defaults if initial call)
    let selectedCat = pdfGroupBy.value;
    let selectedTarget = pdfTarget.value;
    
    // Fallback if elements not populated yet
    if (!selectedCat) selectedCat = Object.keys(analysisResults.categorical_breakdowns)[0];
    
    // Retrieve breakdown info
    let breakdown = analysisResults.categorical_breakdowns[selectedCat];
    if (!breakdown) return;
    
    // If target metric is changed, we display the sum for that group
    // Note: the pre-calculated breakdowns are grouped by the default target.
    // If they choose a different target column, we can estimate it or let it display the count/sum.
    // Since our backend returns breakdowns grouped by target_column, we display its data
    const labels = breakdown.data.slice(0, 8).map(d => d.category);
    const values = breakdown.data.slice(0, 8).map(d => d.sum);
    const metricName = breakdown.target_column;
    
    const catCanvas = document.getElementById('categoryChart');
    categoryChart = new Chart(catCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `Total ${metricName.replace(/_/g, ' ')}`,
                data: values,
                backgroundColor: chartViolet,
                borderRadius: 4,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `${metricName.replace(/_/g, ' ').toUpperCase()} BY ${selectedCat.replace(/_/g, ' ').toUpperCase()}`,
                    color: isDark ? '#f3f4f6' : '#1e293b',
                    font: { family: 'Outfit', size: 13, weight: '700' }
                },
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { size: 9 } }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { size: 9 } }
                }
            }
        }
    });
}

// 7. Request and Download PDF Report
pdfSettingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!currentFilepath) {
        showToast('No active session. Please upload a dataset.', 'error');
        return;
    }
    
    // Disable button and show loader
    generatePdfBtn.disabled = true;
    const origBtnHtml = generatePdfBtn.innerHTML;
    generatePdfBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Compiling PDF Report...';
    
    const payload = {
        filepath: currentFilepath,
        title: pdfTitle.value,
        subtitle: pdfSubtitle.value,
        author: pdfAuthor.value,
        theme: pdfTheme.value,
        groupby_column: pdfGroupBy.value,
        target_column: pdfTarget.value,
        intro_text: document.getElementById('pdfIntro').value,
        spacing_factor: document.getElementById('pdfSpacing').value,
        include_schema: document.getElementById('includeSchema').checked,
        include_outliers: document.getElementById('includeOutliers').checked,
        include_trend: document.getElementById('includeTrend').checked,
        include_categorical: document.getElementById('includeCategorical').checked,
        include_distribution: document.getElementById('includeDistribution').checked,
        include_insights: document.getElementById('includeInsights').checked
    };
    
    fetch('/api/generate_report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) {
            // Read error as JSON if content-type matches
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return response.json().then(err => { throw new Error(err.error || 'PDF Generation Error'); });
            } else {
                throw new Error('An error occurred during PDF compilation.');
            }
        }
        return response.blob();
    })
    .then(blob => {
        // Create virtual download element
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        // Output clean name
        const cleanTitle = pdfTitle.value.trim().replace(/[\s\W]+/g, '_');
        a.download = `${cleanTitle}_Report.pdf`;
        
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Restore button state
        generatePdfBtn.disabled = false;
        generatePdfBtn.innerHTML = origBtnHtml;
        showToast('PDF Report downloaded successfully!');
    })
    .catch(error => {
        generatePdfBtn.disabled = false;
        generatePdfBtn.innerHTML = origBtnHtml;
        showToast(error.message, 'error');
        console.error(error);
    });
});

// 8. Toast Notification Helper
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' 
        ? '<i class="fa-solid fa-circle-check"></i>' 
        : '<i class="fa-solid fa-triangle-exclamation"></i>';
        
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    
    // Fade out and remove after 4 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.5s ease';
        setTimeout(() => {
            container.removeChild(toast);
        }, 500);
    }, 4000);
}
