import type {ScreenRect} from './contract';
export interface Pose {x:number;y:number;zoom:number;yaw:number;pitch:number}
export interface Projected {x:number;y:number;z:number;visible:boolean}
export interface ProjectionOptions {overviewZoom?:number;perspective?:boolean}
export interface ProjectionNotice {anchor:Projected;frame:number;zoom:number;width:number;height:number;occlusions:readonly ScreenRect[]}
export function cameraFrame(pose:Pose,width:number,height:number,id?:number,options?:ProjectionOptions):{id:number;width:number;height:number;pose:Pose;matrix:number[];scale:number;perspective:number;rendererZoom:number;world:(p:number[])=>Projected;project:(p:number[],h?:number)=>Projected;inverse:(x:number,y:number)=>number[]|null;inverseWorld:(x:number,y:number,altitude?:number)=>number[]|null;billboard:(p:number[],unit?:number)=>number[]};
export function occluded(p:{x:number;y:number},rects:readonly ScreenRect[],padding?:number):boolean;
export function fitContext(pose:Pose,points:number[][],width:number,height:number,rects:readonly ScreenRect[],options?:ProjectionOptions):Pose;
export function revealFocus(pose:Pose,point:number[],width:number,height:number,rects:readonly ScreenRect[],margin?:number,altitude?:number,options?:ProjectionOptions):Pose;
export function annotationPosition(anchor:{x:number;y:number},size:{width:number;height:number},viewport:{width:number;height:number},rects?:readonly ScreenRect[]):{x:number;y:number};
