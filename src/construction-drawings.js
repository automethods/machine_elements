import {shaftOutline} from './drawing-contours.js';
import {materials} from './catalogues.js';
import {constructionSnapshot,hardwareName} from './construction.js';
import {formatNumber as fmt} from './precision.js';
import {drawingTitleBlock,generalRoughness,datumMark,toleranceFrame,roughnessMark,surfaceLeader} from './drawing-frame.js';
import {linearDimension,dimensionText} from './drawing-dimensions.js';
import {fitDimension,drawingRequirements,mmText} from './manufacturing.js';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(x,y,v,a='')=>`<text x="${x}" y="${y}" ${a}>${esc(v)}</text>`;
const path=d=>`<path d="${d}" fill="none" stroke="black" stroke-width=".35"/>`;
const scaleFor=lim=>[2,1,.5,.2,.1,.05].find(s=>s<=lim+1e-10)||.02;
const frame=(o,title,number,scale)=>`<g data-part-frame="${number}" data-format="A3"><rect x="${o.x+20}" y="${o.y+5}" width="395" height="287" fill="none" stroke="black" stroke-width=".5"/>${text(o.x+23,o.y+13,title,'font-size="4.5"')}${drawingTitleBlock({x:o.x+230,y:o.y+237,title,designation:'ТМ-'+number,student:o.metadata?.student||'',scale:scale>=1?scale+':1':'1:'+1/scale,material:o.material||'Прийняті навчальні вимоги',sheet:o.sheet||'',sheets:o.sheets||1})}</g>`;
export function constructedShaftDetail(model,shaft,options){
 const {x=0,y=0}=options,o={...options,x,y,...(shaft.drawingNumber?{sheet:1,sheets:2}:{}),material:(materials.find(m=>m.choice===model.inputs.shaftMaterial)?.grade||'Ручні властивості')+' '+(materials.find(m=>m.choice===model.inputs.shaftMaterial)?.condition||'')},p=model.inputs,req=drawingRequirements(p),s=shaft.sections,lo=s[0].startM,hi=s.at(-1).endM,scale=scaleFor(Math.min(365/((hi-lo)*1000),90/(Math.max(...s.map(q=>q.diameterM),...shaft.seats.map(q=>q.outerDiameterM||0))*1000))),X=v=>x+42+(v-lo)*1000*scale,cy=y+100,R=d=>d*500*scale;
 // Merge analytical bore cuts for the external contour; the tapped holes are
 // dimensioned separately and are not external shoulders.
 const profile=[];for(const q of s){const last=profile.at(-1);if(last&&Math.abs(last.diameterM-q.diameterM)<1e-12&&last.fit===q.fit)last.endM=q.endM;else profile.push({...q});}
 const wormSeat=shaft.seats.find(s=>s.threadStartM!==undefined),displayDiameter=q=>q.threaded?wormSeat.outerDiameterM:q.diameterM,points=[];for(const q of profile)points.push([X(q.startM),cy-R(displayDiameter(q))],[X(q.endM),cy-R(displayDiameter(q))]);for(const q of profile.toReversed())points.push([X(q.endM),cy+R(displayDiameter(q))],[X(q.startM),cy+R(displayDiameter(q))]);
 let out=`<g data-part="${shaft.id}" data-construction-source="shared" data-physical-length-m="${hi-lo}">`+frame(o,shaft.name,shaft.drawingNumber||'02.'+({input:'10',intermediate:'11',output:'01'}[shaft.id.replace('-shaft','')]),scale)+`<path d="${shaftOutline(points,p.shaftFillet*1000*scale,p.shaftChamfer*1000*scale)}" fill="white" stroke="black" stroke-width=".5"/>`+path(`M${X(lo)-5} ${cy}H${X(hi)+5}`).replace('stroke-width=".35"','stroke-width=".18" stroke-dasharray="8 2 1 2"');
 if(wormSeat){const a=X(wormSeat.threadStartM),b=X(wormSeat.threadEndM),r=R(wormSeat.rootDiameterM),rt=R(wormSeat.outerDiameterM),pitch=wormSeat.axialPitchM*1000*scale;out+=path(`M${a} ${cy-r}H${b}M${a} ${cy+r}H${b}`);for(let v=a;v<b;v+=pitch)out+=path(`M${v} ${cy-rt}L${Math.min(b,v+pitch*1.8)} ${cy+rt}`);}
 shaft.keyways.forEach(k=>out+=`<rect data-keyway="shared" x="${X(k.startM)}" y="${cy-k.widthM*500*scale}" width="${(k.endM-k.startM)*1000*scale}" height="${k.widthM*1000*scale}" rx="${k.widthM*500*scale}" fill="none" stroke="black" stroke-width=".3"/>`);
 // External end/shoulder edges remain visible in the longitudinal view.
 for(let i=1;i<profile.length;i++){const q=profile[i],previous=profile[i-1];if(Math.abs(q.diameterM-previous.diameterM)>1e-10){const radius=R(Math.max(displayDiameter(q),displayDiameter(previous)))-p.shaftFillet*1000*scale;out+=`<path data-shoulder-edge="${i}" d="M${X(q.startM)} ${cy-radius}V${cy+radius}" fill="none" stroke="black" stroke-width=".35"/>`;}}
 for(const [i,q] of profile.entries()){
  const left=X(q.startM),right=X(q.endM),radius=R(displayDiameter(q)),mid=(left+right)/2,label=q.threaded?'⌀d_a '+fmt(wormSeat.outerDiameterM*1000):q.fit?fitDimension(q.diameterM,q.fit):'⌀'+fmt(q.diameterM*1000);
  const labelWidth=dimensionText(0,0,label).width;
  if(right-left<12){
   // A diameter callout leaves narrow lands/shoulders clear of adjacent fits.
   const ly=y+51;out+=`<g data-dimension="constructed-diameter-${i}" data-diameter-callout="" data-measurement-points="${mid},${cy-radius};${mid},${cy+radius}">${dimensionText(mid,ly,label,{background:true}).svg}${path(`M${mid-labelWidth/2} ${ly+2}H${mid+labelWidth/2}`)}${surfaceLeader([mid,ly+2],[mid,cy-radius],{normal:[0,-1],kind:'diameter',feature:'shaft-section-'+i})}</g>`;
  }else out+=linearDimension({p1:[mid,cy-radius],p2:[mid,cy+radius],at:q.id.includes('journal')?mid-7:mid,label,id:'constructed-diameter-'+i,vertical:true,labelAt:radius*2<labelWidth+7?cy+radius+5+labelWidth/2:cy,textBackground:true});
  out+=linearDimension({p1:[left,cy+radius],p2:[right,cy+radius],at:y+(right-left<15?164:150),label:fmt((q.endM-q.startM)*1000),id:'constructed-length-'+i,labelAt:mid});
  if(q.threaded)out+=linearDimension({p1:[mid+10,cy-R(q.diameterM)],p2:[mid+10,cy+R(q.diameterM)],at:mid+10,label:'⌀d_f '+fmt(q.diameterM*1000),id:'constructed-root',vertical:true,labelAt:cy});
  // The collective note supplies Ra for other surfaces. Place only the
  // finer fitted-seat requirements directly on their upper generator.
  if(!q.threaded&&q.fit==='k6')out+=roughnessMark(left+Math.min(4,(right-left)/3),cy-radius,req.boreRa,{surface:'shaft-section-'+i});
 }

 out+=linearDimension({p1:[X(lo),cy+R(profile[0].diameterM)],p2:[X(hi),cy+R(profile.at(-1).diameterM)],at:y+179,label:fmt((hi-lo)*1000)+' ±0,1',id:'constructed-overall',labelAt:(X(lo)+X(hi))/2});
 const [A,B]=shaft.bearing.supportsM;out+=linearDimension({p1:[X(A),cy],p2:[X(B),cy],at:y+193,label:'A—B = '+fmt((B-A)*1000),id:'constructed-supports',labelAt:(X(A)+X(B))/2});
 for(const [v,label] of [[A,'A'],[B,'B']])out+=path(`M${X(v)} ${cy-R(shaft.bearing.boreM)-8}V${y+194}`).replace('stroke-width=".35"','stroke-width=".18" stroke-dasharray="4 2"')+text(X(v),cy-R(shaft.bearing.boreM)-12,label,'text-anchor="middle" font-size="3.5"');
 out+=datumMark(X(A),cy+R(shaft.bearing.boreM),'A',0,7)+datumMark(X(B),cy+R(shaft.bearing.boreM),'B',0,7);
 const seat=shaft.seats[0],feature=[X((seat.startM+seat.endM)/2),cy-R(shaft.sections.find(q=>q.id.includes('gear-seat')).diameterM)];
 out+=toleranceFrame(feature[0]-18,y+23,'runout',mmText(req.runoutM),'A-B',{to:feature,normal:[0,-1],port:'bottom'});
 out+=text(x+25,y+211,`Галтелі R${fmt(p.shaftFillet*1000)}; фаски ${fmt(p.shaftChamfer*1000)}×45°. Неуказані ±0,1 мм; кутові ±0,5°.`, 'font-size="3.5"');
 out+=text(x+25,y+218,'Обидва торці: M10×1,5–6H, різьба 20; свердління ⌀8,5 глибиною 25.','font-size="3.5"');
 out+=text(x+25,y+225,shaft.keyways.map(k=>`Паз: x ${fmt((k.startM-lo)*1000)}; l ${fmt((k.endM-k.startM)*1000)}; b ${fmt(k.widthM*1000)}; t ${fmt(k.depthM*1000)}`).join(' / '),'font-size="3.2"');
 out+=text(x+25,y+232,wormSeat?'Нарізана ділянка: параметри та контроль — на аркуші 2 цього кресленика.':'Координати уступів, посадки та підводи відповідають збірці; допуски навчальні.','font-size="3.5"');
 return out+generalRoughness({x,y,width:420,height:297,ra:req.generalRa})+'</g>';
}
export function hardwareDetail(model,shaft,options){
 const {x=0,y=0}=options,o={...options,x,y},parts=shaft.hardware.filter(h=>['spacer','seal-sleeve','retaining-plate','cover'].includes(h.kind));let out=`<g data-part="${shaft.id}-hardware">`+frame(o,'Втулки, фіксація та кришки · '+shaft.name,'03.'+({input:1,intermediate:2,output:3}[shaft.id.replace('-shaft','')]),1);
 parts.forEach((h,i)=>{const col=i%4,row=Math.floor(i/4),cx=x+67+col*90,cy=y+45+row*62,scale=scaleFor(Math.min(45/(h.outerDiameterM*1000),40/((h.endM-h.startM)*1000))),X=v=>cx+(v-(h.startM+h.endM)/2)*1000*scale,R=v=>v*500*scale,bores=h.bores?.length?h.bores:[{startM:h.startM,endM:h.endM,diameterM:h.innerDiameterM}];
  out+=text(cx,cy-19,h.id.split('-').slice(2).join('-'),'text-anchor="middle" font-size="3"');
  for(const b of bores){const xx=X(b.startM),ww=(b.endM-b.startM)*1000*scale;out+=`<path d="M${xx} ${cy-R(h.outerDiameterM)}h${ww}v${2*R(h.outerDiameterM)}h-${ww}Z M${xx} ${cy-R(b.diameterM)}h${ww}v${2*R(b.diameterM)}h-${ww}Z" fill="#eee" fill-rule="evenodd" stroke="black" stroke-width=".3"/>`;}
  out+=text(cx,cy+R(h.outerDiameterM)+5,`⌀${fmt(h.outerDiameterM*1000)} / ⌀${fmt(h.innerDiameterM*1000)}; L ${fmt((h.endM-h.startM)*1000)}`,'text-anchor="middle" font-size="3"');
 });
 out+=text(x+25,y+211,'Втулки: отвори за ступенями вала +0,3 мм; торці Ra 1,6; паралельність 0,03.','font-size="3.5"');
 out+=text(x+25,y+218,'Ущільнювальна втулка: посадка H7; зовні h11, Ra 0,4 без гвинтового сліду.','font-size="3.5"');
 out+=text(x+25,y+225,'Пластини: отвір ⌀11; M10×30–8.8; мін. робоче зачеплення різьби 20 мм.','font-size="3.5"');
 out+=text(x+25,y+232,`Кришки: 4 отвори ⌀6,6 на колі ⌀${fmt((shaft.bearing.outerDiameterM+.012)*1000)}; гвинти M6×16. Навчальне виконання.`,'font-size="3.5"');return out+'</g>';
}
