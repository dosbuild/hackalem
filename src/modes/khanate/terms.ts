import {text} from '../../ui/copy';
import type {ModeDefinition} from '../types';

export const districts:ModeDefinition['districts']=[
 {id:'esil',name:'Riverbank',character:'Ferries, reeds and teaching yurts by the Esil'},
 {id:'almaty',name:'Artisans\' Quarter',character:'Felt, timber, kilns and trading yards'},
 {id:'saryarka',name:'Saryarka',character:'Old neighbourhoods, gardens and large family courtyards'},
 {id:'baikonur',name:'Caravan Gates',character:'Arriving caravans, granaries and watch posts'},
 {id:'nura',name:'Nura Pastures',character:'New families, open steppe and long journeys for help'},
];
export const areas:ModeDefinition['areas']={transport:'Roads and caravans',environment:'Land and air',social:'Learning and care',safety:'Peace and protection',municipal:'Shared services'};
export const indicators:ModeDefinition['indicators']={T1:'Free movement',T2:'Access to transport',E1:'Trees and gardens',E2:'Clean air',S1:'Learning',S2:'Healing and care',B1:'Peaceful streets',B2:'Safe crossings',C1:'Water and warmth',C2:'Answers to petitions'};
export const terms:ModeDefinition['terms']={unit:'coins',district:'Quarter',districts:'quarters',season:'season',seasons:'seasons',decision:'Decree',decisions:'Decrees',result:'Chronicle',residents:'Petitions',citywide:'Whole city'};
export const copy:typeof text={...text,
 title:'Khanate',eyebrow:'CITY ON THE ESIL · LATE 18TH CENTURY',
 welcome:'You are the khan of a city on the Esil. Your treasury holds one hundred coins. Issue five decrees and see how life changes over eight seasons. Choose no more than two projects in one policy area. Take your time to decide.',
 fictional:'This city, its residents and events are fictional. Their appearance is inspired by the Kazakh steppe of the late eighteenth century.',
 budget:'Treasury',units:'coins',decisions:'Decrees',plan:'Your decrees',emptySlot:'Decree slot',
 district:'Quarter',districtMeasure:'One quarter',chooseDistrict:'Choose a quarter',
 delay:(lag:number)=>`Preparation: ${lag} ${lag===1?'season':'seasons'}`,
 citywideHelp:'This decree covers all five quarters. No separate location is needed.',
 commit:'Seal the decree',realized:'Over 8 seasons',
 ready:'Five decrees are ready. See what they bring over two years. Unspent coins do not add points.',
 evaluate:'Open the chronicle',worldTitle:'City on the Esil',worldLoading:'Unfolding the city on the Esil… You can already read the petitions.',
 worldHelp:'Choose quarters and see where your decrees apply. Your saved plan is also available on this map.',
 worldFailure:'The 3D city is currently unavailable. Quarters, petitions and calculations remain available on the illustrated map.',
 noDistrict:'No quarter selected yet',cityProjects:'Citywide decrees',results:'A two-year chronicle',
 weakest:'Lowest quarter index',future:'After 8 seasons',
 compareHelp:'The switch shows the city before your decrees and the calculated outcome after two years. It does not predict an intermediate season.',
 positivePairs:(n:number)=>`${n} quarter indicators improved.`,negativePairs:(n:number)=>`${n} quarter indicators declined. See the trade-offs.`,
 districtResults:'By quarter',indicatorDetails:'Selected quarter indicators',
 storage:{restored:'Your decree book is open at the previous page. Let us continue.',corrupt:'The saved book could not be read. A new plan is open.',obsolete:'This book belongs to an earlier version of the game. A new plan is open.',unavailable:'The book could not be saved on this device. You can switch eras; your decrees remain available until you close the page.'},
 announcements:{committed:'The decree is sealed. You can return to it and change your decision.',removed:'Decree removed. Coins returned to the treasury.',evaluated:'Two years calculated. A new page of the chronicle is open.',restarted:'A new decree book is open. The treasury holds one hundred coins.',restored:'Previous decrees restored. Treasury and outcome recalculated.',adopted:'The new alternative is adopted. The decrees and chronicle describe the same future.'},
};
