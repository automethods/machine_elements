import {constructionSnapshot} from './construction.js';
import {stageType} from './gearbox.js';
import {evaluatePlanetary} from '../vendor/technical-modules/gear-geometry/index.mjs';
import {NativeDocumentSession} from '../vendor/engdoc-runtime.js';
import {INPUTS,CALCULATIONS,CHAPTERS,SOURCES,MODES,TITLE,VERSION,selectionExpressions} from './definitions.js';
import {bearings,materials,bearingPatch,materialApplies,timingBelts,chains,timingPatch,chainPatch,beltProfiles} from './catalogues.js';

export const defaults=()=>Object.fromEntries(INPUTS.map(x=>[x.key,x.value]));
const scalar=(value,unit)=>unit?{kind:'quantity',value,canonicalUnit:unit}:{kind:'float64',value};
const must=result=>{if(!result.ok)throw new Error(result.error.message);return result.data;};
const bySymbol=new Map([...INPUTS.map(x=>[x.symbol,'input.'+x.key]),...CALCULATIONS.map(x=>[x.id,'value.'+x.id]),['pi','constant.pi'],['alpha','constant.alpha'],['million','constant.million'],['zero_L','constant.zero_L'],['zero_F','constant.zero_F'],['x_s','input.x_s'],['q_life','input.q_life']]);
function expression(source){return {source,bindings:[...new Set(source.match(/[A-Za-z_][A-Za-z_0-9]*/g)||[])].filter(x=>bySymbol.has(x)).map(token=>({token,valueId:bySymbol.get(token)}))};}

export function validateInputs(inputs,mode='none'){
 if(!Object.hasOwn(MODES,mode))throw new Error('Невідомий тип гнучкої передачі.');
 if(Object.keys(inputs).some(key=>!INPUTS.some(x=>x.key===key)))throw new Error('Проєкт містить невідомі вхідні дані.');
 for(const field of INPUTS){const value=inputs[field.key];
  if(typeof value!=='number'||!Number.isFinite(value)||value<field.min||value>field.max)throw new Error(`${field.label}: значення поза допустимими межами.`);
  if(field.integer&&!Number.isInteger(value))throw new Error(`${field.label}: потрібне ціле число.`);
  if(field.choices&&!field.choices.includes(value))throw new Error(`${field.label}: оберіть один із запропонованих варіантів.`);
 }
 for(let j=1;j<=inputs.stages;j++){
  const type=stageType(inputs,j);
  if(type===1){const u=inputs['z2_'+j]/inputs['z1_'+j],angle=inputs['shaftAngle'+j],delta=Math.atan(Math.sin(angle)/(u+Math.cos(angle)));if(u+Math.cos(angle)<=0||delta<=0||angle-delta>=Math.PI/2)throw new Error('Потрібна зовнішня конічна пара: обидва ділильні конуси < 90°.');const R=inputs['module'+j]*inputs['z1_'+j]/(2*Math.sin(delta));if(inputs['width'+j]>=R)throw new Error('Ширина конічного вінця має бути меншою за конусну відстань.');}
  if(type===3){if(inputs['planetRimThickness'+j]<inputs['module'+j])throw new Error('Товщина обода планетарного вінця має бути не меншою за модуль.');const result=evaluatePlanetary({gearSunTeeth:inputs['z1_'+j],gearPlanetTeeth:inputs['planetTeeth'+j],gearPlanetCount:inputs['planetCount'+j],gearModuleM:inputs['module'+j],gearSunAngularSpeedRadPerS:1,gearRingAngularSpeedRadPerS:0});if(result.status!=='ok')throw new Error('Планетарний ступінь: '+result.diagnostics[0]);}
 }
 if(stageType(inputs,inputs.stages)===3&&inputs.outputRadialForce<=0)throw new Error('Для ресурсу опор вихідного водила задайте ненульове зовнішнє радіальне навантаження робочої машини.');
 if(inputs.oilLevelHeight<=inputs.housingClearance)throw new Error('Рівень оливи для показаної ванни має бути вищим за зазор під найнижчою зубчастою деталлю.');
 if(inputs.drawingToothReduction+.00001>=Math.PI*Math.min(inputs.module1,inputs.stages===2?inputs.module2:inputs.module1)/2)throw new Error('Зменшення товщини зубця має залишати додатну робочу товщину.');
 if(inputs.journalLength>=inputs.shaftSpan)throw new Error('Довжина шийки має бути меншою за відстань між опорами.');
 if(inputs.keywayDepth>=inputs.couplingSeatDiameter/2)throw new Error('Глибина паза має бути меншою за радіус посадки муфти.');
 if(inputs.keywayDepth>=inputs.keyHeight)throw new Error('Глибина паза має бути меншою за висоту шпонки, щоб вона виступала у маточину муфти.');
 if(inputs.gearKeywayWidth>=inputs.shaftDiameter)throw new Error('Ширина паза колеса має бути меншою за діаметр середньої частини вала.');
 if(inputs.gearPosition>=inputs.shaftSpan)throw new Error('Колесо має розміщуватися між опорами: 0 < a < L.');
 if(inputs.keyLength<=inputs.keyWidth)throw new Error('Довжина шпонки має перевищувати її ширину.');
 if(inputs.keyWidth>=inputs.couplingSeatDiameter||inputs.keyHeight>=inputs.couplingSeatDiameter)throw new Error('Розміри шпонки мають бути меншими за діаметр посадки муфти.');
 if(inputs.boltDiameter<=1.226869*inputs.boltPitch)throw new Error('Діаметр і крок різьби несумісні: діаметр западин має бути додатним.');
 if(inputs.coilDiameter<4*inputs.wireDiameter)throw new Error('Для моделі пружини потрібно D/d ≥ 4.');
 const bearing=bearings.find(x=>x.choice===inputs.bearingCatalogue);
 if(bearing&&Object.entries(bearingPatch(bearing.choice)).some(([key,value])=>inputs[key]!==value))throw new Error('Каталожні параметри підшипника не відповідають обраному виробу. Для власних значень оберіть ручні дані.');
 for(const [rows,key,patch] of [[timingBelts,'timingCatalogue',timingPatch],[chains,'chainCatalogue',chainPatch]]){const row=rows.find(x=>x.choice===inputs[key]);if(row&&Object.entries(patch(row.choice)).some(([k,v])=>inputs[k]!==v))throw new Error('Каталожна геометрія не відповідає обраному виробу. Для власних значень оберіть ручні дані.');}
 const material=materials.find(x=>x.choice===inputs.shaftMaterial);
 if(material&&inputs.shaftYield!==material.yield_min_Pa)throw new Error('Границя плинності не відповідає обраному матеріалу. Для власних властивостей змініть спосіб добору.');
 // All three independent worksheets remain evaluable when changing drive type.
 if(2*inputs.beltCentre<=inputs.beltD1+inputs.beltD2)throw new Error('Шківи пасової передачі перекриваються: збільште міжосьову відстань.');
 const t1=inputs.timingPitch*inputs.timingZ1/Math.PI,t2=inputs.timingPitch*inputs.timingZ2/Math.PI;
 const A=inputs.timingPitch*inputs.timingTeeth-Math.PI*(t1+t2)/2;
 if(A<=0||A*A<=2*(t2-t1)**2)throw new Error('Пас має замало зубців для обраних шківів.');
 const at=(A+Math.sqrt(A*A-2*(t2-t1)**2))/4;
 if(2*at<=t1+t2)throw new Error('Зубчасті шківи перекриваються: оберіть довший пас.');
 if(inputs.chainLinks%2!==0)throw new Error('Оберіть парну кількість ланок без перехідної ланки.');
 const Ac=inputs.chainLinks-(inputs.chainZ1+inputs.chainZ2)/2;
 if(Ac<=0||Ac*Ac<=2*((inputs.chainZ2-inputs.chainZ1)/Math.PI)**2)throw new Error('Ланцюг має замало ланок для обраних зірочок.');
 const ac=inputs.chainPitch*(Ac+Math.sqrt(Ac*Ac-2*((inputs.chainZ2-inputs.chainZ1)/Math.PI)**2))/4;
 const dc1=inputs.chainPitch/Math.sin(Math.PI/inputs.chainZ1),dc2=inputs.chainPitch/Math.sin(Math.PI/inputs.chainZ2);
 if(2*ac<=dc1+dc2)throw new Error('Зірочки перекриваються: оберіть довший ланцюг.');
 return inputs;
}

export function createDocument(inputs=defaults(),mode='none'){
 validateInputs(inputs,mode);
 const nodes=[{id:'heading.title',kind:'heading',level:1,content:[{kind:'text',text:TITLE}]}],values=[];
 const add=(id,symbol,label,value,unit,extra={})=>{const ownerNodeId='node.'+id;nodes.push({id:ownerNodeId,kind:'input',valueId:id});values.push({id,ownerNodeId,role:'input',label,symbol,value:scalar(value,unit),...extra});};
 add('constant.pi','pi','Число π',Math.PI,null,{constant:true});
 add('constant.alpha','alpha','Кут профілю 20°',Math.PI/9,null,{constant:true});
 add('constant.million','million','Мільйон обертів',1e6,null,{constant:true});
 add('constant.zero_L','zero_L','Нуль довжини',0,'m',{constant:true});
 add('constant.zero_F','zero_F','Нуль сили',0,'N',{constant:true});
 add('input.x_s','x_s','Координата перерізу',0,'m',{minimum:0,maximum:3});
 add('input.q_life','q_life','Множник навантаження для дослідження',1,null,{minimum:.25,maximum:2});
 const selected=selectionExpressions(mode,inputs.taskKind,inputs.shaftMaterial,inputs.basicLimitMode,inputs);
 for(const chapter of CHAPTERS){
  nodes.push({id:'heading.'+chapter.id,kind:'heading',level:2,content:[{kind:'text',text:(chapter.n?chapter.n+'. ':'')+chapter.title}]});
  nodes.push({id:'prose.'+chapter.id,kind:'paragraph',content:[{kind:'text',text:chapter.intro}]});
  for(const field of INPUTS.filter(x=>x.group===chapter.id))add('input.'+field.key,field.symbol,field.label,inputs[field.key],field.unit,{minimum:field.min,maximum:field.max,...(field.choices?.length<=32?{choices:field.choices.map(n=>scalar(n,field.unit))}:{})});
  for(const c of CALCULATIONS.filter(x=>x.group===chapter.id)){
   const ownerNodeId='calc.'+c.id;
   nodes.push({id:ownerNodeId,kind:'calculation',valueId:'value.'+c.id});
   values.push({id:'value.'+c.id,ownerNodeId,role:'calculation',label:c.label,symbol:c.id,valueType:c.unit?'quantity':'float64',...(c.unit?{canonicalUnit:c.unit}:{}),expression:expression(selected[c.id]||c.expression)});
  }
 }
 for(const source of SOURCES)nodes.push({id:'source.'+source.id,kind:'paragraph',content:[{kind:'text',text:source.title+' '+source.locator+(source.url?' '+source.url:'')}]});
 return {format:'engdoc-native-draft/0.3',id:'doc.automethods.mechanics',title:TITLE,pageSetup:{size:'A4',orientation:'portrait',marginMm:20},nodes,values};
}

export class MechanicsModel{
 constructor(inputs=defaults(),mode='none'){this.inputs={...inputs};this.mode=mode;this.session=new NativeDocumentSession(createDocument(inputs,mode));this.result=this.evaluate();}
 evaluate(options={}){
  const result=must(this.session.evaluate({baseRevision:this.session.revision,...options}));
  if(result.state!=='evaluated')throw new Error(result.diagnostics.map(x=>x.message).join('\n'));
  return {...result,numbers:Object.fromEntries(result.values.map(x=>[x.id.replace(/^value\./,''),Number(x.value.value)]))};
 }
 set(patch={},mode=this.mode){
  const candidate={...this.inputs,...patch};validateInputs(candidate,mode);
  const commands=Object.entries(patch).map(([key,value])=>({type:'setInput',valueId:'input.'+key,value:scalar(value,INPUTS.find(x=>x.key===key).unit)}));
  const before=selectionExpressions(this.mode,this.inputs.taskKind,this.inputs.shaftMaterial,this.inputs.basicLimitMode,this.inputs),after=selectionExpressions(mode,candidate.taskKind,candidate.shaftMaterial,candidate.basicLimitMode,candidate);
  for(const [id,source] of Object.entries(after))if(source!==before[id])commands.push({type:'setExpression',valueId:'value.'+id,...expression(source)});
  if(!commands.length)return this.result;
  const proposal=must(this.session.proposeEdit({baseRevision:this.session.revision,reason:'Зміна вихідних даних навчального проєкту',commands}));
  if(proposal.requiresDraftConfirmation){this.session.discardEdit({baseRevision:this.session.revision,candidateId:proposal.candidateId});throw new Error('Розрахунок для цих даних неможливий.');}
  must(this.session.applyEdit({baseRevision:this.session.revision,candidateId:proposal.candidateId}));
  this.inputs=candidate;this.mode=mode;this.result=this.evaluate();return this.result;
 }
 history(direction){
  must(this.session[direction]({baseRevision:this.session.revision}));
  const document=this.document();
  for(const field of INPUTS)this.inputs[field.key]=document.values.find(x=>x.id==='input.'+field.key).value.value;
  const choice=document.values.find(x=>x.id==='value.u_ext').expression.source;
  this.mode=Object.keys(MODES).find(mode=>selectionExpressions(mode).u_ext===choice);
  this.result=this.evaluate();return this.result;
 }
 document(){return must(this.session.read({revision:this.session.revision,selector:'document'})).items[0];}
 status(){return must(this.session.describe());}
 momentPoints(){return [0,this.inputs.gearPosition,this.inputs.shaftSpan].map(x=>({x,y:this.evaluate({targetValueIds:['value.M_sample'],overrides:[{valueId:'input.x_s',value:scalar(x,'m')}]}).numbers.M_sample}));}
 bearingAssessment({assemblyClearance=this.inputs.bearingAssemblyClearance}={}){const p=this.inputs,r=this.result.numbers;return bearings.map(row=>{
  const geometry=row.B_m<p.shaftSpan&&row.d_m<=p.shaftDiameter&&row.d_m+1e-9>=p.couplingSeatDiameter+assemblyClearance&&row.limit_Hz>=r.n_out;
  if(!geometry)return {row,geometry,failures:['geometry']};
  const q=this.evaluate({targetValueIds:['value.journalStress','value.L_A','value.L_B','value.s0_A','value.s0_B'],overrides:[{valueId:'input.journalDiameter',value:scalar(row.d_m,'m')},{valueId:'input.bearingC',value:scalar(row.C_N,'N')},{valueId:'input.bearingC0',value:scalar(row.C0_N,'N')},{valueId:'input.bearingExponent',value:scalar(3)}]}).numbers;
  return {row,geometry,failures:Object.entries({journalStrength:q.journalStress<=r.shaftLimit,lifeA:q.L_A>=p.bearingHours,lifeB:q.L_B>=p.bearingHours,staticA:q.s0_A>=p.bearingSafety,staticB:q.s0_B>=p.bearingSafety}).filter(([,ok])=>!ok).map(([id])=>id)};
 });}
 bearingOptions(options={}){return this.bearingAssessment(options).filter(x=>x.geometry&&!x.failures.length).map(x=>x.row);}
 displacementPoints(){const L=this.inputs.shaftSpan,positions=[...new Set([...Array.from({length:25},(_,i)=>L*i/24),this.inputs.gearPosition])].sort((a,b)=>a-b);return positions.map(x=>({x,y:this.evaluate({targetValueIds:['value.deflection_sample'],overrides:[{valueId:'input.x_s',value:scalar(x,'m')}]}).numbers.deflection_sample}));}
 shearPoints(){const a=this.inputs.gearPosition,L=this.inputs.shaftSpan,r=this.result.numbers;return [{x:0,y:0},{x:0,y:r.Q_left},{x:a,y:r.Q_left},{x:a,y:r.Q_right},{x:L,y:r.Q_right},{x:L,y:0}];}
 lifePoints(){return [.5,.75,1,1.25,1.5,1.75,2].map(q=>{const r=this.evaluate({targetValueIds:['value.L_A','value.L_B'],overrides:[{valueId:'input.q_life',value:scalar(q,null)}]});return {q,a:r.numbers.L_A/3600,b:r.numbers.L_B/3600};});}
}

export function checks(model){
 const p=model.inputs,r=model.result.numbers,items=[];
 const add=(id,title,ratio,group,note='')=>items.push({id,title,ratio,group,note,ok:Number.isFinite(ratio)&&ratio<=1});
 add('power','Потужність двигуна',1/r.powerReserve,'power');
 add('speed','Відхилення вихідної частоти',Math.abs(r.delta_v)/p.speedTolerance,'power');
 if(p.taskKind===0)add('outputTorque','Момент робочого вала',p.requiredTorque/r.T_out,'power');
 if(model.mode==='belt'){add('belt','Невід’ємний натяг веденої гілки',r.F_slack>0?0:Infinity,'flex','Без відцентрової сили; номінальна потужність паса потребує каталожної перевірки.');const profile=beltProfiles.find(b=>b.choice===p.beltProfile);if(profile)add('beltPulley','Мінімальний діаметр шківів для профілю '+profile.profile,profile.min_pulley_m/Math.min(p.beltD1,p.beltD2),'flex','Мінімум Optibelt PR-17; розрахунковий діаметр. Потужність і натяг перевіряють окремо.');}
 if(model.mode==='timing'){add('timing','Робоче зусилля зубчастого паса',r.q_timing,'flex');add('mesh','Зубців у зачепленні ≥ 6',6/r.Z_mesh,'flex','Попередній навчальний орієнтир; перевірте вимоги виробника.');}
 if(model.mode==='chain')add('chain','Робоче зусилля ланцюга',r.q_chain,'flex');
 for(let j=1;j<=p.stages;j++){
  if(stageType(p,j)===0){add('bending'+j,`Ступінь ${j}: згин зубців`,Math.max(r['sigmaF1_'+j],r['sigmaF2_'+j])/p['bendAllow'+j],'strength');add('contact'+j,`Ступінь ${j}: локальний контакт`,r['pH_'+j]/p['contactAllow'+j],'strength');}
  else {const rating=p['stageRatedTorque'+j];add('gearRating'+j,`Ступінь ${j}: допустимий момент виробу`,rating>0?p.loadFactor*r['T_'+j]/rating:Infinity,'strength','Рейтинг конкретного виробу за його матеріалом, ресурсом, частотою та умовами.');if(rating===0){const item=items.at(-1);item.applicable=false;item.scope='rating';}}
 }
 add('shaft','Статична міцність вала',r.sigma_vm/r.shaftLimit,'shaft');
 add('stockSize','Заготовка вміщує готовий вал',p.shaftDiameter/p.shaftStockDiameter,'shaft');
 if(p.shaftMaterial!==0)add('materialSize','Область властивостей матеріалу',materialApplies(p)?0:Infinity,'shaft');
 add('deflection','Прогин у місці колеса',r.deflection/p.deflectionAllow,'shaft');
 add('twist','Кут закручування',r.twist/p.twistAllow,'shaft');
 add('hub','Колесо вміщує вал',p.shaftDiameter/r['df2_'+p.stages],'shaft','Потрібен також запас товщини маточини й стінки під шпонкою.');
 const adoptedBearing=bearings.find(b=>b.choice===p.bearingCatalogue);if(adoptedBearing)add('journalLength','Шийка вміщує ширину підшипника',adoptedBearing.B_m/p.journalLength,'bearings');
 add('journalShoulder','Шийки не більші за середню частину вала',p.journalDiameter/p.shaftDiameter,'bearings');add('journalStrength','Статична міцність шийки під опорою',r.journalStress/r.shaftLimit,'bearings');
 add('lifeA','Ресурс підшипника A',p.bearingHours/r.L_A,'bearings');add('lifeB','Ресурс підшипника B',p.bearingHours/r.L_B,'bearings');
 add('staticA','Статичний запас опори A',p.bearingSafety/r.s0_A,'bearings');add('staticB','Статичний запас опори B',p.bearingSafety/r.s0_B,'bearings');
 if(p.bearingBore>0)add('bearingBore','Відповідність отвору шийці вала',Math.abs(p.bearingBore-p.journalDiameter)<1e-9?0:Infinity,'bearings','Номінальні діаметри; допуски посадок потребують окремого добору.');
 if(p.bearingLimit>0)add('bearingSpeed','Гранична частота підшипника',r.n_out/p.bearingLimit,'bearings');
 add('keyCrush','Зминання шпонки',r.sigma_key/p.keyBearingAllow,'key');add('keyShear','Зріз шпонки',r.tau_key/p.keyShearAllow,'key');add('coupling','Момент вихідної муфти',r.T_coup/p.couplingTorque,'key');
 add('boltTension','Розтяг болта',r.sigma_bolt/p.boltAllow,'bolts');
 add('clamp','Стик залишається стиснутим',r.F_clamp>0?0:Infinity,'bolts','Після розкриття стику лінійна модель розподілу навантаження за χ перестає діяти.');
 add('slip','Утримання поперечної сили тертям',p.boltShear===0?0:p.boltShear/r.F_friction,'bolts');
 add('boltCombined','Розтяг зі зрізом стрижня',r.sigma_bolt_eq/p.boltAllow,'bolts','Оцінка при ковзанні й зрізі по гладкому стрижню; зминання деталей та різьба в площині зрізу не перевірені.');
 if(r.F_clamp<=0)for(const item of items.filter(x=>['boltTension','boltCombined'].includes(x.id))){item.applicable=false;item.ok=false;item.ratio=NaN;}
 add('couplingSeatStrength','Статична міцність посадки муфти',r.couplingSeatStress/r.shaftLimit,'key');add('couplingSeatFit','Монтажний прохід до опори B',(p.couplingSeatDiameter+p.bearingAssemblyClearance)/p.journalDiameter,'bearings','Перед посадковою шийкою потрібна менша підвідна ділянка, включно з посадкою муфти. Перепад — прийнятий навчальний розмір; k6 зберігається тільки на шийці. Опору A монтують з вільного лівого торця.');add('keywayFit','Паз розміщується на посадці муфти',(p.couplingKeywayStart+p.keyLength)/p.couplingSeatLength,'key');
 const sharedCheckStart=items.length,construction=constructionSnapshot(model);for(const [i,message] of (construction?.diagnostics||[]).entries())add('construction-diagnostic-'+i,message,Infinity,'bearings');for(const shaft of construction?.shafts||[]){for(const c of shaft.checks)add(c.id,shaft.name+': '+c.detail,c.ok?0:Infinity,'bearings');if(shaft.analysis){add(shaft.id+'-sections',shaft.name+': міцність окремих перерізів',shaft.analysis.worst.utilization,'shaft');add(shaft.id+'-displacement',shaft.name+': просторовий прогин',shaft.analysis.maxDeflectionM/p.deflectionAllow,'shaft');}for(const b of shaft.bearingChecks)add(shaft.id+'-bearing-'+b.end,shaft.name+': опора '+b.end,b.ok?0:Infinity,'bearings');}
 for(const item of items.slice(sharedCheckStart))item.construction=true;
 add('rod','Розтяг стрижня',r.sigma_rod/r.rodLimit,'basics');add('spring','Напруження дроту пружини',r.stress_sp/r.springLimit,'basics');
 return items;
}

export function exportProject(model,metadata={},baseline=null,iterations=[],kinematicIterations=[]){return {format:'automethods-mechanics/1',version:VERSION,mode:model.mode,inputs:{...model.inputs},metadata:{student:String(metadata.student||''),group:String(metadata.group||''),name:String(metadata.name||''),rationale:String(metadata.rationale||'')},baseline,iterations,kinematicIterations,construction:constructionSnapshot(model),engdoc:model.document()};}
export function importProject(data){
 if(!data||data.format!=='automethods-mechanics/1'||![VERSION,'0.4.10','0.4.9','0.4.7','0.4.8','0.4.6','0.4.5','0.4.4','0.4.3','0.4.2','0.4.1','0.4.0','0.3.6','0.3.5','0.3.4','0.3.3','0.3.2','0.3.1','0.3.0','0.2.0','0.1.0'].includes(data.version)||!data.inputs)throw new Error('Непідтримуваний формат або версія проєкту.');
 const migrateInputs=inputs=>{
  let result={...inputs};const initial=defaults();for(const key of ['constructionShoulder','constructionShoulderLength','constructionSealLength','constructionPlateThickness','constructionFloat','constructionAzimuth','ratioManual','ratioExternalTarget','ratioFirstTarget',...INPUTS.filter(x=>x.drawing).map(x=>x.key),'bearingAssemblyClearance','journalLength','shaftFillet','couplingSeatDiameter','couplingSeatLength','couplingKeywayStart','keywayDepth','gearKeywayLength','gearKeywayWidth','shaftChamfer','inputShaftDiameter','intermediateShaftDiameter','inputShaftLength','intermediateShaftLength','housingClearance','housingWall','housingBase','oilLevelHeight'])if(!Object.hasOwn(result,key))result[key]=initial[key];
  if(!Object.hasOwn(result,'journalDiameter'))result={...result,journalDiameter:inputs.bearingBore||inputs.shaftDiameter,journalConcentration:1.5};
  if(inputs&&['taskKind','requiredTorque','requiredSpeed'].every(key=>!Object.hasOwn(inputs,key)))result={...result,taskKind:1,requiredTorque:inputs.force*inputs.drum/2,requiredSpeed:inputs.speed/(Math.PI*inputs.drum)};
  if(!Object.hasOwn(result,'shaftMaterial'))result={...result,shaftMaterial:0,shaftStockDiameter:inputs.shaftDiameter,shaftYield:300e6,shaftSafety:3};
  if(!Object.hasOwn(result,'bearingCatalogue'))result={...result,bearingCatalogue:0,bearingBore:0,bearingLimit:0};
  if(!Object.hasOwn(result,'basicLimitMode'))result={...result,basicLimitMode:0,rodStrength:300e6,rodSafety:2,springStrength:600e6,springSafety:1.5};
  if(!Object.hasOwn(result,'timingCatalogue'))result={...result,timingCatalogue:0,timingWidth:.03};
  if(!Object.hasOwn(result,'chainCatalogue'))result={...result,chainCatalogue:0};
  if(!Object.hasOwn(result,'beltProfile'))result.beltProfile=0;
  if(!Object.hasOwn(result,'gearboxType')){const initial=defaults();for(const key of ['gearboxType','outputRadialForce','bearingX','bearingY','axialSupport',...[1,2].flatMap(j=>['stageType','beta','shaftAngle','wormStarts','wormDiameterFactor','wormLength','planetTeeth','planetCount','planetRimThickness','stageRatedTorque'].map(k=>k+j))])result[key]=initial[key];}
  return result;
 };
 const model=new MechanicsModel(migrateInputs(data.inputs),data.mode);
 const metadata={};for(const key of ['student','group','name','rationale']){const value=data.metadata?.[key]||'';if(typeof value!=='string'||value.length>10000)throw new Error('Некоректні відомості про проєкт.');metadata[key]=value;}
 let baseline=null;if(data.baseline){const b=new MechanicsModel(migrateInputs(data.baseline.inputs),data.baseline.mode);baseline={inputs:{...b.inputs},mode:b.mode};}
 // Rebuild fixed equations from this application's schema. Saved output or
 // arbitrary imported native expressions never replace the calculation method.
 const iterations=[];
 if(data.iterations){
  if(!Array.isArray(data.iterations)||data.iterations.length>24)throw new Error('Некоректна історія уточнення конструкції.');
  for(const step of data.iterations){
   if(typeof step.reason!=='string'||step.reason.length>2000)throw new Error('Некоректне обґрунтування ітерації.');
   const inputs=migrateInputs(step.inputs);validateInputs(inputs,step.mode);
   iterations.push({inputs:{...inputs},mode:step.mode,reason:step.reason});
  }
 }
 const kinematicIterations=[];
 if(data.kinematicIterations){
  if(!Array.isArray(data.kinematicIterations)||data.kinematicIterations.length>24)throw new Error('Некоректна історія кінематичного уточнення.');
  for(const step of data.kinematicIterations){if(typeof step.reason!=='string'||step.reason.length>2000)throw new Error('Некоректне обґрунтування кінематичної ітерації.');const inputs=migrateInputs(step.inputs);validateInputs(inputs,step.mode);kinematicIterations.push({inputs:{...inputs},mode:step.mode,reason:step.reason});}
 }
 return {model,metadata,baseline,iterations,kinematicIterations};
}
