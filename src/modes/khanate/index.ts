import {projects} from './projects';
import {districts,areas,indicators,copy,terms} from './terms';
import {stories,residents} from './residents';
import type {ModeDefinition} from '../types';
import {appeals} from './archive';
import {narrative} from './narrative';
const mode:ModeDefinition={id:'khanate',title:'Khanate',subtitle:'City on the Esil',era:'Late 18th century',districts,projects,areas,indicators,copy,terms,stories,appeals,residents,narrative,demonstration:{link:'See Aya open the teaching yurts',title:'A lesson begins with room for everyone',preparing:'Children travel from distant courtyards to lessons in the Nura Pastures. Let us open teaching yurts for them.',building:'24 coins. Frames unfold, the shanyrak rises and felt covers the walls. Soon mats will be laid out for the pupils.',complete:'The teaching yurts are open. Eight seasons will show how this decree changes access to learning. Your turn, Khan.',promise:'After the example, you have 100 coins and no decrees issued.'}};
export default mode;
