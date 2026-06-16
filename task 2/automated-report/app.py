import os
import time
from flask import Flask, request, render_template, jsonify, send_file, session
from werkzeug.utils import secure_filename
import uuid

# Import our utilities
from utils.analyzer import load_data, clean_data, analyze_data
from utils.reporter import create_report_pdf

app = Flask(__name__)
app.secret_key = 'automated_report_generation_secret_key_12983'

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB limit

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def cleanup_old_files():
    """Delete uploaded files older than 1 hour to prevent disk bloating."""
    now = time.time()
    for filename in os.listdir(UPLOAD_FOLDER):
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        # Skip hidden files
        if filename.startswith('.'):
            continue
        try:
            if os.path.isfile(filepath):
                # Check file age (creation/modification time)
                file_age = now - os.path.getmtime(filepath)
                if file_age > 3600: # 1 hour
                    os.remove(filepath)
        except Exception:
            pass

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/analyze', methods=['POST'])
def analyze():
    cleanup_old_files()
    
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected for uploading"}), 400
        
    # Standard file check
    allowed_extensions = {'.csv', '.xlsx', '.xls', '.json'}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        return jsonify({"error": f"Unsupported file type '{ext}'. Please upload CSV, JSON, or Excel files."}), 400

    try:
        # Save file to uploads folder with a unique prefix
        unique_prefix = uuid.uuid4().hex[:8]
        safe_name = secure_filename(file.filename)
        temp_filename = f"{unique_prefix}_{safe_name}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], temp_filename)
        file.save(filepath)
        
        # Load and clean dataset
        df = load_data(filepath, safe_name)
        cleaned_df, cleaning_report = clean_data(df)
        
        # Analyze dataset
        analysis_results = analyze_data(cleaned_df)
        
        # Prepare a small preview of the data (first 15 rows)
        # Convert datetime columns to string for JSON serialization
        preview_df = cleaned_df.head(15).copy()
        for col in preview_df.columns:
            if pydtype_is_datetime_local(preview_df[col]):
                preview_df[col] = preview_df[col].dt.strftime('%Y-%m-%d')
            # Handle float display rounding
            elif preview_df[col].dtype == 'float64':
                preview_df[col] = preview_df[col].round(3)
                
        preview_data = preview_df.replace({float('nan'): None}).to_dict(orient='records')
        
        # Format the columns for UI select inputs
        columns_list = cleaned_df.columns.tolist()
        numeric_columns = analysis_results.get("numerical_cols", [])
        categorical_columns = analysis_results.get("categorical_cols", [])
        
        return jsonify({
            "filepath": filepath,
            "filename": safe_name,
            "cleaning_report": cleaning_report,
            "analysis_results": analysis_results,
            "preview_columns": columns_list,
            "preview_data": preview_data,
            "numeric_columns": numeric_columns,
            "categorical_columns": categorical_columns
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"An error occurred while parsing the dataset: {str(e)}"}), 500

@app.route('/api/generate_report', methods=['POST'])
def generate_report():
    cleanup_old_files()
    
    data = request.json or {}
    filepath = data.get("filepath")
    
    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "Session file not found or expired. Please re-upload your dataset."}), 400
        
    filename = os.path.basename(filepath)
    # Strip the unique prefix for formatting
    original_filename = "_".join(filename.split("_")[1:])
    
    theme = data.get("theme", "navy")
    title = data.get("title", "Automated Business Intelligence Report")
    subtitle = data.get("subtitle", "Data Analysis & Trend Summaries")
    author = data.get("author", "Automated Analytics Engine")
    
    # Custom analysis settings (if user selected specific target/groupby columns)
    target_col = data.get("target_column")
    groupby_col = data.get("groupby_column")
    
    try:
        # Load and clean dataset again
        df = load_data(filepath, original_filename)
        cleaned_df, cleaning_report = clean_data(df)
        
        # Perform custom grouping if columns specified
        # If the user overrides targets, let's recalculate breakdowns before PDF rendering
        analysis_results = analyze_data(cleaned_df)
        
        if groupby_col and target_col and groupby_col in cleaned_df.columns and target_col in cleaned_df.columns:
            import pandas as pd
            # Verify target is numeric
            if pd.api.types.is_numeric_dtype(cleaned_df[target_col]):
                # Re-do breakdown for this specific column pair
                grp = cleaned_df.groupby(groupby_col)[target_col].agg(['sum', 'mean', 'count']).reset_index()
                grp = grp.sort_values(by='sum', ascending=False)
                
                breakdown_list = []
                for _, r in grp.iterrows():
                    breakdown_list.append({
                        "category": str(r[groupby_col]),
                        "sum": round(float(r['sum']), 2),
                        "mean": round(float(r['mean']), 2),
                        "count": int(r['count'])
                    })
                # Set this breakdown as the primary one for the PDF
                # We overwrite the first key or insert it as the primary
                new_breakdowns = {groupby_col: {"target_column": target_col, "data": breakdown_list}}
                # Merge existing ones, prioritizing the custom one
                for k, v in analysis_results["categorical_breakdowns"].items():
                    if k != groupby_col:
                        new_breakdowns[k] = v
                analysis_results["categorical_breakdowns"] = new_breakdowns
                
                # Regenerate insights list to reflect this custom choice
                insights = analysis_results.get("key_insights", [])
                # Filter out old category insights for this column to avoid duplicates
                insights = [i for i in insights if f"category '{groupby_col}'" not in i]
                
                # Add custom insight
                top_cat = breakdown_list[0]
                total_sum = sum(item["sum"] for item in breakdown_list)
                share_pct = round((top_cat["sum"] / total_sum) * 100, 2) if total_sum > 0 else 0.0
                insights.insert(1, 
                    f"For custom category breakdown '{groupby_col}', '{top_cat['category']}' has the highest aggregate {target_col} "
                    f"of {top_cat['sum']:,} ({share_pct}% of total, average {top_cat['mean']:,} per record)."
                )
                analysis_results["key_insights"] = insights

        # Define PDF report output name
        pdf_filename = f"report_{uuid.uuid4().hex[:6]}.pdf"
        pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], pdf_filename)
        
        # Build document settings payload with custom formatting inputs
        pdf_settings = {
            "theme": theme,
            "title": title,
            "subtitle": subtitle,
            "author": author,
            "filename": original_filename,
            "intro_text": data.get("intro_text", ""),
            "spacing_factor": data.get("spacing_factor", 1.5),
            "include_schema": data.get("include_schema", True),
            "include_outliers": data.get("include_outliers", True),
            "include_trend": data.get("include_trend", True),
            "include_categorical": data.get("include_categorical", True),
            "include_distribution": data.get("include_distribution", True),
            "include_insights": data.get("include_insights", True)
        }
        
        create_report_pdf(cleaned_df, cleaning_report, analysis_results, pdf_path, pdf_settings)
        
        # Stream the file back
        return send_file(
            pdf_path,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"Data_Report_{original_filename.split('.')[0]}.pdf"
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to generate PDF report: {str(e)}"}), 500

@app.route('/api/sample/<filename>', methods=['GET'])
def load_sample(filename):
    cleanup_old_files()
    if filename not in ['sales_data.csv', 'company_expenses.xlsx', 'student_grades.json']:
        return jsonify({"error": "Invalid sample dataset selected"}), 400
        
    sample_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sample_data', filename)
    if not os.path.exists(sample_path):
        return jsonify({"error": "Sample file not found on server"}), 404
        
    try:
        # Copy sample file to uploads with a unique prefix so it acts like a normal upload
        import shutil
        unique_prefix = uuid.uuid4().hex[:8]
        temp_filename = f"{unique_prefix}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], temp_filename)
        shutil.copy(sample_path, filepath)
        
        # Load and clean dataset
        df = load_data(filepath, filename)
        cleaned_df, cleaning_report = clean_data(df)
        
        # Analyze dataset
        analysis_results = analyze_data(cleaned_df)
        
        # Prepare a small preview of the data (first 15 rows)
        preview_df = cleaned_df.head(15).copy()
        for col in preview_df.columns:
            if pydtype_is_datetime_local(preview_df[col]):
                preview_df[col] = preview_df[col].dt.strftime('%Y-%m-%d')
            elif preview_df[col].dtype == 'float64':
                preview_df[col] = preview_df[col].round(3)
                
        preview_data = preview_df.replace({float('nan'): None}).to_dict(orient='records')
        
        return jsonify({
            "filepath": filepath,
            "filename": filename,
            "cleaning_report": cleaning_report,
            "analysis_results": analysis_results,
            "preview_columns": cleaned_df.columns.tolist(),
            "preview_data": preview_data,
            "numeric_columns": analysis_results.get("numerical_cols", []),
            "categorical_columns": analysis_results.get("categorical_cols", [])
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to load sample dataset: {str(e)}"}), 500

def pydtype_is_datetime_local(series):
    import pandas as pd
    return pd.api.types.is_datetime64_any_dtype(series)

if __name__ == '__main__':
    # Running Flask app on port 5000
    app.run(debug=True, port=5000)
