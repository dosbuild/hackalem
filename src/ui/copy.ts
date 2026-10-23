import { DISTRICTS, INITIATIVES } from '../domain/scenario';
import type { CandidateDecision, DistrictId, IndicatorId, PolicyArea, ValidationIssue } from '../domain/types';

const numberFormat = new Intl.NumberFormat('en-US',{ maximumFractionDigits:2 });
export const format = (value:number) => numberFormat.format(value);
export const signed = (value:number) => `${value > 0 ? '+' : ''}${format(value)}`;
export const districtName = (id:DistrictId) => DISTRICTS.find(d => d.id === id)!.name;
export const scopeName = (decision:CandidateDecision) => decision.scope === 'citywide' ? text.citywide : decision.districtId ? districtName(decision.districtId) : text.chooseDistrict;
export const areaNames: Record<PolicyArea,string> = { transport:'Transport', environment:'Environment', social:'Social services', safety:'Safety', municipal:'City services' };
export const indicatorNames: Record<IndicatorId,string> = {
  T1:'Traffic flow', T2:'Public transport access', E1:'Green space provision', E2:'Air quality',
  S1:'Schools and kindergartens', S2:'Primary healthcare', B1:'Street safety', B2:'Road safety', C1:'Utility network reliability', C2:'Request resolution speed',
};
export const text = {
  title:'Alem', eyebrow:'ASTANA · MAYOR FOR 5 HOURS',
  welcome:'Choose five city projects within 100 budget units and see how the educational model of Astana changes in two years. Choose at most two projects from one policy area. There is no timer.',
  fictional:'All baseline indicators are fictional. This is an educational scenario, not an assessment of present-day Astana.',
  understood:'Got it', restart:'Start again', skip:'Go to planning',
  budget:'Remaining', units:'units', decisions:'Decisions', ofFive:'of 5', spent:'Spent',
  plan:'Your plan', emptySlot:'Open decision slot', edit:'Edit', remove:'Remove',
  catalogue:'Project catalogue', allAreas:'All areas', areaFilter:'Policy area',
  district:'District', districtMeasure:'One district', citywide:'Citywide', chooseDistrict:'Choose a district',
  inspect:'Inspect', chosen:'In the plan', delay:(lag:number) => `Delay: ${lag} quarters`,
  proposal:'Proposal', replacement:'Decision replacement', replaces:'Replaces',
  candidateHelp:'Previewing does not spend the budget. Confirm the decision to change your plan.',
  citywideHelp:'This project affects all five districts. No individual district selection is needed.',
  replaceHelp:'Change the district or choose another project from the catalogue. Your plan changes only after confirmation.',
  commit:'Add to plan', confirmReplacement:'Save replacement', cancel:'Cancel',
  effect:'Indicator', fullEffect:'Full effect', realized:'Over 8 quarters',
  effectNote:'Effect × (8 − delay) / 8. Synergy bonuses are added separately, then indicators are clipped to 0–100.',
  afterCommit:'Remaining after confirmation', moreNeeded:(n:number) => `Add another ${n} ${n === 1 ? 'decision' : 'decisions'} to evaluate the plan.`,
  ready:'Five decisions are ready for evaluation. Unused budget earns no bonus.',
  evaluate:'Evaluate plan', editRecovery:'Change the project or district, or cancel the proposal. Your plan is saved.',
  overview:'City overview', worldTitle:'Astana districts', harness:'OVERVIEW MAP',
  worldHelp:'Select districts and check the scope of your decisions. You can reload the map. Your saved plan remains available.',
  noCommitments:'No decisions', proposed:'Proposed', committed:'In the plan', noDistrict:'No district selected yet',
  cityProjects:'Citywide projects', worldLoading:'Connecting the city… Planning is already available.',
  worldFailure:'The 3D city is currently unavailable. Districts, your plan and calculations remain available on the overview map.',
  camera:'View request', futureAvailable:'The evaluated future is available',
  results:'Results after two years', index:'Scenario index', baseline:'Baseline index', change:'Change',
  residentVisits:'See what changed for residents',
  meetResident:'Meet a resident',
  average:'City average', weakest:'Lowest district index', critical:'Critical indicators',
  formula:'Index = 0.7 × population-weighted average + 0.3 × lowest district score − number of critical indicators.',
  present:'Now', future:'After 8 quarters', compare:'Compare the present and future',
  compareHelp:'The midpoint of this control separates two pages: the baseline and the calculated future. It does not forecast an intermediate quarter; the final index remains unchanged.',
  divider:(n:number) => n < 50 ? '“Now” page open' : '“Two years later” page open',
  improvements:'What changed', positivePairs:(n:number) => `Improved: ${n} district indicators.`,
  negativePairs:(n:number) => `Decreased: ${n} district indicators. Check trade-offs in the table.`,
  noCritical:'No indicators remain below 40.', criticalHelp:'Only values strictly below 40 are considered critical.',
  districtResults:'By district', indicatorDetails:'Selected district indicators',
  contributions:'Where the changes come from', measures:'Project effects', synergies:'Synergy bonuses',
  noSynergies:'This plan has no synergy bonuses.', contributionNote:'These are individual indicator changes, not components of the final index.',
  revise:'Continue editing', resultRevision:'This result belongs to the current plan. Confirmed changes require a new calculation.',
  dismissNotice:'Dismiss notification',
  storage:{ restored:'Draft restored. Continuing from your saved decisions.', corrupt:'The saved draft is damaged. A new plan is open.', obsolete:'The saved draft belongs to another scenario version. A new plan is open.', unavailable:'Local saving is unavailable. Your plan works until this page closes.' },
  announcements:{ committed:'Decision saved. Evaluate the plan after choosing five projects.', removed:'Decision removed. Budget recalculated.', evaluated:'Plan calculated. The result is available in Results.', restarted:'New plan started. Budget: 100 units.', restored:'Previous plan restored. Its budget and results have been recalculated.', adopted:'Alternative accepted. The plan, calculation and city show the same future.' },
};

export function issueMessage(issue:ValidationIssue): string {
  const name = issue.initiativeId ? INITIATIVES[issue.initiativeId].name : '';
  switch (issue.code) {
    case 'stranded': return 'This decision would leave insufficient budget or valid projects for all five decisions. Aya can suggest a specific replacement.';
    case 'stale': return 'The plan has already changed. I kept your new decisions; request a fresh alternative.';
    case 'invalid_schema': return 'Could not read the decision. Choose the project again.';
    case 'unknown_initiative': return 'Unknown project. Choose one from the catalogue.';
    case 'invalid_scope': return `${name}: check the scope. A citywide project cannot be assigned to one district.`;
    case 'invalid_district': return `${name}: choose one of the five districts.`;
    case 'duplicate': return `${name} is already in the plan. Edit the existing decision or choose another project.`;
    case 'too_many': return 'A plan can contain only five decisions. Edit or remove an existing one.';
    case 'budget': return `Budget exceeded by ${format(issue.amount ?? 0)} units. Choose a cheaper project or replace an existing one.`;
    case 'area_limit': return `The “${issue.area ? areaNames[issue.area] : ''}” area already has two projects. Choose another area or replace one of them.`;
    case 'incompatible': return `“${name}” and “${issue.relatedInitiativeId ? INITIATIVES[issue.relatedInitiativeId].name : ''}” conflict${issue.districtId ? ` in district ${districtName(issue.districtId)}. Change the district or project.` : ' in one plan. Choose another project.'}`;
    case 'missing_target': return 'Could not find the decision to replace. Reopen an existing decision.';
    case 'incomplete': return `Evaluation requires exactly five decisions. Still to add: ${issue.amount ?? 0}.`;
  }
}
