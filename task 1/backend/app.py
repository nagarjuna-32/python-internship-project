import os
import traceback
from flask import Flask, jsonify, request, send_from_directory, make_response
from api_handler import fetch_weather_data, CityNotFoundError, WeatherAPIError
from visualization import (
    generate_temperature_trend,
    generate_humidity_analysis,
    generate_wind_comparison,
    generate_pressure_distribution,
    generate_composite_dashboard
)
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import io

app = Flask(
    __name__,
    template_folder='../templates',
    static_folder='../static'
)

# Ensure chart directory exists
CHARTS_DIR = os.path.join(app.static_folder, 'charts')
os.makedirs(CHARTS_DIR, exist_ok=True)

# Also expose a route to serve frontend assets directly
@app.route('/frontend/<path:filename>')
def serve_frontend_assets(filename):
    return send_from_directory('../frontend', filename)

@app.route('/')
def index():
    """Serves the main application page."""
    # Attempt to render from templates first, fallback to frontend directory
    try:
        return send_from_directory('../templates', 'index.html')
    except Exception:
        return send_from_directory('../frontend', 'index.html')

@app.route('/style.css')
def serve_style():
    return send_from_directory('../frontend', 'style.css')

@app.route('/script.js')
def serve_script():
    return send_from_directory('../frontend', 'script.js')

@app.route('/api/weather', methods=['GET'])
def get_weather():
    city = request.args.get('city')
    if not city:
        return jsonify({"error": "City parameter is required"}), 400
        
    try:
        data = fetch_weather_data(city)
        return jsonify(data)
    except CityNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except WeatherAPIError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        app.logger.error(f"Error fetching weather: {traceback.format_exc()}")
        return jsonify({"error": "An internal server error occurred"}), 500

@app.route('/api/charts', methods=['GET'])
def get_charts():
    city = request.args.get('city')
    theme = request.args.get('theme', 'dark')
    if not city:
        return jsonify({"error": "City parameter is required"}), 400
        
    try:
        # Fetch weather data to generate visual charts
        weather_data = fetch_weather_data(city)
        city_name = weather_data["city_info"]["name"]
        
        # Generate the Matplotlib/Seaborn charts
        temp_trend_b64 = generate_temperature_trend(weather_data["daily"], city_name, CHARTS_DIR, theme)
        humidity_b64 = generate_humidity_analysis(weather_data["hourly"], city_name, CHARTS_DIR, theme)
        wind_b64 = generate_wind_comparison(weather_data["daily"], city_name, CHARTS_DIR, theme)
        pressure_b64 = generate_pressure_distribution(weather_data["hourly"], city_name, CHARTS_DIR, theme)
        composite_b64 = generate_composite_dashboard(weather_data, city_name, CHARTS_DIR, theme)
        
        city_lower = city_name.lower()
        return jsonify({
            "city": city_name,
            "charts": {
                "temp_trend": {
                    "path": f"/static/charts/{city_lower}_temp_trend.png",
                    "base64": temp_trend_b64
                },
                "humidity": {
                    "path": f"/static/charts/{city_lower}_humidity_analysis.png",
                    "base64": humidity_b64
                },
                "wind": {
                    "path": f"/static/charts/{city_lower}_wind_comparison.png",
                    "base64": wind_b64
                },
                "pressure": {
                    "path": f"/static/charts/{city_lower}_pressure_distribution.png",
                    "base64": pressure_b64
                },
                "composite": {
                    "path": f"/static/charts/{city_lower}_composite_stats.png",
                    "base64": composite_b64
                }
            }
        })
    except CityNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except WeatherAPIError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        app.logger.error(f"Error generating charts: {traceback.format_exc()}")
        return jsonify({"error": f"An error occurred generating charts: {str(e)}"}), 500

@app.route('/api/compare', methods=['GET'])
def compare_cities():
    city1 = request.args.get('city1')
    city2 = request.args.get('city2')
    
    if not city1 or not city2:
        return jsonify({"error": "Both city1 and city2 parameters are required"}), 400
        
    try:
        data1 = fetch_weather_data(city1)
        data2 = fetch_weather_data(city2)
        
        return jsonify({
            "city1": data1["current"],
            "city2": data2["current"],
            "comparison": {
                "temp_diff": round(data1["current"]["temperature"] - data2["current"]["temperature"], 1),
                "humidity_diff": round(data1["current"]["humidity"] - data2["current"]["humidity"], 1),
                "wind_diff": round(data1["current"]["wind_speed"] - data2["current"]["wind_speed"], 1),
                "pressure_diff": round(data1["current"]["pressure"] - data2["current"]["pressure"], 1)
            }
        })
    except CityNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except WeatherAPIError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        app.logger.error(f"Error comparing cities: {traceback.format_exc()}")
        return jsonify({"error": "An internal error occurred during comparison"}), 500

@app.route('/api/pdf', methods=['GET'])
def download_pdf():
    city = request.args.get('city')
    if not city:
        return jsonify({"error": "City parameter is required"}), 400
        
    try:
        weather_data = fetch_weather_data(city)
        city_name = weather_data["city_info"]["name"]
        
        # Ensure charts are generated (light theme is usually better for printed PDFs)
        generate_temperature_trend(weather_data["daily"], city_name, CHARTS_DIR, "light")
        generate_composite_dashboard(weather_data, city_name, CHARTS_DIR, "light")
        
        temp_chart_path = os.path.join(CHARTS_DIR, f"{city_name.lower()}_temp_trend.png")
        composite_chart_path = os.path.join(CHARTS_DIR, f"{city_name.lower()}_composite_stats.png")
        
        # Create a PDF in-memory buffer
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=24,
            textColor=colors.HexColor('#1E3A8A'),
            spaceAfter=15
        )
        
        subtitle_style = ParagraphStyle(
            'SubtitleStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            textColor=colors.HexColor('#4B5563'),
            spaceAfter=25
        )
        
        h2_style = ParagraphStyle(
            'H2Style',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=16,
            textColor=colors.HexColor('#0D9488'),
            spaceBefore=15,
            spaceAfter=10
        )
        
        body_style = ParagraphStyle(
            'BodyStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            textColor=colors.HexColor('#1F2937'),
            leading=14
        )

        elements = []
        
        # Header
        elements.append(Paragraph(f"Weather Analytics Report: {city_name}", title_style))
        elements.append(Paragraph(f"Generated on {weather_data['current']['datetime']} | Location: Lat {weather_data['current']['latitude']}, Lon {weather_data['current']['longitude']}", subtitle_style))
        elements.append(Spacer(1, 10))
        
        # Weather details table
        curr = weather_data["current"]
        table_data = [
            [Paragraph("<b>Metric</b>", body_style), Paragraph("<b>Value</b>", body_style), Paragraph("<b>Metric</b>", body_style), Paragraph("<b>Value</b>", body_style)],
            ["Temperature", f"{curr['temperature']} °C", "Feels Like", f"{curr['feels_like']} °C"],
            ["Condition", curr["condition"], "Humidity", f"{curr['humidity']} %"],
            ["Wind Speed", f"{curr['wind_speed']} km/h", "Pressure", f"{curr['pressure']} hPa"],
            ["Region", curr["region"] or "N/A", "Country", curr["country"] or "N/A"]
        ]
        
        t = Table(table_data, colWidths=[130, 130, 130, 130])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E2E8F0')),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
            ('PADDING', (0,0), (-1,-1), 6),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ]))
        
        elements.append(Paragraph("Current Conditions Summary", h2_style))
        elements.append(t)
        elements.append(Spacer(1, 20))
        
        # Embed Temp Trend Image
        if os.path.exists(temp_chart_path):
            elements.append(Paragraph("14-Day Temperature Trend Chart", h2_style))
            elements.append(RLImage(temp_chart_path, width=480, height=216))
            elements.append(Spacer(1, 20))
            
        # Embed Composite Stats Dashboard Image
        if os.path.exists(composite_chart_path):
            elements.append(Paragraph("Weather Analytics Dashboard Overview", h2_style))
            elements.append(RLImage(composite_chart_path, width=480, height=400))
            
        doc.build(elements)
        buffer.seek(0)
        
        response = make_response(buffer.getvalue())
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename=Weather_Report_{city_name.replace(" ", "_")}.pdf'
        return response
        
    except CityNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        app.logger.error(f"Error generating PDF: {traceback.format_exc()}")
        return jsonify({"error": f"An error occurred generating report: {str(e)}"}), 500

if __name__ == '__main__':
    # Run server on port 5000
    app.run(debug=True, host='0.0.0.0', port=5000)
