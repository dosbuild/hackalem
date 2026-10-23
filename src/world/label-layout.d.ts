interface Point{x:number;y:number}
interface Rect{left:number;right:number;top:number;bottom:number;outline?:readonly Point[]}
export function projectLabelVolume(points:readonly (Point&{visible?:boolean})[]):(Rect&{outline:Point[]})|null;
export function projectLabelLeader(volume:Rect&{outline:readonly Point[]},point:Point):Point;
export function projectLabelFootprint(mesh:DataView,bounds:readonly (readonly number[])[]):number[][];
export function projectLabelPhysicalLeader<T extends Point&{visible?:boolean}>(points:readonly T[],point:Point&{box?:Rect},viewport?:{width:number;height:number},obstacles?:readonly Rect[],protectedVolumes?:readonly Rect[]):T|null;
export function createProjectLabelFootprints<T extends object>():{
 reset(labels:readonly {site:T;bounds:readonly (readonly number[])[]|undefined}[]):void;
 capture(site:T,mesh:DataView,constructing:boolean):void;
 read(site:T):number[][]|undefined;
 clear():void;
};
export function placeProjectLabel(anchor:Point,preferred:Point,size:{width:number;height:number},viewport:{width:number;height:number},obstacles:readonly Rect[]):(Point&{box:Rect})|null;
export function createProjectLabelSizes(resizeTarget:EventTarget,fonts?:EventTarget&{ready:Promise<unknown>}):{
 read(button:Pick<HTMLElement,'offsetWidth'|'offsetHeight'>):{width:number;height:number};
 invalidate():void;
 destroy():void;
};
