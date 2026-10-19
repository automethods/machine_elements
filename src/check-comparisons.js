import {bearings,beltProfiles} from './catalogues.js';
import {materials} from './catalogues.js';
const format=value=>new Intl.NumberFormat('uk-UA',{maximumSignificantDigits:5}).format(value);
export function checkComparison(model,item){
 const p=model.inputs,r=model.result.numbers;
 if(item.scope==='rating')return {comparison:'Паспортний / каталожний момент не задано',reserve:'Потрібне значення конкретного виробу'};
 if(item.applicable===false)return {comparison:'Стик розкрито: лінійна модель непридатна',reserve:'—'};
 const low=(a,b,unit)=>`${format(a)} ${unit} ${item.ok?'≤':'>'} ${format(b)} ${unit}`;
 const high=(a,b,unit)=>`${format(a)} ${unit} ${item.ok?'≥':'<'} ${format(b)} ${unit}`;
 let comparison;
 const stage=Number(item.id.match(/\d+$/)?.[0]);
 if(item.id.startsWith('gearRating'))comparison=low(p.loadFactor*r['T_'+stage],p['stageRatedTorque'+stage],'Н·м');
 else if(item.id.startsWith('bending'))comparison=low(Math.max(r['sigmaF1_'+stage],r['sigmaF2_'+stage])/1e6,p['bendAllow'+stage]/1e6,'МПа');
 else if(item.id.startsWith('contact'))comparison=low(r['pH_'+stage]/1e6,p['contactAllow'+stage]/1e6,'МПа');
 else switch(item.id){
  case 'power':comparison=high(p.motorPower/1000,r.P_min/1000,'кВт');break;
  case 'outputTorque':comparison=high(r.T_out,p.requiredTorque,'Н·м');break;
  case 'speed':return {comparison:`δₙ = ${format(r.delta_v*100)} % ${item.ok?'∈':'∉'} [−${format(p.speedTolerance*100)} %; +${format(p.speedTolerance*100)} %]`,reserve:`Допуск ±${format(p.speedTolerance*100)} %`};
  case 'belt':return {comparison:`F₂ = ${format(r.F_slack)} Н ${item.ok?'>':'≤'} 0 Н`,reserve:'Ведена гілка має бути натягнута'};
  case 'beltPulley':comparison=high(Math.min(p.beltD1,p.beltD2)*1000,beltProfiles.find(b=>b.choice===p.beltProfile).min_pulley_m*1000,'мм');break;
  case 'timing':comparison=low(r.F_timing,p.timingAllowForce,'Н');break;
  case 'mesh':comparison=high(r.Z_mesh,6,'зубців');break;
  case 'chain':comparison=low(r.F_chain,p.chainAllowForce,'Н');break;
  case 'shaft':comparison=low(r.sigma_vm/1e6,r.shaftLimit/1e6,'МПа');if(p.shaftMaterial!==0)return {comparison,reserve:`n = ${format(r.shaftFactor)} ${item.ok?'∈':'∉'} [${format(p.shaftSafety)}; ∞)`};break;
  case 'stockSize':comparison=low(p.shaftDiameter*1000,p.shaftStockDiameter*1000,'мм');break;
  case 'materialSize':{const m=materials.find(x=>x.choice===p.shaftMaterial);return {comparison:`dзаг = ${format(p.shaftStockDiameter*1000)} мм ${item.ok?'∈':'∉'} (${format(m.bar_diameter_min_exclusive_m*1000)}; ${format(m.bar_diameter_max_exclusive_m*1000)}) мм`,reserve:'Властивості для цього стану круглого прокату'};}
  case 'couplingSeatStrength':comparison=low(r.couplingSeatStress/1e6,r.shaftLimit/1e6,'МПа');break;
  case 'couplingSeatFit':return {comparison:high((p.journalDiameter-p.couplingSeatDiameter)*1000,p.bearingAssemblyClearance*1000,'мм'),reserve:'Перепад діаметрів / прийнятий монтажний мінімум'};
  case 'keywayFit':comparison=low((p.couplingKeywayStart+p.keyLength)*1000,p.couplingSeatLength*1000,'мм');break;
  case 'journalLength':comparison=low(bearings.find(b=>b.choice===p.bearingCatalogue).B_m*1000,p.journalLength*1000,'мм');break;
  case 'journalShoulder':comparison=low(p.journalDiameter*1000,p.shaftDiameter*1000,'мм');break;
  case 'journalStrength':comparison=low(r.journalStress/1e6,r.shaftLimit/1e6,'МПа');break;
  case 'bearingBore':return {comparison:`${format(p.bearingBore*1000)} мм ${item.ok?'=':'≠'} ${format(p.journalDiameter*1000)} мм`,reserve:'Отвір / шийка вала'};
  case 'bearingSpeed':comparison=low(r.n_out*60,p.bearingLimit*60,'хв⁻¹');break;
  case 'deflection':comparison=low(r.deflection*1000,p.deflectionAllow*1000,'мм');break;
  case 'twist':comparison=low(r.twist*180/Math.PI,p.twistAllow*180/Math.PI,'°');break;
  case 'hub':comparison=low(p.shaftDiameter*1000,r['df2_'+p.stages]*1000,'мм');break;
  case 'lifeA':comparison=high(r.L_A/3600,p.bearingHours/3600,'год');break;
  case 'lifeB':comparison=high(r.L_B/3600,p.bearingHours/3600,'год');break;
  case 'staticA':return {comparison:high(r.s0_A,p.bearingSafety,''),reserve:`s₀ = ${format(r.s0_A)} ${item.ok?'∈':'∉'} [${format(p.bearingSafety)}; ∞)`};
  case 'staticB':return {comparison:high(r.s0_B,p.bearingSafety,''),reserve:`s₀ = ${format(r.s0_B)} ${item.ok?'∈':'∉'} [${format(p.bearingSafety)}; ∞)`};
  case 'keyCrush':comparison=low(r.sigma_key/1e6,p.keyBearingAllow/1e6,'МПа');break;
  case 'keyShear':comparison=low(r.tau_key/1e6,p.keyShearAllow/1e6,'МПа');break;
  case 'coupling':comparison=low(r.T_coup,p.couplingTorque,'Н·м');break;
  case 'boltTension':comparison=low(r.sigma_bolt/1e6,p.boltAllow/1e6,'МПа');break;
  case 'clamp':return {comparison:`Fcl = ${format(r.F_clamp/1000)} кН ${item.ok?'>':'≤'} 0 кН`,reserve:'Стик має залишатися стиснутим'};
  case 'slip':comparison=low(p.boltShear/1000,r.F_friction/1000,'кН');break;
  case 'boltCombined':comparison=low(r.sigma_bolt_eq/1e6,p.boltAllow/1e6,'МПа');break;
  case 'rod':comparison=low(r.sigma_rod/1e6,r.rodLimit/1e6,'МПа');if(p.basicLimitMode===1)return {comparison,reserve:`n = ${format(r.rodFactor)} ${item.ok?'≥':'<'} [n] = ${format(p.rodSafety)}`};break;
  case 'spring':comparison=low(r.stress_sp/1e6,r.springLimit/1e6,'МПа');if(p.basicLimitMode===1)return {comparison,reserve:`n = ${format(r.springFactor)} ${item.ok?'≥':'<'} [n] = ${format(p.springSafety)}`};break;
  default:if(item.construction)return {comparison:Number.isFinite(item.ratio)&&item.ratio>0?`Використання = ${format(item.ratio)} ${item.ok?'≤':'>'} 1`:(item.ok?'Конструктивну умову виконано':'Конструктивна умова потребує уточнення'),reserve:'Спільна конструктивна модель; числові дані нижче'};throw new Error('Немає порівняння для '+item.id);
 }
 const reserve=item.ratio===0?'Умову виконано':`Використання межі: ${format(item.ratio*100)} % ${item.ok?'≤':'>'} 100 %`;
 return {comparison,reserve};
}
