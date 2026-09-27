"""Reusable local heading recognition. Coordinates are source-profile data, not number inference."""
import cv2
import re

def read_heading(image, raw, bbox, ocr):
 sx=image.shape[1]/raw['width'];sy=image.shape[0]/raw['height'];x0,y0,x1,y1=bbox
 patch=image[round(y0*sy):round(y1*sy),round(x0*sx):round(x1*sx)]
 gray=cv2.normalize(cv2.cvtColor(patch,cv2.COLOR_RGB2GRAY),None,0,255,cv2.NORM_MINMAX)
 readings=[]
 for threshold in (100,120,140):
  bw=cv2.threshold(gray,threshold,255,cv2.THRESH_BINARY)[1]
  bw=cv2.copyMakeBorder(cv2.resize(bw,None,fx=3,fy=3),18,18,18,18,cv2.BORDER_CONSTANT,value=255)
  hits=[(t.replace(' ',''),float(c)) for t,c in ocr(bw) if re.fullmatch(r'(?:[1-9]|1[0-8]|U[1-6])',t.replace(' ','')) and c>.9]
  readings.append({'threshold':threshold,'hits':hits})
 values=[r['hits'][0][0] for r in readings if len(r['hits'])==1]
 number=values[0] if len(values)==3 and len(set(values))==1 else None
 return {'number':number,'bbox':bbox,'readings':readings,'confidence':min([r['hits'][0][1] for r in readings]) if number else 0}
