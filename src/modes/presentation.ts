import { format } from '../ui/copy';
import type { ModeDefinition, ModePresentation } from './types';

/** Pure and request-scoped, including server use. Never a mutable current-language global. */
export function presentationFor(mode:ModeDefinition):ModePresentation {
  const districtName:ModePresentation['districtName']=id=>mode.districts.find(d=>d.id===id)!.name;
  const scopeName:ModePresentation['scopeName']=d=>d.scope==='citywide'?mode.copy.citywide:d.districtId?districtName(d.districtId):mode.copy.chooseDistrict;
  const issueMessage:ModePresentation['issueMessage']=issue=>{
    const name=issue.initiativeId?mode.projects[issue.initiativeId].name:'',related=issue.relatedInitiativeId?mode.projects[issue.relatedInitiativeId].name:'';
    const where=issue.districtId?` · ${districtName(issue.districtId)}`:'';
    switch(issue.code){
      case 'stranded':return 'После этого выбора не хватит средств или допустимых проектов для всех пяти решений. Ая поможет найти замену.';
      case 'stale':return 'План уже изменился. Новые решения сохранены; запросите свежий вариант.';
      case 'invalid_schema':return 'Не удалось прочитать решение. Выберите проект заново.';
      case 'unknown_initiative':return 'Неизвестный проект. Выберите проект из каталога.';
      case 'invalid_scope':return `${name}: проверьте охват. Мера для всего города не требует отдельного места.`;
      case 'invalid_district':return `${name}: выберите место из пяти доступных.`;
      case 'duplicate':return `«${name}» уже в плане. Измените это решение или выберите другое.`;
      case 'too_many':return 'Можно принять только пять решений. Измените или уберите существующее.';
      case 'budget':return `Не хватает ${format(issue.amount??0)} ${mode.terms.unit}. Выберите менее дорогой проект или замените существующий.`;
      case 'area_limit':return `В сфере «${issue.area?mode.areas[issue.area]:''}» уже два решения. Выберите другую сферу или сделайте замену.`;
      case 'incompatible':return `«${name}» и «${related}» требуют одних ресурсов${where}. Смените место или проект.`;
      case 'missing_target':return 'Решение для замены не найдено. Откройте существующее решение заново.';
      case 'incomplete':return `Для оценки нужно ровно пять решений. Осталось добавить: ${issue.amount??0}.`;
    }
  };
  return {districtName,scopeName,issueMessage};
}
