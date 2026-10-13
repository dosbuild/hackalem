import {it,expect} from 'vitest';
import {hasUnverifiedNumber} from '../server/numeric-prose';
it('keeps provider quantities out of qualitative prose, including spelled-out numbers',()=>{
 for(const text of ['Плюс 5 баллов.','(десять баллов)','Снижение на двадцать процентов.','Доступность вырастет вдвое.','Более трёх тысяч семей.','Двести мест.','С семью решениями.','Индекс ５０.'])expect(hasUnverifiedNumber(text)).toBe(true);
 for(const text of ['Однако районы получают разную пользу.','Посадки требуют дальнейшего ухода.','Сравните транспорт и социальные услуги.','Семьи смогут выбирать школу ближе к дому.','Решение поддерживает семью.'])expect(hasUnverifiedNumber(text)).toBe(false);
});
