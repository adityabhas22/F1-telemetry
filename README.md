
# F1 Telemetry Visualization Platform

A modern web application for visualizing and analyzing Formula 1 race data, including lap times, telemetry, and driver performance comparisons.

## Features

- **Real-time Data Access**: Integration with FastF1 API for accessing official Formula 1 timing data
- **Multi-Driver Comparison**: Compare lap times and telemetry data between multiple drivers
- **Interactive Visualizations**:
  - Lap time comparison charts
  - Detailed telemetry visualization including:
    - Speed (km/h)
    - Throttle application (%)
    - Brake usage
  - Color-coded driver data for easy differentiation
  - Interactive data points with hover information

## Technical Stack

### Frontend
- Pure JavaScript with Chart.js for data visualization
- Modern CSS for styling and responsive design
- Dynamic DOM manipulation for real-time updates

### Backend
- Python FastAPI server
- FastF1 library for F1 data access
- Caching system for improved performance
- CORS support for cross-origin requests

## Project Structure

```
F1 Tracking Website/
├── frontend/
│   ├── js/
│   │   └── main.js         # Main frontend logic and visualizations
│   ├── css/                # Styling files
│   └── index.html          # Main HTML file
├── backend/
│   ├── app/
│   │   ├── routers/        # API route handlers
│   │   ├── cache_manager.py # Caching implementation
│   │   └── main.py         # FastAPI application
│   └── requirements.txt    # Python dependencies
└── start.sh               # Startup script
```

## Getting Started

1. **Prerequisites**
   - Python 3.8 or higher
   - Modern web browser
   - Node.js (optional, for development)

2. **Installation**
   ```bash
   # Clone the repository
   git clone [repository-url]

   # Install backend dependencies
   cd backend
   pip install -r requirements.txt

   # Start the application
   ./start.sh
   ```

3. **Usage**
   - Open your web browser and navigate to the application URL
   - Select a year and race from the dropdown menus
   - Choose session type (Race or Qualifying)
   - Select drivers to compare
   - Click on lap times to view detailed telemetry data

## Features in Detail

### Lap Time Comparison
- Interactive chart showing lap times for selected drivers
- Outlier detection and filtering for cleaner data
- Click on specific laps to view detailed telemetry

### Telemetry Visualization
- Real-time speed, throttle, and brake data
- Synchronized charts for easy comparison
- Distance-based alignment for accurate analysis
- Color-coded by driver for easy identification

### Data Selection
- Year and race selection
- Session type toggle (Race/Qualifying)
- Multi-driver selection with color coding
- Individual lap selection for detailed analysis

## Development

The project is built with a focus on:
- Clean, modular code structure
- Responsive and intuitive user interface
- Efficient data handling and caching
- Real-time data visualization
- Cross-browser compatibility

## Future Enhancements

- Additional telemetry metrics (DRS, gear shifts)
- Track position visualization
- Sector time analysis
- Race strategy comparison
- Weather data integration
- Historical data trends



## Acknowledgments

- FastF1 library for providing access to Formula 1 data
- Chart.js for powerful visualization capabilities
- Formula 1 for the underlying timing data
