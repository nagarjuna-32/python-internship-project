import requests
from datetime import datetime

# WMO Weather Code Mapping
WMO_CODES = {
    0: {"condition": "Clear Sky", "icon": "fa-sun", "bg": "linear-gradient(135deg, #FF8C00, #FFD700)"},
    1: {"condition": "Mainly Clear", "icon": "fa-cloud-sun", "bg": "linear-gradient(135deg, #5F9EA0, #FFD700)"},
    2: {"condition": "Partly Cloudy", "icon": "fa-cloud", "bg": "linear-gradient(135deg, #708090, #B0C4DE)"},
    3: {"condition": "Overcast", "icon": "fa-cloud", "bg": "linear-gradient(135deg, #4F4F4F, #A9A9A9)"},
    45: {"condition": "Foggy", "icon": "fa-smog", "bg": "linear-gradient(135deg, #696969, #D3D3D3)"},
    48: {"condition": "Depositing Rime Fog", "icon": "fa-smog", "bg": "linear-gradient(135deg, #696969, #D3D3D3)"},
    51: {"condition": "Light Drizzle", "icon": "fa-cloud-rain", "bg": "linear-gradient(135deg, #4682B4, #B0C4DE)"},
    53: {"condition": "Moderate Drizzle", "icon": "fa-cloud-rain", "bg": "linear-gradient(135deg, #4682B4, #A0522D)"},
    55: {"condition": "Dense Drizzle", "icon": "fa-cloud-showers-heavy", "bg": "linear-gradient(135deg, #4682B4, #4B0082)"},
    56: {"condition": "Light Freezing Drizzle", "icon": "fa-snowflake", "bg": "linear-gradient(135deg, #AFEEEE, #B0C4DE)"},
    57: {"condition": "Dense Freezing Drizzle", "icon": "fa-snowflake", "bg": "linear-gradient(135deg, #AFEEEE, #4682B4)"},
    61: {"condition": "Slight Rain", "icon": "fa-cloud-rain", "bg": "linear-gradient(135deg, #1E90FF, #B0C4DE)"},
    63: {"condition": "Moderate Rain", "icon": "fa-cloud-showers-heavy", "bg": "linear-gradient(135deg, #1E90FF, #708090)"},
    65: {"condition": "Heavy Rain", "icon": "fa-cloud-showers-heavy", "bg": "linear-gradient(135deg, #00008B, #708090)"},
    66: {"condition": "Light Freezing Rain", "icon": "fa-cloud-meatball", "bg": "linear-gradient(135deg, #ADD8E6, #708090)"},
    67: {"condition": "Heavy Freezing Rain", "icon": "fa-cloud-meatball", "bg": "linear-gradient(135deg, #008B8B, #708090)"},
    71: {"condition": "Slight Snowfall", "icon": "fa-snowflake", "bg": "linear-gradient(135deg, #E0FFFF, #FFFFFF)"},
    73: {"condition": "Moderate Snowfall", "icon": "fa-snowflake", "bg": "linear-gradient(135deg, #B0E0E6, #FFFFFF)"},
    75: {"condition": "Heavy Snowfall", "icon": "fa-snowflake", "bg": "linear-gradient(135deg, #87CEEB, #FFFFFF)"},
    77: {"condition": "Snow Grains", "icon": "fa-snowflake", "bg": "linear-gradient(135deg, #87CEEB, #D3D3D3)"},
    80: {"condition": "Slight Rain Showers", "icon": "fa-cloud-showers-water", "bg": "linear-gradient(135deg, #1E90FF, #87CEEB)"},
    81: {"condition": "Moderate Rain Showers", "icon": "fa-cloud-showers-heavy", "bg": "linear-gradient(135deg, #1E90FF, #4682B4)"},
    82: {"condition": "Violent Rain Showers", "icon": "fa-cloud-showers-heavy", "bg": "linear-gradient(135deg, #000080, #4682B4)"},
    85: {"condition": "Slight Snow Showers", "icon": "fa-snowflake", "bg": "linear-gradient(135deg, #ADD8E6, #FFFFFF)"},
    86: {"condition": "Heavy Snow Showers", "icon": "fa-snowflake", "bg": "linear-gradient(135deg, #00BFFF, #FFFFFF)"},
    95: {"condition": "Thunderstorm", "icon": "fa-bolt", "bg": "linear-gradient(135deg, #191970, #4B0082)"},
    96: {"condition": "Thunderstorm with Slight Hail", "icon": "fa-cloud-bolt", "bg": "linear-gradient(135deg, #191970, #708090)"},
    99: {"condition": "Thunderstorm with Heavy Hail", "icon": "fa-cloud-bolt", "bg": "linear-gradient(135deg, #000080, #2F4F4F)"}
}

def get_weather_desc(code):
    return WMO_CODES.get(code, {"condition": "Unknown", "icon": "fa-question", "bg": "linear-gradient(135deg, #6c757d, #343a40)"})

class WeatherAPIError(Exception):
    pass

class CityNotFoundError(Exception):
    pass

def get_coordinates(city_name):
    """Resolves city name to latitude and longitude using Open-Meteo Geocoding API."""
    url = f"https://geocoding-api.open-meteo.com/v1/search?name={city_name}&count=1&language=en&format=json"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if not data.get("results"):
            raise CityNotFoundError(f"City '{city_name}' not found.")
            
        result = data["results"][0]
        return {
            "name": result["name"],
            "country": result.get("country", ""),
            "country_code": result.get("country_code", ""),
            "latitude": result["latitude"],
            "longitude": result["longitude"],
            "timezone": result.get("timezone", "UTC"),
            "admin1": result.get("admin1", "")  # e.g., State/Region
        }
    except requests.exceptions.RequestException as e:
        raise WeatherAPIError(f"Geocoding service error: {str(e)}")

def fetch_weather_data(city_name):
    """Fetches real-time, forecast, and historical weather data for a city."""
    geo_data = get_coordinates(city_name)
    
    lat = geo_data["latitude"]
    lon = geo_data["longitude"]
    timezone = geo_data["timezone"]
    
    # URL to fetch current, hourly forecast/history, daily forecast/history
    # past_days=7 parameter will fetch historical weather from the past 7 days as well
    forecast_url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}&timezone={timezone}"
        f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m"
        f"&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,pressure_msl,wind_speed_10m,cloud_cover"
        f"&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant"
        f"&past_days=7"
    )
    
    try:
        response = requests.get(forecast_url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        current = data.get("current", {})
        hourly = data.get("hourly", {})
        daily = data.get("daily", {})
        
        # Parse current condition details
        wmo_code = current.get("weather_code", 0)
        condition_info = get_weather_desc(wmo_code)
        
        # Generate weather alerts if parameters exceed normal thresholds
        alerts = []
        temp = current.get("temperature_2m", 0)
        wind = current.get("wind_speed_10m", 0)
        precip = current.get("precipitation", 0)
        
        if temp > 38:
            alerts.append({"type": "danger", "message": f"Extreme Heat Warning! Current temperature is {temp}°C."})
        elif temp < 0:
            alerts.append({"type": "info", "message": f"Freezing Warning! Current temperature is {temp}°C."})
        
        if wind > 40:
            alerts.append({"type": "warning", "message": f"High Wind Warning! Wind speed is {wind} km/h."})
            
        if precip > 5:
            alerts.append({"type": "primary", "message": f"Heavy Precipitation Alert! Current precipitation is {precip} mm."})
        
        # Prepare current weather card data
        current_weather = {
            "city": geo_data["name"],
            "country": geo_data["country"],
            "region": geo_data["admin1"],
            "latitude": lat,
            "longitude": lon,
            "datetime": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "temperature": temp,
            "feels_like": current.get("apparent_temperature", temp),
            "humidity": current.get("relative_humidity_2m", 0),
            "pressure": current.get("pressure_msl", 0),
            "wind_speed": wind,
            "wind_direction": current.get("wind_direction_10m", 0),
            "cloud_cover": current.get("cloud_cover", 0),
            "condition": condition_info["condition"],
            "icon": condition_info["icon"],
            "gradient_bg": condition_info["bg"],
            "is_day": current.get("is_day", 1),
            "weather_code": wmo_code
        }
        
        # Construct cleaned data object
        return {
            "city_info": geo_data,
            "current": current_weather,
            "hourly": hourly,
            "daily": daily,
            "alerts": alerts
        }
        
    except requests.exceptions.RequestException as e:
        raise WeatherAPIError(f"Failed to fetch weather data: {str(e)}")
