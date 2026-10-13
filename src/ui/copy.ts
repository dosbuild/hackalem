import { DISTRICTS, INITIATIVES } from '../domain/scenario';
import type { CandidateDecision, DistrictId, IndicatorId, PolicyArea, ValidationIssue } from '../domain/types';

const numberFormat = new Intl.NumberFormat('ru-RU',{ maximumFractionDigits:2 });
export const format = (value:number) => numberFormat.format(value);
export const signed = (value:number) => `${value > 0 ? '+' : ''}${format(value)}`;
export const districtName = (id:DistrictId) => DISTRICTS.find(d => d.id === id)!.name;
export const scopeName = (decision:CandidateDecision) => decision.scope === 'citywide' ? text.citywide : decision.districtId ? districtName(decision.districtId) : text.chooseDistrict;
export const areaNames: Record<PolicyArea,string> = { transport:'Транспорт', environment:'Экология', social:'Социальная сфера', safety:'Безопасность', municipal:'Городские службы' };
export const indicatorNames: Record<IndicatorId,string> = {
  T1:'Свобода от пробок', T2:'Доступность общественного транспорта', E1:'Обеспеченность зеленью', E2:'Качество воздуха',
  S1:'Школы и детские сады', S2:'Первичная медицина', B1:'Безопасность улиц', B2:'Безопасность дорог', C1:'Надёжность коммунальных сетей', C2:'Скорость решения обращений',
};
export const text = {
  title:'Әлем', eyebrow:'АСТАНА · АКИМ НА 5 ЧАСОВ',
  welcome:'Выберите пять городских проектов в пределах 100 условных единиц и посмотрите, как изменится учебная модель Астаны через два года. Из одной сферы можно выбрать не больше двух проектов. Здесь нет таймера.',
  fictional:'Все исходные показатели вымышлены. Это учебный сценарий, а не оценка современной Астаны.',
  understood:'Понятно', restart:'Начать заново', skip:'Перейти к планированию',
  budget:'Осталось', units:'ед.', decisions:'Решения', ofFive:'из 5', spent:'Потрачено',
  plan:'Ваш план', emptySlot:'Свободное решение', edit:'Изменить', remove:'Убрать',
  catalogue:'Каталог проектов', allAreas:'Все сферы', areaFilter:'Сфера проекта',
  district:'Район', districtMeasure:'Один район', citywide:'Весь город', chooseDistrict:'Выберите район',
  inspect:'Рассмотреть', chosen:'В плане', delay:(lag:number) => `Задержка: ${lag} кв.`,
  proposal:'Предложение', replacement:'Замена решения', replaces:'Заменяет',
  candidateHelp:'Предпросмотр не расходует бюджет. Подтвердите решение, чтобы изменить план.',
  citywideHelp:'Проект действует во всех пяти районах. Выбор отдельного района не требуется.',
  replaceHelp:'Можно сменить район или выбрать другой проект в каталоге. План изменится только после подтверждения.',
  commit:'Добавить в план', confirmReplacement:'Сохранить замену', cancel:'Отменить',
  effect:'Показатель', fullEffect:'Полный эффект', realized:'За 8 кварталов',
  effectNote:'Эффект × (8 − задержка) / 8. Бонусы сочетаний добавляются отдельно, затем показатели ограничиваются диапазоном 0–100.',
  afterCommit:'После подтверждения останется', moreNeeded:(n:number) => `Добавьте ещё ${n} ${n === 1 ? 'решение' : n < 5 ? 'решения' : 'решений'}, чтобы оценить план.`,
  ready:'Пять решений готовы к оценке. Неиспользованный бюджет не даёт бонуса.',
  evaluate:'Оценить план', editRecovery:'Измените проект или район либо отмените предложение. Ваш план сохранён.',
  overview:'Обзор города', worldTitle:'Районы Астаны', harness:'ОБЗОРНАЯ КАРТА',
  worldHelp:'Выбирайте районы и проверяйте охват решений. Карту можно загрузить повторно. Сохранённый план остаётся доступен.',
  noCommitments:'Нет решений', proposed:'Предложено', committed:'В плане', noDistrict:'Район пока не выбран',
  cityProjects:'Общегородские проекты', worldLoading:'Подключение города… Планирование уже доступно.',
  worldFailure:'Объёмный город пока недоступен. Районы, план и расчёт доступны на обзорной карте.',
  camera:'Запрос вида', futureAvailable:'Оценённое будущее доступно',
  results:'Результат через два года', index:'Индекс сценария', baseline:'Исходный индекс', change:'Изменение',
  residentVisits:'Посмотреть, что изменилось для жителей',
  meetResident:'Встретить жителя',
  average:'Среднее по городу', weakest:'Самый низкий районный индекс', critical:'Критические показатели',
  formula:'Индекс = 0,7 × среднее по населению + 0,3 × минимум районов − число критических показателей.',
  present:'Сейчас', future:'Через 8 кварталов', compare:'Сравнение настоящего и будущего',
  compareHelp:'Середина переключателя разделяет две страницы: исходное состояние и рассчитанное будущее. Это не прогноз промежуточного квартала; итоговый индекс не меняется.',
  divider:(n:number) => n < 50 ? 'Открыта страница «Сейчас»' : 'Открыта страница «Через два года»',
  improvements:'Что изменилось', positivePairs:(n:number) => `Улучшились ${n} районных показателей.`,
  negativePairs:(n:number) => `Снизились ${n} районных показателей. Проверьте компромиссы в таблице.`,
  noCritical:'Показателей ниже 40 не осталось.', criticalHelp:'Критическими считаются только значения строго ниже 40.',
  districtResults:'По районам', indicatorDetails:'Показатели выбранного района',
  contributions:'Из чего складываются изменения', measures:'Эффекты проектов', synergies:'Бонусы сочетаний',
  noSynergies:'В этом плане нет бонусов сочетаний.', contributionNote:'Это изменения отдельных показателей, а не слагаемые итогового индекса.',
  revise:'Продолжить редактирование', resultRevision:'Результат относится к текущему плану. Подтверждённое изменение потребует нового расчёта.',
  dismissNotice:'Закрыть уведомление',
  storage:{ restored:'Черновик восстановлен. Продолжаем с ваших сохранённых решений.', corrupt:'Сохранённый черновик повреждён. Открыт новый план.', obsolete:'Сохранённый черновик относится к другой версии сценария. Открыт новый план.', unavailable:'Локальное сохранение недоступно. План работает до закрытия страницы.' },
  announcements:{ committed:'Решение сохранено. План можно оценить после выбора пяти проектов.', removed:'Решение убрано. Бюджет пересчитан.', evaluated:'План рассчитан. Результат доступен в разделе «Итог».', restarted:'Начат новый план. Бюджет: 100 единиц.', restored:'Предыдущий план возвращён. Бюджет и результат пересчитаны по его решениям.', adopted:'Вариант принят. План, расчёт и город показывают одно будущее.' },
};

export function issueMessage(issue:ValidationIssue): string {
  const name = issue.initiativeId ? INITIATIVES[issue.initiativeId].name : '';
  switch (issue.code) {
    case 'stranded': return 'После этого решения не хватит бюджета или допустимых проектов для всех пяти решений. Ая может предложить конкретную замену.';
    case 'stale': return 'План уже изменился. Я сохранила новые решения; запросите свежий вариант.';
    case 'invalid_schema': return 'Не удалось прочитать решение. Выберите проект заново.';
    case 'unknown_initiative': return 'Неизвестный проект. Выберите проект из каталога.';
    case 'invalid_scope': return `${name}: проверьте охват. Общегородскому проекту нельзя назначить отдельный район.`;
    case 'invalid_district': return `${name}: выберите один из пяти районов.`;
    case 'duplicate': return `${name} уже есть в плане. Измените существующее решение или выберите другой проект.`;
    case 'too_many': return 'В плане может быть только пять решений. Измените или уберите существующее.';
    case 'budget': return `Бюджет превышен на ${format(issue.amount ?? 0)} ед. Выберите менее дорогой проект или замените существующий.`;
    case 'area_limit': return `В сфере «${issue.area ? areaNames[issue.area] : ''}» уже два проекта. Выберите другую сферу или замените один из них.`;
    case 'incompatible': return `«${name}» и «${issue.relatedInitiativeId ? INITIATIVES[issue.relatedInitiativeId].name : ''}» несовместимы${issue.districtId ? ` в районе ${districtName(issue.districtId)}. Смените район или проект.` : ' в одном плане. Выберите другой проект.'}`;
    case 'missing_target': return 'Решение для замены не найдено. Откройте существующее решение заново.';
    case 'incomplete': return `Для оценки нужно ровно пять решений. Осталось добавить: ${issue.amount ?? 0}.`;
  }
}
