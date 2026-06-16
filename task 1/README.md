# AETHERIS — Weather Analytics Dashboard

AETHERIS is a premium full-stack weather analytics dashboard that provides real-time weather observations, forecasts, historical data analysis, city comparison, severe weather alerts, and downloadable PDF reports.

It uses the keyless **Open-Meteo API**, so no API registration is required.

## Tech Stack

### Backend

* Python 3
* Flask REST API
* Requests
* Pandas
* Matplotlib
* Seaborn
* ReportLab

### Frontend

* HTML5
* CSS3
* JavaScript ES6+
* Bootstrap 5
* FontAwesome 6
* Chart.js

## Features

### 1. Dynamic Location Search

* Search weather for any city globally.
* Fetches temperature, feels-like temperature, humidity, pressure, wind speed, weather condition, and local date/time.

### 2. Double Visualizer System

* Interactive frontend charts using Chart.js.
* Backend-generated professional charts using Matplotlib and Seaborn.

Charts include:

* Temperature trend
* Humidity analysis
* Wind speed comparison
* Pressure distribution
* Composite weather statistics

### 3. City Comparison

* Compare two cities side-by-side.
* Shows temperature, humidity, wind, and pressure differences using delta badges.

### 4. Weather Alerts

Detects conditions such as:

* Extreme heat
* Freezing temperature
* High wind
* Heavy rain

### 5. Dark and Light Theme

* Premium glassmorphism dark mode.
* Clean professional light mode.
* Charts adapt based on selected theme.

### 6. PDF Report Download

* Generates a complete PDF weather report.
* Includes current weather details and backend-generated charts.

## Folder Structure

```text
weather-dashboard/
│
├── backend/
│   ├── app.py
│   ├── api_handler.py
│   ├── visualization.py
│   └── requirements.txt
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── static/
│   └── charts/
│
├── templates/
│   └── index.html
│
└── README.md
```

## Installation

Install the required dependencies:

```bash
pip install -r backend/requirements.txt
```

## Run the Project

Start the Flask server:

```bash
python backend/app.py
```

Open the dashboard in your browser:

```text
http://127.0.0.1:5000/
```

## Project Type

This project is suitable for:

* Python internship task
* API integration project
* Data visualization project
* Weather analytics dashboard
* Mini project submission

## Project Name

**AETHERIS — Weather Analytics Dashboard**
