import io
import os
import matplotlib
# Use non-interactive backend for server deployment
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER

# Theme configurations (we preserve these for chart styling, but PDF text color remains strictly black)
THEMES = {
    "navy": {
        "primary": "#000000",
        "secondary": "#000000",
        "accent": "#000000",
        "bg_light": "#ffffff",
        "chart_colors": ["#1e293b", "#3b82f6", "#475569", "#94a3b8", "#cbd5e1"]
    },
    "teal": {
        "primary": "#000000",
        "secondary": "#000000",
        "accent": "#000000",
        "bg_light": "#ffffff",
        "chart_colors": ["#064e3b", "#10b981", "#022c22", "#34d399", "#a7f3d0"]
    },
    "burgundy": {
        "primary": "#000000",
        "secondary": "#000000",
        "accent": "#000000",
        "bg_light": "#ffffff",
        "chart_colors": ["#4c0519", "#e11d48", "#881337", "#f43f5e", "#fda4af"]
    },
    "charcoal": {
        "primary": "#000000",
        "secondary": "#000000",
        "accent": "#000000",
        "bg_light": "#ffffff",
        "chart_colors": ["#1f2937", "#4b5563", "#111827", "#9ca3af", "#e5e7eb"]
    }
}

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and print the total page count,
    add running headers and footers outside the border lines, and draw common black borders on all pages.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        # Save state for the second pass
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages):
        self.saveState()
        
        # Dimensions & Theme setup
        page_w, page_h = letter
        margin = 54  # 0.75 inch margin
        
        # ================= BORDER IN DARK LINES (BLACK) =================
        # Draw a solid black page border rect (0.5 inch / 36 points from left/right, 48 points from top/bottom)
        self.setStrokeColor(HexColor("#000000"))
        self.setLineWidth(1.0)
        self.rect(36, 48, page_w - 72, page_h - 96)
        
        # Skip drawing headers/footers on the cover page (Page 1)
        if self._pageNumber == 1:
            self.restoreState()
            return

        # ================= HEADERS ABOVE THE BORDER =================
        self.setFont("Times-Bold", 8)
        self.setFillColor(HexColor("#000000"))
        self.drawString(margin, page_h - 38, getattr(self, 'pdf_title', 'AUTOMATED DATA REPORT').upper())
        
        self.setFont("Times-Roman", 8)
        self.drawRightString(page_w - margin, page_h - 38, "CONFIDENTIAL")
        
        # ================= FOOTERS BELOW THE BORDER =================
        # Timestamp left
        timestamp = getattr(self, 'pdf_timestamp', datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        self.setFont("Times-Roman", 8)
        self.setFillColor(HexColor("#000000"))
        self.drawString(margin, 28, f"Generated: {timestamp}")
        
        # Page numbering right
        page_text = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(page_w - margin, 28, page_text)
        
        self.restoreState()

def generate_charts(df, analysis, theme_key):
    """
    Generates Matplotlib charts for inclusion in the PDF based on the theme key.
    Returns a dictionary of ByteIO streams containing PNG data.
    """
    theme = THEMES.get(theme_key, THEMES['navy'])
    colors = theme['chart_colors']
    
    # Configure Matplotlib styles to match Times New Roman and black texts
    plt.rcParams['font.family'] = 'serif'
    plt.rcParams['font.serif'] = ['Times New Roman', 'Times', 'DejaVu Serif']
    plt.rcParams['text.color'] = '#000000'
    plt.rcParams['axes.labelcolor'] = '#000000'
    plt.rcParams['xtick.color'] = '#000000'
    plt.rcParams['ytick.color'] = '#000000'
    plt.rcParams['grid.color'] = '#cbd5e1'
    plt.rcParams['grid.linewidth'] = 0.5
    plt.rcParams['figure.autolayout'] = True
    
    chart_streams = {}
    
    # 1. Trend Line Chart (Temporal data)
    if len(analysis['datetime_cols']) > 0 and len(analysis['trends']) > 0:
        date_col = analysis['datetime_cols'][0]
        trend_info = analysis['trends'][date_col]
        trend_data = trend_info['data']
        
        if len(trend_data) > 0:
            fig, ax = plt.subplots(figsize=(6.0, 2.3), dpi=300)
            periods = [x['period'] for x in trend_data]
            sums = [x['sum'] for x in trend_data]
            
            # Using dark/charcoal line and gray fill for professional standard
            ax.plot(periods, sums, marker='o', color='#1e293b', linewidth=1.8, markersize=4.5, label=f"Total {trend_info['target_column']}")
            ax.fill_between(periods, sums, color='#1e293b', alpha=0.08)
            
            ax.set_title(f"{trend_info['target_column'].replace('_', ' ').title()} Trend Over Time", fontsize=9, fontweight='bold', pad=6)
            ax.set_xlabel("Period", fontsize=7.5, labelpad=2)
            ax.set_ylabel("Sum Total", fontsize=7.5, labelpad=2)
            
            if len(periods) > 6:
                plt.xticks(rotation=15, ha='right', fontsize=6.5)
            else:
                plt.xticks(fontsize=6.5)
            plt.yticks(fontsize=6.5)
                
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            ax.spines['left'].set_color('#000000')
            ax.spines['bottom'].set_color('#000000')
            ax.grid(True, axis='y', linestyle='--')
            
            stream = io.BytesIO()
            plt.savefig(stream, format='png', bbox_inches='tight')
            stream.seek(0)
            chart_streams['trend'] = stream
            plt.close(fig)

    # 2. Categorical Bar Chart (Grouped summaries)
    if len(analysis['categorical_breakdowns']) > 0:
        cat_col = list(analysis['categorical_breakdowns'].keys())[0]
        bkdown = analysis['categorical_breakdowns'][cat_col]
        data = bkdown['data']
        
        if len(data) > 0:
            fig, ax = plt.subplots(figsize=(6.0, 2.3), dpi=300)
            top_data = data[:6]
            categories = [x['category'] for x in top_data]
            sums = [x['sum'] for x in top_data]
            
            # Draw standard gray/charcoal bars
            if len(categories) > 4 or any(len(str(c)) > 8 for c in categories):
                y_pos = range(len(categories))
                ax.barh(y_pos, sums, color='#475569', height=0.5)
                ax.set_yticks(y_pos)
                ax.set_yticklabels(categories, fontsize=6.5)
                ax.invert_yaxis()
                ax.set_xlabel(f"Total {bkdown['target_column'].replace('_', ' ').title()}", fontsize=7.5)
            else:
                x_pos = range(len(categories))
                ax.bar(x_pos, sums, color='#475569', width=0.4)
                ax.set_xticks(x_pos)
                ax.set_xticklabels(categories, fontsize=6.5)
                ax.set_ylabel(f"Total {bkdown['target_column'].replace('_', ' ').title()}", fontsize=7.5)
                
            ax.set_title(f"{bkdown['target_column'].replace('_', ' ').title()} by {cat_col.replace('_', ' ').title()}", fontsize=9, fontweight='bold', pad=6)
            plt.xticks(fontsize=6.5)
            plt.yticks(fontsize=6.5)
            
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            ax.spines['left'].set_color('#000000')
            ax.spines['bottom'].set_color('#000000')
            ax.grid(True, axis='x' if len(categories) > 4 else 'y', linestyle='--')
            
            stream = io.BytesIO()
            plt.savefig(stream, format='png', bbox_inches='tight')
            stream.seek(0)
            chart_streams['categorical'] = stream
            plt.close(fig)

    # 3. Numerical Distribution Histogram
    if len(analysis['numerical_cols']) > 0:
        num_col = analysis['numerical_cols'][0]
        vals = df[num_col].dropna().values
        if len(vals) > 0:
            fig, ax = plt.subplots(figsize=(6.0, 2.3), dpi=300)
            
            ax.hist(vals, bins=min(12, len(set(vals))), color='#64748b', alpha=0.8, edgecolor='black', linewidth=0.5)
            
            ax.set_title(f"Distribution of {num_col.replace('_', ' ').title()}", fontsize=9, fontweight='bold', pad=6)
            ax.set_xlabel(num_col.replace('_', ' ').title(), fontsize=7.5)
            ax.set_ylabel("Frequency", fontsize=7.5)
            plt.xticks(fontsize=6.5)
            plt.yticks(fontsize=6.5)
            
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            ax.spines['left'].set_color('#000000')
            ax.spines['bottom'].set_color('#000000')
            ax.grid(True, axis='y', linestyle='--')
            
            stream = io.BytesIO()
            plt.savefig(stream, format='png', bbox_inches='tight')
            stream.seek(0)
            chart_streams['distribution'] = stream
            plt.close(fig)
            
    return chart_streams

def create_report_pdf(df, cleaning_report, analysis, output_path, settings):
    """
    Assembles and generates the structured PDF report.
    Adheres strictly to the user formatting constraints:
    - Common black borders around the rect (with footers below and headers above)
    - All text written in black
    - Heading H1 centered (middle)
    - Figure labels centered (middle)
    - All text written in Times New Roman (Times-Roman, Times-Bold, Times-Italic)
    - Line spacing customized (default 1.5)
    - Content choices toggled based on request selections
    """
    theme_key = settings.get("theme", "navy")
    
    title = settings.get("title", "Automated Data Report")
    subtitle = settings.get("subtitle", "Insights & Analysis Summary")
    author = settings.get("author", "Automated System")
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # User content customization switches
    include_schema = settings.get("include_schema", True)
    include_outliers = settings.get("include_outliers", True)
    include_distribution = settings.get("include_distribution", True)
    include_trend = settings.get("include_trend", True)
    include_categorical = settings.get("include_categorical", True)
    include_insights = settings.get("include_insights", True)
    intro_text = settings.get("intro_text", "").strip()
    
    # Spacing customizations
    spacing_factor = float(settings.get("spacing_factor", 1.5))
    
    # Setup document
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=54,  # 0.75 inch margins
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    # Generate charts
    charts = generate_charts(df, analysis, theme_key)
    
    styles = getSampleStyleSheet()
    
    # ================= FONT FAMILY: TIMES NEW ROMAN =================
    # Cover page title
    cover_title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Heading1'],
        fontName='Times-Bold',
        fontSize=24,
        leading=32,
        alignment=TA_CENTER,
        textColor=HexColor("#000000"),
        spaceAfter=15
    )
    
    cover_subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=12,
        leading=18,
        alignment=TA_CENTER,
        textColor=HexColor("#000000"),
        spaceAfter=40
    )
    
    # H1 - Center aligned (middle), Times-Bold, size: 16, line spacing: S * spacing_factor
    h1_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading1'],
        fontName='Times-Bold',
        fontSize=16,
        leading=round(16 * spacing_factor),
        alignment=TA_CENTER,
        textColor=HexColor("#000000"),
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )
    
    # H2 - Left aligned, Times-Bold, size: 14, line spacing: S * spacing_factor
    h2_style = ParagraphStyle(
        'SubSectionHeading',
        parent=styles['Heading2'],
        fontName='Times-Bold',
        fontSize=14,
        leading=round(14 * spacing_factor),
        alignment=TA_LEFT,
        textColor=HexColor("#000000"),
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )
    
    # Body text - Justified aligned, Times-Roman, size: 12, line spacing: S * spacing_factor
    body_style = ParagraphStyle(
        'ReportBody',
        parent=styles['BodyText'],
        fontName='Times-Roman',
        fontSize=12,
        leading=round(12 * spacing_factor),
        alignment=TA_JUSTIFY,
        textColor=HexColor("#000000"),
        spaceAfter=10
    )
    
    # Bullet lists - Justified aligned, Times-Roman, size: 12, line spacing: S * spacing_factor
    bullet_style = ParagraphStyle(
        'ReportBullet',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=12,
        leading=round(12 * spacing_factor),
        alignment=TA_JUSTIFY,
        textColor=HexColor("#000000"),
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=6
    )
    
    # Figure Labels - Centered (middle), Times-Italic, size: 10, line spacing: 1.5
    figure_label_style = ParagraphStyle(
        'FigureLabel',
        parent=styles['Normal'],
        fontName='Times-Italic',
        fontSize=10,
        leading=15,
        alignment=TA_CENTER,
        textColor=HexColor("#000000"),
        spaceBefore=4,
        spaceAfter=8
    )
    
    # Tables - Times-Roman/Times-Bold, leading: 1.5
    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=10,
        leading=15,
        textColor=HexColor("#ffffff") # header text inside background keeps white for contrast
    )
    
    table_body_style = ParagraphStyle(
        'TableBody',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=9.5,
        leading=14,
        textColor=HexColor("#000000")
    )
    
    table_body_bold = ParagraphStyle(
        'TableBodyBold',
        parent=table_body_style,
        fontName='Times-Bold'
    )

    story = []
    
    # ================= PAGE 1: COVER PAGE =================
    story.append(Spacer(1, 25))
    
    band_data = [[""]]
    band_table = Table(band_data, colWidths=[doc.width], rowHeights=[6])
    band_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), HexColor("#000000")),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(band_table)
    story.append(Spacer(1, 20))
    
    story.append(Paragraph(title, cover_title_style))
    story.append(Paragraph(subtitle, cover_subtitle_style))
    
    story.append(Spacer(1, 30))
    
    # Metadata table on cover page (colors changed to clean black border lines and white backgrounds)
    meta_data = [
        [Paragraph("<b>Document Reference:</b>", table_body_bold), Paragraph("Automated Analytical Report", table_body_style)],
        [Paragraph("<b>Prepared By:</b>", table_body_bold), Paragraph(author, table_body_style)],
        [Paragraph("<b>Generation Date:</b>", table_body_bold), Paragraph(timestamp, table_body_style)],
        [Paragraph("<b>Source File:</b>", table_body_bold), Paragraph(settings.get("filename", "Uploaded Dataset"), table_body_style)],
        [Paragraph("<b>Records Audit:</b>", table_body_bold), Paragraph(f"{cleaning_report['initial_rows']:,} rows / {cleaning_report['initial_cols']:,} columns", table_body_style)],
    ]
    meta_table = Table(meta_data, colWidths=[2.0*inch, 4.0*inch])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), HexColor("#ffffff")),
        ('BOX', (0,0), (-1,-1), 0.5, HexColor("#000000")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, HexColor("#000000")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(meta_table)
    
    story.append(Spacer(1, 40))
    story.append(Paragraph("<font color='#000000' size='8'>CONFIDENTIALITY NOTICE: The contents of this document are generated automatically from user-supplied data. All evaluations are computational.</font>", table_body_style))
    
    # Force PageBreak after cover page
    story.append(PageBreak())
    
    # ================= ALL OTHER PAGES: FLOW ORGANICALLY =================
    
    # 1. Executive Summary
    story.append(Paragraph("Executive Summary", h1_style))
    
    # Use user input summary text if entered, otherwise fallback to default
    if intro_text:
        story.append(Paragraph(intro_text, body_style))
    else:
        summary_text = (
            "This report provides an automated statistical summary, trend analysis, and categorical evaluation "
            "of the uploaded dataset. The process begins with data ingestion, standardizing and cleaning schema columns, "
            "imputing missing entries, and filtering out duplicate records. In-depth statistical computations were then "
            "run over both numerical distributions and categorical relationships to compile these key insights."
        )
        story.append(Paragraph(summary_text, body_style))
    
    story.append(Paragraph("Dataset Characteristics & Cleaning Audit", h2_style))
    audit_text = f"The source dataset initially contained <b>{cleaning_report['initial_rows']:,}</b> rows and <b>{cleaning_report['initial_cols']:,}</b> columns. "
    if cleaning_report['duplicates_removed'] > 0:
        audit_text += f"A total of <b>{cleaning_report['duplicates_removed']}</b> exact duplicate rows were identified and removed during cleaning. "
    else:
        audit_text += "No duplicate records were detected. "
    audit_text += f"The final sanitized dataset contains <b>{cleaning_report['final_rows']:,}</b> records and <b>{cleaning_report['final_cols']:,}</b> columns. "
    story.append(Paragraph(audit_text, body_style))
    
    # Imputation list if present
    if cleaning_report["imputed_columns"]:
        story.append(Paragraph("<b>Missing Values Resolution:</b>", table_body_bold))
        for col, details in cleaning_report["imputed_columns"].items():
            imp_desc = f"Column <b>{col}</b> had {details['null_count']} missing records ({details['null_percentage']}%) resolved via {details['method']}."
            story.append(Paragraph(imp_desc, bullet_style))
    
    story.append(Spacer(1, 10))
    
    # 2. Schema Table (conditional)
    if include_schema:
        schema_elements = []
        schema_elements.append(Paragraph("Data Schema Definitions", h2_style))
        schema_headers = [
            Paragraph("Cleaned Header", table_header_style),
            Paragraph("Original Name", table_header_style),
            Paragraph("Detected Type", table_header_style),
            Paragraph("Unique Count", table_header_style),
            Paragraph("Null Count", table_header_style)
        ]
        
        schema_table_data = [schema_headers]
        for col, meta in list(analysis['columns_summary'].items())[:12]:
            orig_name = cleaning_report['column_mapping'].get(col, col)
            if len(str(orig_name)) > 18:
                orig_name = str(orig_name)[:15] + "..."
                
            col_type = meta.get("type", "unknown").upper()
            unique_c = f"{meta.get('unique_values', 0):,}"
            null_c = f"{meta.get('null_count', 0):,}"
            
            schema_table_data.append([
                Paragraph(f"<b>{col}</b>", table_body_style),
                Paragraph(str(orig_name), table_body_style),
                Paragraph(col_type, table_body_style),
                Paragraph(unique_c, table_body_style),
                Paragraph(null_c, table_body_style)
            ])
            
        schema_table = Table(schema_table_data, colWidths=[1.5*inch, 1.5*inch, 1.3*inch, 1.2*inch, 1.1*inch])
        schema_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), HexColor("#000000")),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('GRID', (0,0), (-1,-1), 0.5, HexColor("#000000")),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor("#ffffff"), HexColor("#f1f5f9")]),
        ]))
        schema_elements.append(schema_table)
        story.append(KeepTogether(schema_elements))
        story.append(Spacer(1, 12))
    
    # 3. Statistical Analysis Summary
    stats_elements = []
    stats_elements.append(Paragraph("Statistical Analysis Summary", h1_style))
    
    num_headers = [
        Paragraph("Variable", table_header_style),
        Paragraph("Sum", table_header_style),
        Paragraph("Mean", table_header_style),
        Paragraph("Median", table_header_style),
        Paragraph("Std Dev", table_header_style),
        Paragraph("Range [Min, Max]", table_header_style)
    ]
    num_table_data = [num_headers]
    
    has_numeric = False
    for col, summary in analysis['columns_summary'].items():
        if summary.get("type") == "numerical":
            has_numeric = True
            min_v = summary.get("min", 0)
            max_v = summary.get("max", 0)
            num_table_data.append([
                Paragraph(f"<b>{col}</b>", table_body_style),
                Paragraph(f"{summary.get('sum', 0):,}", table_body_style),
                Paragraph(f"{summary.get('mean', 0):,}", table_body_style),
                Paragraph(f"{summary.get('median', 0):,}", table_body_style),
                Paragraph(f"{summary.get('std', 0):,}", table_body_style),
                Paragraph(f"[{min_v:,}, {max_v:,}]", table_body_style),
            ])
            
    if has_numeric:
        num_table = Table(num_table_data, colWidths=[1.4*inch, 1.1*inch, 1.1*inch, 1.1*inch, 1.1*inch, 1.2*inch])
        num_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), HexColor("#000000")),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('GRID', (0,0), (-1,-1), 0.5, HexColor("#000000")),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor("#ffffff"), HexColor("#f1f5f9")]),
        ]))
        stats_elements.append(num_table)
    else:
        stats_elements.append(Paragraph("<i>No continuous numerical metrics found in this dataset to perform summary math.</i>", body_style))
        
    story.append(KeepTogether(stats_elements))
    
    # Outliers Audit (conditional)
    if include_outliers and analysis["outliers"]:
        story.append(Spacer(1, 10))
        outliers_elements = []
        outliers_elements.append(Paragraph("Anomalies and Outliers Audit", h2_style))
        for col, details in analysis["outliers"].items():
            sample_strs = [str(round(x, 2)) for x in details["samples"]]
            outliers_elements.append(Paragraph(
                f"• Column <b>{col}</b> has {details['count']} anomalous values ({details['percentage']}% of records) outside standard limits. "
                f"Samples: <i>{', '.join(sample_strs)}</i>",
                bullet_style
            ))
        story.append(KeepTogether(outliers_elements))

    # 4. Visualizations (conditional)
    if include_distribution and 'distribution' in charts:
        story.append(Spacer(1, 12))
        dist_elements = []
        dist_elements.append(Paragraph("Variable Distribution Summary", h2_style))
        dist_img = Image(charts['distribution'], width=380, height=146)
        dist_img.hAlign = 'CENTER'
        dist_elements.append(dist_img)
        # ================= CAPTIONS CENTERED (MIDDLE) =================
        dist_elements.append(Paragraph("Figure 1: Mathematical distribution showing density and spread of primary metric.", figure_label_style))
        story.append(KeepTogether(dist_elements))

    if include_trend and 'trend' in charts:
        story.append(Spacer(1, 12))
        trend_elements = []
        trend_elements.append(Paragraph("Temporal Trend Analysis", h1_style))
        trend_img = Image(charts['trend'], width=380, height=146)
        trend_img.hAlign = 'CENTER'
        trend_elements.append(trend_img)
        # ================= CAPTIONS CENTERED (MIDDLE) =================
        trend_elements.append(Paragraph("Figure 2: Linear trend line and shaded variance across timeline intervals.", figure_label_style))
        story.append(KeepTogether(trend_elements))

    if include_categorical and 'categorical' in charts:
        story.append(Spacer(1, 12))
        cat_elements = []
        cat_elements.append(Paragraph("Categorical Aggregation Breakdown", h1_style))
        cat_img = Image(charts['categorical'], width=380, height=146)
        cat_img.hAlign = 'CENTER'
        cat_elements.append(cat_img)
        # ================= CAPTIONS CENTERED (MIDDLE) =================
        cat_elements.append(Paragraph("Figure 3: Aggregate sum comparative breakdown by category.", figure_label_style))
        
        # Table of categories
        cat_col = list(analysis['categorical_breakdowns'].keys())[0]
        bkdown = analysis['categorical_breakdowns'][cat_col]
        
        tbl_data = [[
            Paragraph(cat_col.replace('_', ' ').title(), table_header_style),
            Paragraph("Sum Total", table_header_style),
            Paragraph("Mean (Average)", table_header_style),
            Paragraph("Sample Rows", table_header_style)
        ]]
        for row in bkdown['data'][:5]:
            tbl_data.append([
                Paragraph(f"<b>{row['category']}</b>", table_body_style),
                Paragraph(f"{row['sum']:,}", table_body_style),
                Paragraph(f"{row['mean']:,}", table_body_style),
                Paragraph(f"{row['count']:,}", table_body_style)
            ])
            
        cat_tbl = Table(tbl_data, colWidths=[2.0*inch, 1.5*inch, 1.5*inch, 1.7*inch])
        cat_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), HexColor("#000000")),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('GRID', (0,0), (-1,-1), 0.5, HexColor("#000000")),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor("#ffffff"), HexColor("#f1f5f9")]),
        ]))
        cat_elements.append(Spacer(1, 6))
        cat_elements.append(cat_tbl)
        
        story.append(KeepTogether(cat_elements))
        
    # 5. Key Insights & Conclusions (conditional)
    if include_insights:
        story.append(Spacer(1, 12))
        insights_elements = []
        insights_elements.append(Paragraph("Key Insights & Analytical Findings", h1_style))
        insights_elements.append(Paragraph("Below are computational deductions extracted from the processed datasets:", body_style))
        for insight in analysis["key_insights"][:8]:
            insights_elements.append(Paragraph(f"• {insight}", bullet_style))
        story.append(KeepTogether(insights_elements))
    
    story.append(Spacer(1, 12))
    conclusion_elements = []
    conclusion_elements.append(Paragraph("Conclusions & Recommendations", h1_style))
    conclusion_text = (
        "Based on the analytical findings detailed above, the uploaded dataset exhibits clear trends and "
        "structural relationships. Standardizing numeric distributions and filtering out duplicate records "
        "guarantees the accuracy of these deductions. We recommend focusing business decisions on the high-performing "
        "categories highlighted in the breakdowns, while investigating any numerical outliers flagged in this audit "
        "to determine if they represent operational failures or high-yield opportunities."
    )
    conclusion_elements.append(Paragraph(conclusion_text, body_style))
    
    # Signature block
    sig_data = [
        [Paragraph("<b>Report Synthesized By:</b>", table_body_style), Paragraph("<b>Approved By:</b>", table_body_style)],
        [Spacer(1, 20), Spacer(1, 20)],
        [Paragraph("_____________________________<br/>System Engineering Engine", table_body_style), Paragraph("_____________________________<br/>Executive Leadership Signature", table_body_style)]
    ]
    sig_table = Table(sig_data, colWidths=[3.4*inch, 3.4*inch])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 1),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
    ]))
    conclusion_elements.append(Spacer(1, 15))
    conclusion_elements.append(sig_table)
    
    story.append(KeepTogether(conclusion_elements))
    
    # 6. Build Document with NumberedCanvas
    def on_later_pages(canvas_obj, document):
        canvas_obj.pdf_theme = theme_key
        canvas_obj.pdf_title = title
        canvas_obj.pdf_timestamp = timestamp

    doc.build(
        story, 
        canvasmaker=NumberedCanvas,
        onFirstPage=lambda c, d: setattr(c, 'pdf_theme', theme_key),
        onLaterPages=on_later_pages
    )
