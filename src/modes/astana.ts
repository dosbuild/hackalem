import {DISTRICTS,INITIATIVES} from '../domain/scenario';
import {INITIATIVE_IDS} from '../domain/types';
import {STORIES,APPEALS} from '../living/appeals';
import {RESIDENTS} from '../residents/population';
import {PROJECT_NAMES,SHORT_NEEDS,SHORT_LIMITS} from '../play/choices';
import {PROJECT_STORIES} from '../features/project-insight';
import {text,areaNames,indicatorNames} from '../ui/copy';
import type {ModeDefinition,ProjectPresentation} from './types';

const actions=['Create dedicated bus lanes','Coordinate traffic signals','Build LRT','Create a park','Switch to clean fuel','Plant trees','Build a school','Open a family clinic','Create sports spaces','Light the streets','Make crossings safer','Launch a resident request platform','Upgrade utility networks','Strengthen emergency crews'];
const projects=Object.fromEntries(INITIATIVE_IDS.map((id,i)=>[id,{...PROJECT_STORIES[id],name:INITIATIVES[id].name,shortName:PROJECT_NAMES[id],shortNeed:SHORT_NEEDS[id],shortLimit:SHORT_LIMITS[id],action:actions[i]!} satisfies ProjectPresentation])) as ModeDefinition['projects'];
const mode:ModeDefinition={id:'astana',title:'Astana',subtitle:'The city today',era:'Present day',districts:DISTRICTS.map(d=>({...d,character:''})),projects,areas:areaNames,indicators:indicatorNames,stories:STORIES,appeals:APPEALS,residents:RESIDENTS,demonstration:{link:'See Aya build a school',title:'Start with a school in Nura',preparing:'Nura needs more places to learn. I am choosing a school. First, we will prepare the whole city.',building:'Modular school and kindergarten · 24 units. Watch a decision become part of the city.',complete:'The entrance is open; children and parents have arrived. Over eight quarters the school improves access to education. Now it is your turn.',promise:'After the example, you have 100 units and 0/5 decisions.'},copy:text,terms:{unit:'units',district:'District',districts:'districts',season:'quarter',seasons:'quarters',decision:'Decision',decisions:'Decisions',result:'Outcome',residents:'Residents',citywide:'Whole city'}};
export default mode;
