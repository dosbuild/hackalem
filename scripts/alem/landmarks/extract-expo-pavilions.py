"""Rebuild the seven narrow EXPO pavilion contours from attributed local OSM data.
Requires Python 3 and Shapely (pip install shapely).
Run with python3 scripts/alem/landmarks/extract-expo-pavilions.py.
The mesh module supplies authored heights/materials; this file supplies map shape.
"""
import glob, json, math
from pathlib import Path
from shapely.geometry import shape, box, Polygon, LineString
from shapely.ops import transform
ROOT=Path(__file__).resolve().parents[3]
ORIGIN=[71.41615425,51.08931345]
IDS=['way/607960215','way/607960216','way/607960217','relation/8448517','relation/8448518','relation/8448519','relation/8448520']
features={f['id']:f for p in glob.glob(str(ROOT/'public/city/data/chunks/buildings*.json')) for f in json.load(open(p))['features']}
def polygons(g):
 if g.is_empty:return []
 if g.geom_type=='Polygon':return [g]
 return [p for p in getattr(g,'geoms',[]) if p.geom_type=='Polygon']
def coord(r):return [[round(x,4),round(y,4)] for x,y in list(r.coords)[:-1]]
result=[]
for oid in IDS:
 f=features[oid];g=transform(lambda x,y:((x-ORIGIN[0])*69600,(y-ORIGIN[1])*111000),shape(f['geometry']));outer=oid.startswith('relation/')
 item={'source':oid,'name':f['properties']['tags'].get('name',f['properties']['tags'].get('addr:housenumber')),'sourceHeightM':f['properties'].get('height_m'),'photoEstimatedHeightM':22 if outer else 13,'polygons':[{'outer':coord(p.exterior),'holes':[coord(r) for r in p.interiors]} for p in polygons(g)],'roofCells':[],'skylights':[],'ribs':[]}
 minx,miny,maxx,maxy=g.bounds;step=7 if outer else 5
 for x in range(math.floor(minx/step)*step,math.ceil(maxx/step)*step,step):
  for y in range(math.floor(miny/step)*step,math.ceil(maxy/step)*step,step):
   for p in polygons(g.intersection(box(x,y,x+step,y+step))):
    if p.area>.02:item['roofCells'].append(coord(p.exterior))
 # Slender radial standing seams and the long rectangular roof-light rhythm.
 for j in range(240):
  a=j*math.tau/240;c,s=math.cos(a),math.sin(a)
  cut=g.intersection(LineString([(c*50,s*50),(c*400,s*400)]));lines=[cut] if cut.geom_type=='LineString' else list(getattr(cut,'geoms',[]))
  for line in lines:
   if line.geom_type=='LineString' and line.length>1:item['ribs'].append([[round(x,4),round(y,4)] for x,y in line.coords])
 if outer:
  for j in range(64):
   a=j*math.tau/64;c,s=math.cos(a),math.sin(a);ux,uy=-s,c
   # These intervals follow the built radial strips; edges remain inside source roof.
   strip=Polygon([(c*r+ux*w,s*r+uy*w) for r,w in [(212,-4.7),(257,-4.7),(257,4.7),(212,4.7)]])
   for p in polygons(g.intersection(strip)):
    if p.area>60:item['skylights'].append(coord(p.exterior))
 else:
  # One restrained inset clerestory on each small thematic pavilion.
  c=g.centroid;a=math.atan2(c.y,c.x);u,v=math.cos(a),math.sin(a);tx,ty=-v,u
  poly=Polygon([(c.x+u*r+tx*w,c.y+v*r+ty*w) for r,w in [(-3,-14),(3,-14),(3,14),(-3,14)]])
  for p in polygons(g.intersection(poly)):
   if p.area>10:item['skylights'].append(coord(p.exterior))
 result.append(item)
data={'origin':ORIGIN,'units':'local metres; +X East +Y North. Conversion matches mapXY constants69600m/degree and111000m/degree.','source':'OpenStreetMap contributors; existing local2026-09-27 snapshot, ODbL1.0. Heights are photo-calibrated author estimates; only footprints treated as surveyed.','pavilions':result}
Path(__file__).with_name('expo-pavilions-source.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
print('EXPO pavilions:',len(result),'roof cells:',sum(len(x['roofCells']) for x in result),'skylights:',sum(len(x['skylights']) for x in result))
