import type { InitiativeId } from '../domain/types';
/** Editorial consistency review only. Native-speaker review remains pending. */
export const LANGUAGE_REVIEW = {status:'editorial-draft',nativeSpeakerReviewed:false,date:'2026-09-25',checks:['Unicode Cyrillic','consistent initiative references','Russian meaning','no numerical personal predictions']} as const;
export const INITIATIVE_TERMS_KK:Record<InitiativeId,string> = {
  M1:'Автобустарға арналған жеке жолақтар',M2:'Бейімделетін бағдаршамдар',M3:'LRT желісін салу немесе кеңейту',
  M4:'Саябақ немесе шағын бақ',M5:'Жеке үйлерді таза отынға көшіру',M6:'Көгалдандыру және желден қорғайтын көшеттер',
  M7:'Модульдік мектеп пен балабақша',M8:'Отбасылық емхана',M9:'Ауладағы спорт алаңдары',M10:'Жарықтандыру мен камералар',
  M11:'Қауіпсіз өткелдер мен мектеп аймақтары',M12:'Тұрғындардың өтініштеріне арналған бірыңғай платформа',
  M13:'Жылу және су құбыры желілерін жаңарту',M14:'Апаттық бригадалар және ерте ескерту',
};
export const DISTRICT_TERMS_KK = {esil:'Есіл',almaty:'Алматы',saryarka:'Сарыарқа',baikonur:'Байқоңыр',nura:'Нұра'} as const;
export const RECURRING_TERMS = [
  {kk:'ұсыныс',ru:'предложение; ещё не обязательство'},
  {kk:'жоспарға кірген',ru:'включён в план; ещё не построен'},
  {kk:'көрсетілген',ru:'показано в иллюстрации; не утверждение о реальном городе'},
  {kk:'өтініш',ru:'обращение жителя'},
  {kk:'көшет',ru:'саженец'},
  {kk:'аялдама',ru:'остановка'},
  {kk:'өткел',ru:'переход'},
  {kk:'кіреберіс',ru:'вход'},
] as const;
