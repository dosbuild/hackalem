/** Authored model units, shared by construction, settlement props and previews. */
export const OBJECT_UNIT=.00006;
export const OBJECT_FACTOR=OBJECT_UNIT/.00025;
export const YURT_HEIGHT_SCALE=.75;
export const LIFE_FACTOR=.13;
export const ROUTE_DURATION_FACTOR=5;
export const ANIMAL_FACTOR=.16;
export const COURT_CONCENTRATION=.5;
export const HOME_FORMATION=.45;
export const localPoint=(origin,angle,x,y,z=0,unit=OBJECT_UNIT)=>[origin[0]+(x*Math.cos(angle)-y*Math.sin(angle))*unit,origin[1]+(x*Math.sin(angle)+y*Math.cos(angle))*unit,(origin[2]??.00006)+z*unit];
export function meshBounds(buffer){
 const view=new DataView(buffer),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let at=0;at<buffer.byteLength;at+=20)for(let axis=0;axis<3;axis++){const value=view.getFloat32(at+axis*4,true);if(!Number.isFinite(value))throw Error('Non-finite historical mesh');min[axis]=Math.min(min[axis],value);max[axis]=Math.max(max[axis],value);}
 return {min,max,extent:max.map((value,i)=>value-min[i]),center:min.map((value,i)=>(value+max[i])/2)};
}
