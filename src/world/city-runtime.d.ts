import type {WorldProps} from './contract';
import type {ResidentScene} from '../residents/types';
import type {AppState} from '../app/state';
export interface CityRuntime {preserveCamera?():void;annotationSize?(size:{width:number;height:number}|null):void;setQuality?(quality:'light'|'detail'):Promise<void>;update(props:WorldProps):void;show(scene:ResidentScene|null,state:AppState):void;pose(value:string):void;zoom(factor:number):void;rotate?(x:number,y:number):void;orbit?(active?:boolean):void;replay?():void;destroy():void;diagnostics():unknown}
export function createCity(element:HTMLElement,props:WorldProps,bus:{select(id:string):void;help():void;physical(value:boolean):void},status:WorldProps['onStatus']):Promise<CityRuntime>;
