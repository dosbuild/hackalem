"""Resolve illustrative activity clusters against prepared OSM geometry; never addresses.
Optional authoring tool (requires Shapely): python3 scripts/city/anchors.py
"""
import json, math
from pathlib import Path
from shapely.geometry import shape, Point
from shapely.ops import transform
from shapely.strtree import STRtree
root=Path(__file__).resolve().parents[2]; data=root/'public/city/data'
project=lambda x,y,z=None: ((x-71.4)*70000,(y-51.1)*111000)
unproject=lambda p:[round(p.x/70000+71.4,7),round(p.y/111000+51.1,7)]
layers={k:[] for k in ['buildings','water','green','streets']}
for c in json.load(open(data/'manifest.json'))['chunks']:
 for f in json.load(open(root/'public/city'/c['url'].lstrip('/')))['features']:
  layers[c['layer']].append((f,transform(project,shape(f['geometry']))))
obstacles=[g for k in ['buildings','water'] for f,g in layers[k] if g.geom_type in ['Polygon','MultiPolygon']]
tree=STRtree(obstacles)
paths=[(f,g) for f,g in layers['streets'] if f['properties'].get('tags',{}).get('highway') in ['footway','pedestrian','path'] and g.geom_type=='LineString']
anchors={}
for d in json.load(open(data/'districts.geojson'))['features']:
 district=transform(project,shape(d['geometry'])); center=Point(*project(*d['properties']['view_center']))
 local=[(f,g) for f,g in paths if district.contains(g.interpolate(.5,normalized=True))]
 for kind in ['garden','clinic','school','entrance','stop','crossing','service']:
  targets=[]
  for f,g in layers['green' if kind=='garden' else 'streets' if kind in ['crossing','stop'] else 'buildings']:
   tags=f['properties'].get('tags',{})
   match=(kind in ['crossing','stop'] and tags.get('highway') in ['residential','tertiary','secondary','primary'] and tags.get('tunnel')!='yes') or (kind=='garden' and tags.get('leisure') in ['park','garden']) or (kind=='school' and tags.get('amenity') in ['school','kindergarten']) or (kind=='clinic' and (tags.get('amenity') in ['hospital','clinic','doctors'] or tags.get('healthcare'))) or (kind in ['entrance','service'] and tags.get('building') in ['apartments','residential','commercial'])
   if match and district.contains(g.representative_point()):targets.append((f,g))
  targets.sort(key=lambda t:t[1].distance(center));targets=targets[:12]
  ranked=[]
  for f,g in local:
   for frac in [.25,.5,.75]:
    point=g.interpolate(frac,normalized=True)
    # Full stage disk for six actors and Aya remains on clear ground, inside district.
    disk=point.buffer(19)
    if not district.contains(disk) or len(tree.query(disk,predicate='intersects')):continue
    target=min(targets,key=lambda t:t[1].distance(point)) if targets else None
    distance=target[1].distance(point) if target else 0
    score=(abs(distance-8) if kind in ['crossing','stop'] else distance)*4+point.distance(center)*.08
    ranked.append((score,f,point,target,distance))
  if not ranked:raise RuntimeError(f'No clear placement: {d["id"]}:{kind}')
  _,f,p,t,dist=min(ranked,key=lambda x:x[0])
  anchors[f'{d["id"]}:{kind}']={'position':unproject(p),'pathSource':f['id'],'nearbySource':t[0]['id'] if t else None,'nearbyDistanceM':round(dist),'semanticExact':bool(t and dist<100),'clearRadiusM':19,'districtSource':d['properties']['source'],'note':'Иллюстративное место на пешеходной геометрии; не адрес и не подтверждённый вход, остановка или переход.'}
out=root/'public/residents/geographic-anchors.json';out.write_text(json.dumps(anchors,ensure_ascii=False,indent=2)+'\n')
print(f'Checked {len(anchors)} activity anchors against {len(obstacles)} building/water polygons.');print(anchors['esil:garden'])
