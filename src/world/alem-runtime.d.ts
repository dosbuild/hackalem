import type {WorldProps} from './contract';
import type {CityRuntime} from './city-runtime';
export function createCity(element:HTMLElement,props:WorldProps,bus:{select(id:string):void;help():void;physical(value:boolean):void},status:WorldProps['onStatus'],signal?:AbortSignal):Promise<CityRuntime>;
