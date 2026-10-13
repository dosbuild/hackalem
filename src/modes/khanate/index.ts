import {projects} from './projects';
import {districts,areas,indicators,copy,terms} from './terms';
import {stories,residents} from './residents';
import type {ModeDefinition} from '../types';
import {appeals} from './archive';
import {narrative} from './narrative';
const mode:ModeDefinition={id:'khanate',title:'Хандық',subtitle:'Город у Есиля',era:'Конец XVIII века',districts,projects,areas,indicators,copy,terms,stories,appeals,residents,narrative,demonstration:{link:'Показать, как Ая открывает учебные юрты',title:'Урок начинается с места для каждого',preparing:'В Нуринских пастбищах дети собираются на урок из дальних дворов. Откроем для них учебные юрты.',building:'24 монеты. Раскрывается каркас, поднимается шанырак, ложится войлок. Скоро здесь расстелют подстилки для учеников.',complete:'Учебные юрты открыты. Восемь сезонов покажут, как указ изменит доступ к учению. Теперь ваш ход, Хан.',promise:'После примера у вас 100 монет и ни одного принятого указа.'}};
export default mode;
