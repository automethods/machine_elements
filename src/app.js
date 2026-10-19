import {i18n,localize,fitDrawingText} from './i18n.js';
import {access} from './access.js';
import {constructionReport,assemblyInstructions,constructionSnapshot,ratioProposal,ratioSpans} from './construction.js';
import {shaftDesignGuide} from './shaft-design-guide.js';
import {formatNumber,inputNumber} from './precision.js';
import {gearboxLabel,gearboxPreset,stageType,STAGE_TYPES} from './gearbox.js';
import {VERSION,TITLE,INPUTS,CALCULATIONS,CHAPTERS,SOURCES,MODES,active} from './definitions.js';
import {MechanicsModel,checks,exportProject,importProject} from './model.js';
import {drawChart,exportChart,powerPlots,line,gearScheme,shaftDiagrams} from './plots.js';
import {driveScheme,drawingHTML} from './transmission-drawing.js';
import {parseCSV} from './csv.js';
import {symbolTex,describeBinding,symbolicEquation,resultChain,calculationExplanation,unitLabel} from './narrative.js';
import {inlineMath as math,technicalText,numberedEquation,calculationNumber,taskRelations,notationGuide,ratioComparisonTables,tableCaptionNumberer,ratioBalanceRelations} from './technical-presentation.js';
import {gearAssembly} from './gear-geometry.js';
import {proposeDesign,proposeAutomaticReduction,proposeBearingMounting,ratioRecommendation,evaluateRatioProposal} from './design-iterations.js';
import {checkComparison} from './check-comparisons.js';
import {drawingConstructionWarnings} from './manufacturing.js';
import {bearings,materials,bearingPatch,materialPatch,moduleRows,fieldWarning,timingBelts,chains,timingPatch,chainPatch,motorPowers,motorSpeeds,bearingMountingWarning,beltProfiles,bearingSelectionAdvice} from './catalogues.js';

const $=selector=>document.querySelector(selector);
const projectTools=$('#projectTools');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=formatNumber;
const STORAGE='automethods-mechanics-v1';
let startupSizing=Promise.resolve();
let shaftSizingJob=null;
let projectOrigin='example';
let automaticSizing=null;
let model,metadata={student:'',group:'',name:'Навчальний привод',rationale:''},baseline=null,motors=[],renderRevision=0,renderQueue=Promise.resolve(),toastTimer,gearMotion=false,gearViewer=null,gearViewerEnabled=true,gear3DPlaying=true,gearLoadRevision=0,projectionView=null,projectionReady=Promise.resolve(),designPlan=null,bearingPlan=null,iterationHistory=[],kinematicHistory=[];
const inclinedAxes=()=>gearAssembly(model).some(p=>p.type===1||p.type===2);
const gearFigureCaption=()=>'Рисунок 4.1 — Збірка в центрі та її ортогональні проєкції з обох боків у спільному масштабі. Опори й кріплення показані прозорим штриховим контуром; геометрія відповідає поточній 3D-моделі.';
function updateGearCaption(){const caption=$('[data-gear-caption]');if(caption)caption.textContent='Рисунок 4.2 — '+gearboxLabel(model.inputs)+' редуктор за прийнятими параметрами. Обертайте вид мишею; колесо миші змінює масштаб.';}
async function mountGearViewer(){
 const generation=++gearLoadRevision;gearViewer?.dispose();gearViewer=null;
 const previous=$('#gearViewer');if(!previous)return;const host=document.createElement('div');host.id='gearViewer';host.className='gear-viewer';previous.replaceWith(host);
 const motion=$('[data-3d-motion]'),fit=$('[data-3d-fit]');motion.disabled=true;fit.disabled=true;motion.setAttribute('aria-pressed','false');motion.textContent='Увімкнути обертання 3D';
 const {createGearViewer}=await import('./gear-viewer.js');
 try{const viewer=await createGearViewer(host,model);if(generation!==gearLoadRevision||!host.isConnected){viewer?.dispose();return;}gearViewer=viewer;motion.disabled=!viewer;fit.disabled=!viewer;if(viewer){viewer.play(gear3DPlaying);motion.setAttribute('aria-pressed',String(gear3DPlaying));motion.textContent=gear3DPlaying?'Зупинити обертання 3D':'Увімкнути обертання 3D';}}
 catch(error){if(generation!==gearLoadRevision||!host.isConnected)return;host.textContent=error.message;const retry=document.createElement('button');retry.type='button';retry.setAttribute('data-load-3d','');retry.textContent='Повторити побудову 3D';host.append(retry);notify(error.message);}
}
const display=(definition,value)=>definition.choiceLabels?definition.choiceLabels[definition.choices.indexOf(value)]:`${fmt(value*definition.factor)}${definition.displayUnit?' '+definition.displayUnit:''}`;
function numberTables(root){const next=tableCaptionNumberer();root.querySelectorAll('table>caption').forEach(c=>{c.textContent=next(c.textContent);});}
function notify(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,6500);}
function saveLocal(){if(!access.canEdit)return;try{localStorage.setItem(STORAGE,JSON.stringify(exportProject(model,metadata,baseline,iterationHistory,kinematicHistory)));$('#saveStatus').textContent='Варіант збережено локально у браузері';}catch{$('#saveStatus').textContent='Локальне збереження недоступне — збережіть JSON';}}
function correctBearingMounting(target){const correction=proposeBearingMounting(target);if(correction.row)target.set(correction.patch);return correction;}
function adoptShaftSizing({automatic=false}={}){
 if(!bearingPlan?.complete||bearingPlan.baseRevision!==model.session.revision)throw new Error('Дані змінилися. Повторіть добір вала й опор.');
 const q=bearingPlan;if(automatic&&!baseline)baseline={inputs:{...model.inputs},mode:model.mode};model.set(q.patch);bearingPlan=null;designPlan=null;automaticSizing=automatic?{revision:model.session.revision,reason:q.reason}:null;saveLocal();render();return q;
}
function projectNotice(){
 const p=model.inputs,r=model.result.numbers,needsSizing=bearingMountingWarning(p)||r.journalStress>r.shaftLimit||r.L_A<p.bearingHours||r.L_B<p.bearingHours||Math.min(r.s0_A,r.s0_B)<p.bearingSafety;
 const q=bearingPlan,ready=q?.complete&&q.baseRevision===model.session.revision;
 return `${automaticSizing?.revision===model.session.revision?'<div class="note" data-automatic-sizing>Автоматично узгоджено розміри вихідного вала, маточини, муфти та опор. Навантаження й матеріал збережено; інші перевірки наведені у звіті.</div>':''}${projectOrigin==='restored'?'<div class="note" data-project-origin><p>Відновлено збережений варіант. Перезавантаження зберігає його параметри.</p><button type="button" data-start-example>Відкрити перевірений приклад</button><small>Поточний варіант спочатку буде збережено у резервний JSON.</small></div>':''}${needsSizing||q?`<div class="note" data-shaft-sizing-notice>${ready?`<p>Для поточного навантаження підготовлено розміри: вал ⌀${fmt((q.patch.shaftDiameter??p.shaftDiameter)*1000)} мм, шийки ⌀${fmt(q.row.d_m*1000)} мм, SKF ${esc(q.row.designation)}. Навантаження й матеріал збережено.</p><p>${q.remaining.length?'Інші перевірки потребують уточнення; перелік і таблиця змін — у розділі 7.':'Усі реалізовані перевірки пропозиції виконано.'}</p><button type="button" data-adopt-shaft-summary>Прийняти розміри вала й опор</button> <button type="button" data-review-shaft-sizing>Переглянути зміни</button>`:`<p>Вихідний вал і опори потребують добору для поточного навантаження.</p><button type="button" data-open-shaft-sizing>Підібрати вал і опори</button>${q?`<p>${esc(q.reason)}</p>`:''}`}</div>`:''}`;
}
async function prepareShaftSizing({focus=true,adopt=false}={}){
 await renderQueue;await projectionReady;
 shaftSizingJob?.cancel();const target=model,revision=model.session.revision;
 document.querySelectorAll('[data-shaft-size],[data-open-shaft-sizing]').forEach(button=>{button.disabled=true;button.textContent='Перевіряємо розміри та перерізи…';});
 const worker=new Worker(new URL('./shaft-sizing-worker.js',import.meta.url),{type:'module'});let finish;
 const result=new Promise(resolve=>{finish=resolve;worker.onmessage=({data})=>resolve(data);worker.onerror=event=>{event.preventDefault();resolve({error:event.message||'Не вдалося завантажити добір. Повторіть спробу.'});};});
 const job={target,revision,cancel(){worker.terminate();finish(null);}};shaftSizingJob=job;document.body.dataset.shaftSizing='running';
 worker.postMessage({inputs:{...target.inputs},mode:target.mode,revision});
 const reply=await result;worker.terminate();if(shaftSizingJob===job){shaftSizingJob=null;document.body.dataset.shaftSizing='idle';}
 if(!reply||model!==target||model.session.revision!==revision)return;
 bearingPlan=reply.proposal||{baseRevision:revision,complete:false,reason:reply.error};const proposal=bearingPlan;if(adopt&&proposal.complete)adoptShaftSizing({automatic:true});else render();if(focus)await focusShaftSizing();return proposal;
}
function sourceLink(id){const source=SOURCES.find(x=>x.id===id);return source?`<a href="#source-${id}" data-source-citation title="${esc(source.title)}">[${SOURCES.indexOf(source)+1}]</a>`:'';}
function field(def,index){
 const value=model.inputs[def.key],id='field-'+def.key;
 const fitting=def.key==='bearingCatalogue'?new Set(model.bearingOptions().map(b=>b.choice)):null;
 const options=fitting?def.choices.filter(v=>v===0||v===value||fitting.has(v)):def.choices;
 const describedBy=`help-${def.key} warning-${def.key}`;
 const control=def.choices?`<select id="${id}" data-input="${def.key}" aria-describedby="${describedBy}">${options.map(v=>`<option value="${v}" ${v===value?'selected':''}>${esc(def.choiceLabels?.[def.choices.indexOf(v)]||v)}</option>`).join('')}</select>`:`<input id="${id}" data-input="${def.key}" type="number" value="${inputNumber(value*def.factor)}" min="${def.min*def.factor}" max="${def.max*def.factor}" step="${def.integer?'1':'any'}" aria-describedby="${describedBy}">`;
 const presets=/^module[12]$/.test(def.key)?[1,2].map(row=>`<div class="standard-row"><span>${row}-й ряд, мм:</span>${moduleRows(row).map(v=>`<button type="button" data-standard-key="${def.key}" data-standard-value="${v}" aria-pressed="${Math.abs(v-value)<1e-10}">${fmt(v*1000)}</button>`).join('')}</div>`).join('')+'<small>Ряди з табл. З.2, с. 183 посібника Дерези (2019); історичне нормативне посилання. Власний модуль вводиться у поле вище.</small>':'';
 const motorOptions=def.key==='motorPower'?`<label class="preset-label" for="preset-motorPower">Номінальна потужність, кВт</label><select id="preset-motorPower" data-motor-preset="power"><option value="">Власне значення</option>${motorPowers.map(w=>`<option value="${w}" ${Math.abs(value-w)<1e-6?'selected':''}>${fmt(w/1000)}</option>`).join('')}</select><small class="motor-preset-note">Каталожний ряд ABB; власне значення можна ввести вище. ${sourceLink('abb-motors')}</small>`:def.key==='motorSpeed'?`<label class="preset-label" for="preset-motorSpeed">Каталожні оберти для ${fmt(model.inputs.motorPower/1000)} кВт</label><select id="preset-motorSpeed" data-motor-preset="speed"><option value="">Власне значення</option>${motorSpeeds(model.inputs.motorPower).map((m,i,rows)=>`<option value="${m.id}" ${Math.abs(value-m.rated_Hz)<1e-9&&rows.findIndex(r=>Math.abs(value-r.rated_Hz)<1e-9)===i?'selected':''}>${fmt(m.rated_Hz*60)} хв⁻¹ · ${m.poles} пол. · ${m.model} · ${m.voltage_V} В (${m.source_edition})</option>`).join('')}</select><small class="motor-preset-note">ABB, мережа 50 Гц; оберти за паспортом. ${sourceLink('abb-motors')}</small>`:'';
 const b=def.key==='bearingCatalogue'?bearings.find(x=>x.choice===value):null,m=def.key==='shaftMaterial'?materials.find(x=>x.choice===value):null;
 const source=b?`<small>SKF 17000/1 EN, с. ${b.printed_page} (PDF ${b.pdf_page}). C = ${fmt(b.C_N/1000)} кН; C₀ = ${fmt(b.C0_N/1000)} кН; D = ${b.D_m*1000} мм; B = ${b.B_m*1000} мм. ${sourceLink('skf')}</small>`:m?`<small>Ovako ${m.variant} ${m.condition}, редакція ${m.source_revision}. Rₑ ≥ ${m.yield_min_Pa/1e6} МПа; Rm ${m.tensile_min_Pa/1e6}…${m.tensile_max_Pa/1e6} МПа (${m.tensile_basis==='typical'?'типове':'діапазон'}); HB ${m.hardness_min_HB}…${m.hardness_max_HB} (${m.hardness_basis==='typical'?'типове':'діапазон'}). Для статичного розрахунку приймаємо мінімальну границю плинності. ${sourceLink('ovako')}</small>`:'';
 const vBelt=def.key==='beltProfile'?beltProfiles.find(b=>b.choice===value):null;
 const profileSource=vBelt?`<small>Optibelt ${esc(vBelt.product)}, ${esc(vBelt.standard)}; b × h = ${fmt(vBelt.width_m*1000)} × ${fmt(vBelt.height_m*1000)} мм; мінімальний d_d = ${fmt(vBelt.min_pulley_m*1000)} мм. Позначення довжини: ${vBelt.length_basis==='Li'?'внутрішня Li':'розрахункова Ld'}. Розрахована у розділі 3 довжина — Ld; стандартний виріб добирають із правильним перерахунком. ${sourceLink('belt-profiles')}</small>`:'';
 const bearingAdvice=def.key==='bearingCatalogue'?`<small data-bearing-selection>${esc(bearingSelectionAdvice(model))}</small>`:'';
 const belt=def.key==='timingCatalogue'?timingBelts.find(b=>b.choice===value):null,chain=def.key==='chainCatalogue'?chains.find(c=>c.choice===value):null;
 const flexibleSource=belt?`<small>Gates 19993 (2021), с. ${belt.source_printed_page}: ${esc(belt.profile)}, p = ${fmt(belt.pitch_m*1000)} мм, L = ${fmt(belt.length_m*1000)} мм, b = ${fmt(belt.width_m*1000)} мм. ${sourceLink('gates-catalogue')} Шків має відповідати профілю ${esc(belt.profile)}. Допустиме зусилля вводиться за рейтингом виробника.</small>`:chain?`<small>Renold Premier ${esc(chain.designation)}, ISO 606: ширина між пластинами ≥ ${fmt(chain.inner_width_min_m*1000)} мм; діаметр ролика ≤ ${fmt(chain.roller_diameter_max_m*1000)} мм; мінімальне розривне зусилля ${fmt(chain.tensile_min_N/1000)} кН. ${sourceLink('renold-catalogue')} Це не допустиме робоче зусилля.</small>`:'';
 const mountingWarning=['bearingCatalogue','journalDiameter','couplingSeatDiameter','bearingAssemblyClearance'].includes(def.key)?bearingMountingWarning(model.inputs):'',recommended=def.key==='bearingCatalogue'&&mountingWarning?model.bearingOptions().sort((a,b)=>a.d_m-b.d_m||a.C_N-b.C_N)[0]:null;
 const bearingAdoption=recommended?`<button type="button" data-bearing-adopt="${recommended.choice}">Прийняти SKF ${esc(recommended.designation)} · отвір ${fmt(recommended.d_m*1000)} мм</button>`:'';
 const customWarning=(['beltProfile','timingCatalogue','chainCatalogue'].includes(def.key))&&value===0?'Власні параметри: перевірте сумісність профілю / кроку та підтвердьте робочу здатність виробу.':'';
 return `<div class="field${def.wide?' wide-field':''}${['motorPower','motorSpeed'].includes(def.key)?' motor-field':def.key==='ratioManual'?' ratio-mode-field':''}"><label for="${id}" data-symbol="${esc(symbolTex(def,model.inputs))}"><span class="input-number">I-${String(index+1).padStart(2,'0')}</span>${esc(def.label)} ${def.selector||def.key==='taskKind'?'':`\\(${esc(symbolTex(def,model.inputs))}\\)`}</label><div class="input-wrap">${control}<span>${esc(def.displayUnit)}</span></div><small id="help-${def.key}">${technicalText(def.hint||(def.source.includes('catalogue')?'Умовне початкове число; замініть даними обраного виробу.':'Прийняте значення; обґрунтуйте у звіті.'),model.inputs)}</small>${source}${profileSource}${bearingAdvice}${flexibleSource}${presets}${motorOptions}${bearingAdoption}<small class="field-warning" id="warning-${def.key}" role="status">${esc(mountingWarning||customWarning||fieldWarning(def.key,value))}</small></div>`;
}
const undefinedAfterSeparation=new Set(['F_bolt','sigma_bolt','sigma_bolt_eq']);
function calculation(def,index,{report=false,defined=new Set()}={}){
 const trace=model.result.traces.find(x=>x.targetValueId==='value.'+def.id);
 const invalid=undefinedAfterSeparation.has(def.id)&&model.result.numbers.F_clamp<=0;
 const eq=calculationNumber(def.group,CHAPTERS.find(x=>x.id===def.group).n,index);
 const symbols=[{id:'value.'+def.id,symbol:symbolTex(def,model.inputs),label:def.label,unit:unitLabel(def.unit)},...trace.inputBindings.map(b=>describeBinding(b,model.inputs))].filter(item=>{if(defined.has(item.id))return false;defined.add(item.id);return true;});
 const glossary=symbols.length?`<dl class="symbol-definitions">${symbols.map(item=>`<div><dt>\\(${esc(item.symbol)}\\)</dt><dd>${esc(item.label)}, ${esc(item.unit)}.</dd></div>`).join('')}</dl>`:'';
 const result=invalid?'Модель потребує уточнення':`\\[${esc(resultChain(def,trace,model.inputs))}\\]`;
 return `<article class="calculation" data-calc="${def.id}" aria-label="${esc(def.label)}"><p class="calculation-purpose">${technicalText(calculationExplanation(def,model.inputs.taskKind,model.inputs),model.inputs)} ${sourceLink(def.source)}</p>${glossary}<div class="equation-numbered"><div>\\[${esc(symbolicEquation(def,trace,model.inputs))}\\]</div><span class="equation-number">(${eq})</span></div><div class="calculation-substitution" ${report?'':`data-result="${def.id}"`}>${result}<span class="equation-number">(${eq}a)</span></div>${invalid?'<p class="note warning">Стик розкрито. Значення за лінійною моделлю χ не підтверджує працездатності з’єднання.</p>':''}</article>`;
}
function checksTable(items,caption,example=model,{ids=true}={}){
 if(!items.length)return '';
 return `<div class="table-wrap checks"><table><caption>${esc(caption)}</caption><thead><tr><th>Перевірка</th><th>Порівняння з граничним значенням</th><th>Запас / допуск</th><th>Висновок</th></tr></thead><tbody>${items.map(item=>{const comparison=checkComparison(example,item);return `<tr ${ids?`data-check="${item.id}"`:''}><td>${esc(item.title)}${item.note?`<small class="source-note">${esc(item.note)}</small>`:''}</td><td>${technicalText(comparison.comparison,example.inputs)}</td><td>${technicalText(comparison.reserve,example.inputs)}</td><td><span class="check-status ${item.ok?'ok':'fail'}">${item.applicable===false?'Поза моделлю':item.ok?'+ Виконано':'− Потрібне уточнення'}</span></td></tr>`;}).join('')}</tbody></table></div>`;
}
function plot(id,caption){return `<figure class="figure"><div class="plot" id="${id}"></div><figcaption>${esc(caption)}</figcaption></figure>`;}
function sourceList(){return `<ol class="source-list">${SOURCES.map(s=>`<li id="source-${s.id}"><span translate="no">${esc(s.title)}</span><small>${esc(s.locator)}</small>${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener">URL: ${esc(s.url)}</a><small>Дата звернення: 16.10.2026.</small>`:''}</li>`).join('')}</ol>`;}
function motorTable(){return `<details class="motor-reference"><summary>Довідкові електромашини зі спільної бази CSV</summary><p class="note">Це тягові електромашини, а не каталог промислових асинхронних двигунів. Тривалу потужність, момент, граничну частоту й умови охолодження наведено окремо. Максимальна частота не є номінальною; ці дані автоматично не замінюють параметри привода.</p><div class="table-wrap"><table><caption>Таблиця Д.1 — Каталожні параметри електромашин</caption><thead><tr><th>Мотор</th><th>Тривала потужність, кВт</th><th>Тривалий момент, Н·м</th><th>Гранична частота, хв⁻¹</th><th>Умови та джерело</th></tr></thead><tbody>${motors.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.continuousKW)}</td><td>${esc(x.continuousNm)}</td><td>${esc(x.maxRpm)}</td><td>${esc(x.ratingConditions)}<small class="source-note">Каталог виробника, с. ${esc(x.sourcePage)} · ${esc(x.voltageRequired)} В</small></td></tr>`).join('')}</tbody></table></div><p class="source-note">Каталоги виробників; умови рейтингу наведено для кожного виробу. Використовується для аналізу можливості застосування; номінальні дані стаціонарного двигуна вводяться окремо.</p></details>`;}

const NOTES={

 flex:'Довжина і міжосьова відстань обчислюються геометрично. Для паса потрібні перевірені профіль, номінальна потужність і поправки; для зубчастого паса — сумісні профіль і ширина; для ланцюга — робоча здатність, швидкість та мащення. Розривне зусилля ланцюга не замінює допустиме робоче.',
 strength:'Фактор K враховується один раз у кожній перевірці. Коефіцієнти Y та допустимі напруження не підібрано автоматично за матеріалом. Локальна оцінка Герца не є повним розрахунком контактної витривалості зубчастої передачі.',
 shaft:'Формули вище описують балку постійного діаметра. Нижче спільна конструкція перевіряє всі вали: ступінчасті перерізи, пази, навантаження в обох площинах і прогин. Утома та критична частота потребують окремого розрахунку.',
 bearings:'L₁₀ — базовий ресурс з надійністю 90%, а не гарантований строк служби. Не враховано модифіковану довговічність за мащенням, забрудненням і втомною межею. Перевірте посадку, зазори та допустиму частоту за каталогом.',
 key:'Робоча площа зминання прийнята як \\(\\frac{h}{2}l_{\\mathrm e}\\). Складні посадки, нерівномірність розподілу та утома шпонкового паза потребують окремої перевірки.',
 bolts:'Умова стиску стику перевіряється першою. Після розкриття стику розподіл навантаження за χ непридатний. Зріз наведено для гладкого стрижня в одній площині; момент \\(K_{\\mathrm t}F_0d\\) є наближенням, без розкиду тертя, інструмента і монтажного кручення.',
 basics:'Для пружини використано корекцію кривини \\(\\frac{c+0{,}5}{c-0{,}75}\\) з Chassis Handbook, формула 3.57. Контакт витків, поздовжня стійкість і циклічна довговічність не перевірені. Приведення до колеса застосовується лише за сталого відношення ходів i.',
 sources:'Результати мають навчальний характер. Остаточне конструювання потребує повного набору перевірок і підтверджених властивостей конкретних деталей.'
};
function manufacturingControls(){
 const choices=INPUTS.filter(f=>f.drawing&&!f.advanced),advanced=INPUTS.filter(f=>f.drawing&&f.advanced);
 const warnings=drawingConstructionWarnings(model);
 return `<div class="manufacturing-controls"><h3>Вимоги до виготовлення деталей A1</h3><p>Для навчальних креслень приймаємо ${choices.map(def=>`<label class="drawing-choice">${esc(def.label.toLowerCase())}: <select id="field-${def.key}" data-input="${def.key}" aria-describedby="help-${def.key} warning-${def.key}">${def.choices.map((value,i)=>`<option value="${value}" ${model.inputs[def.key]===value?'selected':''}>${esc(def.choiceLabels?.[i]||value)}</option>`).join('')}</select><small id="help-${def.key}">${esc(def.hint||'Прийнята вимога креслення.')}</small><small class="field-warning" id="warning-${def.key}" role="status"></small></label>`).join('; ')}.</p><p class="source-note">Розміри в міліметрах, Ra — у мкм. База A колеса — вісь отвору, B — опорний торець; для внутрішнього вінця A — зовнішня посадкова поверхня. Матеріал і термообробка є навчальним вибором для креслення; допустимі напруження розділу 5 задаються окремо. Для черв’ячного колеса прийнято бронзу CAC502 без гартування. Для коліс і маточин окремо визначають осьові упори, проставні втулки та кріплення; <a href="#bearings">правила конструювання наведено в розділі 7</a>. ${sourceLink('drawing-detail')} ${sourceLink('iso-fits')} ${sourceLink('iso-gdt')} ${sourceLink('iso-surface')}</p>${warnings.length?`<p class="note warning" data-drawing-conflicts>${warnings.map(esc).join('<br>')}</p>`:''}<details id="manufacturingOptions"><summary>Розміри маточин і технологічні уточнення</summary><div class="field-grid">${advanced.map(d=>field(d,INPUTS.indexOf(d))).join('')}</div></details></div>`;
}
function comparisonTable(){
 if(!baseline)return '<p class="note">Базовий варіант ще не зафіксовано.</p>';
 const b=new MechanicsModel(baseline.inputs,baseline.mode),rows=['P_min',model.inputs.taskKind===0?'n_out':'v_out','T_out','sigma_vm','deflection','L_A','sigma_key'];
 const conditions=baseline.inputs.taskKind===model.inputs.taskKind&&(model.inputs.taskKind===0?['requiredTorque','requiredSpeed']:['force','speed','drum']).every(key=>baseline.inputs[key]===model.inputs[key]);
 return `${!conditions?'<p class="note warning">Вимоги робочої машини змінилися. Умови порівняння відрізняються.</p>':''}<div class="table-wrap"><table><caption>Таблиця 11.1 — Базовий і поточний варіанти</caption><thead><tr><th>Показник</th><th>Базовий</th><th>Поточний</th><th>Різниця</th></tr></thead><tbody>${rows.map(id=>{const d=CALCULATIONS.find(x=>x.id===id);return `<tr><td>${esc(d.label)}</td><td class="number">${display(d,b.result.numbers[id])}</td><td class="number">${display(d,model.result.numbers[id])}</td><td class="number">${display(d,model.result.numbers[id]-b.result.numbers[id])}</td></tr>`;}).join('')}</tbody></table></div>`;
}

function iterationText(steps,{proposal=false}={}){
 if(!steps.length)return '<p>Історію уточнення конструкції ще не сформовано. За невиконаних умов можна підготувати послідовність уточнень і перевірити кожен крок перед прийняттям.</p>';
 const examples=steps.map(step=>new MechanicsModel(step.inputs,step.mode));
 const initialFailures=checks(examples[0]).filter(x=>!x.ok);
 const traceIds=new Set([steps[0].inputs.taskKind===0?'n_out':'v_out','delta_v']);
 for(const item of initialFailures){const ids={power:['P_min','powerReserve'],outputTorque:['T_out'],shaft:['sigma_vm'],deflection:['deflection'],twist:['twist'],keyCrush:['sigma_key'],keyShear:['tau_key'],coupling:['T_coup'],clamp:['F_clamp'],slip:['F_friction'],boltTension:['sigma_bolt'],boltCombined:['sigma_bolt_eq'],rod:['sigma_rod'],spring:['stress_sp']};for(const id of ids[item.id]||[])traceIds.add(id);}
 return `<div class="design-iterations"><h3>${proposal?'Пропозиція уточнення конструкції':'Прийняті ітерації розрахунку'}</h3>${proposal?'<p>Наведені кроки перевірено окремо від поточного варіанта. Прийняття оновить відповідні поля та весь розрахунок.</p>':''}${steps.map((step,index)=>{
  const example=examples[index],rows=checks(example),previous=steps[index-1];
  const changes=previous?INPUTS.filter(field=>step.inputs[field.key]!==previous.inputs[field.key]):[];
  const changed=changes.map(field=>`${esc(field.label)}: ${esc(display(field,previous.inputs[field.key]))} → ${esc(display(field,step.inputs[field.key]))}`).join('; ');
  const substitutions=[...traceIds].map(id=>{const def=CALCULATIONS.find(x=>x.id===id),trace=example.result.traces.find(x=>x.targetValueId==='value.'+id);const number=CALCULATIONS.filter(x=>x.group===def.group&&active(x,example.inputs,example.mode)).findIndex(x=>x.id===id)+1;return `<p>${esc(def.label)} за формулою (${calculationNumber(def.group,CHAPTERS.find(x=>x.id===def.group).n,number-1)}):</p><div class="calculation-substitution">\\[${esc(resultChain(def,trace,example.inputs))}\\]</div>`;}).join('');
  return `<section class="design-step"><h4>Ітерація ${index+1}</h4><p>${esc(step.reason)}</p>${changed?`<p>Прийнята зміна: ${changed}.</p>`:''}${substitutions}${checksTable(rows,`Таблиця 11.${index+2} — Перевірки ітерації ${index+1}`,example,{ids:false})}<p>${rows.every(x=>x.ok)?'Усі реалізовані навчальні перевірки виконано.':'Невиконані умови: '+rows.filter(x=>!x.ok).map(x=>esc(x.title)).join('; ')+'.'}</p></section>`;
 }).join('')}${proposal?`<p>${designPlan.complete?'Уточнений варіант задовольняє всі реалізовані навчальні перевірки.':'Потрібен подальший добір конструкції або виробу за каталогом. Задані допустимі напруження та каталожні можливості не змінюються для отримання формального проходження.'}</p>${steps.length>1?'<button type="button" data-apply-design>Прийняти уточнений варіант</button>':''}`:''}</div>`;
}

function kinematicText(){
 if(!kinematicHistory.length)return '';
 return `<div class="kinematic-iterations" data-frequency-iterations><h3>Повторний кінематичний розрахунок</h3><p>Збережено початкову перевірку й прийняте уточнення. Задану частоту, допуск, навантаження та параметри двигуна не змінено.</p>${kinematicHistory.map((step,index)=>{
  const example=new MechanicsModel(step.inputs,step.mode),ids=['z2_req','u_req','n_0','u_1',...(step.inputs.stages===2?['u_2']:[]),'n_out','delta_v'];
  const substitutions=ids.map(id=>{const def=CALCULATIONS.find(d=>d.id===id),trace=example.result.traces.find(t=>t.targetValueId==='value.'+id);const number=CALCULATIONS.filter(c=>c.group==='power'&&active(c,example.inputs,example.mode)).findIndex(c=>c.id===id)+1;return `<p>${esc(def.label)} за формулою (${calculationNumber('power',2,number-1)}):</p><div class="calculation-substitution">\\[${esc(resultChain(def,trace,example.inputs))}\\]</div>`;}).join('');
  return `<section class="kinematic-step"><h4>Ітерація ${index+1}</h4><p>${esc(step.reason)}</p>${substitutions}${checksTable(checks(example).filter(c=>c.id==='speed'),`Таблиця 2.${index+7} — Перевірка частоти після ітерації ${index+1}`,example,{ids:false})}</section>`;
 }).join('')}</div>`;
}

function ratioControls({report=false}={}){
 let proposal;try{proposal=evaluateRatioProposal(model,ratioProposal(model));}catch(error){return '<p>'+esc(error.message)+'</p>';}
 const p=model.inputs,r=model.result.numbers,recommendation=ratioRecommendation(model),spans=ratioSpans(model),spanText=span=>span.map(fmt).join('…'),within=(u,[lo,hi])=>u>=lo-1e-9&&u<=hi+1e-9;
 const rangeText=`<p data-ratio-spans>Орієнтири поточної схеми: ${model.mode==='none'?'без зовнішньої передачі':math('u_{\\mathrm e}')+' = '+spanText(spans.external)}; ${spans.stages.map((s,i)=>math('u_{'+(i+1)+'}')+' = '+spanText(s)).join('; ')}. Для циліндричних ступенів типовий початок 3…6; 2…8 — розширений пошук. Для черв’ячних діапазон залежить від числа заходів. ${sourceLink('ratio-spans')} Конічні 2…5, планетарні 3…8, зубчастий пас 2…6 і черв’як з 4 заходами 8…20 — навчальні пошукові орієнтири.</p><p>Прийнято: ${math('u_{\\mathrm e}='+fmt(r.u_ext))}${within(r.u_ext,spans.external)?'':' (поза орієнтиром)'}; ${spans.stages.map((s,i)=>math('u_{'+(i+1)+'}='+fmt(r['u_'+(i+1)]))+(within(r['u_'+(i+1)],s)?'':' (поза орієнтиром)')).join('; ')}.</p>`;
 const planetaryText=spans.stages.flatMap((_,i)=>{const j=i+1;if(stageType(p,j)!==3)return [];const sun=p['z1_'+j],planet=p['planetTeeth'+j],ring=sun+2*planet,count=p['planetCount'+j];return [`<div data-planetary-split="${j}"><p><strong>Планетарний ступінь ${j}:</strong> вхід — сонце, вінець нерухомий, вихід — водило. Сонце має ${sun} зубців; сателіт — ${planet}; вінець — ${ring}; кількість сателітів — ${count}.</p>${numberedEquation('u_{'+j+'}=1+\\frac{z_{\\mathrm r,'+j+'}}{z_{\\mathrm s,'+j+'}}=1+\\frac{'+ring+'}{'+sun+'}='+fmt(1+ring/sun),'2.'+(j+2))}<p>Складання: ${math('z_{\\mathrm r,'+j+'}=z_{\\mathrm s,'+j+'}+2z_{\\mathrm p,'+j+'}')}; ${math('('+sun+'+'+ring+')/'+count+'='+fmt((sun+ring)/count))} — ціле. ${sourceLink('khk-planetary')} Добір змінює сателіт та узгоджений вінець, зберігаючи сонце й кількість сателітів. Міцність обода й розподіл навантаження перевіряють окремо.</p></div>`];}).join('');
 const recommendationText=recommendation?`<div data-ratio-recommendation><h3>Рекомендований розподіл за компактністю</h3>${ratioComparisonTables(model,recommendation,'recommended')}<button type="button" data-ratio-recommend>Прийняти рекомендований розподіл</button></div>`:'<p data-ratio-recommendation>У підтриманих межах не знайдено сумісного розподілу з потрібною частотою; змініть схему або початкові параметри.</p>';
 const balance=ratioBalanceRelations(p);
 const html=`<div class="note" data-ratio-allocation>${rangeText}${planetaryText}${recommendationText}${recommendation&&(recommendation.outsideRecommended.some(Boolean)||recommendation.externalOutsideRecommended)?'<p class="field-warning" data-ratio-span-warning>Окремі передатні числа виходять за рекомендовані орієнтири; перевірте схему, кількість ступенів і частоту двигуна.</p>':''}<p>Габаритне коло — ділильний діаметр колеса; для планетарного — зовнішній діаметр вінця з ободом. Добір порівнює цілі зубці, рекомендовані діапазони та геометрію; черв’ячному ступеню залишають більшу редукцію.</p>${balance}<p>${sourceLink('khk')} Модулі, ширини, навантаження й двигун зберігаються. Перевірки в таблицях охоплюють частоту, потужність, момент і зубці / каталожний рейтинг. Після прийняття окремо перевірте вали, шпонки, опори та пас / ланцюг.</p><div data-ratio-manual><h3>Ручний розподіл</h3><p>Бажані значення: ${math("u'_{\\mathrm e}="+fmt(p.ratioExternalTarget))}; ${math("u'_1="+fmt(p.ratioFirstTarget))}. Таблиці показують фактичні цілі зубці та повторний розрахунок.</p>${ratioComparisonTables(model,proposal,'manual')}${proposal.notes.length?'<p>Запитаний розподіл уточнено через цілі зубці та допустимі межі.</p>':''}<button type="button" data-ratio-adopt>Прийняти цей розподіл</button></div><p data-ratio-actions-note>Кнопки приймають розподіл і вмикають ручний режим. Автоматичний режим I-167 застосовує рекомендацію після зміни умов; редагування бажаного передатного числа або зубців вмикає ручний режим.</p></div>`;
 return report?html.replace(/<button[\s\S]*?<\/button>/g,'').replace(/<p data-ratio-actions-note>[\s\S]*?<\/p>/g,''):html;
}
function shaftSizingControls(){
 const q=bearingPlan,changes=q?.complete?INPUTS.filter(d=>Object.hasOwn(q.patch,d.key)):[];
 return `<section class="note" id="shaft-bearing-sizing"><h3>Добір вихідного вала й опор</h3><p>Якщо потрібна шийка більша за поточний вал, підготуйте узгоджені розміри вала, підшипників, підводу муфти та шпонки. Під час відкриття несумісного варіанта та експорту A1 сумісні розміри добираються автоматично. Ця кнопка готує окрему пропозицію для перегляду.</p><button type="button" data-shaft-size>Підібрати вихідний вал і опори</button>${q?`<p data-shaft-sizing-result>${esc(q.reason)}</p>`:''}${q?.complete?`<div class="table-wrap"><table data-shaft-sizing-changes><caption>Таблиця 7.3 — Добір вихідного вала й опор: зміни розмірів</caption><thead><tr><th>Параметр</th><th>Прийнято</th><th>Пропозиція</th></tr></thead><tbody>${changes.map(d=>`<tr><td>${esc(d.label)}</td><td>${esc(display(d,model.inputs[d.key]))}</td><td>${esc(display(d,q.patch[d.key]))}</td></tr>`).join('')}</tbody></table></div><p>${q.remaining.length?'Інші невиконані перевірки: '+q.remaining.map(c=>esc(c.title)).join('; ')+'.':'Усі реалізовані перевірки виконано.'}</p>${changes.length?'<button type="button" data-shaft-size-adopt>Прийняти розміри вала й опор</button>':'<p>Зміни розмірів не потрібні.</p>'}`:''}</section>`;
}
function render({repairMounting=false,presentationOnly=false}={}){
 if(shaftSizingJob&&(shaftSizingJob.target!==model||shaftSizingJob.revision!==model.session.revision)){shaftSizingJob.cancel();shaftSizingJob=null;document.body.dataset.shaftSizing='idle';}
 const manufacturingOpen=$('#manufacturingOptions')?.open;
 const frequencyKeys=['motorSpeed','requiredSpeed','taskKind','speed','drum','stages','z1_1','z2_1','z1_2','z2_2','beltD1','beltD2','beltSlip','timingZ1','timingZ2','chainZ1','chainZ2','speedTolerance','gearboxType','stageType1','stageType2','wormStarts1','wormStarts2','planetTeeth1','planetTeeth2','module1','module2','beta1','beta2','width1','width2'];
 const last=kinematicHistory.at(-1);if(!presentationOnly&&last&&(last.mode!==model.mode||frequencyKeys.some(k=>last.inputs[k]!==model.inputs[k])))kinematicHistory=[];
 const frequencyFit=presentationOnly?{steps:[]}:proposeAutomaticReduction(model);
 if(frequencyFit.steps.length){kinematicHistory=frequencyFit.steps;if(frequencyFit.complete){model.set(frequencyFit.patch);saveLocal();}else notify(frequencyFit.reason);}
 const mountingCorrection=repairMounting?correctBearingMounting(model):null;if(mountingCorrection?.row)saveLocal();
 gearLoadRevision++;
 gearViewer?.dispose();gearViewer=null;projectionView?.dispose();projectionView=null;
 if(designPlan&&designPlan.baseRevision!==model.session.revision)designPlan=null;
 if(bearingPlan&&bearingPlan.baseRevision!==model.session.revision)bearingPlan=null;
 const revision=++renderRevision;
 const visibleChapters=CHAPTERS.filter(chapter=>chapter.id!=='flex'||model.mode!=='none');
 const allChecks=checks(model),r=model.result.numbers;
 $('#chapter-nav').className='chapter-nav';$('#chapter-nav').innerHTML=visibleChapters.map(c=>`${c.id==='task'?'<p class="nav-group">Вихідні дані</p>':c.id===(model.mode==='none'?'gears':'flex')?'<p class="nav-group">Розрахунок деталей машин</p>':c.id==='comparison'?'<p class="nav-group">Додатки</p>':''}<a href="#${c.id}"><span class="nav-number">${c.n}</span><span>${esc(c.title)}</span></a>`).join('')+'<a href="#report-export"><span class="nav-number">PDF</span><span>Технічний звіт</span></a>';
 $('#chapters').innerHTML=visibleChapters.map(chapter=>{
  let extra='';
  if(chapter.id==='task')extra=projectNotice()+`<div class="metadata-grid">${[['student','Студент'],['group','Група'],['name','Назва варіанта']].map(([key,label])=>`<div class="field"><label for="meta-${key}">${label}</label><input id="meta-${key}" data-metadata="${key}" value="${esc(metadata[key])}" maxlength="200"></div>`).join('')}</div><div class="mode-fields">${field(INPUTS.find(x=>x.key==='taskKind'),INPUTS.findIndex(x=>x.key==='taskKind'))}<div class="field mode-field"><label for="flexMode">Передача перед редуктором</label><select id="flexMode">${Object.entries(MODES).map(([key,title])=>`<option value="${key}" ${model.mode===key?'selected':''}>${title}</option>`).join('')}</select></div>${field(INPUTS.find(x=>x.key==='gearboxType'),INPUTS.findIndex(x=>x.key==='gearboxType'))}${model.mode==='belt'?field(INPUTS.find(x=>x.key==='beltProfile'),INPUTS.findIndex(x=>x.key==='beltProfile')):''}</div>`;
  const fields=INPUTS.filter(x=>x.group===chapter.id&&!x.drawing&&!['taskKind','gearboxType','beltProfile'].includes(x.key)&&active(x,model.inputs,model.mode));
  const defs=CALCULATIONS.filter(x=>x.group===chapter.id&&active(x,model.inputs,model.mode));
  const defined=new Set();
  if(chapter.id==='gears')extra+=manufacturingControls();
  if(chapter.id==='power')extra+=kinematicText()+`<figure class="figure">${driveScheme(model)}<figcaption>Рисунок 2.3 — Повна схема привода: двигун → ${model.mode==='none'?'':esc(MODES[model.mode])+' → '}редуктор → робоча машина. Параметри відповідають прийнятому варіанту.</figcaption></figure>`+plot('powerPlot','Рисунок 2.1 — Передавання потужності та втрати за ланками привода.')+plot('torquePlot','Рисунок 2.2 — Зміна моменту за ступенями редуктора.');
  if(chapter.id==='gears')extra+=`<p>Геометрію прийнятих коліс показано на рисунку 4.1. ${sourceLink('khk')} ${sourceLink('akg')} У центрі розташовано план збірки, зліва й справа — проєкції тих самих деталей та валів. Обертання сповільнене; напрями та відношення частот відповідають розрахунку.</p><figure class="figure">${gearScheme(model)}<figcaption>${esc(gearFigureCaption())}</figcaption><div class="figure-controls"><button type="button" data-gears-motion aria-pressed="${gearMotion}">${gearMotion?'Зупинити обертання':'Увімкнути обертання'}</button></div></figure>`;
  if(chapter.id==='gears')extra+=`<figure class="figure webgl-figure"><div id="gearViewer" class="gear-viewer"><button type="button" data-load-3d>Показати модель у 3D</button></div><figcaption data-gear-caption></figcaption><div class="figure-controls"><button type="button" data-3d-fit disabled>Вписати модель</button><button type="button" data-3d-motion aria-pressed="false" disabled>Увімкнути обертання 3D</button></div></figure>`;
  if(chapter.id==='shaft')extra+=`<figure class="figure shaft-diagrams">${shaftDiagrams(model)}</figure>`;
  if(chapter.id==='shaft')extra+='<div data-construction-report>'+constructionReport(model)+'</div>';
  if(chapter.id==='bearings')extra+='<div data-assembly-instructions>'+assemblyInstructions(model)+'</div>'+shaftDesignGuide()+plot('lifePlot','Рисунок 7.1 — Базовий ресурс опор за різних множників радіального навантаження.');
  if(chapter.id==='basics')extra+=plot('springPlot','Рисунок 10.1 — Лінійна силова характеристика пружини до заданої робочої точки.');
  if(chapter.id==='comparison')extra+=`<div class="project-toolbar"><button data-baseline>Зафіксувати поточний варіант</button><button data-clear-baseline ${baseline?'':'disabled'}>Прибрати порівняння</button></div>${comparisonTable()}${iterationText(designPlan?.steps||iterationHistory,{proposal:Boolean(designPlan)})}<label for="rationale"><strong>Обґрунтування прийнятого рішення</strong></label><p class="source-note">Поясніть вибір вихідних параметрів, невиконані умови та відмінності від базового варіанта.</p><textarea class="rationale" id="rationale" data-metadata="rationale" maxlength="10000">${esc(metadata.rationale)}</textarea><div class="project-toolbar"><button data-native>Зберегти документ engdoc</button></div>`;
  if(chapter.id==='sources')extra+=sourceList();
  const groupChecks=allChecks.filter(x=>x.group===chapter.id);
  return `<section class="chapter" id="${chapter.id}"><header class="chapter-heading">${chapter.n?`<span class="number">${chapter.n}</span>`:''}<h2>${esc(chapter.title)}</h2></header><p class="intro">${technicalText(chapter.intro,model.inputs)} ${sourceLink(chapter.source)}</p>${chapter.id==='gears'?`<p class="note">Тип редуктора: ${esc(gearboxLabel(model.inputs))}. Параметри ступенів, геометрія та осьові сили відповідають вибору в розділі 1.</p>`:''}${chapter.id==='task'?extra:''}${fields.length?'<div class="field-grid">'+fields.map(d=>field(d,INPUTS.indexOf(d))).join('')+'</div>':''}${chapter.id==='power'?ratioControls():chapter.id==='bearings'?shaftSizingControls():''}${defs.length?'<div class="formula-list">'+defs.map((d,i)=>calculation(d,i,{defined})).join('')+'</div>':''}${groupChecks.length?checksTable(groupChecks,`Таблиця ${chapter.n}.${fields.length?2:1} — Перевірки поточного варіанта`):''}${chapter.id!=='task'?extra:''}${chapter.id==='task'?taskRelations(model.inputs)+notationGuide(model.inputs):NOTES[chapter.id]?`<p class="note">${technicalText(NOTES[chapter.id],model.inputs)}</p>`:''}${chapter.id==='task'?motorTable():''}</section>`;
 }).join('');
 numberTables($('#chapters'));access.apply();
 $('#task').append(projectTools);
 if(manufacturingOpen)$('#manufacturingOptions').open=true;
 updateGearCaption();

 if(!gearMotion)document.querySelector('.gear-scheme').pauseAnimations();
 const projectionHost=document.querySelector('.gear-scheme');projectionReady=import('./gear-projections.js').then(m=>m.createGearProjections(projectionHost,model)).then(view=>{if(revision!==renderRevision){view?.dispose();return;}projectionView=view;view?.play(gearMotion);document.querySelector('[data-construction-report]').innerHTML=constructionReport(model);document.querySelector('[data-assembly-instructions]').innerHTML=assemblyInstructions(model);numberTables($('#chapters'));access.apply();typeset(document.querySelector('[data-construction-report]'));}).catch(error=>{if(revision===renderRevision)notify(error.message);});
 document.querySelectorAll('[data-version]').forEach(x=>x.textContent='v'+VERSION);
 updateNav();typeset($('#chapters'));
 renderQueue=renderQueue.catch(()=>{}).then(async()=>{
  if(revision!==renderRevision)return;
  const charts=powerPlots(model),life=model.lifePoints(),snapshot=model.result.numbers;
  await waitLibraries();
  if(revision!==renderRevision)return;
  await drawChart('powerPlot',charts.power,'Ланка привода','P, кВт');
  await drawChart('torquePlot',charts.torque,'Вал редуктора','T, Н·м');
  await drawChart('lifePlot',[line('Опора A',life.map(x=>x.q),life.map(x=>x.a)),line('Опора B',life.map(x=>x.q),life.map(x=>x.b))],'Множник навантаження','L₁₀, год');
  await drawChart('springPlot',[line('Пружина',[0,snapshot.travel_sp*1000],[0,model.inputs.springForce])],'Деформація, мм','Сила, Н');
  localize(document);
  if(gearViewerEnabled&&revision===renderRevision)void mountGearViewer();
  document.body.dataset.ready=String(revision===renderRevision);
 }).catch(error=>{document.body.dataset.ready='error';notify('Графіки: '+error.message);console.error(error);});
 return mountingCorrection;
}

async function waitLibraries(){if(document.readyState!=='complete')await new Promise(resolve=>window.addEventListener('load',resolve,{once:true}));if(!window.Plotly)throw new Error('Локальний модуль графіків недоступний.');}
let mathQueue=Promise.resolve();
function typeset(element){mathQueue=mathQueue.catch(()=>{}).then(async()=>{await waitLibraries();if(element.isConnected&&window.MathJax?.typesetPromise){localize(element);MathJax.typesetClear([element]);await MathJax.typesetPromise([element]);}});return mathQueue;}
function updateNav(){const hash=location.hash||'#task';document.querySelectorAll('#chapter-nav a').forEach(x=>x.classList.toggle('active',x.getAttribute('href')===hash));}
function download(name,content,type='application/json'){if(!access.canEdit)throw new Error('Увійдіть для редагування та експорту.');name=i18n.t(name);const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function focusShaftSizing(){await renderQueue;await projectionReady;await mathQueue;const section=$('#shaft-bearing-sizing');section.scrollIntoView({behavior:'instant',block:'start'});(section.querySelector('[data-shaft-size-adopt]')||section.querySelector('[data-shaft-size]')).focus({preventScroll:true});}

function buildReport(vectorFigures){
 const allChecks=checks(model),r=model.result.numbers;
 return `<div class="report-content"><h1>${TITLE}</h1><p>Технічний звіт · АвтоМетод v${VERSION}</p><p><span translate="no">${esc(metadata.name)}</span><br>Студент: <span translate="no">${esc(metadata.student||'—')}</span> · група: <span translate="no">${esc(metadata.group||'—')}</span></p><p>Склад: ${esc(MODES[model.mode])}; ${esc(gearboxLabel(model.inputs))} редуктор, ${model.inputs.stages} зубчастих ступені. Вихід: ${fmt(r.n_out*60)} хв⁻¹; ${fmt(r.T_out)} Н·м.${model.inputs.taskKind===1?' Лінійна швидкість: '+fmt(r.v_out)+' м/с.':''}</p><p class="note">Звіт відтворює актуальний навчальний розрахунок. ${NOTES.sources}</p>${CHAPTERS.filter(c=>!['comparison','sources'].includes(c.id)&&(c.id!=='flex'||model.mode!=='none')).map(c=>{
  const fields=INPUTS.filter(x=>x.group===c.id&&active(x,model.inputs,model.mode)),defs=CALCULATIONS.filter(x=>x.group===c.id&&active(x,model.inputs,model.mode)),defined=new Set();
  const figures=[...document.querySelectorAll('#'+c.id+' figure:not(.webgl-figure)')].map(x=>{const clone=x.cloneNode(true),plot=x.querySelector('.plot');clone.querySelectorAll('.figure-controls,animateTransform').forEach(y=>y.remove());const ids=new Map([...clone.querySelectorAll('[id]')].map(el=>[el.id,'report-'+el.id]));for(const el of clone.querySelectorAll('*'))for(const attr of [...el.attributes]){let value=attr.value;for(const [oldId,newId] of ids)value=value.replaceAll('url(#'+oldId+')','url(#'+newId+')');if(attr.name==='id'&&ids.has(value))value=ids.get(value);if(value!==attr.value)el.setAttribute(attr.name,value);}if(clone.querySelector('.gear-scheme')&&vectorFigures.gears)clone.querySelector('.gear-scheme').outerHTML=vectorFigures.gears;if(plot){clone.querySelector('.plot').outerHTML=vectorFigures[plot.id];clone.classList.add('report-vector');}return clone.outerHTML;}).join('');
  return `<h2>${c.n}. ${esc(c.title)}</h2><p>${esc(c.intro)}</p>${fields.length?`<div class="table-wrap"><table><caption>Таблиця ${c.n}.1 — Вихідні дані розділу</caption><thead><tr><th>Параметр</th><th>Прийняте значення</th></tr></thead><tbody>${fields.map(f=>`<tr><td>${esc(f.label)} ${math(symbolTex(f,model.inputs))}</td><td>${display(f,model.inputs[f.key])}</td></tr>`).join('')}</tbody></table></div>`:''}${defs.map((d,i)=>calculation(d,i,{report:true,defined})).join('')}${checksTable(allChecks.filter(x=>x.group===c.id),`Таблиця ${c.n}.${fields.length?2:1} — Перевірки поточного варіанта`)}${c.id==='power'?ratioControls({report:true})+kinematicText():''}${c.id==='shaft'?constructionReport(model):''}${c.id==='bearings'?assemblyInstructions(model):''}${figures}${c.id==='task'?taskRelations(model.inputs)+notationGuide(model.inputs):NOTES[c.id]?`<p class="note">${technicalText(NOTES[c.id],model.inputs)}</p>`:''}`;
 }).join('')}<h2>11. Порівняння та обґрунтування</h2>${comparisonTable()}${iterationText(iterationHistory)}<p translate="no">${esc(metadata.rationale||'Обґрунтування студентом ще не внесено.').replaceAll('\n','<br>')}</p><section class="report-references"><h2>Джерела</h2>${sourceList()}</section></div>`;
}
async function showReport(){
 await renderQueue;await projectionReady;const revision=model.session.revision,vectorFigures={};
 $('#saveStatus').textContent='Готуємо звіт і векторні рисунки…';
 for(const id of ['powerPlot','torquePlot','lifePlot','springPlot'])vectorFigures[id]=await exportChart(id);
 if(projectionView?.geometry){const {snapshotProjections}=await import('./gear-projections.js');vectorFigures.gears=snapshotProjections(model,projectionView.geometry).replace('<svg ','<svg class="scheme gear-scheme" ');}
 if(revision!==model.session.revision)throw new Error('Дані змінилися під час підготовки звіту. Підготуйте звіт повторно.');
 const content=buildReport(vectorFigures).replaceAll('id="source-','id="report-source-').replaceAll('href="#source-','href="#report-source-');
 $('#report').innerHTML='<div class="report-actions"><button data-print>Друк / PDF</button><button data-report-html>Зберегти звіт HTML</button><button data-back>До розрахунку</button></div>'+content;
 $('#report').hidden=false;document.body.classList.add('report-preview');numberTables($('#report'));await typeset($('#report'));$('#report').scrollIntoView({behavior:'instant'});$('#saveStatus').textContent='Звіт поточного варіанта готовий';
}

document.addEventListener('change',async event=>{
 const target=event.target;if(target.matches('input,select,textarea')&&!await access.requireSession()){event.preventDefault();render({presentationOnly:true});return;}
 if(target.dataset.input){const def=INPUTS.find(x=>x.key===target.dataset.input);try{if(target.value.trim()==='')throw new Error('Введіть числове значення.');const value=Number(target.value)/(def.choices?1:def.factor);let patch={[def.key]:value};if(['ratioExternalTarget','ratioFirstTarget','z1_1','z2_1','z1_2','z2_2','wormStarts1','wormStarts2','planetTeeth1','planetTeeth2','chainZ1','chainZ2','timingZ1','timingZ2','beltD1','beltD2','beltSlip'].includes(def.key))patch.ratioManual=1;if(def.key==='gearboxType')patch=gearboxPreset(model.inputs,value);if(/^stageType[12]$/.test(def.key))patch=gearboxPreset(model.inputs,value,Number(def.key.at(-1)));if(def.key==='bearingCatalogue'){const row=bearings.find(b=>b.choice===value);patch={...bearingPatch(value),...(row?{journalLength:Math.max(model.inputs.journalLength,row.B_m)}:{})};}if(def.key==='shaftMaterial')patch=materialPatch(value);if(def.key==='timingCatalogue')patch=timingPatch(value);if(def.key==='chainCatalogue')patch=chainPatch(value);if(['timingPitch','timingTeeth','timingWidth'].includes(def.key))patch.timingCatalogue=0;if(def.key==='chainPitch')patch.chainCatalogue=0;if(['bearingC','bearingC0','bearingExponent','bearingBore','bearingLimit','journalDiameter'].includes(def.key))patch.bearingCatalogue=0;if(def.key==='shaftYield')patch.shaftMaterial=0;model.set(patch);target.removeAttribute('aria-invalid');saveLocal();if(def.drawing&&!['drawingHub','drawingHubRatio','drawingHubExtension'].includes(def.key)){$('#warning-'+def.key).textContent='';if(!def.choices)target.value=inputNumber(model.inputs[def.key]*def.factor);render();}else render();}catch(error){target.setAttribute('aria-invalid','true');const advice=target.value.trim()?fieldWarning(def.key,Number(target.value)/def.factor):'';$('#warning-'+def.key).textContent=error.message+(advice?' '+advice:'');notify(error.message);}}
 if(target.dataset.motorPreset&&target.value){try{if(target.dataset.motorPreset==='power')model.set({motorPower:Number(target.value)});else{const row=motorSpeeds(model.inputs.motorPower).find(m=>m.id===target.value);if(!row)throw new Error('Оберіть оберти для прийнятої потужності.');model.set({motorSpeed:row.rated_Hz});}saveLocal();render();}catch(error){notify(error.message);}}
 if(target.id==='flexMode'){try{model.set({},target.value);saveLocal();render();}catch(error){target.value=model.mode;notify(error.message);}}
 if(target.dataset.metadata){metadata[target.dataset.metadata]=target.value;saveLocal();}
});
document.addEventListener('click',async event=>{
 const button=event.target.closest('button,a[data-report]');if(!button)return;if(access.protectedAction(button)&&!await access.requireSession()){event.preventDefault();return;}
 try{
  if(button.matches('[data-save],[data-native],[data-baseline],[data-design],[data-apply-design],[data-report],[data-export-pdf],[data-export-drawing],[data-export-parts],[data-shaft-size],[data-open-shaft-sizing],[data-shaft-size-adopt],[data-adopt-shaft-summary],[data-ratio-adopt],[data-ratio-recommend]')){
   const invalid=$('#chapters [data-input][aria-invalid="true"]');
   if(invalid){invalid.scrollIntoView({behavior:'instant',block:'center'});invalid.focus({preventScroll:true});throw new Error('Виправте виділене поле: введене значення не прийнято до розрахунку.');}
  }
  if(button.hasAttribute('data-ratio-recommend')){const q=ratioRecommendation(model);if(!q)throw new Error('Сумісного рекомендованого розподілу не знайдено.');const patch={...q.patch,ratioManual:1,ratioExternalTarget:q.actual.externalRatio,ratioFirstTarget:q.actual.stageRatios[0]},candidate=new MechanicsModel({...model.inputs,...patch},model.mode);model.set(patch);kinematicHistory=[...kinematicHistory,{inputs:{...candidate.inputs},mode:model.mode,reason:'Прийнято розподіл за компактністю: uₑ = '+fmt(q.actual.externalRatio)+'; ступені '+q.actual.stageRatios.map(fmt).join(' × ')}].slice(-24);saveLocal();render();notify('Рекомендований розподіл прийнято; перевірки перераховано.');}
  if(button.hasAttribute('data-ratio-adopt')){const proposal=ratioProposal(model),patch={...proposal.patch,ratioManual:1};const candidate=new MechanicsModel({...model.inputs,...patch},model.mode);const reason='Ручний розподіл: uₑ = '+fmt(proposal.actual.externalRatio)+'; ступені '+proposal.actual.stageRatios.map(fmt).join(' × ');model.set(patch);kinematicHistory=[...kinematicHistory,{inputs:{...candidate.inputs},mode:model.mode,reason}].slice(-24);saveLocal();render();notify('Розподіл прийнято; перевірки перераховано.');}
  if(button.hasAttribute('data-bearing-adopt')){const row=model.bearingOptions().find(b=>b.choice===Number(button.dataset.bearingAdopt));if(!row)throw new Error('Немає сумісного підшипника для поточних даних.');model.set({...bearingPatch(row.choice),journalLength:Math.max(model.inputs.journalLength,row.B_m)});saveLocal();render();notify(`Прийнято SKF ${row.designation}: монтажний прохід, міцність шийки й ресурс перевірено.`);}
  if(button.hasAttribute('data-shaft-size')||button.hasAttribute('data-open-shaft-sizing'))await prepareShaftSizing();
  if(button.hasAttribute('data-review-shaft-sizing'))await focusShaftSizing();
  if(button.hasAttribute('data-shaft-size-adopt')||button.hasAttribute('data-adopt-shaft-summary')){const fromTask=Boolean(button.closest('#task'));adoptShaftSizing();if(fromTask){await renderQueue;await projectionReady;await mathQueue;$('#task').scrollIntoView({behavior:'instant'});}else await focusShaftSizing();notify('Розміри вихідного вала, підшипників і шпонки прийнято; перевірки перераховано.');}
  if(button.dataset.standardKey){model.set({[button.dataset.standardKey]:Number(button.dataset.standardValue)});saveLocal();render();}
  if(button.hasAttribute('data-load-3d')){gearViewerEnabled=true;await mountGearViewer();}
  if(button.hasAttribute('data-3d-fit'))gearViewer?.fit();
  if(button.hasAttribute('data-example')||button.hasAttribute('data-start-example')){download('Механічний_привод_резерв.json',JSON.stringify(exportProject(model,metadata,baseline,iterationHistory,kinematicHistory),null,2));model=new MechanicsModel(undefined,model.mode);projectOrigin='example';metadata={student:'',group:'',name:'Навчальний привод',rationale:''};baseline=null;designPlan=null;bearingPlan=null;iterationHistory=[];kinematicHistory=[];saveLocal();render();await renderQueue;await projectionReady;await mathQueue;$('#task').scrollIntoView({behavior:'instant'});notify('Відкрито перевірений навчальний приклад. Попередній варіант збережено у резервний JSON.');}
  if(button.hasAttribute('data-3d-motion')){const play=button.getAttribute('aria-pressed')!=='true';gear3DPlaying=play;gearViewer?.play(play);button.setAttribute('aria-pressed',String(play));button.textContent=play?'Зупинити обертання 3D':'Увімкнути обертання 3D';}
  if(button.hasAttribute('data-design')){designPlan=proposeDesign(model);render();await typeset($('#comparison'));$('#comparison').scrollIntoView({behavior:'instant'});}
  if(button.hasAttribute('data-apply-design')){
   if(!designPlan||designPlan.baseRevision!==model.session.revision)throw new Error('Вхідні дані змінилися. Підготуйте уточнення повторно.');
   const history=iterationHistory.length?[...iterationHistory,...designPlan.steps]:designPlan.steps;
   if(history.length>24)throw new Error('Збережіть цей розрахунок перед створенням нової послідовності ітерацій (межа — 24).');
   const patch=Object.fromEntries(Object.entries(designPlan.inputs).filter(([key,value])=>value!==model.inputs[key]));
   model.set(patch);iterationHistory=history;designPlan=null;saveLocal();render();$('#comparison').scrollIntoView({behavior:'instant'});
  }
  if(button.hasAttribute('data-gears-motion')){gearMotion=!gearMotion;projectionView?.play(gearMotion);const svg=document.querySelector('.gear-scheme');if(gearMotion)svg.unpauseAnimations();else svg.pauseAnimations();button.setAttribute('aria-pressed',gearMotion);button.textContent=gearMotion?'Зупинити обертання':'Увімкнути обертання';}
  if(button.hasAttribute('data-save'))download('Механічний_привод.json',JSON.stringify(exportProject(model,metadata,baseline,iterationHistory,kinematicHistory),null,2));
  if(button.hasAttribute('data-native'))download('Механічний_привод.engdoc.json',JSON.stringify(model.document(),null,2));
  if(button.hasAttribute('data-baseline')){baseline={inputs:{...model.inputs},mode:model.mode};saveLocal();render();notify('Базовий варіант зафіксовано.');}
  if(button.hasAttribute('data-clear-baseline')){baseline=null;saveLocal();render();}
  if(button.hasAttribute('data-report')){event.preventDefault();await showReport();}
  if(button.hasAttribute('data-export-drawing')||button.hasAttribute('data-export-parts')){const output=window.open('','_blank');if(!output)throw new Error('Дозвольте відкриття вікна для креслення A1.');try{const correction=correctBearingMounting(model);if(correction.blocked){output.document.body.textContent='Готуємо сумісні розміри вала й опор та креслення A1…';const sizing=await prepareShaftSizing({focus:false,adopt:true});if(!sizing?.complete){await focusShaftSizing();throw new Error(sizing?.reason||'Дані змінилися під час добору. Повторіть експорт A1.');}}if(correction.row){saveLocal();render();notify(correction.reason);}const snapshot=new MechanicsModel(model.inputs,model.mode),details={...metadata};const {loadGearGeometry,pairRequest}=await import('./cad-geometry.js');const geometry=await Promise.all(gearAssembly(snapshot).map((pair,i)=>loadGearGeometry(pairRequest(pair,snapshot,i))));output.document.open();output.document.write(drawingHTML(snapshot,{metadata:details,idPrefix:'export-a1',sheet:button.hasAttribute('data-export-parts')?'parts':'assembly',geometry}));output.document.close();localize(output.document);await output.document.fonts.ready;await new Promise(resolve=>output.requestAnimationFrame(()=>output.requestAnimationFrame(resolve)));fitDrawingText(output.document);output.focus();output.print();}catch(error){output.close();if(error.message.includes('оливи')){$('#warning-oilLevelHeight').textContent=error.message;$('#field-oilLevelHeight').scrollIntoView({behavior:'instant',block:'center'});}throw error;}}
  if(button.hasAttribute('data-export-pdf')){await showReport();await mathQueue;window.print();}
  if(button.hasAttribute('data-back')){document.body.classList.remove('report-preview');$('#report').hidden=true;$('#comparison').scrollIntoView({behavior:'instant'});}
  if(button.hasAttribute('data-print')){await mathQueue;window.print();}
  if(button.hasAttribute('data-report-html')){
   await mathQueue;const css=await fetch('src/app.css').then(x=>x.text()),mathCSS=$('#MJX-SVG-styles')?.textContent||'';const content=$('#report .report-content').outerHTML;
   download('Механічний_привод_звіт.html',`<!doctype html><html lang="${i18n.language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(i18n.t(TITLE))} — ${i18n.language==='en'?'report':'звіт'}</title><style>${css}\n${mathCSS}body{background:white}.report-content{padding:30px}svg{max-width:100%}@media print{.report-content{padding:0}}</style>${content}</html>`,'text/html');
  }
 }catch(error){notify(error.message);console.error(error);}
});
$('#projectFile').addEventListener('change',async event=>{
 if(!await access.requireSession())return;const file=event.target.files[0];if(!file)return;
 try{if(file.size>1e6)throw new Error('Проєкт перевищує 1 МБ.');const restored=importProject(JSON.parse(await file.text()));({model,metadata,baseline,iterations:iterationHistory,kinematicIterations:kinematicHistory}=restored);designPlan=null;bearingPlan=null;projectOrigin='file';const correction=render({repairMounting:true});saveLocal();if(correction.blocked)await prepareShaftSizing({focus:false,adopt:true});notify(bearingPlan&&!bearingPlan.complete?'Проєкт відкрито. Причина невдалого добору — у розділі 7.':'Проєкт відкрито; конструкцію й результати перераховано.');}catch(error){notify('Проєкт не змінено: '+error.message);}finally{event.target.value='';}
});
window.addEventListener('hashchange',updateNav);
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!document.body.classList.contains('report-preview'))render();},250);});

try{
 await access.ready;
 let restoredLocal=false;try{const saved=localStorage.getItem(STORAGE);if(saved&&access.canEdit){({model,metadata,baseline,iterations:iterationHistory,kinematicIterations:kinematicHistory}=importProject(JSON.parse(saved)));restoredLocal=true;projectOrigin='restored';}}catch(error){$('#loadWarning').hidden=false;$('#loadWarning').textContent='Збережений варіант не відкрито: '+error.message+' Показано початковий приклад; старий запис не перезаписано.';}
 model ||=new MechanicsModel();
 try{const response=await fetch('data/motor-reference.csv');if(!response.ok)throw new Error();motors=parseCSV(await response.text());}catch{notify('Довідковий CSV моторів недоступний. Основний розрахунок працює.');}
 const mountingCorrection=render({repairMounting:true});if(mountingCorrection.blocked)startupSizing=prepareShaftSizing({focus:false,adopt:true});$('#saveStatus').textContent=(restoredLocal?'Відновлено збережений варіант':'Навчальний приклад готовий')+' · зміни зберігаються локально';
 // Read-only inspection is useful for browser verification and future tooling.
 window.MechanicsRead={snapshot:()=>({inputs:{...model.inputs},mode:model.mode,numbers:{...model.result.numbers},checks:checks(model),construction:constructionSnapshot(model)}),document:()=>model.document(),geometry:()=>gearAssembly(model),ready:async()=>{await startupSizing;await renderQueue;await projectionReady;await mathQueue;}};
}catch(error){$('#chapters').textContent='Не вдалося підготувати розрахунок: '+error.message;$('#saveStatus').textContent='Помилка підготовки';console.error(error);}

function updateLanguage(){
 const reportOpen=document.body.classList.contains('report-preview');
 const guide=document.querySelector('.guide-download-link');guide.href='downloads/methodical-guide'+(i18n.language==='en'?'-en':'')+'.pdf';
 if(model){render({presentationOnly:true});if(reportOpen)void showReport();}
 localize(document);access.apply();
}
document.addEventListener('languagechange',updateLanguage);
updateLanguage();

document.addEventListener('mechanicsaccesschange',event=>{
 if(!event.detail.member||!model)return;
 try{
  const saved=localStorage.getItem(STORAGE);if(!saved)return;
  ({model,metadata,baseline,iterations:iterationHistory,kinematicIterations:kinematicHistory}=importProject(JSON.parse(saved)));
  projectOrigin='restored';designPlan=null;bearingPlan=null;
  const correction=render({repairMounting:true});
  if(correction.blocked)startupSizing=prepareShaftSizing({focus:false,adopt:true});
 }catch(error){notify('Збережений варіант не відкрито: '+error.message);}
});
