import {lazy,Suspense} from 'react';
import type {WorldProps} from './contract';
const Astana=lazy(()=>import('./AstanaPreview'));
const Khanate=lazy(()=>import('./khanate/Preview'));
export default function MapPreview(props:Pick<WorldProps,'mode'|'onDistrictSelect'|'focusedDistrict'>){const Preview=props.mode==='khanate'?Khanate:Astana;return <Suspense fallback={<div className="map-preview"/>}><Preview {...props}/></Suspense>;}
