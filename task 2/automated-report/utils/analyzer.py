import os
import pandas as pd
import numpy as np
import json
import re

def load_data(file_path, filename):
    """
    Loads data from CSV, Excel (xlsx, xls), or JSON format into a Pandas DataFrame.
    Includes encoding fallbacks for CSV files.
    """
    ext = os.path.splitext(filename)[1].lower()
    
    if ext == '.csv':
        encodings = ['utf-8', 'latin-1', 'cp1252', 'utf-16']
        for encoding in encodings:
            try:
                # read_csv and ensure leading/trailing spaces are handled
                df = pd.read_csv(file_path, encoding=encoding)
                return df
            except Exception as e:
                last_error = e
                continue
        raise ValueError(f"Failed to read CSV file. Tried encodings {encodings}. Error: {str(last_error)}")
        
    elif ext in ['.xlsx', '.xls']:
        try:
            # Load first sheet
            df = pd.read_excel(file_path)
            return df
        except Exception as e:
            raise ValueError(f"Failed to read Excel file: {str(e)}")
            
    elif ext == '.json':
        try:
            # Try loading directly
            df = pd.read_json(file_path)
            return df
        except Exception as e:
            # Fallback for complex JSONs: read via standard json library and normalize
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if isinstance(data, list):
                    df = pd.json_normalize(data)
                    return df
                elif isinstance(data, dict):
                    # If it's a nested dict with a list, try to find the list
                    for key, val in data.items():
                        if isinstance(val, list):
                            df = pd.json_normalize(val)
                            return df
                    df = pd.json_normalize([data])
                    return df
                else:
                    raise ValueError("JSON root must be an object or an array.")
            except Exception as json_e:
                raise ValueError(f"Failed to parse JSON file: {str(json_e)}")
    else:
        raise ValueError(f"Unsupported file format: {ext}. Please upload CSV, JSON, or Excel files.")

def clean_data(df):
    """
    Cleans the input DataFrame:
    1. Removes completely empty rows and columns.
    2. Strips spaces from string values and columns.
    3. Normalizes column headers.
    4. Handles duplicates (drops them).
    5. Attempts to convert currency/numeric strings to float.
    6. Attempts to parse dates.
    7. Imputes missing values.
    
    Returns:
      cleaned_df: The cleaned DataFrame.
      cleaning_report: A dictionary describing what actions were taken.
    """
    cleaning_report = {
        "initial_rows": len(df),
        "initial_cols": len(df.columns),
        "duplicates_removed": 0,
        "imputed_columns": {},
        "parsed_dates": [],
        "parsed_numeric": []
    }
    
    # 1. Drop completely empty rows and columns
    df = df.dropna(how='all')
    df = df.dropna(how='all', axis=1)
    
    # 2. Normalize and strip column names
    original_cols = df.columns.tolist()
    new_cols = []
    for col in original_cols:
        col_str = str(col).strip()
        # replace multiple spaces or dots with a single underscore
        col_str = re.sub(r'[\s\.\-]+', '_', col_str)
        # remove other special characters
        col_str = re.sub(r'[^a-zA-Z0-9_]', '', col_str)
        new_cols.append(col_str)
    
    df.columns = new_cols
    
    # Keep track of mapping for display/reporting purposes
    cleaning_report["column_mapping"] = dict(zip(new_cols, original_cols))
    
    # 3. Strip leading/trailing spaces from string values in the dataframe
    for col in df.columns:
        if df[col].dtype == 'object':
            try:
                df[col] = df[col].apply(lambda x: x.strip() if isinstance(x, str) else x)
            except Exception:
                pass
                
    # 4. Handle duplicate rows
    duplicate_count = df.duplicated().sum()
    if duplicate_count > 0:
        df = df.drop_duplicates().reset_index(drop=True)
        cleaning_report["duplicates_removed"] = int(duplicate_count)
        
    # 5. Parse columns: dates, numeric string cleaning
    for col in df.columns:
        # Detect currency/numeric strings like "$1,234.50" or "5.5%" and convert to numeric
        if df[col].dtype == 'object':
            # Check if majority of non-null elements match currency/number pattern
            non_null_vals = df[col].dropna()
            if len(non_null_vals) > 0:
                sample_vals = non_null_vals.head(10).astype(str)
                is_numeric_like = True
                for val in sample_vals:
                    # check if it looks like currency ($100), percent (10%), or clean number
                    cleaned_val = re.sub(r'[\$,%\s]', '', val)
                    # Check if it represents a float
                    try:
                        float(cleaned_val)
                    except ValueError:
                        is_numeric_like = False
                        break
                        
                if is_numeric_like:
                    try:
                        df[col] = df[col].apply(lambda x: float(re.sub(r'[\$,%\s]', '', str(x))) if pd.notnull(x) and str(x).strip() != '' else np.nan)
                        cleaning_report["parsed_numeric"].append(col)
                    except Exception:
                        pass

        # Parse date columns
        # Check if the column is a string type and header contains date hints OR matches common date regex
        is_date_col = False
        col_lower = col.lower()
        if 'date' in col_lower or 'time' in col_lower or 'day' in col_lower or 'month' in col_lower or 'year' in col_lower:
            is_date_col = True
            
        if df[col].dtype == 'object' or is_date_col:
            # Try to parse as datetime
            try:
                parsed_dates = pd.to_datetime(df[col], errors='coerce')
                # If we parsed at least 80% of the non-null values successfully, commit the conversion
                non_null_count = df[col].dropna().count()
                parsed_non_null_count = parsed_dates.dropna().count()
                if non_null_count > 0 and (parsed_non_null_count / non_null_count) >= 0.8:
                    df[col] = parsed_dates
                    cleaning_report["parsed_dates"].append(col)
            except Exception:
                pass

    # 6. Impute missing values
    for col in df.columns:
        null_count = df[col].isnull().sum()
        if null_count > 0:
            null_pct = round((null_count / len(df)) * 100, 2)
            cleaning_report["imputed_columns"][col] = {
                "null_count": int(null_count),
                "null_percentage": float(null_pct)
            }
            
            # Impute based on data types
            if pydtype_is_datetime(df[col]):
                # Datetime: fill with forward fill then backward fill
                df[col] = df[col].ffill().bfill()
                cleaning_report["imputed_columns"][col]["method"] = "Forward/Backward Fill (Temporal)"
            elif pd.api.types.is_numeric_dtype(df[col]):
                # Numeric: fill with median
                median_val = df[col].median()
                if pd.isna(median_val):
                    median_val = 0
                df[col] = df[col].fillna(median_val)
                cleaning_report["imputed_columns"][col]["method"] = f"Median Imputation ({median_val})"
            else:
                # Categorical/Text: fill with 'Unknown'
                df[col] = df[col].fillna("Unknown")
                cleaning_report["imputed_columns"][col]["method"] = "Substituted with 'Unknown'"

    cleaning_report["final_rows"] = len(df)
    cleaning_report["final_cols"] = len(df.columns)
    
    return df, cleaning_report

def pydtype_is_datetime(series):
    """Helper to check if a Pandas Series is datetime."""
    return pd.api.types.is_datetime64_any_dtype(series)

def analyze_data(df):
    """
    Performs comprehensive statistical, categorical, and temporal analysis on a cleaned DataFrame.
    """
    total_records = len(df)
    analysis = {
        "total_records": total_records,
        "columns_summary": {},
        "numerical_cols": [],
        "categorical_cols": [],
        "datetime_cols": [],
        "text_cols": [],
        "correlations": {},
        "categorical_breakdowns": {},
        "trends": {},
        "key_insights": [],
        "outliers": {}
    }
    
    # 1. Classify columns and compute basic statistics
    for col in df.columns:
        null_count = df[col].isnull().sum()
        unique_vals = df[col].nunique()
        
        # Check type
        if pydtype_is_datetime(df[col]):
            # Datetime column
            analysis["datetime_cols"].append(col)
            min_val = df[col].min()
            max_val = df[col].max()
            analysis["columns_summary"][col] = {
                "type": "datetime",
                "min": min_val.strftime("%Y-%m-%d %H:%M:%S") if pd.notnull(min_val) else None,
                "max": max_val.strftime("%Y-%m-%d %H:%M:%S") if pd.notnull(max_val) else None,
                "range_days": int((max_val - min_val).days) if pd.notnull(min_val) and pd.notnull(max_val) else 0,
                "unique_values": unique_vals,
                "null_count": int(null_count)
            }
            
        elif pd.api.types.is_numeric_dtype(df[col]):
            # Check cardinality: if numeric but very low unique values (e.g. 1-5 distinct values like rating/grade),
            # treat it as a categorical column too for aggregation, but numerical for stats.
            
            is_float = pd.api.types.is_float_dtype(df[col])
            
            mean_val = float(df[col].mean())
            median_val = float(df[col].median())
            min_val = float(df[col].min())
            max_val = float(df[col].max())
            std_val = float(df[col].std()) if len(df) > 1 else 0.0
            sum_val = float(df[col].sum())
            
            analysis["columns_summary"][col] = {
                "type": "numerical",
                "mean": round(mean_val, 2),
                "median": round(median_val, 2),
                "min": round(min_val, 2),
                "max": round(max_val, 2),
                "std": round(std_val, 2),
                "sum": round(sum_val, 2),
                "unique_values": unique_vals,
                "null_count": int(null_count)
            }
            
            if unique_vals <= 10 and not is_float:
                analysis["categorical_cols"].append(col)
            else:
                analysis["numerical_cols"].append(col)
                
            # Outlier detection (Z-score method: values outside mean +/- 3 * std)
            if std_val > 0:
                outliers_mask = np.abs(df[col] - mean_val) > (3 * std_val)
                outlier_vals = df[col][outliers_mask].tolist()
                if len(outlier_vals) > 0:
                    analysis["outliers"][col] = {
                        "count": len(outlier_vals),
                        "percentage": round((len(outlier_vals) / total_records) * 100, 2),
                        "samples": outlier_vals[:5] # show first few
                    }
            
        else:
            # String/Categorical or Text
            # If unique values is low (e.g., <= 20 or < 25% of total rows), classify as categorical
            if unique_vals <= 20 or (unique_vals / total_records) < 0.25:
                analysis["categorical_cols"].append(col)
                
                # Get value counts
                val_counts = df[col].value_counts().head(5)
                top_val = val_counts.index[0] if len(val_counts) > 0 else None
                top_count = int(val_counts.iloc[0]) if len(val_counts) > 0 else 0
                top_pct = round((top_count / total_records) * 100, 2) if total_records > 0 else 0.0
                
                analysis["columns_summary"][col] = {
                    "type": "categorical",
                    "unique_values": unique_vals,
                    "top_value": top_val,
                    "top_value_count": top_count,
                    "top_value_percentage": top_pct,
                    "null_count": int(null_count)
                }
            else:
                analysis["text_cols"].append(col)
                analysis["columns_summary"][col] = {
                    "type": "text/identifier",
                    "unique_values": unique_vals,
                    "null_count": int(null_count)
                }

    # 2. Correlations between numerical variables
    num_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c]) and df[c].nunique() > 1]
    if len(num_cols) > 1:
        corr_matrix = df[num_cols].corr()
        # Extract pairs with correlation > 0.4 or < -0.4
        for i in range(len(num_cols)):
            for j in range(i+1, len(num_cols)):
                col1, col2 = num_cols[i], num_cols[j]
                val = corr_matrix.loc[col1, col2]
                if not pd.isna(val):
                    analysis["correlations"][f"{col1}_vs_{col2}"] = round(float(val), 3)

    # 3. Categorical breakdowns (Group numerical metrics by categorical variables)
    for cat_col in analysis["categorical_cols"]:
        # Choose a target numerical column to aggregate (prefer revenue, cost, score, or units, otherwise the first numeric)
        target_num = None
        for pref in ['revenue', 'cost', 'score', 'total', 'amount', 'units_sold', 'revenue']:
            matched = [c for c in analysis["numerical_cols"] if pref in c.lower()]
            if matched:
                target_num = matched[0]
                break
        if not target_num and len(analysis["numerical_cols"]) > 0:
            target_num = analysis["numerical_cols"][0]
            
        if target_num:
            # Group by category, compute sum and mean
            grp = df.groupby(cat_col)[target_num].agg(['sum', 'mean', 'count']).reset_index()
            # Sort by sum descending
            grp = grp.sort_values(by='sum', ascending=False)
            
            # Format breakdown data for JSON return
            breakdown_list = []
            for _, r in grp.iterrows():
                breakdown_list.append({
                    "category": str(r[cat_col]),
                    "sum": round(float(r['sum']), 2),
                    "mean": round(float(r['mean']), 2),
                    "count": int(r['count'])
                })
            analysis["categorical_breakdowns"][cat_col] = {
                "target_column": target_num,
                "data": breakdown_list
            }

    # 4. Temporal/Trend Analysis
    if len(analysis["datetime_cols"]) > 0:
        date_col = analysis["datetime_cols"][0]
        # Choose target numeric col
        target_num = None
        for pref in ['revenue', 'cost', 'score', 'total', 'amount', 'units_sold', 'revenue']:
            matched = [c for c in analysis["numerical_cols"] if pref in c.lower()]
            if matched:
                target_num = matched[0]
                break
        if not target_num and len(analysis["numerical_cols"]) > 0:
            target_num = analysis["numerical_cols"][0]
            
        if target_num:
            # Resample or group by date (let's group by month or date depending on date range)
            min_d = df[date_col].min()
            max_d = df[date_col].max()
            days_diff = (max_d - min_d).days
            
            # If date range spans more than 60 days, group by month, else group by date (daily)
            temp_df = df.copy()
            if days_diff > 60:
                temp_df['period'] = temp_df[date_col].dt.to_period('M').astype(str)
            else:
                temp_df['period'] = temp_df[date_col].dt.strftime('%Y-%m-%d')
                
            trend_grp = temp_df.groupby('period')[target_num].agg(['sum', 'mean', 'count']).reset_index()
            trend_grp = trend_grp.sort_values('period')
            
            trend_list = []
            for _, r in trend_grp.iterrows():
                trend_list.append({
                    "period": r['period'],
                    "sum": round(float(r['sum']), 2),
                    "mean": round(float(r['mean']), 2),
                    "count": int(r['count'])
                })
                
            analysis["trends"][date_col] = {
                "target_column": target_num,
                "period_type": "Monthly" if days_diff > 60 else "Daily",
                "data": trend_list
            }

    # 5. Programmatic Key Insights & Conclusions
    insights = []
    
    # Insights on total records
    insights.append(f"The dataset contains {total_records} records across {len(df.columns)} active columns.")
    
    # Insights on missing values
    null_cols_details = []
    for col, sum_info in analysis["columns_summary"].items():
        if sum_info.get("null_count", 0) > 0:
            null_cols_details.append(f"{col} ({sum_info['null_count']} missing values)")
    if null_cols_details:
        insights.append(f"Cleaned and imputed missing values in columns: {', '.join(null_cols_details)}.")
    else:
        insights.append("Good quality dataset: No missing values were found.")
        
    # Insights on outliers
    if len(analysis["outliers"]) > 0:
        for col, o_info in analysis["outliers"].items():
            insights.append(f"Outlier alert: Found {o_info['count']} anomalies in column '{col}' ({o_info['percentage']}% of records) outside standard limits.")

    # Insights on Category breakdowns
    for cat_col, breakdown_info in analysis["categorical_breakdowns"].items():
        data_list = breakdown_info["data"]
        target = breakdown_info["target_column"]
        if len(data_list) > 0:
            top_cat = data_list[0]
            # Calculate total sum of target to find percentage share
            total_sum = sum(item["sum"] for item in data_list)
            share_pct = round((top_cat["sum"] / total_sum) * 100, 2) if total_sum > 0 else 0.0
            
            insights.append(
                f"For category '{cat_col}', '{top_cat['category']}' has the highest aggregate {target} "
                f"of {top_cat['sum']:,} ({share_pct}% of total, average {top_cat['mean']:,} per record)."
            )
            
            if len(data_list) > 1:
                lowest_cat = data_list[-1]
                insights.append(
                    f"The lowest category under '{cat_col}' is '{lowest_cat['category']}' with a total {target} "
                    f"of {lowest_cat['sum']:,} (average {lowest_cat['mean']:,} per record)."
                )

    # Insights on Trends
    for date_col, trend_info in list(analysis["trends"].items()):
        data_list = trend_info["data"]
        target = trend_info["target_column"]
        if len(data_list) >= 2:
            first_p = data_list[0]
            last_p = data_list[-1]
            diff = last_p["sum"] - first_p["sum"]
            pct_change = round((diff / first_p["sum"]) * 100, 2) if first_p["sum"] != 0 else 0
            direction = "increase" if diff > 0 else "decrease"
            
            insights.append(
                f"Temporal Trend Analysis on '{target}' (by {trend_info['period_type'].lower()} interval): "
                f"Shows a {direction} of {abs(pct_change)}% from the first period ({first_p['period']}: {first_p['sum']:,}) "
                f"to the last period ({last_p['period']}: {last_p['sum']:,})."
            )

    # Insights on Numerical relationships (correlations)
    for pair, val in analysis["correlations"].items():
        col1, col2 = pair.split("_vs_")
        strength = "strong" if abs(val) >= 0.7 else "moderate"
        direction = "positive" if val > 0 else "negative"
        if abs(val) >= 0.4:
            insights.append(
                f"Statistical Correlation: Found a {strength} {direction} correlation ({val}) "
                f"between '{col1}' and '{col2}'."
            )
            
    analysis["key_insights"] = insights
    
    return analysis
