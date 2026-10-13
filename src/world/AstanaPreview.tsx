import districts from './preview-districts.json';
import {DISTRICT_COLORS} from './district-colors';
import type {WorldProps} from './contract';
import type {DistrictId} from '../domain/types';

// Inline geography is available with the application, even if every mesh request fails.
const xy=(p:number[])=>[(p[0]!-71.431)*580,(51.139-p[1]!)*925];
export default function MapPreview(props:Pick<WorldProps,'onDistrictSelect'|'focusedDistrict'>) {
  return <svg className="map-preview" viewBox="-155 -175 320 320" role="group" aria-label="Обзорная карта Астаны">
    {districts.features.map(d=>{
      const id=d.id as DistrictId,polygons=d.geometry.type==='Polygon'?[d.geometry.coordinates]:d.geometry.coordinates;
      const path=(polygons as number[][][][]).flatMap(poly=>poly.map(ring=>ring.map((p,i)=>`${i?'L':'M'}${xy(p).join(',')}`).join('')+'Z')).join('');
      const p=xy(d.properties.center);
      return <g key={id} role="button" tabIndex={0} aria-label={`Выбрать район ${d.properties.name}`} aria-pressed={props.focusedDistrict===id} onClick={()=>props.onDistrictSelect(id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();props.onDistrictSelect(id);}}}>
        <path d={path} fill={DISTRICT_COLORS[id]} fillRule="evenodd" stroke={props.focusedDistrict===id?'#fff5cf':'#dbe5d0'} strokeWidth={props.focusedDistrict===id?1.2:.35}/>
        <text x={p[0]} y={p[1]} textAnchor="middle">{d.properties.name}</text>
      </g>;
    })}
  </svg>;
}
