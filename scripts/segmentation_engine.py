"""Generic layout dispatch and cross-page region rendering."""
from PIL import Image
import pymupdf

def analyze_page(profile, raw, image, ocr):
    profile.validate_geometry(raw)
    return profile.detect(raw, image, ocr)

def render_regions(pdf, regions, dpi=180):
    """Render explicit regions in supplied order; never infer ownership or reorder pages."""
    panels=[]
    for r in regions:
        if r.owner is None:raise ValueError('Cannot crop an unowned region')
        pix=pdf[r.page-1].get_pixmap(matrix=pymupdf.Matrix(dpi/72,dpi/72),clip=pymupdf.Rect(r.bbox),alpha=False)
        panels.append(Image.frombytes('RGB',(pix.width,pix.height),pix.samples))
    if not panels:raise ValueError('No regions')
    out=Image.new('RGB',(max(p.width for p in panels),sum(p.height for p in panels)+16*(len(panels)-1)),'white')
    y=0
    for panel in panels:out.paste(panel,(0,y));y+=panel.height+16
    return out
