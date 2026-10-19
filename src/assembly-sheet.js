import {assemblyDrawingData} from './gear-projections.js';
import {fitScale,scaleLabel} from './part-drawings.js';
import {formatNumber as fmt} from './precision.js';
import {linearDimension} from './drawing-dimensions.js';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(x,y,s,attrs='')=>`<text x="${x}" y="${y}" ${attrs}>${esc(s)}</text>`;
const path=(d,attrs='')=>`<path d="${d}" fill="none" stroke="black" stroke-width=".3" ${attrs}/>`;
const rectPath=b=>`M${b.min.join(' ')}H${b.max[0]}V${b.max[1]}H${b.min[0]}Z`;

function dimension(x1,x2,y,label,fromY){
 return `<g data-assembly-dimension="${esc(label)}">${linearDimension({p1:[x1,fromY],p2:[x2,fromY],at:y,label,id:'housing-width',labelAt:(x1+x2)/2})}</g>`;
}
function balloons(targets,frame,envelope){
 const sides=[[],[]],capacity=Math.floor((frame.h-39)/7.5)+1;
 for(const item of targets)sides[item.anchor[0]-envelope.min[0]<=envelope.max[0]-item.anchor[0]?0:1].push(item);
 for(const side of [0,1])while(sides[side].length>capacity&&sides[1-side].length<capacity){sides[side].sort((a,b)=>Math.abs(2*a.anchor[0]-envelope.min[0]-envelope.max[0])-Math.abs(2*b.anchor[0]-envelope.min[0]-envelope.max[0]));sides[1-side].push(sides[side].shift());}
 return sides.map((items,side)=>{
  items.sort((a,b)=>a.anchor[1]-b.anchor[1]);
  const minY=frame.y+23,maxY=frame.y+frame.h-16,gap=Math.min(9,(maxY-minY)/Math.max(1,items.length-1)),ys=items.map(item=>item.anchor[1]);
  for(let i=1;i<ys.length;i++)ys[i]=Math.max(ys[i],ys[i-1]+gap);
  const correction=items.length?items.reduce((sum,item,i)=>sum+item.anchor[1]-ys[i],0)/items.length:0;for(let i=0;i<ys.length;i++)ys[i]=Math.max(minY+i*gap,Math.min(maxY-(ys.length-1-i)*gap,ys[i]+correction));
  return items.map((item,i)=>{
   const x=side?Math.min(frame.x+frame.w-8,envelope.max[0]+15):Math.max(frame.x+8,envelope.min[0]-15),y=ys[i],edge=x+(side?-3.3:3.3),elbow=x+(side?-7:7),[ax,ay]=side?(item.right||item.anchor):(item.left||item.anchor);
   return `<g data-balloon-item="${item.id}" data-balloon-position="${item.position}" data-leader-length-mm="${Math.hypot(ax-elbow,ay-y)+Math.abs(elbow-edge)}">${path(`M${ax} ${ay}L${elbow} ${y}H${edge}`)}<circle cx="${ax}" cy="${ay}" r=".6"/><circle data-balloon-circle="${item.position}" cx="${x}" cy="${y}" r="3.3" fill="white" stroke="black" stroke-width=".35"/>${text(x,y+1.5,item.position,'text-anchor="middle" font-size="4.5"')}</g>`;
  }).join('');
 }).join('');
}

function assemblyView(model,view,frame,items,id,aliases){
 const p=model.inputs,wall=p.housingWall*1000,base=p.housingBase*1000,extra=Math.max(10,base),raw={min:[view.bounds.min[0]-extra,view.bounds.min[1]],max:[view.bounds.max[0]+extra,view.bounds.max[1]]},width=raw.max[0]-raw.min[0],height=raw.max[1]-raw.min[1],s=fitScale(Math.min((frame.w-56)/width,(frame.h-36)/height)),tx=frame.x+frame.w/2-(raw.min[0]+raw.max[0])*s/2,ty=frame.y+19+(frame.h-39)/2-(raw.min[1]+raw.max[1])*s/2;
 const point=q=>[tx+q[0]*s,ty+q[1]*s],bounds=b=>({min:point(b.min),max:point(b.max)}),outer=bounds(view.housing.outer),inner=bounds(view.housing.inner),hatch=id+'-hatch';
 const rect=(b,attrs='')=>`<rect x="${b.min[0]}" y="${b.min[1]}" width="${b.max[0]-b.min[0]}" height="${b.max[1]-b.min[1]}" ${attrs}/>`;
 let out=`<g data-assembly-view="${view.id}" data-drawing-scale="${s}"><rect data-view-frame="${view.id}" x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" fill="white" stroke="black" stroke-width=".35"/>${path(`M${frame.x} ${frame.y+11}h${frame.w}`)}${text(frame.x+4,frame.y+7,view.id==='top'?'План · кришку знято':view.id==='left'?'Переріз А–А · зі сторони входу':'Переріз Б–Б · зі сторони виходу','font-size="4"')}${text(frame.x+frame.w-4,frame.y+7,scaleLabel(s),'text-anchor="end" font-size="3.5"')}<defs><pattern id="${hatch}" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M0 3L3 0M-1 1L1 -1M2 4L4 2" stroke="black" stroke-width=".18"/></pattern></defs>`;
 // Casing in section: the cavity remains open, rather than hiding the gears
 // behind an opaque decorative rectangle. Wall/base dimensions are inputs.
 out+=`<g data-housing="${view.id}" data-wall-m="${p.housingWall}"><path d="${rectPath(outer)}${rectPath(inner)}" fill="url(#${hatch})" fill-rule="evenodd" stroke="black" stroke-width=".5"/>`;
 if(view.id!=='top'){
  const foot=extra*s,y=outer.max[1]-Math.max(base*s,1.5);
  for(const x of [outer.min[0]-foot,outer.max[0]-foot])out+=`<rect x="${x}" y="${y}" width="${foot*2}" height="${outer.max[1]-y}" fill="url(#${hatch})" stroke="black" stroke-width=".35"/>`;
  out+=path(`M${outer.min[0]} ${outer.min[1]+Math.max(wall*s*2,3)}H${outer.max[0]}`,'data-cover-joint="true"');
 }else{
  for(const x of [outer.min[0]+wall*s/2,outer.max[0]-wall*s/2])for(const y of [outer.min[1]+wall*s/2,outer.max[1]-wall*s/2])out+=`<circle cx="${x}" cy="${y}" r=".6" fill="white" stroke="black" stroke-width=".2"/>`;
 }
 // Output-bearing bosses follow the adopted bearing positions and connect to
 // the casing where a support lies outside the gear cavity's main envelope.
 for(const part of view.parts.filter(part=>/-bearing-[AB]$/.test(part.key))){
  const b=bounds(part.bounds),expanded={min:b.min.map(v=>v-wall*s),max:b.max.map(v=>v+wall*s)};
  if(expanded.min[1]<outer.min[1])expanded.max[1]=Math.max(expanded.max[1],outer.min[1]);
  if(expanded.max[1]>outer.max[1])expanded.min[1]=Math.min(expanded.min[1],outer.max[1]);
  if(expanded.min[0]<outer.min[0])expanded.max[0]=Math.max(expanded.max[0],outer.min[0]);
  if(expanded.max[0]>outer.max[0])expanded.min[0]=Math.min(expanded.min[0],outer.max[0]);
  if(b.min[0]<inner.min[0]||b.max[0]>inner.max[0]||b.min[1]<inner.min[1]||b.max[1]>inner.max[1])out+=rect(expanded,'data-bearing-boss="true" fill="white" stroke="black" stroke-width=".4"');
 }
 out+='</g>';
 out+=`<g data-assembly-parts="${view.id}" transform="translate(${tx} ${ty}) scale(${s})">${view.parts.map(part=>`<path d="${part.path}" data-assembly-item="${part.key||''}" fill="none" stroke="black" stroke-width="${.25/s}"/>`).join('')}</g>`;
 const targets=[],grouped=new Map();
 for(const part of view.parts){const key=aliases.get(part.key)||part.key;if(!items.has(key))continue;const left=point(part.left),right=point(part.right),old=grouped.get(key);grouped.set(key,{left:old&&old.left[0]<left[0]?old.left:left,right:old&&old.right[0]>right[0]?old.right:right});}
 for(const [key,edges] of grouped)targets.push({id:key,position:items.get(key),...edges,anchor:edges.left.map((n,i)=>(n+edges.right[i])/2)});
 targets.push({id:'housing',position:items.get('housing'),anchor:[outer.max[0],outer.min[1]+2]});
 if(view.oilY!==null){
  const level=ty+view.oilY*s,cx=outer.max[0],r=2.2;
  out+=`<g data-oil-level="${view.id}" data-height-m="${p.oilLevelHeight}">${path(`M${inner.min[0]} ${level}H${inner.max[0]}`,'stroke-dasharray="7 1.5 1 1.5"')}<path d="M${inner.min[0]+2} ${level-2.2}h4.4l-2.2 2.2Z" fill="white" stroke="black" stroke-width=".3"/><circle cx="${cx}" cy="${level}" r="${r}" fill="white" stroke="black" stroke-width=".35"/>${path(`M${cx-r} ${level}h${r*2}`)}${text(frame.x+frame.w/2,frame.y+frame.h-4,`Рівень оливи hₒ = ${fmt(p.oilLevelHeight*1000)} мм від внутрішнього дна`,'text-anchor="middle" font-size="3.5"')}</g>`;
  targets.push({id:'oil-indicator',position:items.get('oil-indicator'),anchor:[cx,level]});
  const fillX=outer.min[0]+(outer.max[0]-outer.min[0])*.25,fillY=outer.min[1],drainX=outer.max[0]-5,drainY=outer.max[1];
  out+=`<g data-service-plugs="${view.id}"><rect x="${fillX-2}" y="${fillY-2}" width="4" height="2" fill="white" stroke="black" stroke-width=".3"/><rect x="${drainX-2}" y="${drainY-.8}" width="4" height="1.6" fill="white" stroke="black" stroke-width=".3"/></g>`;
  targets.push({id:'service-plugs',position:items.get('service-plugs'),anchor:[fillX,fillY-1]});
 }
 const owner=key=>/-bearings$|retaining-(bolt|washer)|-gear-key-/.test(key)?'top':key==='oil-indicator'?'right':key==='service-plugs'?'left':key.startsWith('output-shaft-')||key==='output-coupling'||key==='output-key'?'right':/^(input|intermediate)-shaft-/.test(key)?'left':'top';
 out+=balloons(targets.filter(t=>t.position&&owner(t.id)===view.id),frame,bounds(raw));
 if(view.id==='top')out+=dimension(outer.min[0],outer.max[0],Math.min(frame.y+frame.h-15,outer.max[1]+10),'Корпус '+fmt((view.housing.outer.max[0]-view.housing.outer.min[0])),outer.max[1])+'<g data-section-reference="A-A">'+text(frame.x+frame.w/2,frame.y+frame.h-4,'Розміри в мм; позиції відповідають специфікації','text-anchor="middle" font-size="3.5"')+'</g>';
 return out+'</g>';
}

export function housedAssemblyDrawing(model,geometry,drawingItems,{id='assembly'}={}){
 const data=assemblyDrawingData(model,geometry),items=new Map(drawingItems.map(item=>[item.id,item.position])),aliases=new Map(drawingItems.flatMap(item=>(item.aliases||[]).map(alias=>[alias,item.id]))),byId=new Map(data.views.map(v=>[v.id,v]));
 const frames=[{id:'top',x:30,y:32,w:565,h:300},{id:'left',x:30,y:332,w:282.5,h:140},{id:'right',x:312.5,y:332,w:282.5,h:140}];
 return {svg:`<g data-projection-source="assembled-bosl2" data-housed-assembly="true">${frames.map(frame=>assemblyView(model,byId.get(frame.id),frame,items,id+'-'+frame.id,aliases)).join('')}</g>`,dimensionsM:data.dimensionsM,oilImmersionM:data.oilImmersionM};
}
