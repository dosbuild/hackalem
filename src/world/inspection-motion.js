import {cameraFrame} from './projection.js';

/** Orbit in the authoritative world camera, keeping the inspected point on screen. */
export function inspectionPose(base,pivot,seconds,options={}){
 const yaw=base.yaw+Math.sin(Math.min(24,Math.max(0,seconds))*.075)*.32;
 const pitch=base.pitch+Math.sin(Math.min(24,Math.max(0,seconds))*.11)*.025;
 const zoom=base.zoom*(1+Math.sin(Math.min(24,Math.max(0,seconds))*.09)*.035);
 const width=options.width??1440,height=options.height??900,pose={...base,yaw,pitch,zoom};
 const anchor=cameraFrame(base,width,height,0,options).world(pivot),under=cameraFrame(pose,width,height,0,options).inverseWorld(anchor.x,anchor.y,pivot[2]||0);
 return under?{...pose,x:pose.x+pivot[0]-under[0],y:pose.y+pivot[1]-under[1]}:pose;
}
