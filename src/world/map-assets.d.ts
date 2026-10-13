export interface MapAsset {url:string;bytes:number;sha256:string;gzip?:boolean;transport?:{file:string;bytes:number;sha256:string;vertexBytes:number}}
export function fetchMapAsset(asset:MapAsset,options?:{signal?:AbortSignal;onProgress?:(fraction:number)=>void;fetchImpl?:typeof fetch;stallMs?:number;attempts?:number}):Promise<ArrayBuffer>;
