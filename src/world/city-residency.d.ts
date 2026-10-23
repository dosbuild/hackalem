import type {MapAsset,fetchMapAsset} from './map-assets';
export interface CityPreparation {loaded:number;total:number;bytes:number;totalBytes:number;progress:number}
export function prepareCity(options:{tiles:MapAsset[];base:string;renderer:{addTile:(id:string,data:ArrayBuffer,asset:MapAsset)=>void};signal:AbortSignal;abort?:AbortController;onProgress?:(value:CityPreparation)=>void;load?:typeof fetchMapAsset;concurrency?:number}):Promise<Omit<CityPreparation,'progress'>>;
