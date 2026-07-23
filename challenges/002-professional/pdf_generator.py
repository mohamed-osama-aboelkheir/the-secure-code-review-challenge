import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from store import UserStore

# Initialize user store
user_store = UserStore()

def generate_resume_pdf(profile, custom_color='black'):
    """
    Generate a PDF resume for a professional profile
    """

    # Get username from profile
    user_id = profile['user_id']
    user = user_store.get_user_by_id(user_id)
    username = user['username']

    # Create PDF in memory
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    
    # Add title with username
    if username:
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Title'],
            fontSize=18,
            spaceAfter=20,
            alignment=1  # Center alignment
        )
        story.append(Paragraph(f"<b>{username}'s Resume</b>", title_style))
        story.append(Spacer(1, 20))
    
    # Add bio
    bio_style = ParagraphStyle(
        'BioStyle',
        parent=styles['Normal'],
        fontSize=12,
        spaceAfter=12
    )

    story.append(Paragraph(profile['bio']))
        
    # Add work experiences
    story.append(Paragraph("<b>Work Experience:</b>", styles['Heading2']))
    story.append(Spacer(1, 12))
    
    for exp in profile.get('work_experiences', []):
        exp_text = f"""
        <b>Company:</b> {exp.get('company', 'N/A')}<br/>
        <b>Role:</b> {exp.get('role', 'N/A')}<br/>
        <b>Location:</b> {exp.get('location', 'N/A')}<br/>
        <b>Time:</b> {exp.get('time', 'N/A')}<br/>
        <b>Description:</b> {exp.get('description', 'N/A')}
        """
        story.append(Paragraph(exp_text, styles['Normal']))
        story.append(Spacer(1, 12))
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    
    return buffer
