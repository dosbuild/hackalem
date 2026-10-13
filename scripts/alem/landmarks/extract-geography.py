"""Optional source refresh from the existing attributed, local OSM snapshots.

Normal builds consume the checked-in narrow extracts and need no GIS runtime.
Run with the workspace .venv Python, which includes shapely.
"""
import glob, json, math, sqlite3
from pathlib import Path
from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.ops import transform
from shapely import wkb

ROOT=Path(__file__).resolve().parents[3]
features={f['id']:f for p in glob.glob(str(ROOT/'public/city/data/chunks/buildings*.json')) for f in json.load(open(p))['features']}
ids=['way/454857501','way/230401645','way/460703779','way/166197368','way/549307755','way/166198046','way/240860325','way/917478479','way/1460537088','way/762780007','relation/18901938']
result={}
for pid in ids:
 f=features[pid];g=shape(f['geometry']);center=g.centroid
 # Tower parts can occupy holes in the retail podium polygon. Test the outer
 # parcel shells, not just the podium's solid floor area.
 shell=Polygon(g.exterior) if g.geom_type=='Polygon' else MultiPolygon([Polygon(p.exterior) for p in g.geoms])
 parts=[]
 for oid,p in features.items():
  if oid==pid: continue
  if p['properties'].get('is_part') or p['properties'].get('tags',{}).get('building:part'):
   if shell.buffer(.000015).covers(shape(p['geometry']).representative_point()): parts.append(oid)
 local=transform(lambda x,y:((x-center.x)*69600,(y-center.y)*111000),g)
 rect=list(local.minimum_rotated_rectangle.exterior.coords)
 edges=[math.dist(rect[i],rect[i+1]) for i in range(4)];j=edges.index(max(edges));angle=math.atan2(rect[j+1][1]-rect[j][1],rect[j+1][0]-rect[j][0])
 if pid=='way/762780007':
  # This compound's disconnected tower footprints sit outside the retail shell.
  # Explicit inspected source identities, not proximity-based removal of neighbours.
  parts=sorted(set(parts+['way/'+str(n) for n in range(1373723360,1373723371)]+['way/'+str(n) for n in range(486561786,486561791)]))
 if pid=='way/454857501':
  parts=sorted(set(parts+['way/1461813336']))
 if pid=='way/240860325':
  parts=sorted(set(parts+['way/502393085','way/502393086','way/502393087','way/502393088']))
 result[pid]={'position':[center.x,center.y],'geometry':f['geometry'],'parts':parts,'widthM':min(edges),'lengthM':max(edges),'longAxis':angle}
Path(__file__).with_name('geography.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')

db=sqlite3.connect(ROOT.parent/'astana-data/data/spatial/osm_astana_agglomeration.gpkg')
def decode(raw):
 envelope=(raw[3]>>1)&7
 return wkb.loads(raw[8+{0:0,1:32,2:48,3:48,4:64}[envelope]:])
rails={str(oid):{'id':f'way/{oid}','points':list(decode(geom).coords)} for geom,oid,tags in db.execute('select geom,osm_id,tags_json from railways') if json.loads(tags).get('railway')=='light_rail'}
# One complete mapped running rail, airport to Nurly Zhol. The paired running
# rail lies on its right; their midpoint is the deck centre. No invented route.
order=['1245183401','1420780632','1075504164','1245183400','1245183399','1484667033','1245183398','1245183397','1484667029']
points=[]
for oid in order:
 p=list(reversed(rails[oid]['points']))
 if points:
  assert math.dist(points[-1],p[0])<.0000001,(oid,points[-1],p[0])
  p=p[1:]
 points+=p
stations=[]
for geom,typ,oid,tags in db.execute("select geom,osm_type,osm_id,tags_json from buildings where tags_json like '%light_rail%'"):
 t=json.loads(tags)
 if t.get('railway')!='station':continue
 g=decode(geom);c=g.centroid;local=transform(lambda x,y:((x-c.x)*69600,(y-c.y)*111000),g)
 rect=list(local.minimum_rotated_rectangle.exterior.coords);edges=[math.dist(rect[i],rect[i+1]) for i in range(4)];j=edges.index(max(edges))
 stations.append({'id':f'lrt-{oid}','source':f'way/{oid}','name':t.get('name:ru',t['name']),'position':[c.x,c.y],'lengthM':max(edges),'widthM':min(edges),'angle':math.atan2(rect[j+1][1]-rect[j][1],rect[j+1][0]-rect[j][0])})
data={'source':'OpenStreetMap contributors · existing local 2026-09-27 snapshot; ODbL 1.0','sourceWays':[rails[k]['id'] for k in order],'trackOffsetM':2.1,'points':points,'stations':stations}
(ROOT/'src/world/lrt-route.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('Saved',len(result),'landmark footprints,',len(points),'rail points and',len(stations),'station footprints.')
