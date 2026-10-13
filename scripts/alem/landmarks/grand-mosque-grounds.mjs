import {readFileSync} from 'node:fs';
import {Mesh, TAU} from './kit.mjs';

// These are openwork flower shades, not cylindrical buildings. Positions and
// canopy diameters come from the existing OSM roof footprints; the two heights
// and white petal construction follow the official Astana tourism photographs.
const source=JSON.parse(readFileSync(new URL('./grand-mosque-grounds-source.json',import.meta.url),'utf8'));
export const GRAND_MOSQUE_GROUNDS_ORIGIN=Object.freeze(source.origin);
export const GRAND_MOSQUE_GROUNDS_REPLACES=Object.freeze(source.canopies.map(c=>c.source));

export function flowerShade(m,x=0,y=0,r=5.935){
  const s=r/5.935,h=r>4?6.1:3.6,trunk=h*.58;
  const white='#f0eee2',edge='#e1ded0',lattice='#c3c9be';
  m.cylinder(x,y,0,.69*s,.18*s,'#c0b9a5',12);
  m.lathe(x,y,[[.46*s,.18*s],[.4*s,trunk*.65],[.59*s,trunk],[.92*s,trunk+.49*s]],white,16,{smooth:false,phase:Math.PI/8});
  // Fine longitudinal seams on the fluted stem and its branching crown.
  for(let i=0;i<8;i++){
    const a=i/8*TAU,c=Math.cos(a),q=Math.sin(a);
    m.path([[x+.43*s*c,y+.43*s*q,.18*s],[x+.42*s*c,y+.42*s*q,trunk*.68],[x+.61*s*c,y+.61*s*q,trunk],[x+1.5*s*c,y+1.5*s*q,trunk+.8*s]],.036*s,edge,4);
  }
  for(let petal=0;petal<8;petal++){
    const a=petal/8*TAU,ca=Math.cos(a),sa=Math.sin(a);
    const p=(t,f)=>{
      const rad=r*(.12+.88*t),width=r*.285*Math.sin(Math.PI*t)**.74;
      return [x+ca*rad-sa*width*f,y+sa*rad+ca*width*f,trunk+(h-trunk)*Math.sin(t*Math.PI/2)-Math.abs(f)*.08*s];
    };
    const steps=6;
    for(const f of [-1,1])m.path(Array.from({length:steps+1},(_,i)=>p(i/steps,f)),.069*s,white,4);
    m.path(Array.from({length:steps+1},(_,i)=>p(i/steps,0)),.046*s,edge,4);
    // Repeating open diamonds evoke the perforated floral screens in the
    // reference while leaving the sky visible through the complete crown.
    for(let j=1;j<steps;j++){
      const t=j/steps;
      m.beam(p(t,-1),p(t,1),.032*s,lattice,4);
      for(const f of [-1,1]){
        m.beam(p((j-1)/steps,0),p(t,f),.033*s,lattice,4);
        m.beam(p(t,f),p((j+1)/steps,0),.033*s,lattice,4);
      }
    }
    m.beam([x+.63*s*ca,y+.63*s*sa,trunk-.3*s],p(.28,0),.075*s,white,5);
  }
  return m;
}

// This mesh already uses EAST/NORTH coordinates. Place at ORIGIN with angle 0;
// the mosque's own architectural heading must not be applied to these grounds.
export function grandMosqueGrounds(){
  const m=new Mesh();
  for(const c of source.canopies){const x=(c.position[0]-source.origin[0])*69600,y=(c.position[1]-source.origin[1])*111000;flowerShade(m,x,y,c.radiusM);}
  return m;
}
export function grandMosqueShadeSample(){const m=new Mesh();flowerShade(m);flowerShade(m,10,4,3.071);return m;}
