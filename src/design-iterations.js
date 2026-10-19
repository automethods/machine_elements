import {ratioCandidates,constructionSnapshot} from './construction.js';
import {gearAssembly} from './gear-geometry.js';
import {pairRequest} from './cad-geometry.js';
import {generateBrowserGearGeometry} from '../vendor/technical-modules/gear-geometry/browser.mjs';
import {prepareConstruction} from './gear-projections.js';
import {hubKey,drawingConstructionWarnings} from './manufacturing.js';
import {stageType} from './gearbox.js';
import {formatNumber} from './precision.js';
import {MechanicsModel,checks,validateInputs} from './model.js';
import {INPUTS} from './definitions.js';
import {bearings,materials,bearingPatch,bearingMountingWarning,bearingSelectionAdvice,materialPatch,moduleRows} from './catalogues.js';

const modules=moduleRows(1);
const nextModule=value=>modules.find(x=>x>value+1e-9);
const roundUp=(value,step)=>Math.ceil((value-1e-12)/step)*step;
const bounded=(key,value)=>{const field=INPUTS.find(x=>x.key===key);return value>=field.min&&value<=field.max?value:null;};
export function iterationSnapshot(model,reason){return {inputs:{...model.inputs},mode:model.mode,reason};}

// Read-only proposal. The worksheet applies this through the native edit
// command before creating an immutable drawing snapshot.
export function proposeBearingMounting(model){
 if(!bearingMountingWarning(model.inputs))return {patch:{},blocked:false,reason:''};
 const p=model.inputs,driveFailures=[],constructionFailures=[];let geometry;
 for(const row of model.bearingOptions({assemblyClearance:0}).sort((a,b)=>a.d_m-b.d_m||a.C_N-b.C_N)){
  const couplingSeatDiameter=Math.round(Math.min(p.couplingSeatDiameter,row.d_m-p.bearingAssemblyClearance)*1e9)/1e9;
  const patch={...bearingPatch(row.choice),journalLength:Math.max(p.journalLength,row.B_m),couplingSeatDiameter};
  try{validateInputs({...p,...patch},model.mode);}catch{continue;}
  const q=model.evaluate({targetValueIds:['value.couplingSeatStress','value.sigma_key','value.tau_key'],overrides:[{valueId:'input.couplingSeatDiameter',value:{kind:'quantity',value:couplingSeatDiameter,canonicalUnit:'m'}}]}).numbers;
  const failed=[...(q.couplingSeatStress>model.result.numbers.shaftLimit?[`напруження підвідної посадки муфти ${formatNumber(q.couplingSeatStress/1e6)} > ${formatNumber(model.result.numbers.shaftLimit/1e6)} МПа`]:[]),...(q.sigma_key>p.keyBearingAllow?[`зминання шпонки ${formatNumber(q.sigma_key/1e6)} > ${formatNumber(p.keyBearingAllow/1e6)} МПа`]:[]),...(q.tau_key>p.keyShearAllow?[`зріз шпонки ${formatNumber(q.tau_key/1e6)} > ${formatNumber(p.keyShearAllow/1e6)} МПа`]:[])];
  if(failed.length){driveFailures.push({diameter:couplingSeatDiameter,failed});continue;}
  // Native life checks alone do not validate the actual ring abutment,
  // fillet clearance or stepped shaft. Keep the existing main diameter and
  // reject a catalogue row that cannot be assembled in that construction.
  let candidate;try{candidate=new MechanicsModel({...p,...patch},model.mode);geometry ||=gearAssembly(model).map((pair,i)=>generateBrowserGearGeometry(pairRequest(pair,model,i)));prepareConstruction(candidate,geometry);}catch(error){constructionFailures.push(error.message);continue;}
  const output=constructionSnapshot(candidate)?.shafts.find(s=>s.id==='output-shaft');
  if(!output?.analysis?.worst.ok||output.checks.some(c=>!c.ok)||output.bearingChecks.some(c=>!c.ok)||output.analysis.maxDeflectionM>p.deflectionAllow){constructionFailures.push(...(output?.checks.filter(c=>!c.ok).map(c=>c.detail)||[]));if(output?.analysis&&!output.analysis.worst.ok)constructionFailures.push(`Міцність перерізів вихідного вала: ${formatNumber(output.analysis.worst.vonMisesPa/1e6)} > ${formatNumber(candidate.result.numbers.shaftLimit/1e6)} МПа.`);continue;}
  return {patch,blocked:false,row,reason:`Для монтажу опори B прийнято SKF ${row.designation}: отвір і шийки ${formatNumber(row.d_m*1000)} мм замість ${formatNumber(p.journalDiameter*1000)} мм. Підвідна посадка муфти ${formatNumber(couplingSeatDiameter*1000)} h6; шийка ${formatNumber(row.d_m*1000)} k6. Перепад діаметрів ${formatNumber((row.d_m-couplingSeatDiameter)*1000)} мм; кручення меншого перерізу та шпонку перевірено. Діаметр середньої частини та навантаження збережені.`};
 }
 const drive=driveFailures.sort((a,b)=>a.failed.length-b.failed.length||b.diameter-a.diameter)[0];
 return {patch:{},blocked:true,reason:(drive?`Каталожні опори є, але монтажний добір блокує підвідна посадка муфти / шпонка при ⌀${formatNumber(drive.diameter*1000)} мм: ${drive.failed.join('; ')}. Перевірте більший діаметр вала та муфти або робочу довжину шпонки з повторним розрахунком.`:constructionFailures.length?'Каталожні опори потребують зміни конструкції вала: '+[...new Set(constructionFailures)].join('; '):'Немає сумісного каталожного підшипника для поточної конструкції. '+bearingSelectionAdvice(model))+' Уточніть конструкцію вала та опор перед експортом A1.'};
}

// A separate, explicit proposal can enlarge construction dimensions. The
// existing automatic mounting correction continues to preserve the main shaft.
export function proposeShaftBearings(model){
 const p=model.inputs,r=model.result.numbers,minimum=p.journalDiameter*Math.cbrt(r.journalStress/r.shaftLimit),targets=['shaft','stockSize','materialSize','deflection','twist','hub','journalLength','journalShoulder','journalStrength','lifeA','lifeB','staticA','staticB','bearingBore','bearingSpeed','couplingSeatFit','couplingSeatStrength','keywayFit','keyCrush','keyShear'];
 const nativeTargets=['d_min','shaftLimit','sigma_vm','deflection','twist','journalStress','L_A','L_B','s0_A','s0_B','couplingSeatStress','sigma_key','tau_key'],evaluate=patch=>model.evaluate({targetValueIds:nativeTargets.map(id=>'value.'+id),overrides:Object.entries(patch).map(([key,value])=>{const unit=INPUTS.find(d=>d.key===key).unit;return {valueId:'input.'+key,value:unit?{kind:'quantity',value,canonicalUnit:unit}:{kind:'float64',value}};})}).numbers;
 const geometries=new Map();let lastReason='У підтриманих діаметрах немає варіанта за міцністю, ресурсом, монтажем і розмірами колеса.';
 const rows=bearings.filter(b=>b.d_m>=Math.max(minimum,p.journalDiameter,p.couplingSeatDiameter+p.bearingAssemblyClearance)-1e-9&&b.B_m<p.shaftSpan&&b.fillet_max_m>=p.shaftFillet&&b.limit_Hz>=r.n_out).sort((a,b)=>a.d_m-b.d_m||a.D_m-b.D_m||a.C_N-b.C_N);
 for(const row of rows){
  const couplingSeatDiameter=Math.round((row.d_m-p.bearingAssemblyClearance)*1e9)/1e9,key=hubKey(couplingSeatDiameter),keywayDepth=key.heightM-key.depthM;
  let diameter=roundUp(Math.max(p.shaftDiameter,row.d_m+p.bearingAssemblyClearance,r.d_min*1.02,p.shaftDiameter*Math.max(r.deflection/p.deflectionAllow,r.twist/p.twistAllow,1)**.25),.005);
  for(let attempt=0;attempt<6&&diameter<=.3;attempt++,diameter=roundUp(diameter+.005,.005)){
   const gearKey=hubKey(diameter),stock=Math.max(p.shaftStockDiameter,roundUp(diameter+2*p.constructionShoulder+.001,.005)),material=materials.find(m=>m.choice===p.shaftMaterial);
   if(material&&!(stock>material.bar_diameter_min_exclusive_m&&stock<material.bar_diameter_max_exclusive_m)){lastReason='Потрібна більша заготовка поза діапазоном властивостей обраного матеріалу. Оберіть відповідний стан/розмір заготовки та повторіть добір.';break;}
   if(Math.max(row.shaft_abutment_min_m+.001,diameter+.002)>row.inner_ring_shoulder_m+1e-10)break;
   let patch={...bearingPatch(row.choice),shaftDiameter:diameter,shaftStockDiameter:stock,journalLength:Math.max(p.journalLength,row.B_m),couplingSeatDiameter,keyWidth:key.widthM,keyHeight:key.heightM,keywayDepth,keyLength:Math.max(p.keyLength,key.widthM+.01),gearKeywayWidth:gearKey.widthM,gearKeywayLength:Math.max(p.gearKeywayLength,gearKey.widthM+.005)};
   // Keep the accepted gear key length. A narrow rim needs a longer hub,
   // with the key centred on that fitted seat rather than on the rim.
   if(p.drawingHub===1&&stageType(p,p.stages)!==3)patch.drawingHubExtension=Math.max(p.drawingHubExtension,roundUp((patch.gearKeywayLength+.006)/p['width'+p.stages]-1,.05));
   patch.couplingSeatLength=Math.max(p.couplingSeatLength,p.couplingKeywayStart+patch.keyLength+.005);
   let q;try{validateInputs({...p,...patch},model.mode);q=evaluate(patch);}catch{continue;}
   if(q.journalStress>q.shaftLimit||q.couplingSeatStress>q.shaftLimit||q.L_A<p.bearingHours||q.L_B<p.bearingHours||Math.min(q.s0_A,q.s0_B)<p.bearingSafety)break;
   if(q.sigma_vm>q.shaftLimit||q.deflection>p.deflectionAllow||q.twist>p.twistAllow)continue;
   const keyRatio=Math.max(q.sigma_key/p.keyBearingAllow,q.tau_key/p.keyShearAllow,1),length=roundUp(key.widthM+(patch.keyLength-key.widthM)*keyRatio*1.02,.005);
   patch={...patch,keyLength:Math.max(p.keyLength,length),couplingSeatLength:Math.max(p.couplingSeatLength,p.couplingKeywayStart+length+.005)};
   let candidate;try{candidate=new MechanicsModel({...p,...patch},model.mode);}catch{continue;}
   const failed=checks(candidate).filter(c=>targets.includes(c.id)&&!c.ok);if(failed.length){lastReason='Не виконано: '+failed.map(c=>c.title).join('; ')+'.';continue;}
   const warnings=drawingConstructionWarnings(candidate);if(warnings.length){lastReason=warnings.join(' ');break;}
   // Reuse tooth geometry only for the same trial bore. The final assembly
   // and its section checks must use the candidate's actual fitted diameter.
   if(!geometries.has(diameter))geometries.set(diameter,gearAssembly(candidate).map((pair,i)=>generateBrowserGearGeometry(pairRequest(pair,candidate,i))));
   const geometry=geometries.get(diameter);
   try{prepareConstruction(candidate,geometry);}catch(error){lastReason=error.message;continue;}
   const output=constructionSnapshot(candidate)?.shafts.find(s=>s.id==='output-shaft');
   if(!output?.analysis||!output.analysis.worst.ok||output.analysis.maxDeflectionM>p.deflectionAllow||output.checks.some(c=>!c.ok)||output.bearingChecks.some(c=>!c.ok)){lastReason=[...(output?.checks.filter(c=>!c.ok).map(c=>c.detail)||[]),...(output?.analysis&&!output.analysis.worst.ok?[`Міцність перерізів вихідного вала: ${formatNumber(output.analysis.worst.vonMisesPa/1e6)} > ${formatNumber(candidate.result.numbers.shaftLimit/1e6)} МПа.`]:[]),...(output?.bearingChecks.filter(c=>!c.ok).map(c=>`Опора ${c.end}: ресурс або статичний запас недостатній.`)||[])].join(' ')||lastReason;continue;}
   const changes=Object.fromEntries(Object.entries(patch).filter(([key,value])=>value!==p[key])),remaining=checks(candidate).filter(c=>!c.ok);
   return {baseRevision:model.session.revision,patch:changes,row,minimumJournalM:minimum,complete:true,remaining,reason:`Вихідний вал ⌀${formatNumber(diameter*1000)} мм; шийки ⌀${formatNumber(row.d_m*1000)} мм; підвід муфти ⌀${formatNumber(couplingSeatDiameter*1000)} мм; SKF ${row.designation}. Перевірено монтаж, уступи, пази, міцність окремих перерізів, прогин, шпонку та ресурс опор. Двигун, навантаження, матеріал, допустимі напруження й зубчасті ступені збережено.`};
  }
 }
 return {baseRevision:model.session.revision,patch:{},complete:false,reason:lastReason};
}

// A bounded teaching proposal, evaluated by the same native engdoc engine as
// the worksheet. It changes design parameters, never loads, requirements,
// allowable stresses, efficiencies or catalogue capacities to force a pass.
export function proposeDesign(model){
 const candidate=new MechanicsModel(model.inputs,model.mode),steps=[iterationSnapshot(candidate,'Початкова перевірка прийнятих вихідних даних.')];
 for(let iteration=0;iteration<12;iteration++){
  const p=candidate.inputs,r=candidate.result.numbers,failed=checks(candidate).filter(x=>!x.ok),ids=new Set(failed.map(x=>x.id));
  if(!failed.length)break;
  let patch={},reason='';
  if(ids.has('speed')){
   const fit=proposeFrequencyFit(candidate);if(fit.complete&&Object.keys(fit.patch).length){patch=fit.patch;reason=fit.steps.at(-1).reason;}
  }else if(ids.has('power')||ids.has('outputTorque')){
   const power=roundUp(Math.max(r.P_min,ids.has('outputTorque')?p.motorPower*p.requiredTorque/r.T_out:0)*1.001,100);
   if(bounded('motorPower',power)!==null){patch={motorPower:power};reason='Потужність або вихідний момент недостатні. Уточнюємо механічну потужність до найближчих 0,1 кВт угору та повторно перевіряємо вихідний момент; конкретний двигун потребує каталожного добору.';}
  }else if(failed.some(x=>/^bending|^contact/.test(x.id))||ids.has('hub')){
   const failure=failed.find(x=>/^bending|^contact/.test(x.id)),stage=failure?Number(failure.id.match(/\d+$/)[0]):p.stages,key='module'+stage,value=nextModule(p[key]);
   if(value){patch={[key]:value};reason=`Збільшуємо модуль ступеня ${stage} до ${(value*1000).toFixed(2)} мм. Числа зубців залишаємо прийнятими; повторно перевіряємо геометрію, згин зубців і контакт.`;}
  }else if(['shaft','deflection','twist'].some(id=>ids.has(id))){
   const q=Object.fromEntries(checks(candidate).map(x=>[x.id,x.ratio])),diameter=roundUp(Math.max(r.d_min,p.shaftDiameter*Math.max(q.deflection,q.twist,1)**.25)*1.01,.001);
   const bearing=p.bearingCatalogue?bearings.filter(b=>b.d_m>=diameter).sort((a,b)=>a.d_m-b.d_m||a.C_N-b.C_N)[0]:null,adopted=bearing?.d_m||diameter;
   if(bounded('shaftDiameter',adopted)!==null){patch={shaftDiameter:adopted,shaftStockDiameter:Math.max(p.shaftStockDiameter,adopted),...(bearing?{...bearingPatch(bearing.choice),journalLength:Math.max(p.journalLength,bearing.B_m)}:{})};reason=`За оцінкою міцності та жорсткості приймаємо діаметр вала ${(adopted*1000).toFixed(0)} мм${bearing?' під отвір SKF '+bearing.designation:''}. Уточнюємо заготовку та повторно перевіряємо міцність, жорсткість і опори.`;}
  }else if(ids.has('stockSize')){
   patch={shaftStockDiameter:p.shaftDiameter};reason='Діаметр готового вала перевищує діаметр заготовки. Приймаємо більшу заготовку та перевіряємо область застосування її властивостей.';
  }else if(ids.has('materialSize')){
   const current=materials.find(m=>m.choice===p.shaftMaterial),row=materials.find(m=>m.grade===current.grade&&m.variant===current.variant&&m.condition===current.condition&&p.shaftStockDiameter>m.bar_diameter_min_exclusive_m&&p.shaftStockDiameter<m.bar_diameter_max_exclusive_m);
   if(row){patch=materialPatch(row.choice);reason='Для прийнятого діаметра заготовки використовуємо відповідний ряд того самого матеріалу та стану. Повторно перевіряємо міцність за його мінімальною границею плинності.';}
  }else if(ids.has('couplingSeatFit')||ids.has('bearingBore')){
   const correction=proposeBearingMounting(candidate);if(correction.row){patch=correction.patch;reason=correction.reason;}
  }else if(['lifeA','lifeB','staticA','staticB','bearingSpeed','journalStrength','journalShoulder','journalLength'].some(id=>ids.has(id))&&p.bearingCatalogue!==0){
   const row=candidate.bearingOptions().sort((a,b)=>Math.abs(a.d_m-p.journalDiameter)-Math.abs(b.d_m-p.journalDiameter)||a.C_N-b.C_N)[0];
   if(row){patch={...bearingPatch(row.choice),journalLength:Math.max(p.journalLength,row.B_m)};reason=`За монтажним проходом через посадку муфти, міцністю шийки, ресурсом, статичним запасом і частотою обираємо відкритий SKF ${row.designation} зі спільного каталогу. C і C₀ приймаємо з його рядка; повторно перевіряємо опори.`;}
  }else if(ids.has('keyCrush')||ids.has('keyShear')){
   const q=Math.max(r.sigma_key/p.keyBearingAllow,r.tau_key/p.keyShearAllow),length=roundUp(p.keyWidth+(p.keyLength-p.keyWidth)*q*1.01,.005);
   if(bounded('keyLength',length)!==null){patch={keyLength:length,couplingSeatLength:Math.max(p.couplingSeatLength,p.couplingKeywayStart+length+.005)};reason=`Збільшуємо робочу довжину шпонки; приймаємо повну довжину ${(length*1000).toFixed(0)} мм і повторно перевіряємо зминання та зріз.`;}
  }else if(ids.has('clamp')||ids.has('slip')){
   const count=Math.max(p.boltCount+1,Math.ceil((1-p.boltStiffness)*p.boltAxial/p.boltPreload+p.boltShear/(p.jointFriction*p.boltPreload))+1);
   if(bounded('boltCount',count)!==null){patch={boltCount:count};reason=`Для утримання стику збільшуємо кількість болтів до ${count}; натяг одного болта та коефіцієнт тертя залишаємо заданими. Перевіряємо стиск, ковзання та напруження.`;}
  }else if(ids.has('boltTension')||ids.has('boltCombined')){
   const diameter=roundUp(p.boltDiameter*1.15,.002);
   if(bounded('boltDiameter',diameter)!==null){patch={boltDiameter:diameter};reason='Уточнюємо діаметр болта і повторно перевіряємо площу різьби та напруження. Сумісність діаметра й прийнятого кроку з каталогом перевіряють перед остаточним добором.';}
  }else if(ids.has('rod')){
   const area=roundUp(p.rodForce/r.rodLimit*1.01,.000001);
   if(bounded('rodArea',area)!==null){patch={rodArea:area};reason='Збільшуємо площу перерізу стрижня за заданою силою та допустимим напруженням; повторно обчислюємо напруження й подовження.';}
  }else if(ids.has('spring')){
   const wire=roundUp(p.wireDiameter+.0005,.0005),coil=Math.max(p.coilDiameter,4*wire);
   if(bounded('wireDiameter',wire)!==null&&bounded('coilDiameter',coil)!==null){patch={wireDiameter:wire,coilDiameter:coil};reason='Збільшуємо діаметр дроту пружини з дотриманням D/d ≥ 4; повторно визначаємо жорсткість, деформацію та напруження.';}
  }else if(ids.has('belt')){
   const tension=roundUp(p.loadFactor*r.F_b/(2*r.N_b)+10,10);
   if(bounded('beltPretension',tension)!==null){patch={beltPretension:tension};reason='Уточнюємо попередній натяг паса для додатного натягу веденої гілки; окремо контролюємо зростання навантаження на вал шківа.';}
  }
  if(!Object.keys(patch).length)break;
  try{candidate.set(patch);}catch{break;}
  steps.push(iterationSnapshot(candidate,reason));
 }
 const remaining=checks(candidate).filter(x=>!x.ok);
 return {baseRevision:model.session.revision,steps,inputs:{...candidate.inputs},mode:candidate.mode,remaining,complete:remaining.length===0};
}

// Find an integer-tooth adoption without changing the required speed/tolerance,
// motor parameters or capacities. Every tested output is a native query.
export function proposeFrequencyFit(model){
 const p=model.inputs,r=model.result.numbers,stage=p.stages,type=stageType(p,stage),pinion=type===2?'wormStarts'+stage:'z1_'+stage,wheel=type===3?'planetTeeth'+stage:'z2_'+stage;
 const first=iterationSnapshot(model,'Початкова кінематична перевірка до уточнення чисел зубців.');
 if(Math.abs(r.delta_v)<=p.speedTolerance)return {baseRevision:model.session.revision,steps:[],patch:{},complete:true};
 const fields=Object.fromEntries(INPUTS.map(f=>[f.key,f])),ratio=r.z2_req/p[pinion];
 const testPair=(z1,z2)=>{
  if(z2<fields[wheel].min||z2>fields[wheel].max)return null;
  try{validateInputs({...p,[pinion]:z1,[wheel]:z2},model.mode);}catch{return null;}
  const result=model.evaluate({targetValueIds:['value.n_out','value.delta_v'],overrides:[{valueId:'input.'+pinion,value:{kind:'float64',value:z1}},{valueId:'input.'+wheel,value:{kind:'float64',value:z2}}]}).numbers;
  return Math.abs(result.delta_v)<=p.speedTolerance?{[pinion]:z1,[wheel]:z2}:null;
 };
 let patch=testPair(p[pinion],Math.round(r.z2_req));
 if(!patch){
  // Keep the initial pinion whenever possible; only then search nearby counts.
  const teeth=Array.from({length:fields[pinion].max-fields[pinion].min+1},(_,i)=>fields[pinion].min+i).sort((a,b)=>Math.abs(a-p[pinion])-Math.abs(b-p[pinion])||a-b);
  for(const z1 of teeth){for(const z2 of [...new Set([Math.round(z1*ratio),Math.floor(z1*ratio),Math.ceil(z1*ratio)])]){patch=testPair(z1,z2);if(patch)break;}if(patch)break;}
 }
 if(!patch){first.reason+=' У підтриманих межах чисел зубців допуск не досягнуто; потрібен інший розподіл передатних чисел або схема.';return {baseRevision:model.session.revision,steps:[first],patch:{},complete:false,reason:'У підтриманих межах чисел зубців задану частоту й допуск не узгоджено. Потрібен інший двигун, розподіл передатних чисел або схема привода.'};}
 const candidate=new MechanicsModel({...p,...patch},model.mode),reason=`За формулою уточнення отримано ${type===3?'zₚ*':'z₂*'} = ${formatNumber(r.z2_req)}. Приймаємо для ступеня ${stage} ${type===2?'заходів':'z₁'} = ${patch[pinion]}, ${type===3?'zₚ':'z₂'} = ${patch[wheel]}; повторно обчислюємо частоту та відхилення при незмінному допуску ±${p.speedTolerance*100} %.`;
 return {baseRevision:model.session.revision,steps:[first,iterationSnapshot(candidate,reason)],patch:Object.fromEntries(Object.entries(patch).filter(([key,value])=>p[key]!==value)),complete:true};
}

// Evaluate both displayed alternatives through the same native trace query.
// Accepted inputs, documents and the compactness search remain unchanged.
export function evaluateRatioProposal(model,q){
 const p=model.inputs,targets=['P_min','P_0','n_0','n_out','T_out',...Array.from({length:p.stages},(_,i)=>{const j=i+1;return ['T_'+j,'P_'+j,'n_'+j,'d1_'+j,'d2_'+j,'aw_'+j,...(stageType(p,j)===1?['coneR_'+j]:[]),...(stageType(p,j)===0?['sigmaF1_'+j,'sigmaF2_'+j,'pH_'+j]:[])];}).flat()];
 validateInputs({...p,...q.patch},model.mode);
 const r=model.evaluate({targetValueIds:targets.map(id=>'value.'+id),overrides:Object.entries(q.patch).map(([key,value])=>{const unit=INPUTS.find(d=>d.key===key).unit;return {valueId:'input.'+key,value:unit?{kind:'quantity',value,canonicalUnit:unit}:{kind:'float64',value}};})}).numbers,failures=[];
 if(Math.abs(q.actual.speedErrorFraction)>p.speedTolerance)failures.push('Відхилення вихідної частоти');
 if(p.motorPower<r.P_min)failures.push('Недостатня потужність двигуна');
 if(p.taskKind===0&&r.T_out<p.requiredTorque)failures.push('Недостатній вихідний момент');
 for(let j=1;j<=p.stages;j++)if(stageType(p,j)===0){if(Math.max(r['sigmaF1_'+j],r['sigmaF2_'+j])>p['bendAllow'+j])failures.push('Згин зубців ступеня '+j);if(r['pH_'+j]>p['contactAllow'+j])failures.push('Контакт ступеня '+j);}else if(p['stageRatedTorque'+j]<=0||p.loadFactor*r['T_'+j]>p['stageRatedTorque'+j])failures.push('Паспортний момент ступеня '+j);
 const envelope=q.envelope||Array.from({length:p.stages},(_,i)=>{const j=i+1;return {pinionPitchM:r['d1_'+j],wheelPitchM:r['d2_'+j],centreM:stageType(p,j)===1?r['coneR_'+j]:r['aw_'+j],envelopeDiameterM:r['d2_'+j]+(stageType(p,j)===3?2.5*p['module'+j]+2*p['planetRimThickness'+j]:0)};});
 return {...q,envelope,failures,outputHz:r.n_out,outputTorqueNm:r.T_out,requiredPowerW:r.P_min,stageTorqueNm:Array.from({length:p.stages},(_,i)=>r['T_'+(i+1)]),stagePowerW:Array.from({length:p.stages},(_,i)=>r['P_'+(i+1)]),stageHz:Array.from({length:p.stages},(_,i)=>r['n_'+(i+1)])};
}
const ratioCache=new WeakMap();
export function ratioRecommendation(model){
 const saved=ratioCache.get(model);if(saved?.revision===model.session.revision)return saved.value;
 const candidates=ratioCandidates(model);let best=null;
 for(const q of candidates){
  let value;try{value={...evaluateRatioProposal(model,q),evaluated:candidates.length};}catch{continue;}
  if(!best||value.failures.length<best.failures.length||value.failures.length===best.failures.length&&q.score<best.score)best=value;
 }
 ratioCache.set(model,{revision:model.session.revision,value:best});return best;
}

// Automatic mode uses the same reviewable recommendation as the explicit
// button. Targets remain stable preferences, so repeated renders cannot drift.
export function proposeAutomaticReduction(model){
 if(model.inputs.ratioManual)return {steps:[],patch:{},complete:true};
 const q=ratioRecommendation(model);if(!q)return proposeFrequencyFit(model);
 const patch=Object.fromEntries(Object.entries(q.patch).filter(([key,value])=>Math.abs(model.inputs[key]-value)>1e-10));
 if(!Object.keys(patch).length)return {steps:[],patch,complete:true};
 const next=new MechanicsModel({...model.inputs,...patch},model.mode);
 return {patch,complete:true,steps:[iterationSnapshot(model,'Початковий розподіл перед добором усіх ступенів.'),iterationSnapshot(next,'Автоматичний розподіл за типом ступенів, рекомендованими діапазонами та габаритами: uₑ = '+formatNumber(q.actual.externalRatio)+'; ступені '+q.actual.stageRatios.map(formatNumber).join(' × ')+'. Частоту повторно перевірено після прийняття цілих зубців.'+(q.outsideRecommended.some(Boolean)||q.externalOutsideRecommended?' Окремі передатні числа виходять за рекомендації; див. таблицю розподілу.':''))]};
}
