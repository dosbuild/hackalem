import type {Member,MemberId} from '../../dashboard/types';
export const members:Member[]=[
 {id:'transport',name:'Sarsen',title:'Road steward',initials:'S',focus:'Wagons, ferries and the road to the teacher'},
 {id:'environment',name:'Zere',title:'Keeper of the land',initials:'Z',focus:'Clean air, groves and shared gardens'},
 {id:'social',name:'Aiganym',title:'Teacher',initials:'A',focus:'Learning places and access to healers'},
 {id:'safety',name:'Toleu',title:'Head of the watch',initials:'T',focus:'Peaceful paths and children\'s crossings'},
 {id:'municipal',name:'Ermek',title:'Master of shared services',initials:'E',focus:'Wells, winter homes and help for neighbours'},
 {id:'ombudsman',name:'Kulash',title:'Voice of the five quarters',initials:'K',focus:'Families on the far edge of town'},
 {id:'finance',name:'Oraz',title:'Treasurer',initials:'O',focus:'Value from every coin'},
 {id:'chair',name:'Dana',title:'Council keeper',initials:'D',focus:'A shared answer and the right to disagree'},
];
export const openings:Record<MemberId,string>={
 transport:'Khan, the road connects all our work. I look at whether it is easier to reach the teacher, carry goods and cross the river.',
 environment:'We need clean air above the yurts and living shade by the well. A high overall score must not hide the needs of the land.',
 social:'A pupil and a person visiting the healer need different kinds of help. One good deed cannot replace the other.',
 safety:'A wagon driver must see the children\'s path in advance. If the wagon has to slow down, let us discuss both sides.',
 municipal:'We need wells and winter homes every day. I look at whether crews are ready to help and answers reach petitioners.',
 ombudsman:'From the near bank, distant families are not always visible. My voice is for the quarter still left behind.',
 finance:'Coins in a closed chest do not help the city by themselves. But spending everything just to empty it makes no sense: let us compare the return from each project.',
};
