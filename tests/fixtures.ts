import type { CitywideDecision, CitywideInitiativeId, DistrictDecision, DistrictId, DistrictInitiativeId, Plan } from '../src/domain/types';
export const local = (initiativeId:DistrictInitiativeId, districtId:DistrictId = 'nura'):DistrictDecision => ({ initiativeId, scope:'district', districtId });
export const city = (initiativeId:CitywideInitiativeId):CitywideDecision => ({ initiativeId, scope:'citywide' });
export const fixture:Plan = [local('M1'),city('M2'),local('M8'),local('M10','saryarka'),city('M12')];
export const exactBudget:Plan = [local('M3'),city('M6'),local('M8'),city('M12'),city('M14')];
