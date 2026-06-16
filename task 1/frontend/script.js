// Global variables to store active state
let currentCity = "London";
let isCompareMode = false;
let refreshInterval = null;
let countdownInterval = null;
let countdownTime = 300; // 5 minutes

// Store active weather data for dynamic metric switching
let activeWeatherData = null;
let activeMetric = "temperature";

// Chart.js instances
let mainChartInstance = null;
let humidityChartInstance = null;
let windChartInstance = null;

// Document Ready
document.addEventListener("DOMContentLoaded", () => {
    // Initial fetch
    performSearch(currentCity);
    startAutoRefresh();

    // Event Listeners
    document.getElementById("searchForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const city = document.getElementById("cityInput").value.trim();
        if (city) {
            performSearch(city);
        }
    });

    document.getElementById("compareForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const city1 = document.getElementById("cityInput1").value.trim();
        const city2 = document.getElementById("cityInput2").value.trim();
        if (city1 && city2) {
            performComparison(city1, city2);
        }
    });

    // Quick Locations
    document.querySelectorAll(".btn-quick-loc").forEach(btn => {
        btn.addEventListener("click", () => {
            const city = btn.getAttribute("data-city");
            document.getElementById("cityInput").value = city;
            performSearch(city);
        });
    });

    // Theme Toggle
    document.getElementById("themeToggle").addEventListener("click", () => {
        toggleTheme();
    });

    // Toggle Compare Mode
    document.getElementById("compareModeBtn").addEventListener("click", () => {
        toggleCompareMode();
    });

    document.getElementById("closeCompareBtn").addEventListener("click", () => {
        toggleCompareMode(false);
    });

    // Refresh Button
    document.getElementById("refreshBtn").addEventListener("click", () => {
        performSearch(currentCity);
    });

    // Metric Cards Click Handlers (toggles main interactive chart metric)
    document.querySelectorAll(".clickable-card").forEach(card => {
        card.addEventListener("click", () => {
            const metric = card.getAttribute("data-metric");
            if (metric && activeWeatherData) {
                activeMetric = metric;
                
                // Highlight active card
                document.querySelectorAll(".clickable-card").forEach(c => c.classList.remove("active-metric"));
                card.classList.add("active-metric");
                
                // Redraw main chart with active metric
                renderMainChart(activeWeatherData);
                
                // Smooth scroll to visualization tab
                document.getElementById("visualizationCard").scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    });

    // Lightbox modal trigger for static Matplotlib/Seaborn charts
    const staticImagesInfo = [
        { id: "staticTempTrendImg", title: "14-Day Temperature Trend Chart (Backend)" },
        { id: "staticHumidityImg", title: "48-Hour Humidity Analysis Area Chart (Backend)" },
        { id: "staticWindImg", title: "Daily Max Wind Speed Comparison Bar Chart (Backend)" },
        { id: "staticPressureImg", title: "Atmospheric Pressure Distribution (Backend)" },
        { id: "staticCompositeImg", title: "Weather Statistics Overview Dashboard (Backend)" }
    ];

    staticImagesInfo.forEach(item => {
        const imgEl = document.getElementById(item.id);
        if (imgEl) {
            imgEl.addEventListener("click", () => {
                const src = imgEl.getAttribute("src");
                if (src && src.startsWith("data:image")) {
                    const modalImg = document.getElementById("lightboxChartImg");
                    const modalTitle = document.getElementById("chartLightboxModalLabel");
                    modalImg.src = src;
                    modalTitle.innerText = item.title;
                    
                    // Show Bootstrap Modal
                    const modalEl = document.getElementById("chartLightboxModal");
                    const modal = new bootstrap.Modal(modalEl);
                    modal.show();
                }
            });
        }
    });
});

// Perform Search for a single city
async function performSearch(city) {
    showLoader();
    clearAlerts();
    try {
        const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Failed to fetch weather data.");
        }
        
        const data = await response.json();
        currentCity = data.current.city;
        
        // Update UI panels
        updateWeatherUI(data);
        updateForecastUI(data.daily);
        updateAlertsUI(data.alerts);
        
        // Update Chart.js charts
        renderChartJS(data);

        // Load static Matplotlib/Seaborn charts
        await loadStaticCharts(currentCity);
        
        // Update PDF report download link
        document.getElementById("btnPdfDownload").href = `/api/pdf?city=${encodeURIComponent(currentCity)}`;
        
        // Reset countdown timer
        resetCountdown();
    } catch (error) {
        showAlert("danger", error.message || "An unexpected error occurred.");
    } finally {
        hideLoader();
    }
}

// Perform side-by-side comparison
async function performComparison(city1, city2) {
    showLoader();
    clearAlerts();
    try {
        const response = await fetch(`/api/compare?city1=${encodeURIComponent(city1)}&city2=${encodeURIComponent(city2)}`);
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Failed to compare locations.");
        }
        const data = await response.json();
        
        // Show comparison card
        document.getElementById("comparisonDetailsCard").classList.remove("d-none");
        
        // Populate names & temperatures
        document.getElementById("compCity1Name").innerText = data.city1.city;
        document.getElementById("compCity1Temp").innerText = `${data.city1.temperature}°C`;
        document.getElementById("compCity1Cond").innerText = data.city1.condition;
        
        document.getElementById("compCity2Name").innerText = data.city2.city;
        document.getElementById("compCity2Temp").innerText = `${data.city2.temperature}°C`;
        document.getElementById("compCity2Cond").innerText = data.city2.condition;
        
        document.getElementById("compHeaderCity1").innerText = data.city1.city;
        document.getElementById("compHeaderCity2").innerText = data.city2.city;
        
        // Populate details table
        const tbody = document.getElementById("comparisonTableBody");
        tbody.innerHTML = "";
        
        const metrics = [
            { label: "Feels Like Temp", key: "feels_like", unit: "°C", isTemp: true },
            { label: "Humidity", key: "humidity", unit: "%" },
            { label: "Wind Speed", key: "wind_speed", unit: " km/h" },
            { label: "Pressure", key: "pressure", unit: " hPa" },
            { label: "Cloud Cover", key: "cloud_cover", unit: "%" }
        ];
        
        metrics.forEach(metric => {
            const val1 = data.city1[metric.key];
            const val2 = data.city2[metric.key];
            const diff = roundTo1Decimal(val1 - val2);
            
            let diffClass = "comp-diff-zero";
            let diffSign = "";
            
            if (diff > 0) {
                diffClass = "comp-diff-plus";
                diffSign = "+";
            } else if (diff < 0) {
                diffClass = "comp-diff-minus";
            }
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><b>${metric.label}</b></td>
                <td class="text-center">${val1}${metric.unit}</td>
                <td class="text-center">${val2}${metric.unit}</td>
                <td class="text-center">
                    <span class="comp-diff-badge ${diffClass}">${diffSign}${diff}${metric.unit}</span>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (error) {
        showAlert("danger", error.message || "An error occurred comparing locations.");
    } finally {
        hideLoader();
    }
}

// Update Current Weather Card and statistics grid
function updateWeatherUI(data) {
    const curr = data.current;
    
    // Update main weather card
    document.getElementById("cityName").innerText = curr.city;
    document.getElementById("cityRegion").innerText = curr.region ? `${curr.region}, ${curr.country}` : curr.country;
    document.getElementById("currentTemp").innerText = `${Math.round(curr.temperature)}°C`;
    document.getElementById("weatherDesc").innerText = curr.condition;
    document.getElementById("localTime").innerText = curr.datetime;
    document.getElementById("feelsLikeTemp").innerText = `${curr.feels_like}°C`;
    
    // Set matching weather gradients dynamically
    const cardEl = document.getElementById("currentWeatherCard");
    cardEl.style.background = curr.gradient_bg;
    
    // Weather condition icon class mapping
    const iconContainer = document.getElementById("weatherIconContainer");
    iconContainer.innerHTML = `<i class="fa-solid ${curr.icon} text-white"></i>`;
    
    // Update sub metrics cards
    document.getElementById("statHumidity").innerText = `${curr.humidity}%`;
    document.getElementById("statWind").innerText = `${curr.wind_speed} km/h`;
    document.getElementById("statPressure").innerText = `${curr.pressure} hPa`;
    document.getElementById("statCloud").innerText = `${curr.cloud_cover}%`;
}

// Update 7-Day Forecast Grid
function updateForecastUI(dailyData) {
    const grid = document.getElementById("forecastGrid");
    grid.innerHTML = "";
    
    // Limit to 7 days of forecast. Open-Meteo returns past 7 days, current day, and forecast.
    // The forecast starts from index 7 (today) up to 14.
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    for (let i = 7; i < dailyData.time.length; i++) {
        const date = new Date(dailyData.time[i]);
        const dayName = i === 7 ? "Today" : daysOfWeek[date.getDay()];
        const maxTemp = Math.round(dailyData.temperature_2m_max[i]);
        const minTemp = Math.round(dailyData.temperature_2m_min[i]);
        const wmoCode = dailyData.weather_code[i];
        
        // Resolve condition and icon class
        const condition = getWMOCondition(wmoCode);
        
        const col = document.createElement("div");
        col.className = "col";
        col.innerHTML = `
            <div class="forecast-card-day">
                <div class="forecast-day-name text-muted small">${dayName}</div>
                <div class="forecast-icon" title="${condition.desc}"><i class="fa-solid ${condition.icon}"></i></div>
                <div class="forecast-temp-range fw-bold">${maxTemp}° / <span class="text-muted">${minTemp}°</span></div>
                <div class="forecast-cond mt-1 text-muted small">${condition.desc}</div>
            </div>
        `;
        grid.appendChild(col);
    }
}

// Update Alerts area
function updateAlertsUI(alerts) {
    const container = document.getElementById("alertsContainer");
    const wrapper = container.querySelector(".alerts-wrapper");
    wrapper.innerHTML = "";
    
    if (alerts && alerts.length > 0) {
        container.classList.remove("d-none");
        alerts.forEach(alert => {
            const alertDiv = document.createElement("div");
            alertDiv.className = `alert alert-${alert.type} d-flex align-items-center alert-dismissible fade show m-0 mb-2`;
            alertDiv.setAttribute("role", "alert");
            alertDiv.innerHTML = `
                <i class="fa-solid fa-triangle-exclamation me-3 fs-5"></i>
                <div>${alert.message}</div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            wrapper.appendChild(alertDiv);
        });
    } else {
        container.classList.add("d-none");
    }
}

// Render Interactive Chart.js charts
function renderChartJS(data) {
    // Cache active weather data globally
    activeWeatherData = data;

    // Set the visual highlight class on the active card
    document.querySelectorAll(".clickable-card").forEach(card => {
        card.classList.remove("active-metric");
        if (card.getAttribute("data-metric") === activeMetric) {
            card.classList.add("active-metric");
        }
    });

    // Render the main selected metric chart
    renderMainChart(data);

    // Render secondary charts
    renderSecondaryCharts(data);
}

// Render primary top large chart based on activeMetric selection
function renderMainChart(data) {
    const hourly = data.hourly;
    const theme = document.documentElement.getAttribute("data-theme");
    const textColor = theme === "dark" ? "#94a3b8" : "#475569";
    const gridColor = theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

    // Find start index matching local time
    const now = new Date();
    const currentISO = now.toISOString().slice(0, 13) + ":00";
    let startIndex = hourly.time.findIndex(t => t.startsWith(currentISO.slice(0, 13)));
    if (startIndex === -1) startIndex = 168; // 7 days past fallback

    const sliceEnd = startIndex + 24;
    const hourlySlice = hourly.time.slice(startIndex, sliceEnd);

    // Formats local hours directly from Open-Meteo ISO strings without timezone offsets bugs
    const hourlyTimes = hourlySlice.map(t => {
        const hourPart = t.split("T")[1]; // "20:00"
        const hourInt = parseInt(hourPart.split(":")[0]);
        const ampm = hourInt >= 12 ? 'PM' : 'AM';
        const displayHour = hourInt % 12 === 0 ? 12 : hourInt % 12;
        return `${displayHour}:00 ${ampm}`;
    });

    // Define visual properties based on activeMetric
    let chartLabel = "";
    let chartData = [];
    let strokeColor = "";
    let fillColor = "";
    let chartTitleText = "";
    let minVal = undefined;
    let maxVal = undefined;

    const canvas = document.getElementById("mainInteractiveChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);

    if (activeMetric === "temperature") {
        chartLabel = "Temperature (°C)";
        chartData = hourly.temperature_2m.slice(startIndex, sliceEnd);
        strokeColor = theme === "dark" ? '#3B82F6' : '#2563EB'; // Blue
        gradient.addColorStop(0, theme === "dark" ? "rgba(59, 130, 246, 0.4)" : "rgba(37, 99, 235, 0.3)");
        gradient.addColorStop(1, "rgba(59, 130, 246, 0.0)");
        fillColor = gradient;
        chartTitleText = "24-Hour Temperature Forecast";
    } else if (activeMetric === "humidity") {
        chartLabel = "Relative Humidity (%)";
        chartData = hourly.relative_humidity_2m.slice(startIndex, sliceEnd);
        strokeColor = '#10B981'; // Emerald
        gradient.addColorStop(0, "rgba(16, 185, 129, 0.3)");
        gradient.addColorStop(1, "rgba(16, 185, 129, 0.0)");
        fillColor = gradient;
        chartTitleText = "24-Hour Relative Humidity Forecast";
        minVal = 0;
        maxVal = 100;
    } else if (activeMetric === "wind_speed") {
        chartLabel = "Wind Speed (km/h)";
        chartData = hourly.wind_speed_10m.slice(startIndex, sliceEnd);
        strokeColor = '#F59E0B'; // Amber
        gradient.addColorStop(0, "rgba(245, 158, 11, 0.3)");
        gradient.addColorStop(1, "rgba(245, 158, 11, 0.0)");
        fillColor = gradient;
        chartTitleText = "24-Hour Wind Speed Forecast";
        minVal = 0;
    } else if (activeMetric === "pressure") {
        chartLabel = "Atmospheric Pressure (hPa)";
        chartData = hourly.pressure_msl.slice(startIndex, sliceEnd);
        strokeColor = '#EC4899'; // Pink
        gradient.addColorStop(0, "rgba(236, 72, 153, 0.3)");
        gradient.addColorStop(1, "rgba(236, 72, 153, 0.0)");
        fillColor = gradient;
        chartTitleText = "24-Hour Atmospheric Pressure Forecast";
    } else if (activeMetric === "cloud_cover") {
        chartLabel = "Cloud Cover (%)";
        chartData = hourly.cloud_cover.slice(startIndex, sliceEnd);
        strokeColor = '#6b7280'; // Slate Gray
        gradient.addColorStop(0, "rgba(107, 114, 128, 0.3)");
        gradient.addColorStop(1, "rgba(107, 114, 128, 0.0)");
        fillColor = gradient;
        chartTitleText = "24-Hour Cloud Cover Forecast";
        minVal = 0;
        maxVal = 100;
    }

    // Update title text in UI
    document.getElementById("mainChartTitle").innerText = chartTitleText;

    // Destroy and rebuild main chart
    if (mainChartInstance) mainChartInstance.destroy();
    
    mainChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hourlyTimes,
            datasets: [{
                label: chartLabel,
                data: chartData,
                borderColor: strokeColor,
                borderWidth: 3,
                backgroundColor: fillColor,
                fill: true,
                tension: 0.4,
                pointRadius: 2,
                pointHoverRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, maxTicksLimit: 12 }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor },
                    min: minVal,
                    max: maxVal
                }
            }
        }
    });
}

// Render auxiliary charts (Humidity & Wind bars) below main panel
function renderSecondaryCharts(data) {
    const hourly = data.hourly;
    const daily = data.daily;
    const theme = document.documentElement.getAttribute("data-theme");
    const textColor = theme === "dark" ? "#94a3b8" : "#475569";
    const gridColor = theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

    const now = new Date();
    const currentISO = now.toISOString().slice(0, 13) + ":00";
    let startIndex = hourly.time.findIndex(t => t.startsWith(currentISO.slice(0, 13)));
    if (startIndex === -1) startIndex = 168;

    const sliceEnd = startIndex + 24;
    const hourlySlice = hourly.time.slice(startIndex, sliceEnd);

    const hourlyTimes = hourlySlice.map(t => {
        const hourPart = t.split("T")[1];
        const hourInt = parseInt(hourPart.split(":")[0]);
        const ampm = hourInt >= 12 ? 'PM' : 'AM';
        const displayHour = hourInt % 12 === 0 ? 12 : hourInt % 12;
        return `${displayHour}:00 ${ampm}`;
    });
    
    const hourlyHumidity = hourly.relative_humidity_2m.slice(startIndex, sliceEnd);

    // Formats dates correctly without local timezone distortion
    const dailyDates = daily.time.slice(7).map(t => {
        const parts = t.split("-");
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        const d = new Date(year, month, day);
        const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${daysOfWeek[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
    });
    const weeklyWind = daily.wind_speed_10m_max.slice(7);

    // Chart.js 2: Hourly Humidity
    if (humidityChartInstance) humidityChartInstance.destroy();
    const humCtx = document.getElementById("humidityHourlyChart").getContext("2d");
    const humGradient = humCtx.createLinearGradient(0, 0, 0, 300);
    humGradient.addColorStop(0, "rgba(16, 185, 129, 0.3)");
    humGradient.addColorStop(1, "rgba(16, 185, 129, 0.0)");

    humidityChartInstance = new Chart(humCtx, {
        type: 'line',
        data: {
            labels: hourlyTimes,
            datasets: [{
                label: 'Humidity (%)',
                data: hourlyHumidity,
                borderColor: '#10B981',
                borderWidth: 2.5,
                backgroundColor: humGradient,
                fill: true,
                tension: 0.3,
                pointRadius: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: textColor, maxTicksLimit: 6 } },
                y: { grid: { color: gridColor }, ticks: { color: textColor }, min: 0, max: 100 }
            }
        }
    });

    // Chart.js 3: Weekly Wind Speed
    if (windChartInstance) windChartInstance.destroy();
    const windCtx = document.getElementById("windWeeklyChart").getContext("2d");

    windChartInstance = new Chart(windCtx, {
        type: 'bar',
        data: {
            labels: dailyDates,
            datasets: [{
                label: 'Max Wind Speed (km/h)',
                data: weeklyWind,
                backgroundColor: theme === "dark" ? 'rgba(59, 130, 246, 0.7)' : 'rgba(37, 99, 235, 0.7)',
                borderColor: theme === "dark" ? '#3B82F6' : '#2563EB',
                borderWidth: 1.5,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor } },
                y: { grid: { color: gridColor }, ticks: { color: textColor } }
            }
        }
    });
}

// Fetch and render static Matplotlib/Seaborn charts
async function loadStaticCharts(city) {
    const theme = document.documentElement.getAttribute("data-theme") || "dark";
    
    // Show static loaders
    document.querySelectorAll(".static-loader").forEach(loader => loader.classList.remove("d-none"));
    
    try {
        const response = await fetch(`/api/charts?city=${encodeURIComponent(city)}&theme=${theme}`);
        if (!response.ok) throw new Error("Failed to load backend charts.");
        
        const data = await response.json();
        const charts = data.charts;
        
        // To prevent cache, we load them via Base64 data strings returned in the JSON!
        document.getElementById("staticTempTrendImg").src = `data:image/png;base64,${charts.temp_trend.base64}`;
        document.getElementById("staticHumidityImg").src = `data:image/png;base64,${charts.humidity.base64}`;
        document.getElementById("staticWindImg").src = `data:image/png;base64,${charts.wind.base64}`;
        document.getElementById("staticPressureImg").src = `data:image/png;base64,${charts.pressure.base64}`;
        document.getElementById("staticCompositeImg").src = `data:image/png;base64,${charts.composite.base64}`;
        
    } catch (e) {
        console.error("Error loading static charts:", e);
    } finally {
        document.querySelectorAll(".static-loader").forEach(loader => loader.classList.add("d-none"));
    }
}

// Toggle Dark/Light Mode
function toggleTheme() {
    const htmlEl = document.documentElement;
    const currentTheme = htmlEl.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    
    htmlEl.setAttribute("data-theme", newTheme);
    
    // Update theme toggle icon
    const themeIcon = document.querySelector("#themeToggle i");
    if (newTheme === "light") {
        themeIcon.className = "fa-solid fa-sun";
    } else {
        themeIcon.className = "fa-solid fa-moon";
    }
    
    // Refresh Chart.js themes
    if (tempChartInstance) {
        // We re-query the weather to trigger full re-render
        performSearch(currentCity);
    }
}

// Toggle Compare Mode Layout
function toggleCompareMode(forceState = null) {
    const searchCard = document.getElementById("searchWidgetCard");
    const compareCard = document.getElementById("compareWidgetCard");
    const compDetailsCard = document.getElementById("comparisonDetailsCard");
    const compareBtn = document.getElementById("compareModeBtn");
    
    isCompareMode = forceState !== null ? forceState : !isCompareMode;
    
    if (isCompareMode) {
        searchCard.classList.add("d-none");
        compareCard.classList.remove("d-none");
        compareBtn.classList.add("active");
        
        // Prefill inputs
        document.getElementById("cityInput1").value = currentCity;
    } else {
        searchCard.classList.remove("d-none");
        compareCard.classList.add("d-none");
        compDetailsCard.classList.add("d-none");
        compareBtn.classList.remove("active");
    }
}

// Helper: Start Auto Refresh Countdown
function startAutoRefresh() {
    // Timer interval
    refreshInterval = setInterval(() => {
        performSearch(currentCity);
    }, 300000); // 5 minutes

    // Countdown UI ticking
    countdownInterval = setInterval(() => {
        countdownTime--;
        document.getElementById("refreshCountdown").innerText = countdownTime;
        if (countdownTime <= 0) {
            countdownTime = 300;
        }
    }, 1000);
}

function resetCountdown() {
    countdownTime = 300;
    document.getElementById("refreshCountdown").innerText = countdownTime;
}

// Helper: Show/Hide loaders
function showLoader() {
    document.body.classList.add("loading");
}
function hideLoader() {
    document.body.classList.remove("loading");
}

// Helper: Alert messages
function showAlert(type, message) {
    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.setAttribute("role", "alert");
    alertDiv.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation me-2"></i>
        <span>${message}</span>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    const container = document.getElementById("alertsContainer");
    container.classList.remove("d-none");
    container.querySelector(".alerts-wrapper").appendChild(alertDiv);
}

function clearAlerts() {
    const container = document.getElementById("alertsContainer");
    container.classList.add("d-none");
    container.querySelector(".alerts-wrapper").innerHTML = "";
}

// helper: WMO Weather Interpretation Codes decoder
function getWMOCondition(code) {
    const mapping = {
        0: { desc: "Clear sky", icon: "fa-sun" },
        1: { desc: "Mainly clear", icon: "fa-cloud-sun" },
        2: { desc: "Partly cloudy", icon: "fa-cloud" },
        3: { desc: "Overcast", icon: "fa-cloud" },
        45: { desc: "Fog", icon: "fa-smog" },
        48: { desc: "Depositing rime fog", icon: "fa-smog" },
        51: { desc: "Light drizzle", icon: "fa-cloud-rain" },
        53: { desc: "Moderate drizzle", icon: "fa-cloud-rain" },
        55: { desc: "Dense drizzle", icon: "fa-cloud-showers-heavy" },
        61: { desc: "Slight rain", icon: "fa-cloud-rain" },
        63: { desc: "Moderate rain", icon: "fa-cloud-showers-heavy" },
        65: { desc: "Heavy rain", icon: "fa-cloud-showers-heavy" },
        71: { desc: "Slight snowfall", icon: "fa-snowflake" },
        73: { desc: "Moderate snowfall", icon: "fa-snowflake" },
        75: { desc: "Heavy snowfall", icon: "fa-snowflake" },
        95: { desc: "Thunderstorm", icon: "fa-bolt" },
        96: { desc: "Thunderstorm + Hail", icon: "fa-cloud-bolt" },
        99: { desc: "Thunderstorm + Heavy Hail", icon: "fa-cloud-bolt" }
    };
    return mapping[code] || { desc: "Cloudy", icon: "fa-cloud" };
}

function roundTo1Decimal(num) {
    return Math.round(num * 10) / 10;
}
