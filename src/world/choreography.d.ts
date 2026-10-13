export interface Pose {x:number;y:number;yaw:number;pitch:number;zoom:number}
export interface ChoreographySite {key:string;id:string;origin:number[];citywide?:boolean;slot?:number}
export const OVERVIEW:Readonly<Pose>;
export const CLOSE_ZOOM:number;
export function closePose(site:ChoreographySite):Pose;
export function eventPose(site:ChoreographySite):Pose;
export function createChoreography(site:ChoreographySite,start:number,from:Pose,close?:Pose):{key:string;id:string;start:number;citywide:boolean;from:Pose;close:Pose;cancelled:boolean;duration:number;sample(now:number):{pose:Pose;stage:string;progress:number;people:number;arrival:number;finish:number;settle:number;citywide:boolean;duration:number;done:boolean}};
