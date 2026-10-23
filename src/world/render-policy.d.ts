export interface MapView {rotation:number[];zoom:number;center:number[];aspect:number;perspective?:number;clipPlanes?:number[][]|null}
export function frustumPlanes(view:Pick<MapView,'rotation'|'zoom'|'aspect'|'perspective'>):number[][]|null;
export function visibleBounds(bounds:number[],view:MapView,pad?:number):boolean;
export function shadowFrame(time:number,zoom:number,focusPoint:number[],size?:number):{sun:number[];basis:number[];frames:{extent:number;origin:number[];key:string}[];key:string};
