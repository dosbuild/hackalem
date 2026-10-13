import type { ResidentScene } from '../residents/types';
import type { InitiativeId } from '../domain/types';
export function drawGameplayOverlay(ctx:CanvasRenderingContext2D,options:{scene:ResidentScene|null;x:number;y:number;scale:number;elapsedSeconds:number;night:number;heldInitiative?:InitiativeId|null;encounterRelation?:{anchorId:string;initiativeId:InitiativeId;relevant:boolean}|null}):void;
