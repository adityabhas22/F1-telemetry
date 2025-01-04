// Global state to store selected data
const state = {
    selectedYear: 2024,  // Default to 2024
    selectedRace: null,
    selectedSession: null,
    selectedDriver: null,
    telemetryChart: null,  // Store chart instance for cleanup
    lapTimesChart: null   // Store lap times chart instance
};

// API base URL
const API_BASE_URL = 'http://localhost:8080/races';

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
        const response = await fetch(`${API_BASE_URL}/calendar/${state.selectedYear}`);
        const races = await response.json();
        
        const gpSelect = document.getElementById('gp-select');
        gpSelect.innerHTML = '<option value="" disabled selected>GP...</option>' +
            races.map(race => `
                <option value='${JSON.stringify(race)}'>${race.country}</option>
        `).join('');
        
        gpSelect.disabled = false;
    } catch (error) {
        console.error('Error loading races:', error);
        showError('Failed to load races');
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
            `${API_BASE_URL}/${endpoint}?year=${state.selectedYear}&race_name=${encodeURIComponent(state.selectedRace.race_name)}`
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
    state.selectedDriver = driverSelect.value;
    
    // Load driver details automatically
    await loadDriverDetails(state.selectedDriver);
}

// Helper function to reset dropdown
function resetDropdown(id, placeholder) {
    const dropdown = document.getElementById(id);
    dropdown.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
    dropdown.disabled = true;
}

// Load driver details
async function loadDriverDetails(driverNumber) {
    console.log('Loading driver details for:', driverNumber);
    const { selectedYear, selectedRace, selectedSession } = state;
    console.log('Current state:', { selectedYear, selectedRace, selectedSession });
    
    try {
        // Load lap times with session type parameter
        const url = `${API_BASE_URL}/lap-times?year=${selectedYear}&race_name=${encodeURIComponent(selectedRace.race_name)}&driver_number=${driverNumber}&session_type=${selectedSession}`;
        console.log('Fetching lap times from:', url);
        
        const response = await fetch(url);
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Received lap times data:', data);
        
        if (!data.lap_times || data.lap_times.length === 0) {
            throw new Error('No lap times data available');
        }
        
        const driverData = document.getElementById('driver-data');
        driverData.innerHTML = `
            <h3>${selectedSession.charAt(0).toUpperCase() + selectedSession.slice(1)} Lap Times for Car #${driverNumber}</h3>
            <div style="height: 600px; margin: 40px 0;">
                <canvas id="lapTimesChart"></canvas>
            </div>
            <div id="lap-selector" style="text-align: center; margin: 20px 0;">
                <label for="lap-select">Select Lap for Telemetry: </label>
                <select id="lap-select">
                    ${data.lap_times.map(lap => `
                        <option value="${lap.lap_number}">Lap ${lap.lap_number} - ${formatTime(lap.lap_time)}</option>
                    `).join('')}
                </select>
                <button onclick="loadTelemetryForLap()">View Telemetry</button>
            </div>
            <div id="data-visualization"></div>
        `;

        console.log('Created driver data HTML');

        // Create lap times chart
        const ctx = document.getElementById('lapTimesChart').getContext('2d');
        if (state.lapTimesChart) {
            state.lapTimesChart.destroy();
        }
        
        console.log('Creating lap times chart');

        // Process lap times and filter outliers
        const validLapTimes = data.lap_times
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

        console.log('Creating lap times chart with filtered data:', filteredLapTimes);
        state.lapTimesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: filteredLapTimes.map(lap => lap.lapNumber),
                datasets: [{
                    label: 'Lap Time',
                    data: filteredLapTimes.map(lap => lap.seconds),
                    borderColor: '#ff0000',
                    borderWidth: 0.5,  // Match telemetry line thickness
                    fill: false,
                    tension: 0.1,  // Slight smoothing
                    pointRadius: 3,
                    pointBackgroundColor: '#ff0000',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: '#ff0000',
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 2,
                    pointHitRadius: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'nearest',
                    intersect: true,
                    axis: 'x'
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const lapNumber = filteredLapTimes[index].lapNumber;
                        document.getElementById('lap-select').value = lapNumber;
                        loadTelemetryForLap();
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Lap Times',
                        color: '#ffffff',
                        padding: 10,
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    tooltip: {
                        enabled: true,
                        mode: 'nearest',
                        intersect: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        displayColors: false,
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
                                const lap = filteredLapTimes[items[0].dataIndex];
                                return `Lap ${lap.lapNumber}`;
                            },
                            label: (context) => {
                                const lap = filteredLapTimes[context.dataIndex];
                                return `Time: ${lap.originalTime}`;
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
                            callback: (value) => {
                                const minutes = Math.floor(value / 60);
                                const seconds = (value % 60).toFixed(3);
                                return `${minutes}:${seconds.padStart(6, '0')}`;
                            }
                        }
                    }
                },
                elements: {
                    point: {
                        radius: 4
                    },
                    line: {
                        borderWidth: 2,
                        tension: 0
                    }
                }
            }
        });
        
        console.log('Lap times chart created');
        
        // Store lap times data for later use
        state.currentLapTimes = data.lap_times;
    } catch (error) {
        console.error('Error loading driver details:', error);
        showError(`Failed to load driver details: ${error.message}`);
    }
}

async function loadTelemetryForLap() {
    const lapNumber = document.getElementById('lap-select').value;
    const { selectedYear, selectedRace, selectedDriver, selectedSession } = state;
    const visualization = document.getElementById('data-visualization');
    
    try {
                const telemetryResponse = await fetch(
            `${API_BASE_URL}/telemetry?year=${selectedYear}&race_name=${encodeURIComponent(selectedRace.race_name)}&driver_number=${selectedDriver}&lap_number=${lapNumber}&session_type=${selectedSession}`
                );
                const telemetryData = await telemetryResponse.json();
                
        // Destroy previous charts if they exist
        if (state.telemetryChart) {
            Object.values(state.telemetryChart).forEach(chart => chart?.destroy());
        }
        
                visualization.innerHTML = `
                    <div class="telemetry-summary">
                <h4>Lap ${lapNumber} Telemetry</h4>
                <p>Max Speed: ${Math.max(...telemetryData.telemetry.map(t => t.speed)).toFixed(1)} km/h</p>
            </div>
            <div class="telemetry-container">
                <div style="height: 600px; margin-bottom: 40px;">
                    <canvas id="speedChart"></canvas>
                </div>
                <div style="height: 400px; margin-bottom: 40px;">
                    <canvas id="throttleChart"></canvas>
                </div>
                <div style="height: 400px; margin-bottom: 20px;">
                    <canvas id="brakeChart"></canvas>
                </div>
                    </div>
                `;

        // Common options for all charts
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    padding: 12,
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 },
                    displayColors: false,
                    callbacks: {
                        title: (items) => `Distance: ${items[0].label}m`
                    }
                }
            },
            scales: {
                x: {
                    display: false,
                    grid: {
                        display: false,
                        drawBorder: false
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
                        },
                        padding: 10
                    }
                }
            }
        };

        // Bottom chart options (with x-axis)
        const bottomChartOptions = {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                x: {
                    display: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false,
                        lineWidth: 0.5
                    },
                    ticks: {
                        color: '#ffffff',
                        maxRotation: 0,
                        autoSkip: false,
                        callback: (value, index, values) => {
                            const distance = parseInt(telemetryData.telemetry[value]?.distance || 0);
                            return distance % 500 === 0 ? distance : '';
                        },
                        font: {
                            size: 12
                        },
                        padding: 10
                    },
                    title: {
                        display: true,
                        text: 'Distance (meters)',
                        color: '#ffffff',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        padding: 20
                    }
                }
            }
        };

        // Create speed chart with custom scale
        state.telemetryChart = {
            speed: new Chart(document.getElementById('speedChart').getContext('2d'), {
                type: 'line',
                data: {
                    labels: telemetryData.telemetry.map(t => t.distance.toFixed(0)),
                    datasets: [{
                        label: 'Speed',
                        data: telemetryData.telemetry.map(t => t.speed),
                        borderColor: 'rgb(255, 0, 0)',
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0,
                        pointHoverRadius: 3,
                        tension: 0.1
                    }]
                },
                options: {
                    ...commonOptions,
                    plugins: {
                        ...commonOptions.plugins,
                        title: {
                            display: true,
                            text: 'Speed (km/h)',
                            color: '#ffffff',
                            padding: 20,
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        }
                    },
                    scales: {
                        ...commonOptions.scales,
                        y: {
                            ...commonOptions.scales.y,
                            suggestedMin: 0,
                            suggestedMax: 350
                        }
                    }
                }
            }),
            
            throttle: new Chart(document.getElementById('throttleChart').getContext('2d'), {
                type: 'line',
                data: {
                    labels: telemetryData.telemetry.map(t => t.distance.toFixed(0)),
                    datasets: [{
                        label: 'Throttle',
                        data: telemetryData.telemetry.map(t => t.throttle),
                        borderColor: 'rgb(0, 255, 0)',
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0,
                        pointHoverRadius: 3,
                        tension: 0.1
                    }]
                },
                options: {
                    ...commonOptions,
                    plugins: {
                        ...commonOptions.plugins,
                        title: {
                            display: true,
                            text: 'Throttle (%)',
                            color: '#ffffff',
                            padding: 20,
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        }
                    },
                    scales: {
                        ...commonOptions.scales,
                        y: {
                            ...commonOptions.scales.y,
                            min: 0,
                            max: 100,
                            ticks: {
                                stepSize: 20
                            }
                        }
                    }
                }
            }),
            
            brake: new Chart(document.getElementById('brakeChart').getContext('2d'), {
                type: 'line',
                data: {
                    labels: telemetryData.telemetry.map(t => t.distance.toFixed(0)),
                    datasets: [{
                        label: 'Brake',
                        data: telemetryData.telemetry.map(t => t.brake ? 1 : 0),
                        borderColor: 'rgb(0, 0, 255)',
                        borderWidth: 2,
                        fill: false,
                        stepped: true,
                        pointRadius: 0,
                        pointHoverRadius: 3
                    }]
                },
                options: {
                    ...bottomChartOptions,
                    plugins: {
                        ...bottomChartOptions.plugins,
                        title: {
                            display: true,
                            text: 'Brake',
                            color: '#ffffff',
                            padding: 20,
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        }
                    },
                    scales: {
                        ...bottomChartOptions.scales,
                        y: {
                            ...bottomChartOptions.scales.y,
                            min: 0,
                            max: 1,
                            ticks: {
                                callback: value => value === 1 ? 'ON' : 'OFF',
                                stepSize: 1,
                                padding: 10
                            },
                            grid: {
                                display: false  // Remove grid lines for brake chart
                            }
                        }
                    }
                }
            })
        };
    } catch (error) {
        console.error('Error loading telemetry data:', error);
        showError('Failed to load telemetry data');
    }
}

// Error handling
function showError(message) {
    // Simple alert for now, could be improved with a proper error UI
    alert(message);
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', init); 