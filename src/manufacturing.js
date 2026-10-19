import {constructHub} from '../vendor/technical-modules/mechanical-construction/index.mjs';
// Drawing requirements are adopted teaching data. They never replace the
// native stress allowables, loads, nominal tooth geometry or catalogue ratings.
import {formatNumber} from './precision.js';
import {gearAssembly} from './gear-geometry.js';
import {bearingMountingWarning,materials} from './catalogues.js';
export const mmText=value=>new Intl.NumberFormat('uk-UA',{maximumFractionDigits:4}).format(value*1000);
const deg=value=>formatNumber(value*180/Math.PI)+'°';
// ISO 286 deviations in micrometres; SKF 17000/1 EN, tables 12, 14, 18
// (printed pp. 156, 160, 168). Intervals are (lower, upper].
const bands=[3,6,10,18,30,50,80,120,180,250,315,400,500];
const IT6=[6,8,9,11,13,16,19,22,25,29,32,36,40],IT7=[10,12,15,18,21,25,30,35,40,46,52,57,63],IT9=[25,30,36,43,52,62,74,87,100,115,130,140,155],k6Lower=[0,1,1,1,2,2,2,3,3,4,4,4,5];
export function fitDeviations(diameterM,zone){
 const index=bands.findIndex(upper=>diameterM*1000<=upper+1e-8);
 if(index<0||diameterM<=0)throw Error('Числові посадки підтримуються для 0 < d ≤ 500 мм.');
 const pair=zone==='H7'?[0,IT7[index]]:zone==='h6'?[-IT6[index],0]:zone==='k6'?[k6Lower[index],k6Lower[index]+IT6[index]]:zone==='JS9'?[-IT9[index]/2,IT9[index]/2]:null;
 if(!pair)throw Error('Непідтримуване поле допуску '+zone);
 return {lowerM:pair[0]*1e-6,upperM:pair[1]*1e-6};
}
const signed=value=>(value>0?'+':'')+mmText(value);
export function fitDimension(diameterM,zone){const {lowerM,upperM}=fitDeviations(diameterM,zone);return `⌀${mmText(diameterM)} ${zone} (${signed(upperM)}/${signed(lowerM)})`;}
export function drawingRequirements(p){
 return {shaftZone:p.drawingFit===1?'h6':'k6',grade:p.drawingAccuracy,boreRa:p.drawingFinish===1?.8:1.6,teethRa:p.drawingFinish===1?1.6:3.2,generalRa:p.drawingFinish===1?3.2:6.3,runoutM:p.drawingGeometry===1?.00002:.00003,perpendicularM:p.drawingGeometry===1?.00001:.00002,linearToleranceM:.0001,angularToleranceDeg:.5};
}
// Full-height parallel keys / hub depth, mm. Manufacturer tables use these
// diameter intervals, DIN 6885-1; width is specified separately as JS9.
const keys=[[8,2,2,1],[10,3,3,1.4],[12,4,4,1.8],[17,5,5,2.3],[22,6,6,2.8],[30,8,7,3.3],[38,10,8,3.3],[44,12,8,3.3],[50,14,9,3.8],[58,16,10,4.3],[65,18,11,4.4],[75,20,12,4.9],[85,22,14,5.4],[95,25,14,5.4],[110,28,16,6.4],[130,32,18,7.4],[150,36,20,8.4],[170,40,22,9.4],[200,45,25,10.4],[230,50,28,11.4],[260,56,32,12.4],[290,63,32,12.4],[330,70,36,14.4]];
export function hubKey(diameterM){const row=keys.find(row=>diameterM*1000<=row[0]+1e-8);if(!row)throw Error('Потрібні власні розміри шпонкового паза для цього діаметра.');return {widthM:row[1]/1000,heightM:row[2]/1000,depthM:row[3]/1000};}
export function materialRequirement(p,{wormWheel=false}={}){
 if(wormWheel)return {material:'Бронза CAC502',treatment:'Без термообробки',hardness:'За сертифікатом заготовки',zone:'Увесь вінець',depth:'—'};
 if(p.drawingMaterial===1)return {material:'Сталь C45',treatment:'Нормалізація; ТВЧ боків і западин зубців',hardness:'50–60 HRC',zone:'Бокові поверхні та западини зубців',depth:mmText(p.drawingCaseDepth)+' мм до 450 HV'};
 if(p.drawingMaterial===2)return {material:'Сталь 42CrMo4 +QT',treatment:'Гартування та високий відпуск',hardness:'270–320 HBW',zone:'Увесь переріз',depth:'—'};
 return {material:'Сталь C45 +N',treatment:'Нормалізація',hardness:'170–210 HBW',zone:'Увесь переріз',depth:'—'};
}
function blankData(model,pair,id){
 const p=model.inputs,j=pair.stage,isPlanet=id==='planet',isRing=id==='ring',isWorm=id==='worm',isWheel=['wheel','ring'].includes(id),gear=isPlanet?{teeth:pair.planetTeeth,pitchRadiusM:p['module'+j]*pair.planetTeeth/2,tipRadiusM:p['module'+j]*(pair.planetTeeth+2)/2,rootRadiusM:p['module'+j]*(pair.planetTeeth-2.5)/2}:isWheel?pair.wheel:pair.pinion;
 const boreM=isRing?0:isPlanet?Math.max(.005,Math.floor(Math.min(p.intermediateShaftDiameter,p['module'+j]*(pair.planetTeeth-2.5)*.4)/.005)*.005):isWorm||!isWheel?(j===1?p.inputShaftDiameter:p.intermediateShaftDiameter):(j===p.stages?p.shaftDiameter:p.intermediateShaftDiameter),key=isRing||isPlanet||isWorm?null:hubKey(boreM),warnings=[];
 const minRoot=gear.rootRadiusM*(pair.type===1?1-pair.widthM/model.result.numbers['coneR_'+j]:1);
 if(key&&key.depthM+boreM/2>=minRoot)warnings.push('Паз виходить до западин: зменште отвір або ширину конічного вінця.');
 return {isPlanet,isRing,isWorm,isWheel,gear,boreM,key,warnings};
}
export function drawingConstructionWarnings(model){
 return [bearingMountingWarning(model.inputs),...gearAssembly(model).flatMap(pair=>(pair.type===3?['sun','planet','ring']:pair.type===2?['worm','wheel']:['pinion','wheel']).flatMap(id=>blankData(model,pair,id).warnings.map(message=>`Ступінь ${pair.stage}, ${id==='worm'?'черв’як':id==='pinion'||id==='sun'?'шестірня':'колесо'}: ${message}`)))].filter(Boolean);
}
export function partManufacturing(model,item){
 const p=model.inputs,r=model.result.numbers,{pair,part}=item,j=pair.stage,blank=blankData(model,pair,part.id),{isPlanet,isRing,isWorm,isWheel,gear,boreM,key}=blank,diameter=p['module'+j];
 const radialMax=Math.max(...part.verticesM.map(v=>Math.hypot(v[0],v[1]))),zmin=Math.min(...part.verticesM.map(v=>v[2])),zmax=Math.max(...part.verticesM.map(v=>v[2])),widthM=pair.widthM;
 const hub=p.drawingHub===1&&!isRing&&!isPlanet&&!isWorm,hubData=constructHub({enabled:hub,boreDiameterM:boreM,bodyStartM:zmin,bodyEndM:zmax,faceWidthM:widthM,diameterRatio:p.drawingHubRatio,extensionRatio:p.drawingHubExtension,side:pair.type===1?'back':'front'}),hubDiameterM=hubData.diameterM,hubExtensionM=hubData.extensionM,requirements=drawingRequirements(p),shaftMaterial=materials.find(m=>m.choice===p.shaftMaterial),material=isWorm&&shaftMaterial?{material:shaftMaterial.grade+' '+shaftMaterial.condition,treatment:'Стан заготовки '+shaftMaterial.condition,hardness:(shaftMaterial.hardness_basis==='range'?shaftMaterial.hardness_min_HB+'–'+shaftMaterial.hardness_max_HB:shaftMaterial.hardness_min_HB+' (типове)')+' HBW',zone:'За паспортом заготовки',depth:'—'}:materialRequirement(p,{wormWheel:pair.type===2&&isWheel});
 const data={...requirements,...material,...blank,pair,part,widthM,hubDiameterM,hubExtensionM,hubCenterZM:hubData.centerM,axialWidthM:pair.type===1?zmax-zmin:widthM,outerDiameterM:pair.type===0||pair.type===3&&!isRing?gear.tipRadiusM*2:radialMax*2,rootDiameterM:gear.rootRadiusM*2,pitchDiameterM:gear.pitchRadiusM*2,nominalTipDiameterM:gear.tipRadiusM*2,overallLengthM:(pair.type===1?zmax-zmin:widthM)+hubExtensionM,mountingDistanceM:pair.type===1?Math.abs(zmin-hubExtensionM):zmax+hubExtensionM,coneDistanceM:r['coneR_'+j],threadLengthM:p['wormLength'+j],shaftLengthM:j===1?p.inputShaftLength:p.intermediateShaftLength};
 data.axialPitchM=Math.PI*diameter/Math.cos(r['gamma_'+j]);
 const rows=[],row=(section,label,symbol,value)=>rows.push({section,label,symbol,value});
 row('Основні дані',pair.type===1?'Зовнішній модуль':'Нормальний модуль',pair.type===1?'mₑ':'mₙ',mmText(diameter));
 row('Основні дані',isWorm?'Число заходів':'Число зубців',isWorm?'z₁':'z',String(gear.teeth));row('Основні дані','Кут профілю',pair.type===1?'αₑ':'αₙ','20°');row('Основні дані','Коеф. зміщення','x','0');
 row('Основні дані',isWorm?'Довжина нарізаної частини':'Ширина зубчастого вінця',isWorm?'l₁':'b',mmText(isWorm?data.threadLengthM:widthM));
 if(pair.type===0){row('Основні дані','Кут нахилу','β',deg(pair.betaRad));row('Основні дані','Напрям зубців','—',pair.betaRad===0?'Прямі':isWheel?'Лівий':'Правий');row('Основні дані','Вихідна рейка','—','ISO 53 · A');}
 if(pair.type===3){row('Основні дані','Зачеплення','—',isRing?'Внутрішнє':'Зовнішнє');row('Основні дані','Вихідна рейка','—','ISO 53 · A');}
 if(pair.type===1){row('Основні дані','Кут ділильного конуса','δ',deg(r[(isWheel?'cone2_':'cone1_')+j]));row('Основні дані','Кут між осями','Σ',deg(pair.shaftAngleRad));row('Основні дані','Конусна відстань','Rₑ',mmText(r['coneR_'+j]));row('Основні дані','Напрям зубців','βₘ','0° · прямі');row('Основні дані','Від вершини до бази B','M',mmText(data.mountingDistanceM)+' ±0,05');}
 if(pair.type===2){row('Основні дані','Профіль / напрям','—','N · правий');row('Основні дані','Коеф. діаметра','q',formatNumber(p['wormDiameterFactor'+j]));row('Основні дані','Кут підйому','γ',deg(r['gamma_'+j]));row('Основні дані','Осьовий крок','pₓ',mmText(Math.PI*diameter/Math.cos(r['gamma_'+j])));row('Основні дані','Хід гвинтової лінії','p_z',mmText(Math.PI*diameter*p['wormStarts'+j]/Math.cos(r['gamma_'+j])));}
 const quality=pair.type===1?'ISO 17485':pair.type===2?'DIN 3974':'ISO 1328-1';row('Контроль','Ступінь точності','Q',requirements.grade+' · '+quality);
 const sn=Math.PI*diameter/2;row('Контроль',pair.type===1?'Товщина на зовн. конусі':'Норм. товщина зубця',pair.type===1?'sₑ':'sₙ',mmText(sn));row('Контроль','Відхилення товщини','Aₛ',`−${mmText(p.drawingToothReduction+.00001)}/−${mmText(p.drawingToothReduction-.00001)}`);
 row('Довідкові дані',pair.type===1?'Зовн. ділильний ⌀':'Ділильний діаметр',pair.type===1?'dₑ':'d',mmText(data.pitchDiameterM));row('Довідкові дані','Діаметр вершин',pair.type===1?'dₐₑ':'dₐ',mmText(data.nominalTipDiameterM));row('Довідкові дані','Діаметр западин',pair.type===1?'d_fₑ':'d_f',mmText(data.rootDiameterM));
 if(pair.type===2&&!isWorm){row('Довідкові дані','Найбільший діаметр','dₑ',mmText(data.outerDiameterM));row('Довідкові дані','Діаметр фрези / корона','d₀ / c',mmText(r['d1_'+j]+.0002)+' / 0,1');}
 row('Довідкові дані',isWorm?'Зубців колеса-пари':'Зубців / заходів пари','z_m',String(isWheel?pair.pinion.teeth:pair.wheel.teeth));row('Довідкові дані','Міжосьова відстань','a',pair.type===1?'Осі перетинаються':mmText(pair.centerDistanceM));
 if(pair.type===0||pair.type===3)row('Довідкові дані','Основний діаметр','d_b',mmText(data.pitchDiameterM*Math.cos(pair.type===0?gear.pressureAngleRad:Math.PI/9)));
 if(hub)row('Довідкові дані','Маточина: ⌀ / виступ','dₕ / lₕ',mmText(hubDiameterM)+' / '+mmText(hubExtensionM));
 return {...data,rows,qualityStandard:quality};
}
