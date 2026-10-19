import {gearAssembly,profilePath} from './gear-geometry.js';
import {formatNumber as fmt} from './precision.js';
export const svgText=(x,y,value,extra='')=>`<text x="${x}" y="${y}" ${extra}>${value}</text>`;
const path=(d,cls='draft-thin')=>`<path class="${cls}" d="${d}"/>`;
export function assemblyLayout(model){
 const pairs=gearAssembly(model),spacing=Math.max(...pairs.map(p=>p.widthM))+.03,centres=[0];
 for(const p of pairs)centres.push(p.type===3?centres.at(-1):centres.at(-1)+(p.type===1?model.result.numbers['coneR_'+p.stage]:p.centerDistanceM));
 return {pairs,spacing,centres,span:Math.max(...pairs.map(p=>p.wheel.tipRadiusM))*2+centres.at(-1)};
}
export const draftingStyle=`.draft-outline{vector-effect:non-scaling-stroke;fill:white;stroke:currentColor;stroke-width:1.5}.draft-thin{vector-effect:non-scaling-stroke;fill:none;stroke:currentColor;stroke-width:.9}.draft-axis{vector-effect:non-scaling-stroke;fill:none;stroke:currentColor;stroke-width:.7;stroke-dasharray:9 2 1 2}.draft-shaft{vector-effect:non-scaling-stroke;fill:none;stroke:currentColor;stroke-width:2}.draft-hidden{fill:none;stroke:currentColor;stroke-width:.8;stroke-dasharray:4 3}`;
const support=(x,y)=>path(`M${x-7} ${y-7}h-5v14h5m14-14h5v14h-5`);
// The inclined stages use their actual axis angle. Their symbolic bodies are
// assembled along the same output/input shaft; no parallel-shaft surrogate.
export function inclinedPlan(model,{width=390,height=300,labels=true,id='inclined',scale:fixedScale=null}={}){
 const l=assemblyLayout(model),p=model.inputs,items=[],points=[],frames=[];
 const dir=a=>[Math.sin(a),Math.cos(a)],normal=a=>[Math.cos(a),-Math.sin(a)],offset=(o,v,k)=>[o[0]+v[0]*k,o[1]+v[1]*k];
 let origin=[0,0],angle=0;
 const segment=(a,b,cls='draft-shaft')=>{points.push(a,b);items.push(`<path class="${cls}" d="M${a.join(' ')}L${b.join(' ')}"/>`);};
 const body=(o,a,r,b,kind='wheel')=>{const n=normal(a),d=dir(a);for(const sx of [-1,1])for(const sy of [-1,1])points.push(offset(offset(o,n,sx*r),d,sy*b/2));items.push(`<g transform="translate(${o.join(' ')}) rotate(${-a*180/Math.PI})" data-wheel-plane="perpendicular"><rect class="draft-outline" x="${-r}" y="${-b/2}" width="${2*r}" height="${b}"/>${kind==='worm'?path(`M${-r} ${-b*.3}l${2*r} ${b*.2}m${-2*r} ${b*.1}l${2*r} ${b*.2}`):''}</g>`);};
 for(const [stageIndex,pair] of l.pairs.entries()){
  const d=dir(angle),n=normal(angle),incoming=origin;
  const outgoing=pair.type===0?offset(origin,n,pair.centerDistanceM):pair.type===2?offset(origin,n,-pair.centerDistanceM):origin;
  const outAngle=angle+(pair.type===1?pair.shaftAngleRad:pair.type===2?Math.PI/2:0);
  frames.push({pair,incoming,outgoing,inAngle:angle,outAngle});
  segment(offset(incoming,d,-.065),offset(incoming,d,.065));segment(offset(outgoing,dir(outAngle),-.065),offset(outgoing,dir(outAngle),.065));
  if(pair.type===1){
   const R=model.result.numbers['coneR_'+pair.stage];
   for(const [a,delta] of [[angle,model.result.numbers['cone1_'+pair.stage]],[outAngle,model.result.numbers['cone2_'+pair.stage]]]){
    const ro=R*Math.sin(delta),ri=(R-pair.widthM)*Math.sin(delta),zo=R*Math.cos(delta),zi=(R-pair.widthM)*Math.cos(delta),n=normal(a),d=dir(a);
    const corners=[[-ro,-zo],[ro,-zo],[ri,-zi],[-ri,-zi]].map(([x,y])=>offset(offset(incoming,n,x),d,y));points.push(...corners);items.push(`<path class="draft-outline" data-intersecting-axes="${pair.shaftAngleRad}" d="M${corners.map(c=>c.join(' ')).join('L')}Z"/>`);
   }
  }else{body(incoming,angle,pair.pinion.tipRadiusM,pair.type===2?p['wormLength'+pair.stage]:pair.widthM,pair.type===2?'worm':'wheel');body(outgoing,outAngle,Math.max(pair.wheel.tipRadiusM,pair.wheel.rootRadiusM),pair.widthM);}
  const following=l.pairs[stageIndex+1],separation=following?Math.max(l.spacing,(pair.wheel.tipRadiusM+following.wheel.tipRadiusM)*1.2+.05):l.spacing;
  const next=offset(outgoing,dir(outAngle),separation);segment(outgoing,next);origin=next;angle=outAngle;

 }
 const first=frames[0],last=frames.at(-1),od=dir(last.outAngle);
 // Put connection ports beyond the complete reducer. Treat a horizontal
 // output as horizontal: floating-point cos(90°) must not select the left end.
 const outputDirection=Math.abs(od[1])<1e-8?[1,0]:od[1]<0?od:od.map(v=>-v),input=[first.incoming[0],Math.max(...points.map(q=>q[1]))+.08];
 const distances=points.map(q=>(q[0]-last.outgoing[0])*outputDirection[0]+(q[1]-last.outgoing[1])*outputDirection[1]),output=offset(last.outgoing,outputDirection,Math.max(.16,...distances.map(v=>v+.06)));
 segment(first.incoming,input);segment(last.outgoing,output);
 const xmin=Math.min(...points.map(p=>p[0])),xmax=Math.max(...points.map(p=>p[0])),ymin=Math.min(...points.map(p=>p[1])),ymax=Math.max(...points.map(p=>p[1]));
 const scale=fixedScale??Math.min((width-40)/(xmax-xmin),(height-70)/(ymax-ymin)),tx=20-xmin*scale,ty=45-ymin*scale,project=o=>[tx+o[0]*scale,ty+o[1]*scale];
 const scaled=items.join('');
 const names=labels?frames.map(f=>{const [x,y]=project(f.incoming);return svgText(65+(f.pair.stage-1)*130,26,`Ступінь ${f.pair.stage}`,'font-size="11" text-anchor="middle"');}).join(''):'';
 return {svg:`<g data-projection="top" data-layout="assembled" id="${id}"><g transform="translate(${tx} ${ty}) scale(${scale})" style="--draft-scale:${scale}">${scaled}</g>${names}</g>`,input:project(input),output:project(output),outputDirection};
}
export function planProjection(model,{width=390,height=300,labels=true,id='plan',scale:fixedScale=null}={}){
 const l=assemblyLayout(model),p=model.inputs,pairs=l.pairs;
 if(pairs.some(pair=>pair.type===1||pair.type===2))return inclinedPlan(model,{width,height,labels,id,scale:fixedScale}).svg;
 const xmin=-Math.max(...pairs.map(a=>a.pinion.tipRadiusM)),xmax=l.centres.at(-1)+Math.max(...pairs.map(a=>a.wheel.tipRadiusM)),axialLength=Math.max(p.shaftSpan,l.spacing*p.stages+.1);
 const scale=fixedScale??Math.min((width-40)/(xmax-xmin),(height-85)/axialLength),x=m=>20+(m-xmin)*scale,y=m=>60+(m+axialLength/2)*scale;
 let drawing='';
 l.centres.forEach((c,i)=>{drawing+=path(`M${x(c)} ${y(-axialLength/2)}V${y(axialLength/2)}`,'draft-shaft')+path(`M${x(c)} ${y(-axialLength/2)-8}V${y(axialLength/2)+8}`,'draft-axis')+support(x(c),y(-axialLength*.4))+support(x(c),y(axialLength*.4));});
 pairs.forEach((pair,i)=>{
  const cy=y((i-(pairs.length-1)/2)*l.spacing),b=pair.widthM*scale;
  if(pair.type===2){
   const cx=x(l.centres[i]),length=p['wormLength'+pair.stage]*scale,d=pair.pinion.pitchRadiusM*scale;
   drawing+=`<rect class="draft-outline" x="${cx-d}" y="${cy-length/2}" width="${2*d}" height="${length}"/>`+path(`M${cx-d} ${cy-length*.35}l${2*d} ${length*.2}m${-2*d} ${length*.1}l${2*d} ${length*.2}m${-2*d} ${length*.1}l${2*d} ${length*.2}`);
  }
  for(const [number,g,c] of [[1,pair.pinion,l.centres[i]],[2,pair.wheel,l.centres[i+1]]]){
   if(pair.type===2&&number===1)continue;
   const r=Math.max(g.tipRadiusM,g.rootRadiusM)*scale,cx=x(c),pitch=g.pitchRadiusM*scale;
   drawing+=`<g data-wheel-plane="perpendicular" data-stage="${pair.stage}"><rect class="draft-outline" x="${cx-r}" y="${cy-b/2}" width="${2*r}" height="${b}"/>${path(`M${cx-pitch} ${cy-b/2-4}v${b+8}m${2*pitch} ${-b-8}v${b+8}`,'draft-axis')}</g>`;
   if(pair.betaRad) drawing+=path(`M${cx-r+4} ${cy+b/2}l${Math.min(r,10)} ${-b}m6 0l${-Math.min(r,10)} ${b}`);
  }
  drawing+=path(`M${x(l.centres[i])} ${cy}H${x(l.centres[i+1])}`,'draft-thin');
  if(pair.type===1)drawing+=path(`M${x(l.centres[i])} ${cy-10}l20 20m-20 0 20-20`);
  if(labels)drawing+=svgText((x(l.centres[i])+x(l.centres[i+1]))/2,cy-b/2-8,`Ступінь ${pair.stage}`,'text-anchor="middle" font-size="11"');
 });
 return `<g data-projection="top" data-layout="assembled" id="${id}">${drawing}</g>`;
}
export function endProjection(model,{width=270,height=300,right=false,animate=false,id='end',scale:fixedScale=null}={}){
 const l=assemblyLayout(model),pairs=l.pairs,radius=Math.max(...pairs.map(p=>Math.max(p.wheel.tipRadiusM,p.wheel.rootRadiusM))),min=-pairs[0].pinion.tipRadiusM,max=l.centres.at(-1)+radius;
 const scale=fixedScale??Math.min((width-25)/(max-min),(height-60)/(2*radius)),x=m=>12+(m-min)*scale,y=height/2+10;
 let drawing=path(`M5 ${y}H${width-5}`,'draft-axis'),speed=1;
 for(const pair of pairs){
  const index=pair.stage-1;
  if(pair.type===3){
   const cx=x(l.centres[index]),rs=pair.pinion.pitchRadiusM*scale,rp=model.result.numbers['planetD_'+pair.stage]/2*scale,rr=pair.wheel.pitchRadiusM*scale;
   const motion=rate=>animate&&rate?`<animateTransform attributeName="transform" type="rotate" from="0" to="${rate>0?360:-360}" dur="${8/Math.abs(rate)}s" repeatCount="indefinite"/>`:'';
   const carrier=speed/pair.ratio,relativePlanet=-(speed-carrier)*pair.pinion.teeth/pair.planetTeeth;
   drawing+=`<g transform="translate(${cx} ${y})"><circle class="draft-outline" r="${rr+model.inputs['planetRimThickness'+pair.stage]*scale}"/><circle class="draft-axis" r="${rr}"/><g>${motion(speed)}<circle class="draft-outline" r="${rs}"/>${path(`M0 0H${rs*.8}`)}</g><g>${motion(carrier)}`;
   for(let n=0;n<pair.planetCount;n++){const a=n*2*Math.PI/pair.planetCount;drawing+=`<g transform="translate(${pair.centerDistanceM*scale*Math.cos(a)} ${pair.centerDistanceM*scale*Math.sin(a)})"><g>${motion(relativePlanet)}<circle class="draft-outline" r="${rp}"/>${path(`M0 0H${rp*.8}`)}</g></g>`;}
   drawing+='</g></g>';
  }else for(const [number,g,c] of [[2,pair.wheel,l.centres[index+1]],[1,pair.pinion,l.centres[index]]]){
   const rate=number===1?speed:-speed/pair.ratio,phase=number===1?0:180-180/g.teeth,shape=g.points?`<path class="draft-outline" ${!right?`data-gear-teeth="${g.teeth}"`:''} d="${profilePath(g,scale)}"/>`:`<ellipse class="draft-outline" rx="${Math.max(g.tipRadiusM,g.rootRadiusM)*scale}" ry="${Math.max(1,Math.max(g.tipRadiusM,g.rootRadiusM)*scale*(number===2&&pair.type===1?Math.abs(Math.cos(pair.shaftAngleRad)):number===2&&pair.type===2?0:1))}"/>`;
   drawing+=`<g transform="translate(${x(c)} ${y})"><g transform="rotate(${phase})"><g>${animate?`<animateTransform attributeName="transform" type="rotate" from="0" to="${rate>0?360:-360}" dur="${8/Math.abs(rate)}s" repeatCount="indefinite"/>`:''}${shape}${path(`M0 0H${g.pitchRadiusM*scale*.8}`,'draft-thin')}</g></g><circle class="draft-axis" r="${g.pitchRadiusM*scale}"/><circle class="draft-outline" r="${Math.min(model.inputs.shaftDiameter/2,g.pitchRadiusM*.3)*scale}"/></g>`;
  }
  speed*=pair.type===3?1/pair.ratio:-1/pair.ratio;
 }
 return `<g data-projection="${right?'right':'left'}" id="${id}" ${right?`transform="translate(${width} 0) scale(-1 1)"`:''}>${drawing}</g>`;
}
export function assemblyProjections(model,{animate=true,id='assembly',title=true}={}){
 const l=assemblyLayout(model),inclined=l.pairs.some(p=>p.type===1||p.type===2),radius=Math.max(...l.pairs.map(p=>Math.max(p.wheel.tipRadiusM,p.wheel.rootRadiusM))),extent=l.centres.at(-1)+radius+l.pairs[0].pinion.tipRadiusM,scale=Math.min(245/extent,240/(2*radius),215/Math.max(model.inputs.shaftSpan,l.spacing*l.pairs.length+.1));
 return `<svg xmlns="http://www.w3.org/2000/svg" class="scheme gear-scheme" viewBox="0 0 1000 400" role="img" aria-label="Зібраний редуктор: вигляд зверху та з двох боків уздовж валів" font-family="Arial" font-size="14" color="#26392d"><style>${draftingStyle}</style><g transform="translate(310 45)">${title?svgText(195,-21,'План збірки','text-anchor="middle"'):''}${planProjection(model,{id:id+'-top',scale:inclined?null:scale})}</g><g transform="translate(10 35)">${title?svgText(135,-11,inclined?'Січення · вхідні елементи':'Зліва · зі сторони входу','text-anchor="middle"'):''}${endProjection(model,{animate,id:id+'-left',scale})}</g><g transform="translate(710 35)">${title?svgText(135,-11,inclined?'Січення · вихідні елементи':'Справа · зі сторони виходу','text-anchor="middle"'):''}${endProjection(model,{right:true,animate,id:id+'-right',scale})}</g>${svgText(500,385,inclined?'Схема осей і умовні січення ступенів. Просторове розташування показано в 3D-вигляді.':'Спільні вали і масштаб. Контури та ділильні поверхні — умовне подання; профілі зубців — навчальна деталізація.','text-anchor="middle" font-size="12"')}</svg>`;
}
