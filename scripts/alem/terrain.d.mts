export function cellContours(cells:Set<string>,cell:number):[number,number][][];
export function softenContour(ring:[number,number][],passes?:number):[number,number][];
export function simplifyContour(ring:[number,number][],tolerance:number):[number,number][];
export function terrainContours(cells:Set<string>,cell:number):{loops:[number,number][][];cells:number;buffer:number};
