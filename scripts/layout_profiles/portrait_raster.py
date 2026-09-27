"""Reusable cache-only portrait layout primitives; never infer ownership from proximity.

A source profile supplies explicit regions and separately audited heading-patch
fingerprints. The fingerprint authenticates a visual transcription, not an OCR
prediction. Unknown pixels remain unowned. Optional OCR is supplementary evidence.
"""
import hashlib
import math
from PIL import Image


def pixel_box(box, image, geometry):
    w,h=geometry
    if len(box)!=4 or not all(math.isfinite(v) for v in box) or not (0<=box[0]<box[2]<=w and 0<=box[1]<box[3]<=h):
        raise ValueError('Invalid portrait region geometry')
    return (math.floor(box[0]*image.width/w),math.floor(box[1]*image.height/h),
            math.ceil(box[2]*image.width/w),math.ceil(box[3]*image.height/h))


def patch_image(image,box,geometry):
    return image.crop(pixel_box(box,image,geometry)).convert('RGB')


def patch_hash(image):
    image=image.convert('RGB')
    return hashlib.sha256((str(image.size)+'RGB').encode()+image.tobytes()).hexdigest()


def analyze_portrait(raw,image,page_config,ocr=None,prefix='winter-ap'):
    if not isinstance(image,Image.Image):image=Image.fromarray(image).convert('RGB')
    geometry=[raw['width'],raw['height']]
    if any(abs(a-b)>0.001 for a,b in zip(geometry,page_config['geometry'])):
        raise ValueError('Exact page geometry does not match audited portrait page')
    page=raw['source_page'];anchors=[];regions=[];issues=[];proofs=[]
    for slot in page_config.get('slots',[]):
        heading=patch_image(image,slot['heading_box'],geometry)
        actual_hash=patch_hash(heading)
        number=slot['observed_number'];aid=f'{prefix}-p{page}-{number}'
        proof={'kind':'heading','number':number,'bbox':slot['heading_box'],
               'pixel_sha256':actual_hash,'audited_pixel_sha256':slot['visual_patch_sha256']}
        valid=actual_hash==slot['visual_patch_sha256']
        if ocr is not None:proof['ocr_supplement']=ocr(heading)
        proofs.append(proof)
        for box,role in zip(slot['regions'],slot['roles']):
            pixel_box(box,image,geometry)
            regions.append({'page':page,'bbox':box,'role':role,'owner':aid if valid else None,
                            'evidence':slot['evidence'] if valid else 'Heading pixel evidence changed; no owner inferred'})
        if len(slot['regions'])!=len(slot['roles']):raise ValueError('Role/region mismatch')
        if not valid:
            issues.append('unverified_heading_pixels:'+number);continue
        anchors.append({'anchor_id':aid,'number':number,'bbox':slot['heading_box'],
                        'evidence':'visually_observed_heading_with_exact_pixel_fingerprint',
                        'visual_evidence':slot['visual_evidence'],'review_reasons':[],
                        'heading_pixel_sha256':actual_hash})
    for explicit in page_config.get('explicit_regions',[]):
        proof=patch_image(image,explicit['evidence_box'],geometry)
        actual_hash=patch_hash(proof);valid=actual_hash==explicit['visual_patch_sha256']
        proofs.append({'kind':'ownership','number':explicit['observed_owner_label'],
                       'bbox':explicit['evidence_box'],'pixel_sha256':actual_hash,
                       'audited_pixel_sha256':explicit['visual_patch_sha256']})
        pixel_box(explicit['bbox'],image,geometry)
        regions.append({'page':page,'bbox':explicit['bbox'],'role':explicit['role'],
                        'owner':explicit['owner'] if valid else None,'evidence':explicit['evidence']})
        if not valid:issues.append('unverified_explicit_owner:'+explicit['observed_owner_label'])
    return {'page':page,'geometry':geometry,'classification':page_config['classification'],
            'classification_evidence':page_config.get('evidence','Individually inspected printed heading and panels'),
            'anchors':anchors,'regions':regions,'proofs':proofs,'issues':issues,
            'context_regions':page_config.get('context_regions',[]),
            'review_status':'needs_review' if issues else 'visually_verified',
            'user_acceptance':'pending'}


def compose_cached_regions(regions,page_images,page_geometry):
    """Preserve within-page layout/masks, then stack explicit pages in given order."""
    if not regions or any(not r['owner'] for r in regions):raise ValueError('Cannot preview unresolved ownership')
    owners={r['owner'] for r in regions}
    if len(owners)!=1:raise ValueError('Cannot mix owners in a question preview')
    ordered_pages=list(dict.fromkeys(r['page'] for r in regions));panels=[]
    for page in ordered_pages:
        im=page_images[page];geometry=page_geometry[page]
        boxes=[pixel_box(r['bbox'],im,geometry) for r in regions if r['page']==page]
        hull=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes))
        panel=Image.new('RGB',(hull[2]-hull[0],hull[3]-hull[1]),'white')
        for b in boxes:panel.paste(im.crop(b),(b[0]-hull[0],b[1]-hull[1]))
        panels.append(panel)
    result=Image.new('RGB',(max(p.width for p in panels),sum(p.height for p in panels)+24*(len(panels)-1)),'white')
    y=0
    for p in panels:result.paste(p,(0,y));y+=p.height+24
    return result
