import {createCityRuntime} from '../runtime-core.js';
import world from './definition.js';
export function createCity(element,initial,bus,status,signal){return createCityRuntime(element,initial,bus,status,signal,world);}
