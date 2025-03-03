// Add styles to the document
const styles = document.createElement('style');
styles.textContent = `
    .selected-telemetry-laps {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 20px 0;
        padding: 10px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        min-height: 50px;
    }

    .telemetry-lap-tag {
        display: flex;
        align-items: center;
        padding: 5px 10px;
        background: #1e1e1e;
        border: 2px solid;
        border-radius: 4px;
        color: #ffffff;
        font-size: 14px;
        gap: 8px;
    }

    .remove-lap {
        background: none;
        border: none;
        color: #ffffff;
        cursor: pointer;
        font-size: 18px;
        padding: 0 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.7;
        transition: opacity 0.2s;
    }

    .remove-lap:hover {
        opacity: 1;
    }
`;
document.head.appendChild(styles);

// Environment configuration
const CONFIG = {
    development: {
        API_BASE_URL: 'https://apparent-barnacle-coherent.ngrok-free.app/races'
    },
    production: {
        API_BASE_URL: 'https://apparent-barnacle-coherent.ngrok-free.app/races'
    }
};

// Use development configuration by default
const ENVIRONMENT = window.location.hostname === 'localhost' ? 'development' : 'production';
const API_BASE_URL = CONFIG[ENVIRONMENT].API_BASE_URL;

// Update fetch configuration
const fetchConfig = {
    mode: 'cors',
    credentials: 'include',  // Include credentials
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
    }
};

// Global state to store selected data
const state = {
    selectedYear: 2024,  // Default to 2024
    selectedRace: null,
    selectedSession: null,
    selectedDrivers: [],  // Array to store multiple drivers
    driverColors: {},    // Map to store color for each driver
    driverNames: {},     // Map to store names for each driver
    telemetryChart: null,  // Store chart instance for cleanup
    lapTimesChart: null,   // Store lap times chart instance
    currentLapTimes: {},   // Map to store lap times for each driver
    selectedLapsByClick: new Set()  // Store clicked laps as "driverNumber:lapNumber"
};

// Register Chart.js plugins
if (typeof Chart !== 'undefined' && typeof ChartjsPluginCrosshair !== 'undefined') {
    Chart.register(ChartjsPluginCrosshair);
}

// Available colors for drivers (high contrast colors)
const driverColorPalette = [
    '#ff0000',  // Red
    '#00ff00',  // Green
    '#0000ff',  // Blue
    '#ffff00',  // Yellow
    '#ff00ff',  // Magenta
    '#00ffff',  // Cyan
    '#ff8000',  // Orange
    '#8000ff',  // Purple
    '#0080ff',  // Light Blue
    '#ff0080'   // Pink
];

// Format time string to mm:ss.SSS
function formatTime(timeStr) {
    if (!timeStr || timeStr === 'None') return '-';
    
    // Convert to milliseconds if it's in timedelta format
    if (timeStr.includes('days') || timeStr.includes('day')) {
        const parts = timeStr.split('.');
        if (parts.length !== 2) return timeStr;
        
        const milliseconds = parseInt(parts[1].slice(0, 3));
        const timeComponents = parts[0].split(':');
        const seconds = parseInt(timeComponents[timeComponents.length - 1]);
        const minutes = parseInt(timeComponents[timeComponents.length - 2]) || 0;
        
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }
    
    // If already in the right format, return as is
    if (timeStr.match(/^\d{2}:\d{2}\.\d{3}$/)) return timeStr;
    
    return timeStr;
}

// Initialize the application
async function init() {
    // Year is already enabled by default
    document.getElementById('year-select').value = '2024';
    await handleYearChange();
}

// Make sure we initialize only after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Register Chart.js plugins again after DOM is loaded
    if (typeof Chart !== 'undefined' && typeof ChartjsPluginCrosshair !== 'undefined') {
        Chart.register(ChartjsPluginCrosshair);
    }
    init();
});

// Handle year selection change
async function handleYearChange() {
    const yearSelect = document.getElementById('year-select');
    state.selectedYear = parseInt(yearSelect.value);
    
    // Reset and disable subsequent dropdowns
    resetDropdown('gp-select', 'GP...');
    resetDropdown('session-select', 'Session...');
    resetDropdown('driver-select', 'Drivers...');
    
    // Show loading state
    const gpWrapper = document.querySelector('.select-wrapper:nth-child(2)');
    gpWrapper.classList.add('loading');

    // Load races for selected year
    try {
        const response = await fetch(`${API_BASE_URL}/calendar/${state.selectedYear}`, {
            ...fetchConfig
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const races = await response.json();
        
        if (!Array.isArray(races)) {
            throw new Error('Expected races to be an array, got: ' + typeof races);
        }
        
        const gpSelect = document.getElementById('gp-select');
        gpSelect.innerHTML = '<option value="" disabled selected>GP...</option>' +
            races.map(race => `
                <option value='${JSON.stringify(race)}'>${race.country}</option>
        `).join('');
        
        gpSelect.disabled = false;
    } catch (error) {
        console.error('Error loading races:', error);
        showError(`Failed to load races: ${error.message}`);
    } finally {
        gpWrapper.classList.remove('loading');
    }
}

// Handle GP selection change
async function handleGPChange() {
    const gpSelect = document.getElementById('gp-select');
    if (!gpSelect.value) return;
    
    state.selectedRace = JSON.parse(gpSelect.value);
    
    // Reset and disable subsequent dropdowns
    resetDropdown('session-select', 'Session...');
    resetDropdown('driver-select', 'Drivers...');
    
    // Enable session selection
    const sessionSelect = document.getElementById('session-select');
    sessionSelect.disabled = false;
    sessionSelect.innerHTML = `
        <option value="" disabled selected>Session...</option>
        <option value="race">RACE</option>
        <option value="qualifying">QUALIFYING</option>
    `;
}

// Handle session selection change
async function handleSessionChange() {
    const sessionSelect = document.getElementById('session-select');
    if (!sessionSelect.value) return;
    
    state.selectedSession = sessionSelect.value;
    
    // Reset and disable driver dropdown
    resetDropdown('driver-select', 'Drivers...');
    
    // Show loading state
    const driverWrapper = document.querySelector('.select-wrapper:last-child');
    driverWrapper.classList.add('loading');
    
    // Load drivers for selected session
    try {
        const endpoint = state.selectedSession === 'qualifying' ? 'qualifying-results' : 'results';
        const response = await fetch(
            `${API_BASE_URL}/${endpoint}?year=${state.selectedYear}&race_name=${encodeURIComponent(state.selectedRace.race_name)}`,
            {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                }
            }
        );
        const data = await response.json();
        
        const driverSelect = document.getElementById('driver-select');
        driverSelect.innerHTML = '<option value="" disabled selected>Drivers...</option>' +
            data.results.map(result => `
                <option value="${result.driver_number}">${result.position}. ${result.driver_name}</option>
        `).join('');
        
        driverSelect.disabled = false;
    } catch (error) {
        console.error('Error loading session results:', error);
        showError('Failed to load session results');
    } finally {
        driverWrapper.classList.remove('loading');
    }
}

// Handle driver selection change
async function handleDriverChange() {
    const driverSelect = document.getElementById('driver-select');
    const selectedDriver = driverSelect.value;
    const selectedOption = driverSelect.options[driverSelect.selectedIndex];
    const driverName = selectedOption.text.split('. ')[1]; // Get name part after position
    
    // Check if driver is already selected
    if (state.selectedDrivers.includes(selectedDriver)) {
        alert('This driver is already selected');
        driverSelect.value = '';
        return;
    }
    
    // Assign a color to the new driver
    const availableColors = driverColorPalette.filter(color => 
        !Object.values(state.driverColors).includes(color)
    );
    if (availableColors.length === 0) {
        alert('Maximum number of drivers reached');
        driverSelect.value = '';
        return;
    }
    
    state.driverColors[selectedDriver] = availableColors[0];
    state.driverNames[selectedDriver] = driverName;
    state.selectedDrivers.push(selectedDriver);
    
    // Reset the dropdown
    driverSelect.value = '';
    
    // Load driver details and update visualization
    await loadDriverDetails();
}

// Function to remove a driver from comparison
function removeDriver(driverNumber) {
    const index = state.selectedDrivers.indexOf(driverNumber);
    if (index > -1) {
        state.selectedDrivers.splice(index, 1);
        delete state.driverColors[driverNumber];
        delete state.driverNames[driverNumber];
        delete state.currentLapTimes[driverNumber];
        loadDriverDetails();  // Reload visualization
    }
}

// Helper function to reset dropdown
function resetDropdown(id, placeholder) {
    const dropdown = document.getElementById(id);
    dropdown.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
    dropdown.disabled = true;
}

// Load driver details
async function loadDriverDetails() {
    if (state.selectedDrivers.length === 0) {
        document.getElementById('driver-data').innerHTML = '';
        return;
    }
    
    try {
        // Create driver data container
        const driverData = document.getElementById('driver-data');
        driverData.innerHTML = `
            <h3>${state.selectedSession.charAt(0).toUpperCase() + state.selectedSession.slice(1)} Data</h3>
            <div class="selected-drivers">
                ${state.selectedDrivers.map(driver => `
                    <div class="driver-tag" style="border-color: ${state.driverColors[driver]}">
                        ${state.driverNames[driver]}
                        <button onclick="removeDriver('${driver}')" class="remove-driver">×</button>
                    </div>
                `).join('')}
            </div>
            <div style="height: 600px; margin: 40px 0;">
                <canvas id="lapTimesChart"></canvas>
            </div>
            <div id="selected-telemetry-laps" class="selected-telemetry-laps">
                <!-- Selected laps will be displayed here -->
            </div>
            <div id="data-visualization"></div>
        `;

        // Load lap times for all selected drivers
        for (const driverNumber of state.selectedDrivers) {
            const url = `${API_BASE_URL}/lap-times?year=${state.selectedYear}&race_name=${encodeURIComponent(state.selectedRace.race_name)}&driver_number=${driverNumber}&session_type=${state.selectedSession}`;
            const response = await fetch(url, {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                }
            });
            const data = await response.json();
            
            if (!data.lap_times || data.lap_times.length === 0) {
                continue;
            }
            
            // Store lap times data
            state.currentLapTimes[driverNumber] = data.lap_times;
        }

        // Create lap times chart with multiple drivers
        await createLapTimesChart();
        
        // Initialize telemetry visualization container
        initializeTelemetryContainer();
        
        // Load telemetry for any previously selected laps
        if (state.selectedLapsByClick.size > 0) {
            await loadTelemetryForSelectedLaps();
        }
        
    } catch (error) {
        console.error('Error loading driver details:', error);
        showError(`Failed to load driver details: ${error.message}`);
    }
}

// Initialize telemetry container
function initializeTelemetryContainer() {
    const visualization = document.getElementById('data-visualization');
    visualization.innerHTML = `
        <div class="telemetry-container" style="position: relative; background: #1e1e1e; padding: 20px; border-radius: 8px;">
            <div id="vertical-slider" style="position: absolute; width: 2px; background: rgba(255, 255, 255, 0.7); top: 0; bottom: 0; display: none; pointer-events: none; z-index: 10;"></div>
            <div style="height: 675px; margin-bottom: 2px; position: relative; background: rgba(0, 0, 0, 0.3); border-radius: 4px; padding: 20px;">
                <div style="position: absolute; left: 20px; top: 20px; color: #fff; font-size: 16px; font-weight: 500; z-index: 1;">
                    Speed (km/h)
                </div>
                <canvas id="speedChart"></canvas>
            </div>
            <div style="height: 450px; margin-bottom: 2px; position: relative; background: rgba(0, 0, 0, 0.3); border-radius: 4px; padding: 20px;">
                <div style="position: absolute; left: 20px; top: 20px; color: #fff; font-size: 16px; font-weight: 500; z-index: 1;">
                    Throttle (%)
                </div>
                <canvas id="throttleChart"></canvas>
            </div>
            <div style="height: 300px; position: relative; background: rgba(0, 0, 0, 0.3); border-radius: 4px; padding: 20px;">
                <div style="position: absolute; left: 20px; top: 20px; color: #fff; font-size: 16px; font-weight: 500; z-index: 1;">
                    Brake
                </div>
                <canvas id="brakeChart"></canvas>
            </div>
            <div id="values-display" style="position: absolute; right: 20px; top: 20px; background: rgba(0, 0, 0, 0.8); padding: 10px; border-radius: 4px; color: white; display: none;"></div>
        </div>
    `;

    // Add mouse move handler to container
    const container = document.querySelector('.telemetry-container');
    const slider = document.getElementById('vertical-slider');
    const valuesDisplay = document.getElementById('values-display');

    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        
        // Show and position the slider
        slider.style.display = 'block';
        slider.style.left = `${x}px`;
        
        // Update values display if charts exist
        if (state.telemetryChart) {
            const speedChart = state.telemetryChart.speed;
            const chartArea = speedChart.chartArea;
            const xScale = speedChart.scales.x;
            
            // Only process if within chart area
            if (x >= chartArea.left && x <= chartArea.right) {
                const xValue = xScale.getValueForPixel(x - 20); // Adjust for padding
                
                // Binary search to find the exact distance in our sorted array
                const distances = Array.from(allDistances).sort((a, b) => a - b);
                let left = 0;
                let right = distances.length - 1;
                let exactDistance = distances[0];
                let minDiff = Math.abs(distances[0] - xValue);

                while (left <= right) {
                    const mid = Math.floor((left + right) / 2);
                    const diff = Math.abs(distances[mid] - xValue);
                    
                    if (diff < minDiff) {
                        minDiff = diff;
                        exactDistance = distances[mid];
                    }
                    
                    if (distances[mid] < xValue) {
                        left = mid + 1;
                    } else if (distances[mid] > xValue) {
                        right = mid - 1;
                    } else {
                        exactDistance = distances[mid];
                        break;
                    }
                }

                // Find the values at this exact distance for each chart
                const values = [];
                Object.entries(state.telemetryChart).forEach(([type, chart]) => {
                    chart.data.datasets.forEach(dataset => {
                        const point = dataset.data.find(p => p.x === exactDistance);
                        if (point) {
                            let value = '';
                            switch(type) {
                                case 'speed':
                                    value = `${Math.round(point.y)} km/h`;
                                    break;
                                case 'throttle':
                                    value = `${Math.round(point.y)}%`;
                                    break;
                                case 'brake':
                                    value = point.y <= 0 ? 'OFF' : 'ON';
                                    break;
                            }
                            values.push(`${dataset.label}: ${type.charAt(0).toUpperCase() + type.slice(1)} ${value}`);
                        }
                    });
                });

                // Update values display
                valuesDisplay.style.display = 'block';
                valuesDisplay.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 5px">Distance: ${Math.round(exactDistance)}m</div>
                    ${values.join('<br>')}
                `;
            }
        }
    });

    container.addEventListener('mouseleave', () => {
        slider.style.display = 'none';
        valuesDisplay.style.display = 'none';
    });
}

// Update selected telemetry laps display
function updateSelectedLapsDisplay() {
    const container = document.getElementById('selected-telemetry-laps');
    if (!container) return;

    const lapsHtml = Array.from(state.selectedLapsByClick).map(key => {
        const [driverNumber, lapNumber] = key.split(':');
        return `
            <div class="telemetry-lap-tag" style="border-color: ${state.driverColors[driverNumber]}">
                ${state.driverNames[driverNumber]} - Lap ${lapNumber}
                <button onclick="removeTelemetryLap('${key}')" class="remove-lap">×</button>
            </div>
        `;
    }).join('');

    container.innerHTML = lapsHtml;
}

// Remove telemetry lap
async function removeTelemetryLap(key) {
    state.selectedLapsByClick.delete(key);
    updateSelectedLapsDisplay();
    await loadTelemetryForSelectedLaps();
    createLapTimesChart(); // Refresh lap times chart to update point styles
}

// Create lap times chart with multiple drivers
async function createLapTimesChart() {
    const ctx = document.getElementById('lapTimesChart').getContext('2d');
    if (state.lapTimesChart) {
        state.lapTimesChart.destroy();
    }

    // Process lap times for all drivers
    const datasets = [];
    for (const driverNumber of state.selectedDrivers) {
        const driverLapTimes = state.currentLapTimes[driverNumber];
        if (!driverLapTimes) continue;

        // Process lap times and filter outliers
        const validLapTimes = driverLapTimes
            .map(lap => {
                const timeStr = formatTime(lap.lap_time);
                if (timeStr === '-') return null;
                const [mins, secs] = timeStr.split(':');
                return {
                    lapNumber: lap.lap_number,
                    seconds: parseFloat(mins) * 60 + parseFloat(secs),
                    originalTime: timeStr
                };
            })
            .filter(lap => lap !== null);

        // Calculate statistics for outlier detection
        const times = validLapTimes.map(lap => lap.seconds);
        const mean = times.reduce((a, b) => a + b, 0) / times.length;
        const stdDev = Math.sqrt(times.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / times.length);
        
        // Filter out laps that are more than 2 standard deviations from the mean
        const filteredLapTimes = validLapTimes.filter(lap => 
            Math.abs(lap.seconds - mean) <= 2 * stdDev
        );

        // Add dataset for this driver
        datasets.push({
            label: state.driverNames[driverNumber],
            data: filteredLapTimes.map(lap => lap.seconds),
            borderColor: state.driverColors[driverNumber],
            backgroundColor: state.driverColors[driverNumber],
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: (context) => {
                const index = context.dataIndex;
                const lapNumber = filteredLapTimes[index].lapNumber;
                return state.selectedLapsByClick.has(`${driverNumber}:${lapNumber}`) ? 6 : 3;
            },
            pointBackgroundColor: (context) => {
                const index = context.dataIndex;
                const lapNumber = filteredLapTimes[index].lapNumber;
                return state.selectedLapsByClick.has(`${driverNumber}:${lapNumber}`) ? 
                    '#ffffff' : state.driverColors[driverNumber];
            },
            pointBorderColor: (context) => {
                const index = context.dataIndex;
                const lapNumber = filteredLapTimes[index].lapNumber;
                return state.selectedLapsByClick.has(`${driverNumber}:${lapNumber}`) ? 
                    state.driverColors[driverNumber] : '#ffffff';
            },
            pointBorderWidth: (context) => {
                const index = context.dataIndex;
                const lapNumber = filteredLapTimes[index].lapNumber;
                return state.selectedLapsByClick.has(`${driverNumber}:${lapNumber}`) ? 2 : 1;
            },
            pointHoverRadius: 5,
            pointHoverBackgroundColor: state.driverColors[driverNumber],
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2,
            pointHitRadius: 10,
            // Store additional data for click handling
            lapNumbers: filteredLapTimes.map(lap => lap.lapNumber),
            driverNumber: driverNumber
        });
    }

    // Create chart with multiple datasets
    state.lapTimesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: datasets[0]?.lapNumbers || [],  // Use actual lap numbers for labels
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                intersect: true,
                axis: 'x'
            },
            onClick: async (event, elements) => {
                if (elements.length > 0) {
                    const element = elements[0];
                    const dataset = state.lapTimesChart.data.datasets[element.datasetIndex];
                    const lapNumber = dataset.lapNumbers[element.index];  // Use stored lap number directly
                    const driverNumber = dataset.driverNumber;
                    const key = `${driverNumber}:${lapNumber}`;
                    
                    // Toggle selection
                    if (state.selectedLapsByClick.has(key)) {
                        state.selectedLapsByClick.delete(key);
                    } else {
                        state.selectedLapsByClick.add(key);
                    }
                    
                    // Update display and load telemetry
                    updateSelectedLapsDisplay();
                    await loadTelemetryForSelectedLaps();
                    
                    // Redraw chart to update point styles
                    createLapTimesChart();
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#ffffff',
                        font: {
                            size: 12
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Lap Times Comparison',
                    color: '#ffffff',
                    padding: 10,
                    font: {
                        size: 14,
                        weight: 'bold'
                    }
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    padding: 10,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    callbacks: {
                        title: (items) => {
                            if (items.length === 0) return '';
                            return `Lap ${items[0].label}`;
                        },
                        label: function(context) {
                            const minutes = Math.floor(context.parsed.y / 60);
                            const seconds = (context.parsed.y % 60).toFixed(3);
                            return `${context.dataset.label}: ${minutes}:${seconds.padStart(6, '0')}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Lap Number',
                        color: '#ffffff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawTicks: false
                    },
                    ticks: {
                        color: '#ffffff',
                        font: {
                            size: 12
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Lap Time',
                        color: '#ffffff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawTicks: false
                    },
                    ticks: {
                        color: '#ffffff',
                        font: {
                            size: 12
                        },
                        callback: function(value) {
                            const minutes = Math.floor(value / 60);
                            const seconds = (value % 60).toFixed(3);
                            return `${minutes}:${seconds.padStart(6, '0')}`;
                        }
                    }
                }
            }
        }
    });
}

// Load telemetry for selected laps
async function loadTelemetryForSelectedLaps() {
    const visualization = document.getElementById('data-visualization');
    
    try {
        // If no laps are selected, initialize empty container
        if (state.selectedLapsByClick.size === 0) {
            initializeTelemetryContainer();
            return;
        }

        // Destroy previous charts if they exist
        if (state.telemetryChart) {
            Object.values(state.telemetryChart).forEach(chart => chart?.destroy());
        }
        
        // Fetch telemetry data for all selected laps
        const telemetryData = {};
        for (const key of state.selectedLapsByClick) {
            const [driverNumber, lapNumber] = key.split(':').map(str => str.trim());
            try {
                console.log(`Fetching telemetry for ${key} - Driver: ${driverNumber}, Lap: ${lapNumber}`);
                const url = `${API_BASE_URL}/telemetry?year=${state.selectedYear}&race_name=${encodeURIComponent(state.selectedRace.race_name)}&driver_number=${driverNumber}&lap_number=${parseInt(lapNumber)}&session_type=${state.selectedSession}`;
                console.log(`URL: ${url}`);
                
                const response = await fetch(url, {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'omit',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': 'true'
                    }
                });
                console.log(`Response status: ${response.status}`);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`Error response: ${errorText}`);
                    throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
                }
                
                const data = await response.json();
                console.log(`Received data:`, data);
                
                if (data && data.telemetry && data.telemetry.length > 0) {
                    telemetryData[key] = data;
                    console.log(`Successfully loaded telemetry for ${key}`);
                } else {
                    console.warn(`No telemetry data for Driver ${driverNumber}, Lap ${lapNumber}`);
                    state.selectedLapsByClick.delete(key);
                }
            } catch (error) {
                console.error(`Error loading telemetry for Driver ${driverNumber}, Lap ${lapNumber}:`, error);
                showError(`Failed to load telemetry: ${error.message}`);
                state.selectedLapsByClick.delete(key);
            }
        }

        // Update the display after removing any invalid laps
        updateSelectedLapsDisplay();

        // If we have no valid telemetry data after fetching, initialize empty container
        if (Object.keys(telemetryData).length === 0) {
            initializeTelemetryContainer();
            return;
        }

        // Initialize container if not already done
        if (!document.getElementById('speedChart')) {
            initializeTelemetryContainer();
        }
        
        // Create charts with the telemetry data
        await createTelemetryCharts(telemetryData);
        
    } catch (error) {
        console.error('Error loading telemetry data:', error);
        showError('Failed to load telemetry data');
        initializeTelemetryContainer();
    }
}

// Function to convert hex to HSL
function hexToHSL(hex) {
    // Remove the # if present
    hex = hex.replace('#', '');
    
    // Convert hex to RGB
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

// Function to convert HSL to hex
function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

// Function to generate unique colors for telemetry lines
function generateTelemetryColor(baseColor, index) {
    const hsl = hexToHSL(baseColor);
    
    // Generate variations by rotating hue and adjusting saturation/lightness
    const variations = [
        baseColor, // Original color
        hslToHex((hsl.h + 60) % 360, hsl.s, hsl.l),  // Rotate hue by 60 degrees
        hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l), // Complementary color
        hslToHex((hsl.h + 120) % 360, hsl.s, hsl.l), // Rotate hue by 120 degrees
        hslToHex((hsl.h + 240) % 360, hsl.s, hsl.l), // Rotate hue by 240 degrees
        hslToHex((hsl.h + 300) % 360, hsl.s, hsl.l), // Rotate hue by 300 degrees
        hslToHex(hsl.h, Math.min(100, hsl.s + 30), Math.min(100, hsl.l + 20)), // More saturated and lighter
        hslToHex((hsl.h + 30) % 360, Math.min(100, hsl.s + 20), hsl.l), // Slight hue shift with more saturation
        hslToHex((hsl.h + 330) % 360, hsl.s, Math.min(100, hsl.l + 10)), // Another hue variation
        hslToHex((hsl.h + 150) % 360, Math.min(100, hsl.s - 10), hsl.l)  // Muted complementary
    ];
    
    return variations[index % variations.length];
}

// Create telemetry charts with multiple drivers
async function createTelemetryCharts(telemetryData) {
    // Create a shared array of X coordinates (distances)
    const allDistances = new Set();
    Object.values(telemetryData).forEach(data => {
        data.telemetry.forEach(t => allDistances.add(t.distance));
    });
    const sortedDistances = Array.from(allDistances).sort((a, b) => a - b);

    // Common options for all charts
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    color: '#ffffff',
                    font: {
                        size: 12
                    },
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            tooltip: false,  // Disable default tooltip
            crosshair: {
                line: {
                    color: '#fff',
                    width: 1,
                    dashPattern: [5, 5]
                },
                sync: {
                    enabled: true,
                    group: 1,
                },
                zoom: {
                    enabled: false
                },
                snap: {
                    enabled: true
                }
            }
        },
        scales: {
            x: {
                type: 'linear',
                min: 0,
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                    drawBorder: false,
                    lineWidth: 0.5
                },
                ticks: {
                    color: '#ffffff',
                    font: {
                        size: 12
                    },
                    callback: (value) => `${value}m`,
                    padding: 0
                },
                title: {
                    display: true,
                    text: 'Distance (meters)',
                    color: '#ffffff',
                    font: {
                        size: 12
                    },
                    padding: 0
                }
            },
            y: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                    drawBorder: false,
                    lineWidth: 0.5
                },
                ticks: {
                    color: '#ffffff',
                    font: {
                        size: 12
                    }
                }
            }
        },
        layout: {
            padding: 0
        }
    };

    // Remove custom slider and values display
    const container = document.querySelector('.telemetry-container');
    container.innerHTML = `
        <div style="height: 675px; margin-bottom: 2px; position: relative; background: rgba(0, 0, 0, 0.3); border-radius: 4px; padding: 20px;">
            <div style="position: absolute; left: 20px; top: 20px; color: #fff; font-size: 16px; font-weight: 500; z-index: 1;">
                Speed (km/h)
            </div>
            <canvas id="speedChart"></canvas>
        </div>
        <div style="height: 450px; margin-bottom: 2px; position: relative; background: rgba(0, 0, 0, 0.3); border-radius: 4px; padding: 20px;">
            <div style="position: absolute; left: 20px; top: 20px; color: #fff; font-size: 16px; font-weight: 500; z-index: 1;">
                Throttle (%)
            </div>
            <canvas id="throttleChart"></canvas>
        </div>
        <div style="height: 300px; position: relative; background: rgba(0, 0, 0, 0.3); border-radius: 4px; padding: 20px;">
            <div style="position: absolute; left: 20px; top: 20px; color: #fff; font-size: 16px; font-weight: 500; z-index: 1;">
                Brake
            </div>
            <canvas id="brakeChart"></canvas>
        </div>
    `;

    // Create datasets for each chart type
    const chartData = {
        speed: { datasets: [] },
        throttle: { datasets: [] },
        brake: { datasets: [] }
    };

    // Keep track of color variations per driver
    const driverLapCounts = {};

    // Process telemetry data for each driver and lap
    for (const [key, data] of Object.entries(telemetryData)) {
        const [driverNumber, lapNumber] = key.split(':');
        const baseColor = state.driverColors[driverNumber];
        
        // Initialize or increment lap count for this driver
        driverLapCounts[driverNumber] = (driverLapCounts[driverNumber] || 0);
        const colorIndex = driverLapCounts[driverNumber]++;
        
        // Generate unique color for this lap
        const color = generateTelemetryColor(baseColor, colorIndex);
        const label = `${state.driverNames[driverNumber]} - Lap ${lapNumber}`;

        if (!data.telemetry || !Array.isArray(data.telemetry)) {
            console.warn(`Invalid telemetry data for ${label}`);
            continue;
        }

        // Speed dataset
        chartData.speed.datasets.push({
            label,
            data: data.telemetry.map(t => ({
                x: t.distance,
                y: t.speed
            })),
            borderColor: color,
            backgroundColor: color,
            borderWidth: 2,
            pointRadius: 0
        });

        // Throttle dataset
        chartData.throttle.datasets.push({
            label,
            data: data.telemetry.map(t => ({
                x: t.distance,
                y: t.throttle
            })),
            borderColor: color,
            backgroundColor: color,
            borderWidth: 2,
            pointRadius: 0
        });

        // Brake dataset
        chartData.brake.datasets.push({
            label,
            data: data.telemetry.map(t => ({
                x: t.distance,
                y: t.brake ? 1 : 0
            })),
            borderColor: color,
            backgroundColor: color,
            borderWidth: 2,
            pointRadius: 0,
            stepped: true
        });
    }

    // Create charts with synchronized X coordinates
    state.telemetryChart = {
        speed: new Chart(document.getElementById('speedChart').getContext('2d'), {
            type: 'line',
            data: chartData.speed,
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: {
                        ...commonOptions.scales.y,
                        title: {
                            display: true,
                            text: 'Speed (km/h)',
                            color: '#ffffff',
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        }),
        throttle: new Chart(document.getElementById('throttleChart').getContext('2d'), {
            type: 'line',
            data: chartData.throttle,
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: {
                        ...commonOptions.scales.y,
                        min: 0,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Throttle (%)',
                            color: '#ffffff',
                            font: {
                                size: 12
                            }
                        },
                        ticks: {
                            ...commonOptions.scales.y.ticks,
                            padding: 8
                        }
                    }
                }
            }
        }),
        brake: new Chart(document.getElementById('brakeChart').getContext('2d'), {
            type: 'line',
            data: chartData.brake,
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: {
                        ...commonOptions.scales.y,
                        min: -0.1,
                        max: 1.1,
                        ticks: {
                            ...commonOptions.scales.y.ticks,
                            callback: value => value <= 0 ? 'OFF' : value >= 1 ? 'ON' : ''
                        },
                        title: {
                            display: true,
                            text: 'Brake',
                            color: '#ffffff',
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        })
    };
}

// Error handling
function showError(message) {
    // Simple alert for now, could be improved with a proper error UI
    alert(message);
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', init); 