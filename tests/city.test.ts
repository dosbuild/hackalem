import {describe,it,expect} from 'vitest';
import {anchorPose,boundedPose,confinePose,rotation,transform,geoPoint,inversePoint,contains} from '../src/world/city-math';
import bootstrap from '../src/world/bootstrap.json';
import {DISTRICT_COLORS} from '../src/world/district-colors';

describe('city geometry and map controls',()=>{
 it('places every geographic anchor on a flat surface in its actual district',()=>{
  for(const [id,anchor] of Object.entries(bootstrap.anchors)){
   const district=bootstrap.districts.features.find(d=>d.id===id.split(':')[0])!;
   expect(contains(district.geometry,anchor.position),id).toBe(true);
   expect(geoPoint(anchor.position)[2]).toBe(0);
  }
 });
 it('keeps labels, sites and ground picking aligned through pan, rotation, tilt and zoom',()=>{
  for(const anchor of Object.values(bootstrap.anchors))for(const yaw of [-Math.PI,-Math.PI/2,-.35,0,.35,Math.PI/2,Math.PI])for(const pitch of [.35,.78,1]){
   const center=anchorPose(anchor.position),m=rotation(yaw,pitch);
   for(const offset of [[0,0],[.016,.021],[-.033,.024]]){
    const p=[anchor.position[0]!+offset[0]!,anchor.position[1]!+offset[1]!],v=geoPoint(p),q=transform(m,[v[0]!-center.x,v[1]!-center.y,0]);
    const picked=inversePoint(q[0]!,q[1]!,m,[center.x,center.y])!;
    expect(picked[0]).toBeCloseTo(p[0]!,8);expect(picked[1]).toBeCloseTo(p[1]!,8);
   }
  }
 });
 it('bounds repeated navigation above the surface and near the playable extent',()=>{
  const pose=boundedPose({x:999,y:-999,yaw:100,pitch:100,zoom:1e9});
  expect(pose).toEqual({x:1.30,y:-1.20,yaw:Math.PI,pitch:1,zoom:576});
  expect(boundedPose({...pose,pitch:-100,zoom:0}).pitch).toBe(.35);
  const confined=confinePose({x:999,y:-999,yaw:0,pitch:.78,zoom:288},bootstrap.districts.features);
  expect(Math.hypot(confined.x-pose.x,confined.y-pose.y)).toBeGreaterThan(.01);
  expect(confined.zoom).toBe(288);
 });
 it('does not select empty space or a polygon hole',()=>{
  const poly={type:'Polygon',coordinates:[[[0,0],[4,0],[4,4],[0,4],[0,0]],[[1,1],[3,1],[3,3],[1,3],[1,1]]]};
  expect(contains(poly,[.5,.5])).toBe(true);expect(contains(poly,[2,2])).toBe(false);expect(contains(poly,[5,2])).toBe(false);
  expect(bootstrap.districts.features.some(d=>contains(d.geometry,[71.1,51.1]))).toBe(false);
 });
 it('builds all five clipped territories without a spherical base or landmark manifest',()=>{
  expect(new Set(Object.values(DISTRICT_COLORS)).size).toBe(5);
  expect(bootstrap.metadata).not.toHaveProperty('globeCount');expect(bootstrap).not.toHaveProperty('places');
  expect(Object.keys(bootstrap.metadata.districtRanges).sort()).toEqual(Object.keys(DISTRICT_COLORS).sort());
  for(const range of Object.values(bootstrap.metadata.districtRanges))expect(range.count).toBeGreaterThan(0);
 });
});
