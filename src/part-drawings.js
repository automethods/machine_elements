import {shaftOutline} from './drawing-contours.js';
import {constructionSnapshot} from './construction.js';
import {constructedShaftDetail,hardwareDetail} from './construction-drawings.js';
import {prepareConstruction} from './gear-projections.js';
import {formatNumber as fmt} from './precision.js';
import {materials,bearingMountingWarning} from './catalogues.js';
import {gearAssembly} from './gear-geometry.js';
import {stageType} from './gearbox.js';
import {drawingTitleBlock,datumMark,toleranceFrame,roughnessMark,generalRoughness} from './drawing-frame.js';
import {partManufacturing,drawingRequirements,fitDimension,fitDeviations,mmText} from './manufacturing.js';
import {linearDimension} from './drawing-dimensions.js';

const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(x,y,s,attrs='')=>`<text x="${x}" y="${y}" ${attrs}>${esc(s)}</text>`;
export const fitScale=limit=>[5,2,1,.5,.2,.1,.05,.02,.01,.005,.002,.001].find(s=>s<=limit)||limit;
export const scaleLabel=s=>s>=1?fmt(s)+':1':'1:'+fmt(1/s);
const path=d=>`<path d="${d}" fill="none" stroke="black" stroke-width=".35"/>`;
const dim=(x1,x2,y,label,id,fromY)=>linearDimension({p1:[x1,Array.isArray(fromY)?fromY[0]:fromY],p2:[x2,Array.isArray(fromY)?fromY[1]:fromY],at:y,label,id,labelAt:(x1+x2)/2});
const verticalDimension=(x,y1,y2,label,id,fromX)=>linearDimension({p1:[Array.isArray(fromX)?fromX[0]:fromX,y1],p2:[Array.isArray(fromX)?fromX[1]:fromX,y2],at:x,label,id,vertical:true});
export function drawingFrame({x=0,y=0,width=420,height=297,title,number,student='',scale='—',material='Не задано',sheet='',sheets=1}){
 const tx=x+width-190,ty=y+height-60;
 return `<g data-part-frame="${number}" data-format="${width===210?'A4':'A3'}"><rect x="${x+20}" y="${y+5}" width="${width-25}" height="${height-10}" fill="none" stroke="black" stroke-width=".5"/>${drawingTitleBlock({x:tx,y:ty,title,designation:'ТМ-'+number,student,material,scale,sheet,sheets})}${text(x+23,y+13,title,'font-size="4.5"')}</g>`;
}

// All axial coordinates are measured from the centre of bearing A. The wheel
// is at a_s, not at an invented shoulder. Construction dimensions stay editable.
export function outputShaftSections(p){
 const a=-p.journalLength/2,b=p.journalLength/2,c=p.shaftSpan-p.journalLength/2,d=p.shaftSpan+p.journalLength/2;
 return [{start:a,end:b,diameter:p.journalDiameter},{start:b,end:c,diameter:p.shaftDiameter},{start:c,end:d,diameter:p.journalDiameter},{start:d,end:d+p.couplingSeatLength,diameter:p.couplingSeatDiameter}];
}
export function shaftDetail(model,{x=0,y=0,width=420,height=297,metadata={}}={}){
 const constructed=constructionSnapshot(model)?.shafts.find(s=>s.id==='output-shaft');if(constructed)return constructedShaftDetail(model,constructed,{x,y,width,height,metadata});
 const mounting=bearingMountingWarning(model.inputs);if(mounting)throw new Error(mounting+' Перед кресленням прийміть сумісний підшипник.');
 const p=model.inputs,sections=outputShaftSections(p),left=sections[0].start,right=sections.at(-1).end,available=width-75,scale=fitScale(available/((right-left)*1000)),ox=x+37-left*1000*scale,cy=y+103,X=v=>ox+v*1000*scale,R=v=>v*500*scale;
 const material=materials.find(m=>m.choice===p.shaftMaterial),points=[];
 sections.forEach(s=>points.push([X(s.start),cy-R(s.diameter)],[X(s.end),cy-R(s.diameter)]));
 [...sections].reverse().forEach(s=>points.push([X(s.end),cy+R(s.diameter)],[X(s.start),cy+R(s.diameter)]));
 let out=`<g data-part="output-shaft" data-physical-length-m="${right-left}">`+drawingFrame({x,y,width,height,title:'Вал вихідний',number:'02.01',student:metadata.student,scale:scaleLabel(scale),material:material?material.grade+' '+material.condition:'Властивості задано вручну'});
 out+=`<path d="${shaftOutline(points,p.shaftFillet*1000*scale,p.shaftChamfer*1000*scale)}" fill="white" stroke="black" stroke-width=".6"/>${path(`M${X(left)-8} ${cy}H${X(right)+8}`).replace('stroke-width=".35"','stroke-width=".2" stroke-dasharray="8 2 1 2"')}`;
 const cut=(start,length,keyWidth,id)=>`<rect data-keyway="${id}" x="${X(start)}" y="${cy-R(keyWidth)}" width="${length*1000*scale}" height="${keyWidth*1000*scale}" rx="${R(keyWidth)}" fill="none" stroke="black" stroke-width=".35"/>`;
 out+=cut(p.gearPosition-p.gearKeywayLength/2,p.gearKeywayLength,p.gearKeywayWidth,'wheel');
 out+=cut(sections.at(-1).start+p.couplingKeywayStart,p.keyLength,p.keyWidth,'coupling');
 const req=drawingRequirements(p);
 sections.forEach((s,i)=>{const x1=X(s.start),x2=X(s.end),radius=R(s.diameter),dx=i===0?X(left)-10:i===3?X(right)+10:i===1?x1+(x2-x1)*.25:(x1+x2)/2;
  out+=dim(x1,x2,y+146,fmt((s.end-s.start)*1000),'length-'+i,cy+radius);
  out+=verticalDimension(dx,cy-radius,cy+radius,fitDimension(s.diameter,i===0||i===2?'k6':i===3?'h6':req.shaftZone),'shaft-diameter-'+i,i===0?x1:i===3?x2:dx);
 });
 out+=dim(X(left),X(right),y+163,fmt((right-left)*1000),'overall',[cy+R(sections[0].diameter),cy+R(sections.at(-1).diameter)]);
 out+=dim(X(0),X(p.shaftSpan),y+181,`A—B = ${fmt(p.shaftSpan*1000)}`,'bearing-centres',cy+R(p.journalDiameter));
 out+=dim(X(0),X(p.gearPosition),y+196,`a = ${fmt(p.gearPosition*1000)}`,'wheel-position',[cy+R(p.journalDiameter),cy+R(p.shaftDiameter)]);
 for(const [v,label] of [[0,'A'],[p.shaftSpan,'B'],[p.gearPosition,'Колесо']])out+=path(`M${X(v)} ${cy-35}v70`).replace('stroke-width=".35"','stroke-width=".2" stroke-dasharray="4 2"')+text(X(v)+(label!=='A'?8:0),cy-39,label,`text-anchor="${label!=='A'?'start':'middle'}" font-size="3.5"`);
 // Detail of the keyway section at the coupling seat, at an independent scale.
 const ex=x+width-55,ey=y+50,sectionScale=fitScale(40/(p.couplingSeatDiameter*1000)),er=p.couplingSeatDiameter*500*sectionScale,depth=p.keywayDepth*1000*sectionScale,kw=p.keyWidth*1000*sectionScale,arcY=ey-Math.sqrt(Math.max(0,er*er-kw*kw/4));
 out+=`<g data-section="keyway">${path(`M${ex-kw/2} ${arcY}A${er} ${er} 0 1 0 ${ex+kw/2} ${arcY}L${ex+kw/2} ${ey-er+depth}H${ex-kw/2}Z`)}${dim(ex-kw/2,ex+kw/2,ey-er-9,fmt(p.keyWidth*1000),'keyway-width',arcY)}${verticalDimension(ex+er+8,ey-er+depth,ey+er,fmt((p.couplingSeatDiameter-p.keywayDepth)*1000),'keyway-remaining-height',[ex+kw/2,ex])}${text(ex,y+11,'Переріз паза · '+scaleLabel(sectionScale),'text-anchor="middle" font-size="3.5"')}</g>`;
 out+=datumMark(X(0),cy+R(p.journalDiameter),'A',0,7)+datumMark(X(p.shaftSpan),cy+R(p.journalDiameter),'B',0,7);
 out+=toleranceFrame(x+140,y+43,'runout',mmText(req.runoutM),'A-B',{to:[X(p.gearPosition),cy-R(p.shaftDiameter)],normal:[0,-1],port:'bottom'});
 out+=generalRoughness({x,y,width,height,ra:req.generalRa})+roughnessMark(x+45,y+61,req.boreRa,{surface:'journal',to:[X(0),cy-R(p.journalDiameter)],normal:[0,-1]});
 out+=text(x+25,y+211,`Спільна база A–B — осі шийок. Биття посадки колеса ≤ ${mmText(req.runoutM)} мм. Ra шийок ${fmt(req.boreRa)}; пазів ${fmt(req.generalRa)} мкм.`,'font-size="3.5"');
 out+=text(x+25,y+219,`Галтелі R${fmt(p.shaftFillet*1000)}; фаски ${fmt(p.shaftChamfer*1000)} × 45°. Неуказані лінійні ±0,1 мм; кутові ±0,5°.`,'font-size="3.5"');
 out+=text(x+25,y+227,`Паз колеса ${fmt(p.gearKeywayWidth*1000)} × ${fmt(p.gearKeywayLength*1000)}; паз муфти ${fmt(p.keyWidth*1000)} × ${fmt(p.keyLength*1000)}; t = ${fmt(p.keywayDepth*1000)}; відступ ${fmt(p.couplingKeywayStart*1000)}.`,'font-size="3.5"');
 return out+'</g>';
}
export function shaftBlankDetail(model,{x=0,y=0,width=420,height=297,shaft='input',metadata={}}={}){
 const constructed=constructionSnapshot(model)?.shafts.find(s=>s.id===shaft+'-shaft');if(constructed)return constructedShaftDetail(model,constructed,{x,y,width,height,metadata});
 const p=model.inputs,req=drawingRequirements(p),material=materials.find(m=>m.choice===p.shaftMaterial),intermediate=shaft==='intermediate',name=intermediate?'Вал проміжний — заготовка':'Вал вхідний — заготовка',d=intermediate?p.intermediateShaftDiameter:p.inputShaftDiameter,l=intermediate?p.intermediateShaftLength:p.inputShaftLength,scale=fitScale(300/(l*1000)),x1=x+45,x2=x1+l*1000*scale,yy=y+95,r=d*500*scale;
 return `<g data-part="${shaft}-shaft">${drawingFrame({x,y,width,height,title:name,number:intermediate?'02.02Б':'02.02А',student:metadata.student,scale:scaleLabel(scale),material:material?material.grade+' '+material.condition:'Матеріал не задано'})}<rect x="${x1}" y="${yy-r}" width="${l*1000*scale}" height="${2*r}" fill="white" stroke="black" stroke-width=".5"/>${path(`M${x1-5} ${yy}H${x2+5}`).replace('stroke-width=".35"','stroke-width=".2" stroke-dasharray="8 2 1 2"')}${dim(x1,x2,yy+r+15,mmText(l)+' ±0,1','length',yy+r)}${verticalDimension(x1-10,yy-r,yy+r,fitDimension(d,req.shaftZone),'blank-diameter',x1)}${generalRoughness({x,y,width,height,ra:req.generalRa})}${datumMark((x1+x2)/2,yy-r,'A',0,-18)}${text(x+25,y+188,'Показано циліндричну заготовку, а не остаточний вал з уступами.','font-size="3.5"')}${text(x+25,y+203,'Пази, опори й осьову фіксацію призначити при конструюванні.','font-size="3.5"')}</g>`;
}

// Project actual local BOSL2 surfaces. Weld vertices before finding silhouettes
// so neither triangulation diagonals nor invented tooth outlines enter drawings.
export function localPartProjection(part,axes=[0,1]){
 const verts=[],map=new Map(),remap=part.verticesM.map(v=>{const key=v.map(n=>Math.round(n*1e9)).join(',');if(!map.has(key)){map.set(key,verts.length);verts.push(v);}return map.get(key);}),edges=new Map(),depth=[0,1,2].find(n=>!axes.includes(n));
 for(const triangle of part.triangles){const ids=triangle.map(i=>remap[i]),[a,b,c]=ids.map(i=>verts[i]),u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n);if(!length)continue;n.forEach((v,i)=>n[i]=v/length);for(let i=0;i<3;i++){const aa=ids[i],bb=ids[(i+1)%3],key=aa<bb?aa+','+bb:bb+','+aa;if(!edges.has(key))edges.set(key,{a:aa,b:bb,n:[]});edges.get(key).n.push(n);}}
 let d='';for(const e of edges.values()){const front=e.n.some(n=>n[depth]>1e-8),back=e.n.some(n=>n[depth]<=1e-8),crease=e.n.length===1||e.n.length>1&&e.n[0].reduce((s,n,i)=>s+n*e.n[1][i],0)<.87;if(front&&(back||crease)){const q=i=>[verts[i][axes[0]]*1000,-verts[i][axes[1]]*1000].map(n=>n.toFixed(3)).join(' ');d+='M'+q(e.a)+'L'+q(e.b);}}
 const coords=verts.map(v=>[v[axes[0]]*1000,-v[axes[1]]*1000]),min=axes.map((_,i)=>Math.min(...coords.map(q=>q[i]))),max=axes.map((_,i)=>Math.max(...coords.map(q=>q[i])));
 return {d,min,max};
}
export function gearPartDetails(model,geometry=[]){
 const pairs=gearAssembly(model),parts=[];
 pairs.forEach((pair,i)=>{const packet=geometry[i];if(!packet)return;for(const part of packet.outputs.parts){const names={pinion:'Шестірня',wheel:'Колесо',worm:'Черв’як-вал',sun:'Сонячне колесо',planet:'Сателіт',ring:'Вінець'};parts.push({part,pair,name:names[part.id]||part.id,request:packet.inputs});}});return parts;
}
function parameterTable(x,y,rows){
 const w=110,rowHeight=7,sections=[];let height=7,out='';
 for(const row of rows){if(sections.at(-1)!==row.section){sections.push(row.section);out+=`<path d="M${x} ${y+height}h${w}" stroke="black" stroke-width=".7"/>`;}
  const pieces=row.symbol.split('_'),symbol=pieces.length===2?`<text x="${x+59}" y="${y+height+4.7}" text-anchor="middle" font-size="3.5">${esc(pieces[0])}<tspan baseline-shift="sub" font-size="2.5">${esc(pieces[1])}</tspan></text>`:text(x+59,y+height+4.7,row.symbol,'text-anchor="middle" font-size="3.5"');
  out+=`<g data-parameter="${esc(row.symbol)}" data-parameter-section="${row.section}"><rect x="${x}" y="${y+height}" width="${w}" height="${rowHeight}" fill="white" stroke="black" stroke-width=".2"/>${path(`M${x+53} ${y+height}v${rowHeight}m12 -${rowHeight}v${rowHeight}`)}${text(x+1.5,y+height+4.7,row.label,'font-size="3.5"')}${symbol}${text(x+66.5,y+height+4.7,row.value,'font-size="3.5"')}</g>`;height+=rowHeight;
 }
 return `<g data-gear-parameters="true" data-table-bounds="${[x,y,w,height].join(',')}"><rect x="${x}" y="${y}" width="${w}" height="7" fill="white" stroke="black" stroke-width=".5"/>${text(x+2,y+4.7,'Параметри зубчастого вінця · мм','font-size="3"')}${out}</g>`;
}
function gearSection(spec,{x,y,scale,id}){
 const {isWorm,isRing,boreM,hubDiameterM,hubExtensionM,outerDiameterM,rootDiameterM,axialWidthM,shaftLengthM,threadLengthM}=spec,mm=v=>v*1000*scale,cy=y,L=isWorm?threadLengthM:axialWidthM+hubExtensionM,x1=x-mm(L)/2,x2=x+mm(L)/2,bodyEnd=x1+mm(axialWidthM),R=mm(outerDiameterM)/2,r=mm(boreM)/2,hr=mm(hubDiameterM)/2,hatch=id+'-section';
 let out=`<g data-section="gear-axial"><defs><pattern id="${hatch}" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M0 3L3 0M-1 1L1 -1M2 4L4 2" stroke="black" stroke-width=".18"/></pattern></defs>`;
 if(isWorm){
  const a=x-mm(threadLengthM)/2,b=x+mm(threadLengthM)/2,sr=mm(rootDiameterM)/2;
  out+=`<rect x="${x1}" y="${cy-sr}" width="${mm(L)}" height="${sr*2}" fill="white" stroke="black" stroke-width=".5"/><rect x="${a}" y="${cy-R}" width="${mm(threadLengthM)}" height="${2*R}" fill="white" stroke="black" stroke-width=".5"/>`;
  // Conventional thread lines; lead and normal profile are specified in the table.
  const spacing=Math.max(.5,mm(spec.axialPitchM));for(let xx=a;xx<b;xx+=spacing)out+=path(`M${xx} ${cy-R}L${Math.min(b,xx+spacing*1.8)} ${cy+R}`);
  out+=path(`M${a} ${cy-mm(rootDiameterM)/2}H${b}M${a} ${cy+mm(rootDiameterM)/2}H${b}`);
  out+=dim(a,b,cy+R+9,fmt(threadLengthM*1000)+' −0,1','thread-length',cy+R);
 }else{
  const small=spec.pair.type===1?R*(1-spec.widthM/spec.coneDistanceM):R;
  const top=`M${x1} ${cy-small}L${bodyEnd} ${cy-R}`+(hubExtensionM?`V${cy-hr}H${x2}V${cy+hr}H${bodyEnd}V${cy+R}`:`V${cy+R}`)+`L${x1} ${cy+small}Z`;
  const holeRadius=isRing?mm(rootDiameterM)/2:r,hole=`M${x1} ${cy-holeRadius}H${x2}V${cy+holeRadius}H${x1}Z`;
  out+=`<path d="${top}${hole}" fill="url(#${hatch})" fill-rule="evenodd" stroke="black" stroke-width=".5"/>`;
  if(spec.key)out+=`<rect x="${x1}" y="${cy-r-mm(spec.key.depthM)}" width="${mm(L)}" height="${mm(spec.key.depthM)}" fill="white" stroke="black" stroke-width=".3"/>`;
  const rootR=mm(rootDiameterM)/2;out+=path(`M${x1} ${cy-rootR}H${bodyEnd}M${x1} ${cy+rootR}H${bodyEnd}`);
  out+=dim(x1,bodyEnd,cy+R+9,fmt(axialWidthM*1000)+' −0,1','face-width',cy+R);
  if(hubExtensionM)out+=verticalDimension(x2+14,cy-hr,cy+hr,'⌀'+fmt(hubDiameterM*1000)+' ±0,1','hub-diameter',x2);
 }
 out+=path(`M${x1-5} ${cy}H${x2+5}`).replace('stroke-width=".35"','stroke-width=".2" stroke-dasharray="8 2 1 2"');
 if(!isWorm)out+=dim(x1,x2,cy+R+21,fmt(L*1000)+' ±0,1','overall-length',[cy+(isWorm?r:R),cy+(hubExtensionM?hr:isWorm?r:R)]);
 const faceOuter=isWorm?r:hubExtensionM?hr:R,faceInner=isWorm?0:isRing?mm(rootDiameterM)/2:r,runoutX=isWorm?x:hubExtensionM?(bodyEnd+x2)/2:(x1+bodyEnd)/2,small=spec.pair.type===1?R*(1-spec.widthM/spec.coneDistanceM):R,runoutRadius=hubExtensionM?hr:isWorm?R:(small+R)/2;
 const runout={to:[runoutX,cy-runoutRadius],normal:!hubExtensionM&&!isWorm&&spec.pair.type===1?[-(R-small),-(bodyEnd-x1)]:[0,-1]},face={to:[x2,cy+(faceInner+faceOuter)/2],normal:[1,0]},finish=isWorm?{to:[(x1+x-mm(threadLengthM)/2)/2,cy+r],normal:[0,1]}:isRing?{to:[x1+(bodyEnd-x1)/4,cy-R],normal:[0,-1],via:[[x1-8,cy-R-5]]}:{to:[(x1+x2)/2,cy+r],normal:[0,-1],reach:Math.min(5,r/2),via:[[x1-8,cy+r-Math.min(5,r/2)]]};
 return {svg:out+'</g>',x1,x2,bodyEnd:isWorm?x2:bodyEnd,R,r,cy,faceInner,faceOuter,runout,face,finish};
}
export function gearPartDetail(model,item,{x,y,width=420,height=297,index=0,metadata={}}){
 if(!item)return '';
 const {part,pair,name}=item,p=model.inputs,spec={...partManufacturing(model,item),...(part.id==='worm'?{boreM:pair.pinion.rootRadiusM*2,shaftLengthM:model.inputs['wormLength'+pair.stage]}:{})},front=localPartProjection(part),length=spec.isWorm?spec.shaftLengthM:spec.overallLengthM,commonScale=fitScale(Math.min(125/(spec.outerDiameterM*1000),60/(length*1000))),scale=spec.isWorm?fitScale(60/(spec.outerDiameterM*1000)):commonScale,sectionScale=spec.isWorm?fitScale(Math.min(220/(length*1000),60/(spec.outerDiameterM*1000))):commonScale,cx=x+(spec.isWorm?100:110),cy=y+(spec.isWorm?75:112),R=spec.outerDiameterM*500*scale,boreR=spec.boreM*500*scale,id=`detail-${pair.stage}-${part.id}-${index}`;
 let out=`<g data-part="gear-${pair.stage}-${part.id}" data-family="${pair.family}" data-nominal-source="accepted-model"><title>${esc(name)}: розміри та навчальні вимоги виготовлення</title>`+drawingFrame({x,y,width,height,title:`${name}${spec.isWorm?' · нарізана ділянка':''}, ступінь ${pair.stage}`,number:'02.0'+(index+3),student:metadata.student,scale:scaleLabel(sectionScale),material:spec.material,...(spec.isWorm?{sheet:2,sheets:2}:{})});
 const frontPath=spec.isWorm?`<g data-conventional="worm-end"><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="black" stroke-width=".5"/><circle cx="${cx}" cy="${cy}" r="${spec.rootDiameterM*500*scale}" fill="none" stroke="black" stroke-width=".25"/><circle cx="${cx}" cy="${cy}" r="${spec.pitchDiameterM*500*scale}" fill="none" stroke="black" stroke-width=".2" stroke-dasharray="8 2 1 2"/></g>`:`<path d="${front.d}" transform="translate(${cx} ${cy}) scale(${scale})" fill="none" stroke="black" stroke-width="${.25/scale}"/>`;
 out+=`<g data-part-view="front" data-view-scale="${scale}">${frontPath}<path d="M${cx-R-4} ${cy}H${cx+R+4}M${cx} ${cy-R-4}V${cy+R+4}" stroke="black" stroke-width=".18" stroke-dasharray="8 2 1 2"/>`;
 if(!spec.isRing&&!spec.isWorm){out+=`<circle cx="${cx}" cy="${cy}" r="${boreR}" fill="white" stroke="black" stroke-width=".4"/>`;if(spec.key){const kw=spec.key.widthM*1000*scale,depth=spec.key.depthM*1000*scale;out+=`<rect x="${cx-kw/2}" y="${cy-boreR-depth}" width="${kw}" height="${depth+boreR-Math.sqrt(Math.max(0,boreR*boreR-kw*kw/4))}" fill="white" stroke="black" stroke-width=".3"/>`;}}
 if(spec.hubDiameterM)out+=`<circle cx="${cx}" cy="${cy}" r="${spec.hubDiameterM*500*scale}" fill="none" stroke="black" stroke-width=".3"/>`;
 out+='</g>';
 if(!spec.isRing)out+=verticalDimension(x+35,cy-R,cy+R,'⌀'+fmt(spec.outerDiameterM*1000)+' ±0,1','tip-diameter',cx);
 const fitLabel=spec.isRing?(spec.outerDiameterM<=.5?fitDimension(spec.outerDiameterM,'h6'):'⌀'+fmt(spec.outerDiameterM*1000)+' h6'):(spec.isWorm?'⌀'+mmText(spec.rootDiameterM):fitDimension(spec.boreM,'H7')),fitRadius=spec.isRing?R:boreR;
 out+=linearDimension({p1:[cx-fitRadius,cy],p2:[cx+fitRadius,cy],at:cy-R-12,label:fitLabel,id:'fitted-diameter',labelAt:cx});
 out+=generalRoughness({x,y,width,height,ra:spec.generalRa})+text(cx,spec.isWorm?cy-R-25:cy+R+25,'Торцевий вид'+(spec.isWorm?' · '+scaleLabel(scale):''),'text-anchor="middle" font-size="3.5"');
 out+=parameterTable(x+300,y+20,spec.rows);
 const section=gearSection(spec,{x:x+(spec.isWorm?155:245),y:y+(spec.isWorm?150:112),scale:sectionScale,id});out+=`<g data-part-view="axial" data-view-scale="${sectionScale}">${section.svg}</g>`+text(x+(spec.isWorm?25:245),spec.isWorm?y+125:section.cy+section.R+31,'Осьовий переріз'+(spec.isWorm?' · '+scaleLabel(sectionScale):''),`text-anchor="${spec.isWorm?'start':'middle'}" font-size="3.5"`);
 out+=datumMark(cx,cy+(spec.isRing?R:boreR),'A',-20,R-(spec.isRing?R:boreR)+8)+datumMark(section.x2,section.cy+section.faceInner+(section.faceOuter-section.faceInner)*.75,'B',20,-3);
 const toleranceY=section.cy-section.R-16,faceY=spec.isWorm?y+108:y+25;
 out+=toleranceFrame(section.runout.to[0]-35,toleranceY,'runout',mmText(spec.runoutM),'A',{...section.runout,port:'right'});
 out+=toleranceFrame(x+(spec.isWorm?235:265),faceY,'perpendicular',mmText(spec.perpendicularM),'A',{...section.face,port:'bottom',reach:3.5,via:[[section.x2+3.5,faceY+12]]});
 out+=roughnessMark(spec.isWorm?x+25:x+185,spec.isWorm?y+190:y+179,spec.boreRa,{surface:spec.isWorm?'seat':spec.isRing?'outer-seat':'bore',...section.finish});
 const heat=`${spec.treatment}; ${spec.hardness}`+(p.drawingMaterial===1&&!spec.isWorm&&!(pair.type===2&&spec.isWheel)?`; h_eff ${spec.depth}`:'');
 out+=text(x+25,y+214,heat,'font-size="3.5"');
 out+=text(x+25,y+220,`Ra зубців ≤ ${fmt(spec.teethRa)}; інших ≤ ${fmt(spec.generalRa)} мкм. Неуказані лінійні ±0,1 мм; кутові ±0,5°. Фаски 0,5×45°; вільні радіуси R0,4, крім зубців.`,'font-size="3.5"');
 const key=spec.key?`Паз ${mmText(spec.key.widthM)} JS9 (±${mmText(fitDeviations(spec.key.widthM,'JS9').upperM)}); t₂ ${mmText(spec.key.depthM)} +0,1/0; наскрізний.`:spec.isWorm?'Заодно з валом. Уступи, шийки, бази й повну довжину див. на кресленні вала.':'Паз відсутній; базування по вказаній циліндричній поверхні.';
 out+=text(x+25,y+226,key,'font-size="3.5"');
 out+=text(x+25,y+232,spec.warnings.length?'УТОЧНИТИ: '+spec.warnings.join(' '):'Навчальні вимоги. Номінальний контур; товщину зубця — за таблицею.',`font-size="3.5"${spec.warnings.length?' data-construction-unresolved="true"':''}`);
 return out+'</g>';
}
export function partSheets(model,{geometry=[],metadata={}}={}){
 if(geometry.length)prepareConstruction(model,geometry);
 const parts=gearPartDetails(model,geometry),pages=[],drawings=[options=>shaftDetail(model,options),options=>shaftBlankDetail(model,options),...(model.inputs.stages===2?[options=>shaftBlankDetail(model,{...options,shaft:'intermediate'})]:[]),...parts.map((part,index)=>options=>gearPartDetail(model,part,{...options,index})),...(constructionSnapshot(model)?.shafts||[]).map(shaft=>options=>hardwareDetail(model,shaft,options))];
 for(let offset=0;offset<drawings.length;offset+=4){const content=drawings.slice(offset,offset+4).map((draw,i)=>draw({x:(i%2)*420,y:Math.floor(i/2)*297,width:420,height:297,metadata})).join('');
  pages.push(`<svg xmlns="http://www.w3.org/2000/svg" class="transmission-drawing" data-drawing-sheet="A1-parts" data-layout="4A3" data-page="${pages.length+1}" width="841mm" height="594mm" viewBox="0 0 841 594" font-family="Arial" font-size="3.5" color="black"><rect width="841" height="594" fill="white"/>${content}</svg>`);
 }return pages;
}
