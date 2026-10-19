import {constructionSnapshot,hardwareName} from './construction.js';
import {prepareConstruction} from './gear-projections.js';
import {VERSION,MODES} from './definitions.js';
import {bearings,chains,timingBelts,materials,bearingMountingWarning,driveBeltLabel} from './catalogues.js';
import {formatNumber as fmt} from './precision.js';
import {gearboxLabel,STAGE_TYPES,stageType} from './gearbox.js';
import {assemblyLayout,inclinedPlan,planProjection,assemblyProjections,draftingStyle,svgText as text} from './drafting.js';
import {housedAssemblyDrawing} from './assembly-sheet.js';
import {partSheets} from './part-drawings.js';
import {drawingTitleBlock} from './drawing-frame.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const support=(x,y)=>`<path class="draft-thin" d="M${x-10} ${y-8}h-6v16h6m20-16h6v16h-6"/>`;
export function driveScheme(model,{id='drive'}={}){
 const p=model.inputs,r=model.result.numbers,l=assemblyLayout(model),flex=model.mode!=='none',width=560,height=300;
 const radius=Math.max(...l.pairs.map(pair=>Math.max(pair.wheel.tipRadiusM,pair.wheel.rootRadiusM))),xmin=-Math.max(...l.pairs.map(pair=>pair.pinion.tipRadiusM)),xmax=l.centres.at(-1)+radius,L=Math.max(p.shaftSpan,l.spacing*p.stages+.1),s=Math.min((width-40)/(xmax-xmin),(height-85)/L),gx=60,gy=100;
 const shaftX=m=>gx+20+(m-xmin)*s,defaultInputX=shaftX(0),defaultOutputX=shaftX(l.centres.at(-1)),defaultShaftBottom=gy+60+L*s,shaftTop=gy+60;
 const inclined=l.pairs.some(pair=>pair.type===1||pair.type===2)?inclinedPlan(model,{width,height,labels:false,id:id+'-gearbox'}):null,outputX=inclined?gx+inclined.output[0]:defaultOutputX,outputY=inclined?gy+inclined.output[1]:shaftTop,inputX=inclined?gx+inclined.input[0]:defaultInputX,shaftBottom=inclined?gy+inclined.input[1]:defaultShaftBottom;
 const motorX=flex?(inputX>350?inputX-250:inputX+250):inputX,motorY=655,flexY=530;
 const shaft=(x,y1,y2)=>`<path class="draft-shaft" d="M${x} ${y1}V${y2}"/>`;
 const small=()=>text(30,735,'Кінематична схема у плані; без масштабу. Осі та зв’язки відповідають прийнятим ступеням.','font-size="14"');
 const leader=(key,point,y)=>`<path data-schematic-leader="${key}" class="draft-thin" d="M${point.join(' ')}H690V${y}H707"/><circle cx="${point[0]}" cy="${point[1]}" r="2" fill="currentColor"/>`;
 let flexible='';
 if(flex){
  const d1=model.mode==='belt'?p.beltD1:model.mode==='timing'?r.d_t1:r.d_c1,d2=model.mode==='belt'?p.beltD2:model.mode==='timing'?r.d_t2:r.d_c2;
  const t=12,r1=Math.min(55,d1*s/2),r2=Math.min(65,d2*s/2),chain=model.mode==='chain';
  flexible=`<g data-drive-flex="${model.mode}"><path class="draft-thin" ${chain?'stroke-dasharray="6 3"':''} d="M${Math.min(inputX-r2,motorX-r1)} ${flexY-t/2}H${Math.max(inputX+r2,motorX+r1)}V${flexY+t/2}H${Math.min(inputX-r2,motorX-r1)}Z"/><rect class="draft-outline" data-wheel-plane="perpendicular" x="${inputX-r2}" y="${flexY-t/2}" width="${2*r2}" height="${t}"/><rect class="draft-outline" data-wheel-plane="perpendicular" x="${motorX-r1}" y="${flexY-t/2}" width="${2*r1}" height="${t}"/>${leader('flex',[Math.max(inputX+r2,motorX+r1),flexY],515)}${text(720,515,esc(model.mode==='belt'?driveBeltLabel(p):MODES[model.mode]),'font-size="18"')}${text(720,540,`u = ${fmt(r.u_ext)}; η = ${fmt(r.eta_ext)}`,'font-size="16"')}</g>`;
 }
 const extension=inclined&&inclined.outputDirection[1]<0?Math.min(45,Math.max(0,(outputY-20)/-inclined.outputDirection[1])):45;
 const loadEnd=inclined?[outputX+inclined.outputDirection[0]*extension,outputY+inclined.outputDirection[1]*extension]:[outputX,26],loadAngle=inclined?-Math.atan2(inclined.outputDirection[0],inclined.outputDirection[1])*180/Math.PI:0;
 const loadHalfX=44*Math.abs(Math.cos(loadAngle*Math.PI/180))+15*Math.abs(Math.sin(loadAngle*Math.PI/180));
 const load=`<g data-drive-part="load"><path class="draft-shaft" d="M${outputX} ${outputY}L${loadEnd.join(' ')}"/><rect class="draft-outline" x="${loadEnd[0]-44}" y="${loadEnd[1]-15}" width="88" height="30" transform="rotate(${loadAngle} ${loadEnd.join(' ')})"/>${leader('load',[loadEnd[0]+loadHalfX,loadEnd[1]],58)}${text(720,58,'Робоча машина','font-size="18"')}${text(720,83,`T = ${fmt(r.T_out)} Н·м`,'font-size="16"')}${text(720,106,`n = ${fmt(r.n_out*60)} хв⁻¹`,'font-size="16"')}</g>`;
 const couplingY=(shaftBottom+(flex?flexY:motorY-34))/2;
 return `<svg xmlns="http://www.w3.org/2000/svg" class="scheme drive-scheme" data-drive-mode="${model.mode}" data-schematic="kinematic-plan" viewBox="0 0 1000 760" role="img" aria-label="Кінематична схема у плані: двигун, передача, редуктор, муфта та робоча машина" font-family="Arial" font-size="18" color="#17231b"><style>${draftingStyle}</style><g data-drive-part="gearbox" transform="translate(${gx} ${gy})">${inclined?inclined.svg:planProjection(model,{width,height,labels:false,id:id+'-gearbox'})}</g>${text(720,175,`${esc(gearboxLabel(p).split(' (')[0])} редуктор`,'font-size="17"')}${text(720,201,`${p.stages} ступ.; u = ${fmt(r.u_1*(p.stages===2?r.u_2:1))}`,'font-size="16"')}${text(720,225,`${fmt(r.n_0*60)} → ${fmt(r.n_out*60)} хв⁻¹`,'font-size="16"')}${l.pairs.map((pair,i)=>text(720,275+i*55,`Ступінь ${pair.stage}: ${STAGE_TYPES[pair.type]}`,'font-size="16"')+text(720,298+i*55,`u<tspan baseline-shift="sub" font-size="11">${pair.stage}</tspan> = ${fmt(pair.ratio)}`,'font-size="15"')).join('')}${shaft(inputX,shaftBottom,flex?flexY:motorY-34)}${support(inputX,shaftBottom+18)}<g data-drive-part="coupling"><rect class="draft-outline" x="${inputX-17}" y="${couplingY-15}" width="34" height="30"/><path class="draft-thin" d="M${inputX-12} ${couplingY+9}l24-18"/>${leader('coupling',[inputX+17,couplingY],422)}${text(720,422,'Муфта','font-size="18"')}</g>${flex?shaft(motorX,flexY,motorY-34):''}${support(motorX,motorY-55)}${flexible}<g data-drive-part="motor"><circle class="draft-outline" cx="${motorX}" cy="${motorY}" r="34"/>${text(motorX,motorY+9,'M','text-anchor="middle" font-size="29"')}${leader('motor',[motorX+34,motorY],640)}${text(720,640,'Двигун')}${text(720,665,`${fmt(p.motorPower/1000)} кВт; ${fmt(p.motorSpeed*60)} хв⁻¹`,'font-size="16"')}</g>${load}${small()}</svg>`;
}
function table(x,y,width,title,headers,rows,{rowHeight=7,font=3.5}={}){
 const cols=headers.map(h=>h[1]),sum=cols.reduce((a,b)=>a+b,0),xs=[x];for(const c of cols)xs.push(xs.at(-1)+width*c/sum);
 let out=`<g data-drawing-table="${esc(title)}">`+text(x,y-3,esc(title),'font-size="4.5"');const h=(rows.length+1)*rowHeight;
 out+=`<rect x="${x}" y="${y}" width="${width}" height="${h}" fill="white" stroke="black" stroke-width=".5"/>`;
 xs.slice(1,-1).forEach(cx=>out+=`<path d="M${cx} ${y}v${h}" fill="none" stroke="black" stroke-width=".25"/>`);
 [headers.map(h=>h[0]),...rows].forEach((row,i)=>{if(i)out+=`<path d="M${x} ${y+i*rowHeight}h${width}" fill="none" stroke="black" stroke-width=".25"/>`;row.forEach((value,j)=>out+=text(xs[j]+1.5,y+(i+.68)*rowHeight,esc(value),`font-size="${font}"`));});
 return out+'</g>';
}
function titleBlock(metadata,sheetCount=1,scale='За видами'){
 return drawingTitleBlock({x:651,y:534,title:(metadata.name||'Редуктор')+' · Складальний кресленик',designation:'ТМ-'+VERSION+'.01.00 СК',student:metadata.student,group:metadata.group,scale,sheet:1,sheets:sheetCount});
}
export function drawingItems(model){
 const p=model.inputs,l=assemblyLayout(model),b=bearings.find(b=>b.choice===p.bearingCatalogue),items=[],construction=constructionSnapshot(model);
 const shaftSize=(id,fallback)=>{const s=construction?.shafts.find(s=>s.id===id);return s?`⌀макс ${fmt(Math.max(...s.sections.map(q=>q.diameterM),...s.seats.filter(q=>q.integral).map(q=>q.outerDiameterM))*1000)} × ${fmt((s.sections.at(-1).endM-s.sections[0].startM)*1000)} мм`:fallback;};
 const add=(id,name,qty,note='',aliases=[])=>items.push({id,position:items.length+1,name,qty,note,aliases});
 add('motor','Двигун',1,`${fmt(p.motorPower/1000)} кВт / ${fmt(p.motorSpeed*60)} хв⁻¹`);
 if(model.mode!=='none'){add('flex-wheels',model.mode==='chain'?'Зірочки':'Шківи',2,MODES[model.mode]);add('flex-link',model.mode==='chain'?'Роликовий ланцюг':'Пас',model.mode==='belt'?model.result.numbers.N_b:1,model.mode==='chain'?(chains.find(c=>c.choice===p.chainCatalogue)?.designation||'Власний'):model.mode==='timing'?(timingBelts.find(b=>b.choice===p.timingCatalogue)?.designation||'Власний'):driveBeltLabel(p));}
 for(const pair of l.pairs){const id=`gear-${pair.stage}-`;if(pair.type===3){add(id+'sun',`Сонце, ступінь ${pair.stage}`,1,`z = ${pair.pinion.teeth}`);add(id+'planet',`Сателіт, ступінь ${pair.stage}`,pair.planetCount,`z = ${pair.planetTeeth}`);add(id+'ring',`Вінець, ступінь ${pair.stage}`,1,`z = ${pair.wheel.teeth}`);add(id+'carrier',`Водило, ступінь ${pair.stage}`,1,'Конструкція уточнюється');}else{add(id+(pair.type===2?'worm':'pinion'),`${pair.type===2?'Черв’як-вал':'Шестірня'}, ступінь ${pair.stage}`,1,`${pair.type===2?'Заходів':'z'} = ${pair.pinion.teeth}`+(pair.type===2?'; '+shaftSize(pair.stage===1?'input-shaft':'intermediate-shaft',''): ''),pair.type===2?[pair.stage===1?'input-shaft':'intermediate-shaft']:[]);add(id+'wheel',`Колесо, ступінь ${pair.stage}`,1,`z = ${pair.wheel.teeth}`);}}
 if(stageType(p,1)!==2)add('input-shaft','Вхідний вал',1,shaftSize('input-shaft',`⌀${fmt(p.inputShaftDiameter*1000)} × ${fmt(p.inputShaftLength*1000)} мм`));
 if(p.stages===2&&stageType(p,2)!==2)add('intermediate-shaft','Проміжний вал',1,shaftSize('intermediate-shaft',`⌀${fmt(p.intermediateShaftDiameter*1000)} × ${fmt(p.intermediateShaftLength*1000)} мм`));
 const material=materials.find(m=>m.choice===p.shaftMaterial);
 add('output-shaft','Вихідний вал',1,shaftSize('output-shaft',`⌀${fmt(p.shaftDiameter*1000)} мм`)+(material?'; '+material.grade+' '+material.condition:''));
 add('output-bearings','Опори вихідного вала',2,b?'SKF '+b.designation:'За власними даними',['output-shaft-bearing-A','output-shaft-bearing-B']);
 add('output-key','Вихідна шпонка',1,`${fmt(p.keyWidth*1000)}×${fmt(p.keyHeight*1000)}×${fmt(p.keyLength*1000)}; деталювання`,['output-shaft-drive-key']);
 add('output-coupling','Муфта вихідна',1,`Доп. T = ${fmt(p.couplingTorque)} Н·м`,['output-shaft-drive-hub']);
 for(const shaft of constructionSnapshot(model)?.shafts||[]){
  if(shaft.id!=='output-shaft')add(shaft.id+'-bearings','Опори · '+shaft.name,2,'SKF '+shaft.bearing.designation,[shaft.id+'-bearing-A',shaft.id+'-bearing-B']);
  for(const h of shaft.hardware)if(h.kind!=='bearing'&&!['output-shaft-drive-hub','output-shaft-drive-key'].includes(h.id))add(h.id,hardwareName(h),h.quantity,h.designation||`⌀${fmt(h.outerDiameterM*1000)} / ⌀${fmt(h.innerDiameterM*1000)} × ${fmt((h.endM-h.startM)*1000)} мм`);
 }
 add('housing','Корпус із кришкою',1,`Стінка ${fmt(p.housingWall*1000)} мм; навчальний`);
 add('oil-indicator','Покажчик рівня оливи',1,'Виконання уточнюється');
 add('service-plugs','Пробки наливу / зливу',2,'Різьба уточнюється');
 return items;
}
export function drawingBOM(model){return drawingItems(model).map(item=>[item.position,item.name,item.qty,item.note]);}
export function transmissionDrawing(model,{idPrefix='sheet',metadata={},projectionSVG=null,geometry=[]}={}){
 if(geometry.length)prepareConstruction(model,geometry);
 const mounting=bearingMountingWarning(model.inputs);if(mounting)throw new Error(mounting+' Перед кресленням прийміть сумісний підшипник.');
 const p=model.inputs,r=model.result.numbers,rows=[['Тип редуктора',gearboxLabel(p).split(' (')[0]],['Навантаження',`${fmt(p.requiredTorque)} Н·м / ${fmt(p.requiredSpeed*60)} хв⁻¹`],['Двигун',`${fmt(p.motorPower/1000)} кВт / ${fmt(p.motorSpeed*60)} хв⁻¹`],['Вихід',`${fmt(r.T_out)} Н·м / ${fmt(r.n_out*60)} хв⁻¹`],['Загальний ККД',fmt(r.eta_total)]];
 for(const pair of assemblyLayout(model).pairs){const j=pair.stage;rows.push([`Ступінь ${j}`,STAGE_TYPES[pair.type]],[`m${j}; b${j}`,`${fmt(p['module'+j]*1000)}; ${fmt(pair.widthM*1000)} мм`],['Зубці / заходи',`${pair.pinion.teeth} / ${pair.wheel.teeth}`],[`a${j}`,`${fmt(pair.centerDistanceM*1000)} мм`]);
  if(pair.type===0)rows.push([`β${j}; αₙ`,`${fmt(pair.betaRad*180/Math.PI)}°; 20°`]);
  if(pair.type===1)rows.push(['Σ; δ₁; δ₂',`${fmt(pair.shaftAngleRad*180/Math.PI)}°; ${fmt(r['cone1_'+j]*180/Math.PI)}°; ${fmt(r['cone2_'+j]*180/Math.PI)}°`],['Конусна відстань',`${fmt(r['coneR_'+j]*1000)} мм`]);
  if(pair.type===2)rows.push(['q; γ',`${p['wormDiameterFactor'+j]}; ${fmt(r['gamma_'+j]*180/Math.PI)}°`],['Довжина черв’яка',`${fmt(p['wormLength'+j]*1000)} мм`]);
  if(pair.type===3)rows.push(['Сателіти: z; N',`${pair.planetTeeth}; ${pair.planetCount}`],['Вінець',`Нерухомий; обід ${fmt(p['planetRimThickness'+j]*1000)} мм`]);
 }

 const bom=drawingBOM(model),items=drawingItems(model),housed=geometry.length?housedAssemblyDrawing(model,geometry,items,{id:idPrefix+'-case'}):null;
 const projections=housed?housed.svg:(projectionSVG||assemblyProjections(model,{animate:false,id:idPrefix+'-views'})).replace('<svg ', '<svg x="30" y="32" width="565" height="377" ');
 const byId=new Map(items.map(item=>[item.id,item.position]));
 const flow=[['Двигун, поз. '+byId.get('motor'),`${fmt(p.motorPower/1000)} кВт; ${fmt(p.motorSpeed*60)} хв⁻¹`],...(model.mode==='none'?[]:[[model.mode==='belt'?driveBeltLabel(p):MODES[model.mode],`u = ${fmt(r.u_ext)}; η = ${fmt(r.eta_ext)}`]]),['Редуктор',`${p.stages} ступ.; u = ${fmt(r.u_1*(p.stages===2?r.u_2:1))}`],['Робоча машина',`${fmt(r.T_out)} Н·м; ${fmt(r.n_out*60)} хв⁻¹`]];
 const requirements=[['1','Розміри корпусу — навчальні конструктивні дані; стінки показано в умовних розрізах.'],['2',`Зазор ${fmt(p.housingClearance*1000)} мм; стінка ${fmt(p.housingWall*1000)} мм; основа додатково ${fmt(p.housingBase*1000)} мм.`],['3',`Рівень оливи hₒ = ${fmt(p.oilLevelHeight*1000)} мм від дна для показаного монтажного положення.`],['4','Опори: одна фіксуюча, друга плаваюча; торцеві пластини M10 та знімні втулки.'],['5','Манжети працюють по втулках; розміри кришок і ущільнень — навчальні.'],['6','Позиції на виносках відповідають специфікації; деталювання експортується окремим документом A1.']];
 if(housed)rows.push(['Корпус, без лап',housed.dimensionsM.map(v=>fmt(v*1000)).join(' × ')+' мм']);

 return `<svg xmlns="http://www.w3.org/2000/svg" class="transmission-drawing" data-drawing-sheet="A1" width="841mm" height="594mm" viewBox="0 0 841 594" role="img" aria-label="A1: корпус редуктора в розрізах, позиційні виноски, рівень оливи, таблиці та специфікація" font-family="Arial" font-size="3.5" color="black"><rect width="841" height="594" fill="white"/><rect x="20" y="5" width="816" height="584" fill="none" stroke="black" stroke-width=".7"/>${text(30,20,`МЕХАНІЧНИЙ ПРИВОД · ${esc(gearboxLabel(p))}`,'font-size="6"')}${projections}${table(605,32,220,'Основні параметри',[['Показник',1],['Значення',1]],rows)}${text(605,32+(rows.length+1)*7+18,'Специфікація, фіксація та складання — аркуш 2','font-size="4"')}${table(30,490,195,'Параметри ланок привода',[['Вузол',1],['Прийняті дані',1.1]],flow,{rowHeight:12,font:3.5})}${table(240,490,355,'Технічні вимоги та прийняті розміри',[['№',.1],['Вимога',2]],requirements,{rowHeight:12,font:3.5})}${titleBlock(metadata,2,'За видами')}${text(30,580,'Формат A1 · 841 × 594 мм · корпус і мащення: прийняті навчальні розміри','font-size="4"')}</svg>`;
}
export function constructionAssemblySheet(model,{metadata={}}={}){
 const items=drawingItems(model),data=constructionSnapshot(model),positions=new Map(items.flatMap(i=>[[i.id,i.position],...(i.aliases||[]).map(a=>[a,i.position])])),rows=items.map(i=>[i.position,i.name,i.qty,i.note]);
 let out=`<svg xmlns="http://www.w3.org/2000/svg" class="transmission-drawing" data-drawing-sheet="A1-construction" width="841mm" height="594mm" viewBox="0 0 841 594" font-family="Arial" font-size="3.5"><rect width="841" height="594" fill="white"/><rect x="20" y="5" width="816" height="584" fill="none" stroke="black" stroke-width=".7"/><metadata data-bom-items="true">${esc(JSON.stringify(items))}</metadata>${text(30,20,'СПЕЦИФІКАЦІЯ · ОСЬОВА ФІКСАЦІЯ · СКЛАДАННЯ','font-size="6"')}`;
 const half=Math.ceil(rows.length/2);for(let k=0;k<2;k++)out+=table(30+k*400,32,390,'Специфікація · '+(k+1),[['Поз.',.16],['Найменування',1.45],['К-ть',.17],['Розміри / стандарт',1.3]],rows.slice(k*half,(k+1)*half),{rowHeight:7,font:3.2});
 let yy=48+(half+1)*7;
 for(const shaft of data?.shafts||[]){out+=text(30,yy,shaft.name+': опора '+shaft.bearing.locatingEnd+' фіксує; '+shaft.bearing.floatingEnd+' плаває, g = '+fmt(shaft.bearing.floatingClearanceM*1000)+' мм','font-size="4"');yy+=8;
  const verbs=['Маточини зі шпонками, втулки та бурт','Опори: монтаж тільки через внутрішні кільця','Ущільнювальна втулка, муфта, торцеві пластини та болти з шайбами','Кришки; манжета губкою до оливи; перевірка плаваючої опори'];
  shaft.instructions.forEach((step,i)=>{const refs=[...new Set(step.parts.map(id=>positions.get(id)).filter(Boolean))].join(', ');out+=text(35,yy,(i+1)+'. '+verbs[i]+' · поз. '+refs,'font-size="3.5"');yy+=7;});yy+=4;
 }
 out+=text(30,yy+2,'Перед роботою: перевірити проходи, зазори, осьову фіксацію та вільне обертання; залити оливу до покажчика.','font-size="3.5"');
 out+=text(30,yy+9,'Навчальні кришки/манжети — добір за ISO 6194; затягування, захист від відкручування та герметизація уточнюються за виробом.','font-size="3.5"');
 out+=drawingTitleBlock({x:651,y:534,title:'Специфікація та складання',designation:'ТМ-'+VERSION+'.01.00 СК',student:metadata.student,group:metadata.group,scale:'—',sheet:2,sheets:2});return out+'</svg>';
}
export function drawingHTML(model,options={}){
 const parts=options.sheet==='parts',sheets=parts?partSheets(model,options):[transmissionDrawing(model,options),constructionAssemblySheet(model,options)];
 return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>Технічна механіка — ${parts?'деталі':'редуктор'} A1</title><style>@page{size:841mm 594mm;margin:0}html,body{margin:0;padding:0;background:white}.transmission-drawing{display:block;width:841mm;height:594mm;break-after:page}.transmission-drawing:last-child{break-after:auto}svg{overflow:visible}@media screen{body{max-width:100vw}.transmission-drawing{width:100%;height:auto}}</style></head><body>${sheets.join('')}</body></html>`;
}
