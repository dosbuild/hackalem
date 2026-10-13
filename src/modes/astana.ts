import {DISTRICTS,INITIATIVES} from '../domain/scenario';
import {INITIATIVE_IDS} from '../domain/types';
import {STORIES,APPEALS} from '../living/appeals';
import {RESIDENTS} from '../residents/population';
import {PROJECT_NAMES,SHORT_NEEDS,SHORT_LIMITS} from '../play/choices';
import {PROJECT_STORIES} from '../features/project-insight';
import {text,areaNames,indicatorNames} from '../ui/copy';
import type {ModeDefinition,ProjectPresentation} from './types';

const actions=['Выделить автобусные полосы','Настроить светофоры','Построить LRT','Создать парк','Перейти на чистое топливо','Высадить деревья','Построить школу','Открыть поликлинику','Оборудовать спортплощадки','Осветить улицы','Сделать переходы безопаснее','Запустить платформу обращений','Обновить сети','Усилить аварийные бригады'];
const projects=Object.fromEntries(INITIATIVE_IDS.map((id,i)=>[id,{...PROJECT_STORIES[id],name:INITIATIVES[id].name,shortName:PROJECT_NAMES[id],shortNeed:SHORT_NEEDS[id],shortLimit:SHORT_LIMITS[id],action:actions[i]!} satisfies ProjectPresentation])) as ModeDefinition['projects'];
const mode:ModeDefinition={id:'astana',title:'Астана',subtitle:'Город сегодня',era:'Наше время',districts:DISTRICTS.map(d=>({...d,character:''})),projects,areas:areaNames,indicators:indicatorNames,stories:STORIES,appeals:APPEALS,residents:RESIDENTS,demonstration:{link:'Показать, как Ая строит школу',title:'Начнём со школы в Нуре',preparing:'В Нуре нужны дополнительные места для учёбы. Выбираю школу. Сейчас подготовим весь город.',building:'Модульная школа и детский сад · 24 единицы. Смотрите, как решение становится частью города.',complete:'Вход открылся, появились дети и родители. За восемь кварталов школа улучшит доступность образования. Теперь ваш ход.',promise:'После примера у вас 100 единиц и 0/5 решений.'},copy:text,terms:{unit:'ед.',district:'Район',districts:'районы',season:'квартал',seasons:'кварталов',decision:'Решение',decisions:'Решения',result:'Итог',residents:'Жители',citywide:'Весь город'}};
export default mode;
