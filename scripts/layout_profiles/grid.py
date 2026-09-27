"""Parameterized grid toolkit. Profiles supply geometry/heading policy."""
import re
import cv2
import numpy as np

def suspected_label(raw, x, y):
    return any(len(line['text'].strip()) <= 4 and abs(line['bbox'][0]-x)<14 and
               y-8<=line['bbox'][1]<=y+24 and line['bbox'][3]-line['bbox'][1]>=18
               for line in raw['lines'])


def assign_cells(markers, xs, ys, workspaces=None):
    """Partition each printed band, continuing an earlier owner through L shapes."""
    owners = [None, None]
    rectangles = {}
    for row in range(len(ys) - 1):
        current = {m['col']: m['number'] for m in markers if m['row'] == row}
        if 0 in current:
            owners = [current[0], current.get(1, current[0])]
        elif 1 in current:
            owners[1] = current[1]
        for col in (0, 1):
            if workspaces and (row, col) in workspaces:
                owners[col] = workspaces[(row, col)]
        if owners[0] and owners[0] == owners[1]:
            rectangles.setdefault(owners[0], []).append([xs[0], ys[row], xs[2], ys[row + 1]])
        else:
            for col, owner in enumerate(owners):
                if owner:
                    rectangles.setdefault(owner, []).append([xs[col], ys[row], xs[col + 1], ys[row + 1]])
    for number, regions in rectangles.items():
        merged = []
        for box in regions:
            if merged and merged[-1][0] == box[0] and merged[-1][2] == box[2] and merged[-1][3] == box[1]:
                merged[-1][3] = box[3]
            else:
                merged.append(box.copy())
        rectangles[number] = merged
    return rectangles

def region_text(lines, regions):
    selected = []
    for line in lines:
        a, b, c, d = line['bbox']
        if any(x0 <= (a+c)/2 < x1 and y0 <= (b+d)/2 < y1 for x0,y0,x1,y1 in regions):
            selected.append(line)
    return '\n'.join(line['text'] for line in sorted(selected, key=lambda l: (round(l['bbox'][1]/6), l['bbox'][0])))

def detect_seams(image, offset, scale, nominal):
    """Snap template band boundaries to observed long printed separators."""
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 70, 180)
    lines = cv2.HoughLinesP(edges, 1, np.pi/1800, 100, minLineLength=175*scale, maxLineGap=12*scale)
    seams, supported = list(nominal), []
    for index in (1, 2):
        found = []
        for segment in ([] if lines is None else np.asarray(lines).reshape(-1,4)):
            x0,y0,x1,y1 = [float(v)/scale for v in segment]
            if abs(y1-y0) < 4 and abs((y0+y1)/2 - nominal[index]) < 13:
                start, end = min(x0,x1), max(x0,x1)
                if offset+40 <= start <= offset+310 and end <= offset+565 and end-start > 180:
                    found.append(((y0+y1)/2, end-start))
        if found:
            seams[index] = round(max(found, key=lambda item:item[1])[0], 1)
            supported.append(index)
    return seams, supported

class LabelOCR:
    def __init__(self): self.engine = None
    def __call__(self, patch):
        if self.engine is None:
            from rapidocr_onnxruntime import RapidOCR
            self.engine = RapidOCR(intra_op_num_threads=2, inter_op_num_threads=2)
        return self.engine(patch, use_det=False, use_cls=False)[0] or []

def label_at(image, raw, x, y, ocr, max_choice=28):
    pdf = []
    for line in raw['lines']:
        text = line['text'].strip()
        box = line['bbox']
        if re.fullmatch(r'\d{1,2}', text) and 1 <= int(text) <= max_choice and abs(box[0]-x) < 14 and y-8 <= box[1] <= y+24 and box[3]-box[1] >= 16:
            pdf.append((text, box))
    if len(pdf) == 1:
        return {'number': pdf[0][0], 'label_confidence': .96, 'evidence': 'pdf_heading_size_and_position', 'label_box': pdf[0][1]}
    sx, sy = image.shape[1]/raw['width'], image.shape[0]/raw['height']
    x0,y0,x1,y1 = [int(v) for v in ((x-6)*sx, y*sy, (x+40)*sx, (y+40)*sy)]
    patch = image[y0:y1,x0:x1]
    bw = (cv2.cvtColor(patch, cv2.COLOR_RGB2GRAY)<150).astype('uint8')*255
    contours,_ = cv2.findContours(bw,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    for contour in sorted(contours,key=cv2.contourArea,reverse=True):
        xx,yy,w,h = cv2.boundingRect(contour)
        extent=cv2.contourArea(contour)/max(1,w*h)
        if 20<w<65 and 18<h<50 and extent>.6 and yy<25:
            inverted=255-patch[yy+2:yy+h-2,xx+2:xx+w-2]
            padded=cv2.copyMakeBorder(inverted,10,10,10,10,cv2.BORDER_CONSTANT,value=(255,255,255))
            for text, confidence in ocr(padded):
                if re.fullmatch(r'\d{1,2}',text) and 1<=int(text)<=max_choice and confidence>.80:
                    return {'number':text,'label_confidence':round(float(confidence),3),'evidence':'inverted_label_ocr',
                            'label_box':[(x0+xx)/sx,(y0+yy)/sy,(x0+xx+w)/sx,(y0+yy+h)/sy]}
    # Conventional number omitted by the embedded text layer (e.g. 8 read as I).
    head=patch[:int(27*sy),:int(34*sx)]
    for text, confidence in ocr(cv2.copyMakeBorder(head,8,8,8,8,cv2.BORDER_CONSTANT,value=(255,255,255))):
        if re.fullmatch(r'\d{1,2}',text) and 1<=int(text)<=max_choice and confidence>.83:
            return {'number':text,'label_confidence':round(float(confidence),3),'evidence':'label_ocr',
                    'label_box':[x,y,x+34,y+27]}
    return None

def detect_page(raw, image, ocr, config):
    if raw['width'] < raw['height']:
        return [], {'kind':'attachment','unresolved':[]}
    results, unresolved = [], []
    half=raw['width']/2
    for side in range(2):
        offset=side*half
        ulabels=[l for l in raw['lines'] if re.fullmatch(r'U[1-8]',l['text'].strip()) and offset+config['u_heading_x'][0]<l['bbox'][0]<offset+config['u_heading_x'][1] and l['bbox'][1]<config['u_heading_top']]
        if ulabels:
            for label in ulabels:
                results.append({'number':label['text'].strip(),'regions':[[offset+20,15,offset+half-20,808]],
                                'confidence':.96,'reasons':[],'anchor':f'h{side}-U','evidence':'U_heading_and_booklet_half','label_box':label['bbox']})
            continue
        # Cover/instruction half-pages contain no question body at the row anchors.
        halftext=region_text(raw['lines'],[[offset,0,offset+half,raw['height']]])
        if 'Vorgabezeit' in halftext or 'Schriftliche' in halftext or 'Markierungsbogens' in halftext and side==0:
            continue
        ys,seam_evidence=detect_seams(image,offset,image.shape[1]/raw['width'],config['body_y'])
        xs=[offset+x for x in config['body_x']]
        markers=[]
        for row in range(3):
            for col in range(2):
                label=label_at(image,raw,offset+config['heading_x'][col],ys[row]+2,ocr,config['max_choice'])
                if label:
                    markers.append({**label,'row':row,'col':col})
                elif suspected_label(raw,offset+config['heading_x'][col],ys[row]+2):
                    unknown=f'UNRESOLVED-{side}-{row}-{col}'
                    markers.append({'number':unknown,'row':row,'col':col,'label_box':[offset+config['heading_x'][col],ys[row]+8,offset+340,ys[row]+30]})
                    unresolved.append({'anchor':f'h{side}-r{row}-c{col}','reason':'unreadable_heading','source_page':raw['source_page']})
        # Heading baselines provide a second boundary observation when scanned rules fragment.
        for row in (1,2):
            heads=[m['label_box'][1] for m in markers if m['row']==row]
            if heads:
                ys[row]=round(min(heads)-5,1)
        workspaces = {}
        for line in raw['lines']:
            match = re.search(r'Nebenrechnung Aufgabe\s+(\d+)\s*[:;]', line['text'])
            if match and match.group(1) in {m['number'] for m in markers}:
                x,y = line['bbox'][:2]
                if xs[0] <= x < xs[-1]:
                    col = 0 if x < xs[1] else 1
                    row = next((r for r in range(3) if ys[r] <= y < ys[r+1]), None)
                    if row is not None:
                        workspaces[(row,col)] = match.group(1)
        regions=assign_cells(markers,xs,ys,workspaces)
        for marker in markers:
            if marker['number'].startswith('UNRESOLVED'): continue
            areas=regions[marker['number']]
            reasons=[]
            confidence=min(.96,marker['label_confidence'])
            if len(areas)>1:
                confidence=min(confidence,.84); reasons.append('non_rectangular_layout')
            if len(seam_evidence)<2:
                confidence=min(confidence,.93)
            if marker['evidence']=='label_ocr':
                confidence=min(confidence,.89); reasons.append('single_ocr_label_evidence')
            if marker['label_confidence']<.90:
                reasons.append('uncertain_question_number')
            results.append({'number':marker['number'],'regions':areas,'confidence':confidence,'reasons':reasons,
                            'anchor':f'h{side}-r{marker["row"]}-c{marker["col"]}','evidence':marker['evidence'],'label_box':marker['label_box']})
    return results,{'kind':'question_page' if results else 'context','unresolved':unresolved}

