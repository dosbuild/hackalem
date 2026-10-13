import {Mesh as BaseMesh, rgb, blend} from '../../../src/world/mesh-kit.js';

// Original metre-scale architectural geometry. The city compiler applies one
// geographic transform; the same surfaces are used at every camera distance.
export {rgb, blend};
export const palette = Object.freeze({
  stone:'#e4d8be', cream:'#eee3ca', edge:'#b7aa91', shadow:'#887c6c',
  glass:'#647f8c', glassLight:'#9aafb3', glassDark:'#425f6e',
  frame:'#d0d8cd', steel:'#8a9b9b', gold:'#c8a963', goldLight:'#e1c785',
  leaf:'#829379', darkLeaf:'#637e68', paving:'#c6baa0', water:'#7d9fa1',
});
export const TAU=Math.PI*2;
export class Mesh extends BaseMesh {
  constructor(){super();this.kind=8;}
  tri(a,b,c,color,normals){
    // Clipped arch/petal quads can end in a repeated vertex. Such triangles
    // have exactly zero area and cannot carry a valid geometric normal.
    const u=b.map((v,i)=>v-a[i]),v=c.map((q,i)=>q-a[i]);
    if(u[1]*v[2]-u[2]*v[1]===0&&u[2]*v[0]-u[0]*v[2]===0&&u[0]*v[1]-u[1]*v[0]===0)return;
    return super.tri(a,b,c,color,normals);
  }
  material(kind,fn){const before=this.kind;this.kind=kind;fn(this);this.kind=before;return this;}
  ring(x,y,z,r,tube,color,sides=64,tubeSides=5){
    for(let i=0;i<sides;i++){const a=i/sides*TAU,b=(i+1)/sides*TAU;this.beam([x+r*Math.cos(a),y+r*Math.sin(a),z],[x+r*Math.cos(b),y+r*Math.sin(b),z],tube,color,tubeSides);}return this;
  }
  lathe(x,y,profile,color,sides=48,{smooth=true,phase=0}={}){
    for(let j=0;j<profile.length-1;j++)for(let i=0;i<sides;i++){
      const [r,z]=profile[j],[s,h]=profile[j+1],a=i/sides*TAU+phase,b=(i+1)/sides*TAU+phase;
      const p=[[x+r*Math.cos(a),y+r*Math.sin(a),z],[x+r*Math.cos(b),y+r*Math.sin(b),z],[x+s*Math.cos(b),y+s*Math.sin(b),h],[x+s*Math.cos(a),y+s*Math.sin(a),h]];
      const co=typeof color==='function'?color(i,j):color;
      if(smooth){const length=Math.hypot(h-z,r-s)||1,n=t=>[(h-z)/length*Math.cos(t),(h-z)/length*Math.sin(t),(r-s)/length],ns=[n(a),n(b),n(b),n(a)];this.tri(p[0],p[1],p[2],co,ns.slice(0,3));this.tri(p[0],p[2],p[3],co,[ns[0],ns[2],ns[3]]);}else this.quad(...p,co);
    }return this;
  }
  disk(x,y,z,r,color,sides=64){for(let i=0;i<sides;i++){const a=i/sides*TAU,b=(i+1)/sides*TAU;this.tri([x,y,z],[x+r*Math.cos(a),y+r*Math.sin(a),z],[x+r*Math.cos(b),y+r*Math.sin(b),z],color);}return this;}
  path(points,r,color,sides=6){for(let i=1;i<points.length;i++)this.beam(points[i-1],points[i],r,color,sides);return this;}
  // Transform a local architectural component without losing its parent's frame.
  component(origin,angle,fn){const saved={origin:this.origin,angle:this.angle,scale:this.scale};this.at(this.point(origin),saved.angle+angle,saved.scale);fn(this);this.at(saved.origin,saved.angle,saved.scale);return this;}
}

export function tree(m,x,y,height=7,radius=2.6){
 m.cylinder(x,y,0,.24,height*.52,'#8a7962',7);
 m.ellipsoid(x,y,height*.65,radius,radius,height*.4,palette.leaf,10,7);
}
export function bench(m,x,y,angle=0){m.component([x,y,0],angle,()=>{m.box(0,0,.48,2.4,.64,.16,'#b49060');m.box(0,.27,.62,2.4,.13,.6,'#c09c6c');for(const s of [-.85,.85])m.box(s,0,0,.12,.55,.5,palette.steel);});}
export function lamp(m,x,y,h=5){m.cylinder(x,y,0,.11,h,palette.steel,8);m.material(25,()=>m.ellipsoid(x,y,h,.4,.4,.22,'#ffe0a0',10,6));}
