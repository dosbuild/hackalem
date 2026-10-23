import type { DistrictId, InitiativeId } from '../domain/types';
import type { Resident, Visual, Prop, Line, RoutineStep, AnchorKind } from './types';
import { RULES } from './rules';

type Seed = readonly [string, string, InitiativeId, InitiativeId, Prop, string, string, string];
/** Every row is an authored identity. Index and scenario never generate a new person. */
const SIGNATURES: Record<DistrictId, readonly Seed[]> = {
  esil:[
    ['Aidana Serik','landscape technician','M4','M8','watering-can','Moves the pot into the shade and checks the soil twice.','I water the sapling a little at a time. When Aliya comes, I will pass her the watering can.','I water the sapling a little at a time. When Aliya comes, I will pass her the watering can.'],
    ['Aliya Nurlan','translator','M8','M4','folder','Aligns the corners of the folder before putting it in the bag.','My papers are in order. I will visit Aidana on the way back.','My papers are in order. I will visit Aidana on the way back.'],
    ['Timur Adil','stage technician','M1','M11','gloves','Folds work gloves with the cuffs tucked inside.','I will fold my gloves so I do not lose them at the stop.','I will fold my gloves so I do not lose them at the stop.'],
    ['Dana Tolegen','editor','M11','M1','satchel','Stops at the kerb and adjusts the bag strap.','I will adjust my bag strap, then look at the road.','I will adjust my bag strap, then look at the road.'],
  ],
  almaty:[
    ['Marat Oraz','bus driver','M2','M11','thermos','Turns the thermos lid and looks across the crossing.','I will close the thermos. At the turn, I watch for pedestrians.','I will close the thermos. At the turn, I watch for pedestrians.'],
    ['Zhanar Aset','librarian','M7','M9','book','Checks the bookmark, then looks at the school notice.','I must not lose my bookmark. Let me read this notice.','I must not lose my bookmark. Let me read this notice.'],
    ['Ruslan Kim','repair specialist','M13','M12','toolbox','Counts tools from left to right and closes the box.','I will count the tools so I leave nothing behind.','I will count the tools so I leave nothing behind.'],
    ['Nazerke Bolat','baker','M5','M8','bread','Holds a paper bag under one elbow to free a hand.','I hold the bread without crushing it. My other hand opens the door.','I hold the bread without crushing it. My other hand opens the door.'],
  ],
  saryarka:[
    ['Saltanat Kairat','courtyard caretaker','M10','M12','broom','Straightens a notice on the board before sweeping.','I will straighten the corner of the notice. The wind has folded it again.','I will straighten the corner of the notice. The wind has folded it again.'],
    ['Viktor Sokolov','watchmaker','M12','M13','clipboard','Checks a note and passes a pencil to a neighbour.','Is my writing clear? I will lend the neighbour a pencil.','Is my writing clear? I will lend the neighbour a pencil.'],
    ['Rauan Ermek','student','M9','M7','ball','Rolls the ball under one foot before passing it to a friend.','I will not kick it far. My friend is nearby.','I will not kick it far. My friend is nearby.'],
    ['Gulmira Askar','tailor','M6','M5','plant','Carefully tightens a soft tie around a sapling.','I will not tighten the tie too much. The stem needs room.','I will not tighten the tie too much. The stem needs room.'],
  ],
  baikonur:[
    ['Erlan Murat','dispatcher','M14','M13','headphones','Moves one headphone aside and checks a list with a colleague.','Let us check the list together. I am marking it carefully.','Let us check the list together. I am marking it carefully.'],
    ['Amina Daulet','illustrator','M3','M10','camera','Covers the lens, then puts the camera in a bag.','I will put the camera away. I want to read on the journey.','I will put the camera away. I want to read on the journey.'],
    ['Oleg Pak','electrician','M11','M2','cart','Checks the strap of a small trolley by the kerb.','I will check the trolley strap. Let us look at the crossing together.','I will check the trolley strap. Let us look at the crossing together.'],
    ['Lazzat Sarsen','archivist','M8','M6','tote','Folds a cloth bag and rests a walking stick alongside.','I will fold the bag and take my papers in my hands.','I will fold the bag and take my papers in my hands.'],
  ],
  nura:[
    ['Madina Bek','teacher','M7','M8','book','Closes a notebook around a pencil to keep the page.','I will leave the pencil between the pages and continue after our conversation.','I will leave the pencil between the pages and continue after our conversation.'],
    ['Arman Zhakyp','courier','M1','M11','umbrella','Brushes dry leaves from a folded umbrella.','A leaf is still on my umbrella. I will carry it to the stop.','A leaf is still on my umbrella. I will carry it to the stop.'],
    ['Zere Nurgali','designer','M4','M10','racket','Rests a racket against the knees, then greets an acquaintance.','I have my racket. First, let me say hello.','I have my racket. First, let me say hello.'],
    ['Bakyt Kanat','duty technician','M13','M14','toolbox','Sets the toolbox handle towards the passage and checks the latch.','I will put the handle towards the passage. It is easier to pick up that way.','I will put the handle towards the passage. It is easier to pick up that way.'],
  ],
};

// Supporting residents are authored in small place-based clusters, not a random name pool.
const SUPPORT: Record<DistrictId, readonly string[]> = {
  esil:['Samat Yesen','Kamila Isa','Ayan Maksat','Inna Li','Dias Omar','Aruzhan Saken','Nikita Orlov','Sholpan Aman','Zhomart Niyaz','Liliya Akhmet','Asel Dos','Roman Chen','Dinara Malik','Miras Sayan','Saule Rakym','Denis Yun','Aisulu Erkin','Aslan Zhengis','Mariya Belova','Nuriya Sabyr','Erkebulan Talgat','Irina Kim','Sanzhar Tilek'],
  almaty:['Adilet Bakyt','Alina Bayan','Galym Rustem','Yekaterina Pak','Nursultan Zhan','Meruert Ospan','Tatyana Yun','Azamat Ali','Akerke Darkhan','Pavel Li','Damir Eldos','Gaukhar Esen','Sergei Kim','Symbat Nur','Talshyn Omar','Ilyas Bolat','Anna Zotova','Rakhat Tilek','Fariza Zhol','Olzhas Samat'],
  saryarka:['Serik Aidar','Roza Erlan','Daniyar Kasym','Yelena Chen','Dilnaz Aset','Murat Asan','Polina Li','Bekzat Sapar','Zhibek Adil','Andrei Yun','Aisha Zhomart','Kanat Oraz','Svetlana Kim','Nurbek Esen','Ayaulym Rauan','Maksim Pak'],
  baikonur:['Chyngyz Alim','Kulash Isa','Yana Li','Yerasyl Nur','Rimma Pak','Tolegen Aman','Ayana Bolat','Grigory Yun','Moldir Omar'],
  nura:['Inkar Adil','Saken Murat','Veronika Kim','Nurlan Asan','Malika Yesen','Valery Li','Yerzhan Bek','Tomiris Oraz','Yuliya Pak','Kuanysh Samat','Karina Chen','Dauren Aidar'],
};
type Habit = readonly [string, Prop, string, string, string];
const HABITS: readonly Habit[] = [
  ['florist','plant','Checks a leaf while turning the pot towards the light.','I will turn the pot so the light reaches the leaf.','I will turn the pot so the light reaches the leaf.'],
  ['print operator','folder','Presses the folder corners together and looks for a sheet.','The right sheet is marked. I will not have to search again.','The right sheet is marked. I will not have to search again.'],
  ['cook','thermos','Places the thermos lid only on a personal napkin.','I will put the lid on the napkin, then we can talk.','I will put the lid on the napkin, then we can talk.'],
  ['student','satchel','Checks the bag zip twice.','Is my bag closed? Yes. I am listening now.','Is my bag closed? Yes. I am listening now.'],
  ['school pupil','ball','Catches the ball with both hands and holds it under an elbow.','I will hold the ball so it does not interrupt our conversation.','I will hold the ball so it does not interrupt our conversation.'],
  ['proofreader','book','Runs a finger along the bookmark\'s edge.','The bookmark is in place. I know where I stopped.','The bookmark is in place. I know where I stopped.'],
  ['plumber','toolbox','Places a toolbox on a folded mat.','I will put the toolbox on the mat.','I will put the toolbox on the mat.'],
  ['retired chess player','tote','Rolls the cloth bag handles together.','I will gather the bag handles to make room.','I will gather the bag handles to make room.'],
  ['workshop assistant','gloves','Shakes dust out of one glove.','I will shake the glove out. There is dust inside.','I will shake the glove out. There is dust inside.'],
  ['sound engineer','headphones','Removes one headphone to talk.','I will remove one headphone so I can hear you clearly.','I will remove one headphone so I can hear you clearly.'],
  ['architect','clipboard','Holds a sheet of paper against the wind.','I will hold the paper so the wind does not take it.','I will hold the paper so the wind does not take it.'],
  ['father on parental leave','stroller','Checks the stroller brake and adjusts a bag.','I will check the stroller brake, then we can talk.','I will check the stroller brake, then we can talk.'],
  ['shopkeeper','cart','Straightens a box on a shopping trolley.','I will adjust the strap so the box does not slip.','I will adjust the strap so the box does not slip.'],
  ['amateur gardener','watering-can','Checks how much water remains in the watering can.','There is a little water left. I will share it with my neighbour.','There is a little water left. I will share it with my neighbour.'],
  ['photographer','camera','Wipes the lens cap with a sleeve.','I will wipe the cap. The camera can wait.','I will wipe the cap. The camera can wait.'],
  ['coach','racket','Checks the tension of the racket strings.','I will check the racket strings so it is ready to play.','I will check the racket strings so it is ready to play.'],
  ['cleaner','broom','Gathers leaves in a small pile by the dustpan.','I will collect the leaves together so they do not scatter.','I will collect the leaves together so they do not scatter.'],
  ['musician','scarf','Loosens a scarf during a short pause.','I will loosen my scarf. I am stopping here briefly.','I will loosen my scarf. I am stopping here briefly.'],
  ['pastry chef','bread','Changes hands with a bag to reach the door handle.','I will move the bag. It makes the door easier to open.','I will move the bag. It makes the door easier to open.'],
  ['translator','umbrella','Folds the umbrella strap into a neat loop.','I will wrap the umbrella strap. It is easier to hold now.','I will wrap the umbrella strap. It is easier to hold now.'],
];
const DISTRICT_ORDER: DistrictId[] = ['esil','almaty','saryarka','baikonur','nura'];
const COATS = ['#c3874a','#587c79','#b4523e','#6c668e','#c4b389','#3e637a','#617348','#b97977','#606b78','#9e875a'];
const ACCENTS = ['#f1d9a3','#b9d4c9','#e9bd6c','#d7c4de','#d67a55'];
const SKINS = ['#bd8666','#e1b48e','#a96d50','#d29c77','#ebc4a3'];
function visual(index:number, prop:Prop):Visual {
  return {coat:COATS[index % COATS.length]!,accent:ACCENTS[Math.floor(index / 3) % ACCENTS.length]!,skin:SKINS[index % SKINS.length]!,hair:['#302d32','#534338','#aba297','#382f28'][Math.floor(index / 2) % 4]!,
    cut:(['long','jacket','vest','wide'] as const)[index % 4]!,head:(['bob','bun','short','cap','hood'] as const)[Math.floor(index / 2) % 5]!,
    build:(['regular','tall','small','broad'] as const)[Math.floor(index / 3) % 4]!,mobility:index === 18 || index === 57 ? 'wheelchair' : index === 15 || index === 45 || index === 87 ? 'cane' : 'walk',prop};
}
function routine(anchor:AnchorKind):readonly RoutineStep[] {
  const middle=anchor==='garden'?'exchange':anchor==='crossing'?'walk':anchor==='service'?'handle':'wait';
  return [{activity:'handle',anchor,seconds:2},{activity:'signature',anchor,seconds:2},{activity:middle,anchor,seconds:3},{activity:'acknowledge',anchor,seconds:1},{activity:'walk',anchor,seconds:3},{activity:'idle',anchor:'entrance',seconds:3}];
}
const line = (kk:string,ru:string):Line=>({kk,ru});
const rows: Resident[] = [];
for (const [di,district] of DISTRICT_ORDER.entries()) {
  const seeds:Seed[] = [...SIGNATURES[district]];
  for (const [i,name] of SUPPORT[district].entries()) {
    const h = HABITS[(i + di * 3) % HABITS.length]!;
    // Purposeful concern families per cluster, with enough variety to cover every initiative.
    const template = SIGNATURES[district][Math.floor(i / 3) % 4]!;
    // The first local support group makes citywide planting, dispatch, signals and requests discoverable everywhere.
    const primary:InitiativeId = (['M6','M14','M2','M12'] as const)[i] ?? template[2];
    seeds.push([name,h[0],primary,primary===template[3]?template[2]:template[3],h[1],h[2],h[3],h[4]]);
  }
  for (const [i,s] of seeds.entries()) {
    const index = rows.length;
    const signature = i < 4;
    const id = `${district}-${String(i + 1).padStart(2,'0')}`;
    const primary = s[2];
    const location = i === 7 || i === 11 ? DISTRICT_ORDER[(di + 1) % 5]! : district;
    const anchor = RULES[primary].anchor;
    rows.push({id,name:s[0],role:s[1],primary,secondary:s[3],synthetic:true,signature,home:district,location,
      age:s[1] === 'school pupil' ? 'teenager' : index % 7 === 0 || index === 15 ? 'older adult' : index % 4 === 0 ? 'young adult' : 'adult',
      visual:visual(signature ? di*4+i : index,s[4]),habit:s[5],action:line(s[6],s[7]),
      why:line(`${s[6]} ${RULES[primary].baseline.kk}`,`${s[7]} ${RULES[primary].baseline.ru}`),
      concerns:[...new Set([...RULES[primary].indicators,...RULES[s[3]].indicators])].slice(0,3),
      relationships:[],routine:routine(anchor),
    });
  }
}
// Symmetric small clusters, disjoint groups of 2–3. No all-to-all synthetic social graph.
for (const d of DISTRICT_ORDER) {
  const group = rows.filter(r=>r.home === d);
  for (let i=0;i<group.length;) {
    const size=group.length-i===4?2:3;
    const cluster = group.slice(i,i+size);
    for (const resident of cluster) resident.relationships = cluster.filter(r=>r.id!==resident.id).map(r=>({residentId:r.id,kind:i===0?'friends':i%2===0?'colleagues':'neighbours'}));
    i+=size;
  }
}
export const RESIDENTS: readonly Resident[] = rows;
export const RESIDENT_BY_ID:Readonly<Record<string,Resident>> = Object.fromEntries(rows.map(r=>[r.id,r]));
export const SIGNATURE_RESIDENTS = RESIDENTS.filter(r=>r.signature);
export const FIRST_RESIDENT = RESIDENT_BY_ID['esil-01']!;
