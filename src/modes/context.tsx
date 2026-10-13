import {createContext,useContext,useMemo} from 'react';
import type {ReactNode} from 'react';
import type {ModeDefinition,ModeId,ModePresentation} from './types';
import type {StoragePort} from '../app/storage';
import {worldStorage} from './storage';
import {presentationFor} from './presentation';
import {contentFor} from './content';

type ModeContextValue={mode:ModeDefinition;content:ReturnType<typeof contentFor>;presentation:ModePresentation;storage:StoragePort;session:StoragePort;switchMode:(id:ModeId)=>void};
const ModeContext=createContext<ModeContextValue|null>(null);
export function ModeProvider({mode,switchMode,children}:{mode:ModeDefinition;switchMode:(id:ModeId)=>void;children:ReactNode}){
 const value=useMemo(()=>({mode,content:contentFor(mode),presentation:presentationFor(mode),storage:worldStorage(mode.id),session:worldStorage(mode.id,'session'),switchMode}),[mode,switchMode]);
 return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}
export function useMode(){const value=useContext(ModeContext);if(!value)throw new Error('World presentation requires a ModeProvider');return value;}
