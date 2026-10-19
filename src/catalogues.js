import {catalogue} from '../data/machine-elements/catalogue.js';
import {formatNumber} from './precision.js';
export const bearings=catalogue.bearings;
export const materials=catalogue.materials;
export const timingBelts=catalogue.timingBelts;
export const chains=catalogue.chains;
export const beltProfiles=catalogue.vBeltProfiles;
export const beltProfileLabel=b=>`${b.family==='narrow'?'Вузький клиновий':'Класичний клиновий'} ${b.profile} · ${formatNumber(b.width_m*1000)}×${formatNumber(b.height_m*1000)} мм`;
export const driveBeltLabel=p=>{const b=beltProfiles.find(b=>b.choice===p.beltProfile);return b?'Клинопасова передача · '+b.profile:'Пасова передача · власний профіль';};
export const timingLabel=b=>`Gates ${b.family} ${b.designation}; ${b.teeth} зубців`;
export const chainLabel=c=>`Renold ${c.designation}; p = ${c.pitch_m*1000} мм`;
export function timingPatch(choice){const b=timingBelts.find(x=>x.choice===choice);return b?{timingCatalogue:choice,timingPitch:b.pitch_m,timingTeeth:b.teeth,timingWidth:b.width_m}:{timingCatalogue:0};}
export function chainPatch(choice){const c=chains.find(x=>x.choice===choice);return c?{chainCatalogue:choice,chainPitch:c.pitch_m}:{chainCatalogue:0};}
export const moduleRows=row=>catalogue.modules.filter(x=>x.preferred_row===row).map(x=>x.module_m);
export const materialLabel=m=>`${m.grade} ${m.variant} ${m.condition}; заготовка >${m.bar_diameter_min_exclusive_m*1000}…<${m.bar_diameter_max_exclusive_m*1000} мм`;
export const bearingLabel=b=>`SKF ${b.designation}, відкритий; d = ${b.d_m*1000} мм`;
export function bearingPatch(choice){const b=bearings.find(x=>x.choice===choice);return b?{journalDiameter:b.d_m,bearingCatalogue:choice,bearingC:b.C_N,bearingC0:b.C0_N,bearingExponent:3,bearingBore:b.d_m,bearingLimit:b.limit_Hz}:{bearingCatalogue:0};}
export function bearingSelectionAdvice(model){
 const p=model.inputs,r=model.result.numbers,rows=model.bearingAssessment(),fitting=rows.filter(x=>x.geometry),passing=fitting.filter(x=>!x.failures.length);
 if(passing.length)return `Доступно ${passing.length} сумісних варіантів із ${bearings.length} у спільному каталозі (отвори 5…300 мм).`;
 const interval=`Потрібний отвір від ${formatNumber((p.couplingSeatDiameter+p.bearingAssemblyClearance)*1000)} до ${formatNumber(p.shaftDiameter*1000)} мм.`;
 if(!fitting.length)return interval+' Немає варіанта за монтажним проходом, шириною та граничною частотою. Перевірте діаметри підводу й вала, проліт і частоту.';
 const labels={journalStrength:'міцність шийки',lifeA:'ресурс A',lifeB:'ресурс B',staticA:'статичний запас A',staticB:'статичний запас B'},counts=Object.entries(labels).filter(([id])=>fitting.some(x=>x.failures.includes(id))).map(([id,label])=>`${label}: ${fitting.filter(x=>x.failures.includes(id)).length}/${fitting.length}`);
 const minimum=p.journalDiameter*Math.cbrt(r.journalStress/r.shaftLimit);
 return interval+' Не виконано: '+counts.join('; ')+'.'+(fitting.every(x=>x.failures.includes('journalStrength'))?` За поточним навантаженням розрахунковий мінімум шийки ${formatNumber(minimum*1000)} мм; потрібні більші вал і відповідний отвір підшипника. Збільшення C саме по собі міцність шийки не змінює.`:'');
}
// A enters from the free left end. B must pass the coupling seat at the
// right end; the middle wheel seat is an abutment, not its assembly route.
export function bearingMountingWarning(p){
 const bore=p.bearingBore||p.journalDiameter;
 if(Math.abs(bore-p.journalDiameter)>1e-9)return `Отвір підшипника ${formatNumber(bore*1000)} мм не відповідає шийці ${formatNumber(p.journalDiameter*1000)} мм. Узгодьте підшипник і шийку.`;
 return bore+1e-9<p.couplingSeatDiameter+p.bearingAssemblyClearance?`Монтаж опори B неможливий із прийнятим перепадом: отвір ${formatNumber(bore*1000)} мм, підвідна посадка муфти ${formatNumber(p.couplingSeatDiameter*1000)} мм; потрібна різниця діаметрів не менше ${formatNumber(p.bearingAssemblyClearance*1000)} мм. Уточніть підшипник або підвідну ділянку з перевіркою міцності.`:'';
}
export function materialPatch(choice){const m=materials.find(x=>x.choice===choice);return m?{shaftMaterial:choice,shaftYield:m.yield_min_Pa}:{shaftMaterial:0};}
export function materialApplies(inputs){const m=materials.find(x=>x.choice===inputs.shaftMaterial);return !m||(inputs.shaftStockDiameter>m.bar_diameter_min_exclusive_m&&inputs.shaftStockDiameter<m.bar_diameter_max_exclusive_m);}
export function fieldWarning(key,value){
 if(/^module[12]$/.test(key)&&!catalogue.modules.some(x=>Math.abs(x.module_m-value)<1e-10))return 'Власний модуль поза довідковими рядами. Перевірте доступність інструмента та обґрунтуйте вибір.';
 if(/^z[12]_[12]$/.test(key)&&value<18)return 'Для цієї моделі α = 20°, x = 0 прийнято z ≥ 18. Менше число потребує перевірки підрізання й зміщення профілю.';
 return '';
}

export const inductionMotors=catalogue.inductionMotors;
export const motorPowers=[...new Set(inductionMotors.map(m=>m.power_W))].sort((a,b)=>a-b);
export const motorSpeeds=power=>inductionMotors.filter(m=>Math.abs(m.power_W-power)<1e-6).sort((a,b)=>a.rated_Hz-b.rated_Hz||a.id.localeCompare(b.id));
