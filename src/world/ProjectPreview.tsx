import type {InitiativeId,DistrictId} from '../domain/types';
import type {ModeId} from '../modes/types';

type Props={initiativeId:InitiativeId;mode:ModeId;width?:number;height?:number;className?:string;districtId?:DistrictId|null};
/** Images are rendered from the same Alem meshes used by the native world. */
export function ProjectPreview({initiativeId,mode,width=320,height=156,className='',districtId}:Props){
 const place=districtId??'esil';
 return <img className={`paper-preview project-preview ${className}`} src={`${import.meta.env.BASE_URL}project-previews/${mode}/${initiativeId}-${place}.webp`} width={width} height={height} alt="" loading="lazy" decoding="async" onError={e=>{e.currentTarget.hidden=true;}}/>;
}
