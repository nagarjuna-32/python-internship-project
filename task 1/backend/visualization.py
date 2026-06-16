import os
import io
import base64
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np

# Apply global seaborn style
sns.set_theme(style="whitegrid")

def get_theme_colors(theme):
    if theme == "dark":
        return {
            "bg": "#1E293B",        # Slate 800
            "fg": "#F8FAFC",        # Slate 50
            "grid": "#334155",      # Slate 700
            "primary": "#3B82F6",   # Blue 500
            "secondary": "#10B981", # Emerald 500
            "accent": "#F59E0B",    # Amber 500
            "danger": "#EF4444",    # Red 500
            "muted": "#94A3B8"      # Slate 400
        }
    else:
        return {
            "bg": "#FFFFFF",
            "fg": "#1E293B",
            "grid": "#E2E8F0",      # Slate 200
            "primary": "#2563EB",   # Blue 600
            "secondary": "#059669", # Emerald 600
            "accent": "#D97706",    # Amber 600
            "danger": "#DC2626",    # Red 600
            "muted": "#64748B"      # Slate 500
        }

def apply_chart_theme(fig, ax, colors):
    fig.patch.set_facecolor(colors["bg"])
    ax.set_facecolor(colors["bg"])
    
    # Set spines visibility and colors
    for spine in ['bottom', 'top', 'left', 'right']:
        ax.spines[spine].set_color(colors["muted"])
        ax.spines[spine].set_linewidth(1.0)
        
    # X and Y axis labels
    ax.xaxis.label.set_color(colors["fg"])
    ax.xaxis.label.set_fontsize(11)
    ax.xaxis.label.set_weight('semibold')
    
    ax.yaxis.label.set_color(colors["fg"])
    ax.yaxis.label.set_fontsize(11)
    ax.yaxis.label.set_weight('semibold')
    
    # Ticks & labels formatting
    ax.tick_params(axis='both', colors=colors["fg"], labelsize=9)
    
    # Title formatting
    ax.title.set_color(colors["fg"])
    ax.title.set_fontsize(13)
    ax.title.set_weight('bold')
    
    # Grid lines formatting
    ax.grid(True, color=colors["grid"], linestyle=':', linewidth=0.8)
    
    # Style offset text (e.g. 1e2, scientific notation markers)
    ax.xaxis.get_offset_text().set_color(colors["fg"])
    ax.yaxis.get_offset_text().set_color(colors["fg"])

def fig_to_base64_and_file(fig, filename, save_dir):
    """Saves the figure to static path and returns base64 encoding."""
    # Ensure static directory exists
    if save_dir:
        os.makedirs(save_dir, exist_ok=True)
        file_path = os.path.join(save_dir, filename)
        fig.savefig(file_path, dpi=120, bbox_inches='tight', facecolor=fig.get_facecolor())
    else:
        file_path = None

    # Base64 output
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=120, bbox_inches='tight', facecolor=fig.get_facecolor())
    buf.seek(0)
    img_b64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close(fig)
    return img_b64

def generate_temperature_trend(daily_data, city_name, save_dir, theme="dark"):
    """Generates temperature line plot showing past 7 days and next 7 days forecast."""
    colors = get_theme_colors(theme)
    df = pd.DataFrame({
        "Date": pd.to_datetime(daily_data["time"]),
        "MaxTemp": daily_data["temperature_2m_max"],
        "MinTemp": daily_data["temperature_2m_min"]
    })
    
    # Format Date
    df["DateStr"] = df["Date"].dt.strftime("%b %d")
    
    fig, ax = plt.subplots(figsize=(10, 4.5))
    apply_chart_theme(fig, ax, colors)
    
    # Plot line
    ax.plot(df["DateStr"], df["MaxTemp"], marker='o', color=colors["danger"], label="Max Temp (°C)", linewidth=2.5)
    ax.plot(df["DateStr"], df["MinTemp"], marker='o', color=colors["primary"], label="Min Temp (°C)", linewidth=2.5)
    
    # Fill between
    ax.fill_between(df["DateStr"], df["MinTemp"], df["MaxTemp"], color=colors["primary"], alpha=0.1)
    
    # Annotate values on points
    for idx, row in df.iterrows():
        # Annotate Max
        ax.annotate(f"{row['MaxTemp']:.0f}°", (row['DateStr'], row['MaxTemp']), 
                    textcoords="offset points", xytext=(0,10), ha='center', color=colors["fg"], fontsize=8)
        # Annotate Min
        ax.annotate(f"{row['MinTemp']:.0f}°", (row['DateStr'], row['MinTemp']), 
                    textcoords="offset points", xytext=(0,-15), ha='center', color=colors["fg"], fontsize=8)
    
    # Draw vertical separator line for past/future boundary (the 8th element is today)
    # Open-Meteo daily weather returns past_days (7) + current day (1) + forecast (7) = 15 days
    if len(df) >= 8:
        ax.axvline(x=7, color=colors["accent"], linestyle="--", alpha=0.7)
        # Use relative axes coordinates to position labels at the top center of the chart
        ax.text(0.48, 0.93, "Historical (Past 7 Days)", transform=ax.transAxes, color=colors["muted"], ha='right', fontsize=9, fontweight='bold')
        ax.text(0.52, 0.93, "Forecast (Next 7 Days)", transform=ax.transAxes, color=colors["muted"], ha='left', fontsize=9, fontweight='bold')

    ax.set_title(f"14-Day Temperature Trend - {city_name}", fontsize=14, fontweight='bold', pad=15)
    ax.set_xlabel("Date", fontsize=11, labelpad=10)
    ax.set_ylabel("Temperature (°C)", fontsize=11, labelpad=10)
    ax.legend(facecolor=colors["bg"], edgecolor=colors["grid"], labelcolor=colors["fg"])
    plt.xticks(rotation=45)
    
    return fig_to_base64_and_file(fig, f"{city_name.lower()}_temp_trend.png", save_dir)

def generate_humidity_analysis(hourly_data, city_name, save_dir, theme="dark"):
    """Generates area chart of hourly humidity variations."""
    colors = get_theme_colors(theme)
    # Open-Meteo returns 15 days of hourly data (15 * 24 = 360 values)
    # Let's take the middle 48 hours (last 24 hours of history and first 24 hours of forecast) to keep it readable
    times = pd.to_datetime(hourly_data["time"])
    humidity = hourly_data["relative_humidity_2m"]
    
    df = pd.DataFrame({"Time": times, "Humidity": humidity})
    # Filter for the last 24h + next 24h (index ~ 144 to 192, since 7 days = 168 hours)
    mid_index = 168
    df_slice = df.iloc[mid_index - 12 : mid_index + 36].copy() # 48 hours centered around today
    df_slice["HourStr"] = df_slice["Time"].dt.strftime("%a %I%p")

    fig, ax = plt.subplots(figsize=(10, 4.5))
    apply_chart_theme(fig, ax, colors)
    
    # Plot as area chart
    ax.fill_between(df_slice["HourStr"], df_slice["Humidity"], color=colors["secondary"], alpha=0.2)
    ax.plot(df_slice["HourStr"], df_slice["Humidity"], color=colors["secondary"], linewidth=2)
    
    ax.set_title(f"48-Hour Humidity Analysis - {city_name}", fontsize=14, fontweight='bold', pad=15)
    ax.set_xlabel("Time", fontsize=11, labelpad=10)
    ax.set_ylabel("Relative Humidity (%)", fontsize=11, labelpad=10)
    ax.set_ylim(0, 110)
    
    # Keep ticks neat by showing every 3rd label
    for index, label in enumerate(ax.xaxis.get_ticklabels()):
        if index % 3 != 0:
            label.set_visible(False)
            
    plt.xticks(rotation=45)
    
    return fig_to_base64_and_file(fig, f"{city_name.lower()}_humidity_analysis.png", save_dir)

def generate_wind_comparison(daily_data, city_name, save_dir, theme="dark"):
    """Generates bar chart comparing wind speed variations."""
    colors = get_theme_colors(theme)
    df = pd.DataFrame({
        "Date": pd.to_datetime(daily_data["time"]),
        "WindSpeed": daily_data["wind_speed_10m_max"]
    })
    df["DateStr"] = df["Date"].dt.strftime("%b %d")
    
    fig, ax = plt.subplots(figsize=(10, 4.5))
    apply_chart_theme(fig, ax, colors)
    
    # Plot bars
    bars = ax.bar(df["DateStr"], df["WindSpeed"], color=colors["primary"], alpha=0.8, edgecolor=colors["bg"])
    
    # Apply custom styling on bars (hover effect/highlight for current day)
    # Current day is index 7
    if len(bars) > 7:
        bars[7].set_color(colors["accent"])
        bars[7].set_alpha(1.0)
        ax.text(7, df["WindSpeed"].iloc[7] + 1, "Today", color=colors["accent"], ha='center', fontweight='bold', fontsize=9)
        
    for bar in bars:
        height = bar.get_height()
        ax.annotate(f"{height:.1f}",
                    xy=(bar.get_x() + bar.get_width() / 2, height),
                    xytext=(0, 3),  # 3 points vertical offset
                    textcoords="offset points",
                    ha='center', va='bottom', color=colors["fg"], fontsize=8)
        
    ax.set_title(f"Daily Max Wind Speed Comparison - {city_name}", fontsize=14, fontweight='bold', pad=15)
    ax.set_xlabel("Date", fontsize=11, labelpad=10)
    ax.set_ylabel("Wind Speed (km/h)", fontsize=11, labelpad=10)
    plt.xticks(rotation=45)
    
    return fig_to_base64_and_file(fig, f"{city_name.lower()}_wind_comparison.png", save_dir)

def generate_pressure_distribution(hourly_data, city_name, save_dir, theme="dark"):
    """Generates pressure distribution graph (KDE & Histogram)."""
    colors = get_theme_colors(theme)
    pressures = hourly_data["pressure_msl"]
    
    fig, ax = plt.subplots(figsize=(10, 4.5))
    apply_chart_theme(fig, ax, colors)
    
    # Seaborn KDE + Hist
    sns.histplot(pressures, kde=True, ax=ax, color=colors["primary"], stat="density", linewidth=1.5, alpha=0.4)
    
    ax.set_title(f"Atmospheric Pressure Distribution - {city_name}", fontsize=14, fontweight='bold', pad=15)
    ax.set_xlabel("Sea Level Pressure (hPa)", fontsize=11, labelpad=10)
    ax.set_ylabel("Density", fontsize=11, labelpad=10)
    
    return fig_to_base64_and_file(fig, f"{city_name.lower()}_pressure_distribution.png", save_dir)

def generate_composite_dashboard(weather_data, city_name, save_dir, theme="dark"):
    """Generates a multi-panel composite dashboard combining metrics."""
    colors = get_theme_colors(theme)
    
    # Construct subplots 2x2
    fig, axs = plt.subplots(2, 2, figsize=(12, 10))
    fig.suptitle(f"Weather Analytics Overview - {city_name}", fontsize=18, fontweight='bold', color=colors["fg"], y=0.96)
    fig.patch.set_facecolor(colors["bg"])
    
    # 1. Temperature Range (daily_data)
    ax1 = axs[0, 0]
    apply_chart_theme(fig, ax1, colors)
    daily = weather_data["daily"]
    df_daily = pd.DataFrame({
        "Date": pd.to_datetime(daily["time"]).strftime("%m/%d"),
        "MaxTemp": daily["temperature_2m_max"],
        "MinTemp": daily["temperature_2m_min"]
    })
    ax1.plot(df_daily["Date"], df_daily["MaxTemp"], color=colors["danger"], marker='o', label='Max Temp')
    ax1.plot(df_daily["Date"], df_daily["MinTemp"], color=colors["primary"], marker='s', label='Min Temp')
    ax1.fill_between(df_daily["Date"], df_daily["MinTemp"], df_daily["MaxTemp"], color=colors["primary"], alpha=0.1)
    ax1.set_title("14-Day Temp Range (°C)", fontsize=12, fontweight='semibold')
    ax1.legend(facecolor=colors["bg"], labelcolor=colors["fg"], edgecolor=colors["grid"], fontsize=8)
    ax1.tick_params(axis='x', rotation=45, labelsize=8)

    # 2. Hourly humidity over past day + next day
    ax2 = axs[0, 1]
    apply_chart_theme(fig, ax2, colors)
    hourly = weather_data["hourly"]
    df_hourly = pd.DataFrame({
        "Hour": pd.to_datetime(hourly["time"]),
        "Humidity": hourly["relative_humidity_2m"],
        "Temp": hourly["temperature_2m"]
    }).iloc[144:192] # 48 hours around current
    
    # Dual axis: Temp and Humidity
    ax2.plot(df_hourly["Hour"].dt.strftime("%H:00"), df_hourly["Humidity"], color=colors["secondary"], label="Humidity (%)")
    ax2.set_ylabel("Humidity (%)", color=colors["secondary"])
    ax2.tick_params(axis='y', labelcolor=colors["secondary"])
    ax2.set_title("48-Hour Humidity & Temperature", fontsize=12, fontweight='semibold')
    
    # Overlay temperature
    ax2_twin = ax2.twinx()
    ax2_twin.plot(df_hourly["Hour"].dt.strftime("%H:00"), df_hourly["Temp"], color=colors["danger"], linestyle='--', label="Temp (°C)")
    ax2_twin.set_ylabel("Temp (°C)", color=colors["danger"], fontsize=11, fontweight='semibold')
    ax2_twin.tick_params(axis='y', labelcolor=colors["danger"], labelsize=9, colors=colors["danger"])
    
    # Style the twin y-axis spines to match the theme/labels
    ax2_twin.spines['right'].set_color(colors["danger"])
    ax2_twin.spines['left'].set_color(colors["muted"])
    ax2_twin.spines['top'].set_color(colors["muted"])
    ax2_twin.spines['bottom'].set_color(colors["muted"])
    ax2_twin.grid(False)
    
    # Format labels
    for index, label in enumerate(ax2.xaxis.get_ticklabels()):
        if index % 6 != 0:
            label.set_visible(False)
    ax2.tick_params(axis='x', rotation=45, labelsize=8)

    # 3. Wind speed vs gust comparison (daily max)
    ax3 = axs[1, 0]
    apply_chart_theme(fig, ax3, colors)
    df_wind = pd.DataFrame({
        "Date": pd.to_datetime(daily["time"]).strftime("%m/%d"),
        "Wind": daily["wind_speed_10m_max"]
    })
    ax3.bar(df_wind["Date"], df_wind["Wind"], color=colors["primary"], alpha=0.7)
    ax3.set_title("Daily Max Wind Speed (km/h)", fontsize=12, fontweight='semibold')
    ax3.tick_params(axis='x', rotation=45, labelsize=8)

    # 4. Precipitation probability vs sum (daily)
    ax4 = axs[1, 1]
    apply_chart_theme(fig, ax4, colors)
    df_precip = pd.DataFrame({
        "Date": pd.to_datetime(daily["time"]).strftime("%m/%d"),
        "Rain": daily["precipitation_sum"]
    })
    ax4.bar(df_precip["Date"], df_precip["Rain"], color=colors["accent"], alpha=0.8)
    ax4.set_title("Daily Precipitation Sum (mm)", fontsize=12, fontweight='semibold')
    ax4.tick_params(axis='x', rotation=45, labelsize=8)

    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    
    return fig_to_base64_and_file(fig, f"{city_name.lower()}_composite_stats.png", save_dir)
