export const PALETTE:Readonly<Record<'felt'|'paper'|'ink'|'muted'|'sage'|'water'|'clay'|'brass'|'indigo'|'textile'|'pine'|'line'|'land'|'landEdge'|'landRim'|'skyTop'|'skyBottom'|'nightTop'|'nightBottom'|'stone'|'paving'|'road'|'path',string>>;
export const DISTRICT_PALETTE:Readonly<Record<import('../domain/types').DistrictId,string>>;
export function unitColor(hex:string):number[];
export function applyPalette(element:HTMLElement):void;
