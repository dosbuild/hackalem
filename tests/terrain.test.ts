import {describe,expect,it} from 'vitest';
import {cellContours,terrainContours} from '../scripts/alem/terrain.mjs';
// @ts-expect-error Shared JavaScript geometry kernel is exercised directly here.
import {inPolygon} from '../src/world/placement-geometry.js';

describe('continuous terrain apron',()=>{
 it('contains every occupied cell, including narrow projections and re-entrant corners',()=>{
  const cells=new Set<string>();
  for(let x=0;x<20;x++)for(let y=0;y<18;y++)if(!(x>10&&y>9))cells.add(`${x}/${y}`);
  for(let x=20;x<28;x++)cells.add(`${x}/0`);
  const {loops}=terrainContours(cells,.035);
  for(const key of cells){const [x,y]=key.split('/').map(Number) as [number,number];for(const [a,b] of [[x,y],[x+1,y],[x+1,y+1],[x,y+1]] as [number,number][])expect(loops.some(r=>inPolygon([a*.035,b*.035],[r]))).toBe(true);}
  expect(loops).toHaveLength(1);
  // Smoothing must not fill the entire concave footprint's bounding box.
  expect(loops.some(r=>inPolygon([.62,.57],[r]))).toBe(false);
 });
 it('keeps separated islands separate instead of making a convex hull',()=>{
  const {loops}=terrainContours(new Set(['0/0','30/0']),1);
  expect(loops).toHaveLength(2);
  expect(loops.some(r=>inPolygon([15,.5],[r]))).toBe(false);
 });
 it('closes diagonal contacts without dropping an exposed edge',()=>{
  const loops=cellContours(new Set(['0/0','1/1']),1);
  expect(loops.flat().length).toBe(8);
  expect(loops.every(r=>r.length>=4)).toBe(true);
 });
});
