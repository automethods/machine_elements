import {symbolTex} from './narrative.js';
import {stageType} from './gearbox.js';
import {STAGE_TYPES} from './gearbox.js';
import {formatNumber as fmt} from './precision.js';

export const escapeTechnical=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const inlineMath=tex=>'\\('+escapeTechnical(tex)+'\\)';
// Explicit TeX in authored prose is preserved; exposed engine identifiers
// receive the same notation as inputs, equations and native trace results.
export function technicalText(value,inputs){
 return String(value).split(/(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g).map(part=>part.startsWith('\\(')||part.startsWith('\\[')?escapeTechnical(part):escapeTechnical(part).replace(/\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b|\beps\b/g,token=>inlineMath(symbolTex({symbol:token},inputs)))).join('');
}
export function numberedEquation(tex,number){return `<div class="equation-numbered" data-equation="${escapeTechnical(number)}"><div>\\[${escapeTechnical(tex)}\\]</div><span class="equation-number">(${escapeTechnical(number)})</span></div>`;}
export const calculationNumber=(group,chapter,index)=>chapter+'.'+(index+1+(group==='power'?4:0));
export function tableCaptionNumberer(){const counts=new Map();return caption=>caption.replace(/^Таблиця ([^.]+)\.\d+/,(_,chapter)=>{const next=(counts.get(chapter)||0)+1;counts.set(chapter,next);return 'Таблиця '+chapter+'.'+next;});}
export function ratioBalanceRelations(inputs){
 if(inputs.stages!==2||stageType(inputs,1)!==0||stageType(inputs,2)!==0)return '';
 return `<p>Для двох циліндричних ступенів за близьких модулів, чисел зубців шестірень і кутів нахилу початковий розподіл:</p>${numberedEquation('u_1\\approx u_2\\approx\\sqrt{u}','2.1')}<p>Для різної геометрії близькі діаметри коліс дає орієнтир:</p>${numberedEquation('u_1\\approx\\sqrt{u\\,\\frac{m_{\\mathrm n,2}z_{2\\text{-}2}/\\cos\\beta_2}{m_{\\mathrm n,1}z_1/\\cos\\beta_1}}','2.2')}`;
}
export function taskRelations(inputs){
 const out=(inputs.stages||2)+1;
 return `<div class="note" data-task-relations><p>Потрібні момент ${inlineMath("T'_{"+out+'}')} і частота ${inlineMath("n'_{"+out+'}')} робочого вала задають потрібну потужність:</p>${numberedEquation("P'_{"+out+"}=2\\pi T'_{"+out+"}n'_{"+out+'}','1.1')}<p>Для задання коловою силою ${inlineMath('F')} та лінійною швидкістю ${inlineMath('v')} використовують робочий діаметр ${inlineMath('D')} приводного елемента:</p>${numberedEquation("P'_{"+out+'}=Fv','1.2')}${numberedEquation("n'_{"+out+'}=\\frac{v}{\\pi D}','1.3')}<p>Частота у формулах — у с⁻¹; у полях — у хв⁻¹. Допустиме відносне відхилення частоти позначено ${inlineMath('\\varepsilon')}; фактичне відхилення — ${inlineMath('\\delta_n')}. За введених 5 % допустимий діапазон становить від −5 % до +5 %. Розміри, ККД й запаси міцності приймають для завдання. Матеріал заготовки та підшипники SKF можна обрати зі спільних довідників. Для готового допустимого напруження запас повторно не вводять. Потужність двигуна — механічна потужність на його валу. На екрані числа округлено до п’яти значущих цифр; розрахунок і збереження мають повну точність.</p></div>`;
}
export function notationGuide(inputs){
 const stages=inputs.stages||2,rows=Array.from({length:stages+1},(_,i)=>{
  const shaft=i+1,gears=[];for(let j=1;j<=stages;j++)for(const member of [1,2])if((member===1?j:j+1)===shaft){const type=stageType(inputs,j);gears.push(type===3&&member===2?'водило (без зубців)':inlineMath(symbolTex({symbol:type===2&&member===1?'starts_'+j:`z${member}_${j}`},inputs)));}
  return `<tr><td>${shaft} · ${i===0?'вхідний':i===stages?'вихідний':'проміжний'}</td><td>${gears.join('; ')}</td><td>${inlineMath('P_{'+shaft+'}')}</td><td>${inlineMath('n_{'+shaft+'}')}</td><td>${inlineMath('T_{'+shaft+'}')}</td></tr>`;
 });
 return `<div class="note" data-notation-guide><h3>Позначення валів, коліс і передатних чисел</h3><p>Вали нумеруються від входу редуктора. На проміжному валу другий індекс розрізняє колесо першого ступеня та шестірню другого. Для планетарної передачі s — сонце, p — сателіт, r — нерухомий вінець; w позначає число заходів черв’яка. Штрих означає бажане значення, наприклад ${inlineMath("u'_1")}; без штриха — прийняте ${inlineMath('u_1')}. Ітерації вказано окремими номерами.</p><div class="table-wrap"><table><caption>Таблиця 1.2 — Вали та позначення їхніх величин</caption><thead><tr><th>Вал</th><th>Зубчасті елементи</th><th>Потужність</th><th>Частота</th><th>Момент</th></tr></thead><tbody>${rows.join('')}</tbody></table></div><p>${inlineMath('u')} — передатне число редуктора, ${inlineMath('u_{\\mathrm e}')} — паса або ланцюга, ${inlineMath('u_{\\Sigma}')} — усього привода; m — двигун:</p>${numberedEquation('u='+Array.from({length:stages},(_,i)=>'u_{'+(i+1)+'}').join('\\,')+'=\\frac{n_1}{n_{'+(stages+1)+'}}','1.4')}${numberedEquation('u_{\\Sigma}=u_{\\mathrm e}u=\\frac{n_{\\mathrm m}}{n_{'+(stages+1)+'}}','1.5')}</div>`;
}
export function ratioComparisonTables(model,q,kind){
 const p={...model.inputs,...q.patch},recommended=kind==='recommended',name=recommended?'Рекомендований':'Ручний',first=recommended?3:5,out=p.stages+1,m=inlineMath;
 const teeth=j=>{const type=stageType(p,j),z=(token,value)=>m(symbolTex({symbol:token},p)+'='+fmt(value));return type===3?[z('z1_'+j,p['z1_'+j]),z('zp_'+j,p['planetTeeth'+j]),z('ringZ_'+j,p['z1_'+j]+2*p['planetTeeth'+j])].join('; '):[z(type===2?'starts_'+j:'z1_'+j,type===2?p['wormStarts'+j]:p['z1_'+j]),z('z2_'+j,p['z2_'+j])].join('; ');};
 const header=['Ступінь / зубці',m('u_j'),m('m_j')+', мм',m('b_j')+', мм','Габаритне коло, мм','Міжосьова / конусна відстань, мм',m('P_{j+1}')+', кВт',m('n_{j+1}')+', хв⁻¹',m('T_{j+1}')+', Н·м'];
 const geometry=`<div class="table-wrap"><table data-ratio-stage-table="${kind}"><caption>Таблиця 2.${first} — ${name} розподіл: геометрія та вихідні величини ступенів</caption><thead><tr>${header.map(h=>'<th>'+h+'</th>').join('')}</tr></thead><tbody>${q.envelope.map((e,i)=>`<tr><td>${i+1} · ${escapeTechnical(STAGE_TYPES[stageType(p,i+1)])}<br>${teeth(i+1)}</td>${[q.actual.stageRatios[i],p['module'+(i+1)]*1000,p['width'+(i+1)]*1000,e.envelopeDiameterM*1000,e.centreM*1000,q.stagePowerW[i]/1000,q.stageHz[i]*60,q.stageTorqueNm[i]].map(v=>'<td>'+fmt(v)+'</td>').join('')}</tr>`).join('')}</tbody></table></div>`;
 const status=ok=>`<span class="check-status ${ok?'ok':'fail'}">${ok?'Виконано':'Потрібне уточнення'}</span>`,u=q.actual.stageRatios.reduce((a,b)=>a*b,1),r=model.result.numbers,rows=[
  ['Передатне число зовнішньої передачі',m('u_{\\mathrm e}'),fmt(q.actual.externalRatio),'—','—'],
  ['Передатне число редуктора',m('u'),fmt(u),'—','—'],
  ['Передатне число всього привода',m('u_{\\Sigma}'),fmt(q.actual.totalRatio),m("u'_{\\Sigma}="+fmt(p.motorSpeed/r.n_req)),'—'],
  ['Вихідна частота, хв⁻¹',m('n_{'+out+'}'),fmt(q.outputHz*60),m("n'_{"+out+'}='+fmt(r.n_req*60)),status(Math.abs(q.actual.speedErrorFraction)<=p.speedTolerance)],
  ['Відносне відхилення частоти, %',m('\\delta_n'),fmt(q.actual.speedErrorFraction*100),m('\\pm\\varepsilon=\\pm'+fmt(p.speedTolerance*100)+'\\%'),status(Math.abs(q.actual.speedErrorFraction)<=p.speedTolerance)],
  ['Потрібна потужність двигуна, кВт',m("P'_{\\mathrm m}"),fmt(q.requiredPowerW/1000),m('P_{\\mathrm m}='+fmt(p.motorPower/1000)),status(q.requiredPowerW<=p.motorPower)],
  ['Вихідний момент, Н·м',m('T_{'+out+'}'),fmt(q.outputTorqueNm),p.taskKind===0?m("T'_{"+out+'}='+fmt(p.requiredTorque)):'—',p.taskKind===0?status(q.outputTorqueNm>=p.requiredTorque):'—'],
  ['Підсумок наведених перевірок','—',q.failures.length?escapeTechnical(q.failures.join('; ')):'Усі наведені умови виконано','Див. також розділ 5',status(!q.failures.length)]
 ];
 return geometry+`<div class="table-wrap"><table data-ratio-result-table="${kind}"><caption>Таблиця 2.${first+1} — ${name} розподіл: частота, потужність, момент і перевірки</caption><thead><tr><th>Показник</th><th>Позначення</th><th>Отримано</th><th>Задано / межа</th><th>Висновок</th></tr></thead><tbody>${rows.map(row=>'<tr>'+row.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')}</tbody></table></div>`;
}
