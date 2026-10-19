import {cloneTechnical,technicalProfiles,createTechnicalAdapter,createExclusiveRunner,publishTechnicalSVG} from '../vendor/technical-modules/chart-publication/index.mjs';
export const withExclusive=createExclusiveRunner();
const adapters=new Map();
const configs=new Map();
const publicationReports=new Map();
export const readPublicationReport=id=>structuredClone(publicationReports.get(id));
export function profileFor(element,xLabel,yLabel){
 const profile=cloneTechnical(technicalProfiles.colour);
 profile.roles.primary.color='#4d7358';
 profile.page.width_mm=Math.max(60,Math.min(250,element.clientWidth*25.4/96));
 profile.page.height_mm=105;profile.page.left_mm=20;profile.page.right_mm=10;profile.page.top_mm=18;profile.page.bottom_mm=18;profile.page.caption_mm=0;
 profile.caption.enabled=false;profile.axes.labels=true;profile.axes.ends='arrows';profile.axes.label_position='center';profile.axes.notation='quantity';
 profile.metadata.x={quantity:xLabel,symbol:'',unit:''};profile.metadata.y={quantity:yLabel,symbol:'',unit:''};profile.legend='top';profile.grid.minor=false;
 return profile;
}
export async function drawChart(id,data,xLabel,yLabel,options={}){
 const element=document.getElementById(id);if(!element)return;
 const profile=profileFor(element,xLabel,yLabel);
 const bindings=data.map((_,index)=>({index,role:index===0?'primary':index===1?'secondary':'limit',channels:{color:'decorative',width:'decorative',dash:'decorative',marker:'decorative'}}));
 const previous=adapters.get(id);previous?.dispose();
 await withExclusive(()=>Plotly.react(element,data,{font:{family:'Arial',size:14},paper_bgcolor:'#ffffff',plot_bgcolor:'#ffffff',showlegend:data.length>1,xaxis:{title:{text:xLabel},zeroline:false},yaxis:{title:{text:yLabel},rangemode:'tozero',zeroline:true,...options.yaxis},margin:{l:70,r:25,t:55,b:60},height:Math.max(300,Math.min(400,element.clientWidth*.5)),...options.layout},{displayModeBar:false,responsive:false,staticPlot:false,scrollZoom:false}));
 // Adopt the native renderer's initial ranges before technical formatting.
 // Later font / marker changes must not silently recalculate those ranges.
 await withExclusive(()=>Plotly.relayout(element,{'xaxis.type':element._fullLayout.xaxis.type,'xaxis.range':[...element._fullLayout.xaxis.range],'xaxis.autorange':false,'yaxis.type':element._fullLayout.yaxis.type,'yaxis.range':[...element._fullLayout.yaxis.range],'yaxis.autorange':false}));
 const adapter=createTechnicalAdapter(Plotly,element,{withExclusive,bindings});adapters.set(id,adapter);
 await adapter.applyProfile(profile);
 configs.set(id,{profile,bindings});
 element.dataset.ready='true';
}
export async function exportChart(id){
 const {profile,bindings}=configs.get(id)||{};if(!profile)throw new Error('Графік ще не підготовлено.');
 // A4 report content is 170 mm wide; publication geometry must not inherit a
 // phone's narrow viewport and crowd category labels into a tiny plot.
 const publication=cloneTechnical(profile);publication.page.width_mm=170;
 let result;
 try{result=await withExclusive(()=>publishTechnicalSVG(Plotly,document.getElementById(id),publication,bindings));}
 catch(error){throw new Error(`Не вдалося експортувати графік ${id}: ${error.message}`,{cause:error});}
 publicationReports.set(id,result.report);
 if(result.report.outcome==='failed')throw new Error('Не вдалося підготувати перевірений SVG.');
 return result.svg;
}

export const line=(name,x,y,color)=>({name,x,y,type:'scatter',mode:'lines+markers',line:{shape:'linear',color},marker:{size:6},hovertemplate:'%{x:.3g}; %{y:.4g}<extra>%{fullData.name}</extra>'});
export function powerPlots(model){
 const r=model.result.numbers,p=model.inputs;
 const labels=['Двигун','Вал 1','Вал 2',...(p.stages===2?['Вал 3']:[])];
 return {
  power:[line('Потужність',labels,[p.motorPower,r.P_0,r.P_1,...(p.stages===2?[r.P_2]:[])].map(x=>x/1000))],
  torque:[line('Момент',labels.slice(1),[r.T_0,r.T_1,...(p.stages===2?[r.T_2]:[])])]
 };
}
export {assemblyProjections as gearScheme} from './drafting.js';
export function shaftReactionComponents(model){
 const p=model.inputs,r=model.result.numbers;
 // Diagram axes: x along the shaft, y upward in the resultant-load plane.
 // Axial sharing is the same explicit input used by the native bearing check.
 return [{end:'A',fxN:-r.Fa_out*p.axialSupport,fyN:r.R_A,locating:p.axialSupport>0},{end:'B',fxN:-r.Fa_out*(1-p.axialSupport),fyN:r.R_B,locating:p.axialSupport<1}];
}
export function shaftScheme(model){
 const p=model.inputs,r=model.result.numbers,left=120,right=580,x=left+(right-left)*p.gearPosition/p.shaftSpan;
 const arrow=(x1,y1,x2,y2,colour,extra='')=>{const length=Math.hypot(x2-x1,y2-y1),ux=(x2-x1)/length,uy=(y2-y1)/length,bx=x2-ux*7,by=y2-uy*7;return `<path ${extra} d="M${x1} ${y1}L${x2} ${y2}M${bx-uy*3} ${by+ux*3}L${x2} ${y2}L${bx+uy*3} ${by-ux*3}" fill="none" stroke="${colour}" stroke-width="2"/>`;};
 const force=(cx,cy,axis,end,value)=>`<text x="${cx}" y="${cy}" text-anchor="middle">F<tspan baseline-shift="sub" font-size=".7em">${axis}${end?','+end:''}</tspan> = ${Math.abs(value)<1e-8?'0':value.toFixed(0)} Н</text>`;
 const supports=shaftReactionComponents(model).map((reaction,i)=>{
  const cx=i?right:left,base=reaction.locating?148:156,hatch=Array.from({length:8},(_,j)=>`M${cx-25+j*7} ${base}l-7 8`).join('');
  return `<g data-shaft-support="${reaction.end}" data-axial-constraint="${reaction.locating?'locating':'floating'}"><path d="M${cx} 116l-20 32h40Z" fill="white" stroke="#2f5140" stroke-width="2"/>${reaction.locating?'':`<circle cx="${cx-12}" cy="152" r="4" fill="white" stroke="#2f5140"/><circle cx="${cx+12}" cy="152" r="4" fill="white" stroke="#2f5140"/>`}<path data-support-hatching="${reaction.end}" d="M${cx-30} ${base}h60${hatch}" fill="none" stroke="#2f5140" stroke-width="1.5"/>${Math.abs(reaction.fxN)>1e-8?arrow(cx-(reaction.fxN<0?30:80),130,cx-(reaction.fxN<0?80:30),130,'#2563eb',`data-reaction-axis="x" data-value-n="${reaction.fxN}"`):''}${force(cx-55,100,'x',reaction.end,reaction.fxN)}${arrow(cx,219,cx,base+11,'#2f5140',`data-reaction-axis="y" data-value-n="${reaction.fyN}"`)}${force(cx,244,'y',reaction.end,reaction.fyN)}<text x="${cx+35}" y="143">${reaction.end}</text></g>`;
 }).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" class="scheme shaft-scheme" viewBox="0 0 700 395" role="img" aria-label="Розрахункова схема вала: штриховані опори та складові реакцій" font-family="Arial" font-size="16" fill="#17231b">${arrow(x,27,x,100,'#b45309')}${force(x,20,'y','',-r.F_out)}${Math.abs(r.Fa_out)>1e-8?arrow(x,70,x+70*Math.sign(r.Fa_out),70,'#b45309')+force(Math.max(85,Math.min(615,x+70*Math.sign(r.Fa_out))),58,'x','',r.Fa_out):''}<line x1="${left}" x2="${right}" y1="110" y2="110" stroke="#4d7358" stroke-width="8"/><line x1="${x}" x2="${x}" y1="96" y2="125" stroke="#2f5140" stroke-width="10"/>${supports}${arrow(625,250,680,250,'#647368')}${arrow(625,250,625,195,'#647368')}<text x="682" y="267">x</text><text x="617" y="188">y</text><text x="350" y="285" text-anchor="middle">L = ${(p.shaftSpan*1000).toFixed(0)} мм</text><text x="350" y="317" text-anchor="middle">a = ${(p.gearPosition*1000).toFixed(0)} мм</text><text x="350" y="349" text-anchor="middle">T = ${r.T_design.toFixed(1)} Н·м</text><text x="350" y="381" text-anchor="middle">x — вісь вала; y — площина результуючої сили</text></svg>`;
}

// Each ordinate is evaluated by the native beam model, with a common x mapping.
export function shaftDiagrams(model){
 const p=model.inputs,left=120,right=580,L=p.shaftSpan,a=p.gearPosition;
 const sx=x=>left+(right-left)*x/L,fmt=n=>Math.abs(n)<1e-12?'0':Number(n.toPrecision(4)).toString();
 const beam=shaftScheme(model).replace(/<svg[^>]*>/,'').replace(/<\/svg>$/,'');
 const rows=[{id:'shear',points:model.shearPoints(),symbol:'Q',unit:'Н',number:'6.2',title:'Поперечна сила',factor:1},
  {id:'moment',points:model.momentPoints(),symbol:'M',unit:'Н·м',number:'6.3',title:'Момент згину',factor:1},
  {id:'deflection',points:model.displacementPoints(),symbol:'f',unit:'мм',number:'6.4',title:'Прогин',factor:1000,positiveDown:true}];
 const panels=rows.map((row,i)=>{
  const top=440+i*205,max=Math.max(...row.points.map(q=>Math.abs(q.y*row.factor)),1e-12),rawStep=max/3,magnitude=10**Math.floor(Math.log10(rawStep)),step=[1,2,5,10].find(n=>n*magnitude>=rawStep)*magnitude,limit=Math.ceil(max/step)*step;
  const bipolar=row.points.some(q=>q.y*row.factor < -max*1e-10)&&!row.positiveDown,zero=top+(bipolar?70:row.positiveDown?15:125),height=bipolar?55:110,sy=y=>zero+(row.positiveDown?1:-1)*y*row.factor/limit*height;
  const xTicks=Array.from({length:5},(_,j)=>L*j/4),yTicks=Array.from({length:Math.round(limit/step)*(bipolar?2:1)+1},(_,j)=>(j-(bipolar?Math.round(limit/step):0))*step);
  const path=row.points.map((q,j)=>(j?'L':'M')+sx(q.x)+' '+sy(q.y)).join('');
  const grid=`<g data-diagram-grid="" stroke="#dce3de" stroke-width=".6">${xTicks.map(x=>`<line x1="${sx(x)}" x2="${sx(x)}" y1="${top+15}" y2="${top+125}"/>`).join('')}${yTicks.map(y=>`<line x1="${left}" x2="${right}" y1="${sy(y/row.factor)}" y2="${sy(y/row.factor)}"/>`).join('')}</g>`;
  const guides=[0,a,L].map(x=>`<line data-common-x="${x}" x1="${sx(x)}" x2="${sx(x)}" y1="${top+10}" y2="${top+130}" stroke="#a9b8ae" stroke-dasharray="3 4"/>`).join('');
  const labels=xTicks.map(x=>`<path d="M${sx(x)} ${zero-3}v6" stroke="#526057"/><text x="${sx(x)}" y="${zero+19}" text-anchor="middle">${fmt(x*1000)}</text>`).join('')+yTicks.map(y=>`<path d="M${left-3} ${sy(y/row.factor)}h6" stroke="#526057"/>${Math.abs(y)>1e-12?`<text x="${left-9}" y="${sy(y/row.factor)+4}" text-anchor="end">${fmt(y)}</text>`:''}`).join('');
  const extremes=row.points.filter(q=>q.x>0&&q.x<L&&Math.abs(q.y*row.factor)>=max-1e-12).filter((q,j,all)=>!all.slice(0,j).some(t=>t.x===q.x&&t.y===q.y));
  const yStart=top+(row.positiveDown?5:135),yEnd=top+(row.positiveDown?137:3),arrow=row.positiveDown?-1:1;
  return `<g data-beam-panel="${row.id}" data-x-start="${left}" data-x-end="${right}" data-zero-y="${zero}" data-ordinate-symbol="${row.symbol}" font-size="14">${grid}${guides}<path data-axis="x" d="M${left-5} ${zero}H${right+14}m-6 -3l6 3l-6 3" fill="none" stroke="#526057"/><path data-axis="y" d="M${left} ${yStart}V${yEnd}m-3 ${arrow*6}l3 ${-arrow*6}l3 ${arrow*6}" fill="none" stroke="#526057"/><text x="${left-12}" y="${top-9}" text-anchor="end">${row.symbol}, ${row.unit}</text>${labels}<path data-native-ordinates="" d="${path}" fill="none" stroke="#4d7358" stroke-width="2"/>${extremes.map(q=>`<circle cx="${sx(q.x)}" cy="${sy(q.y)}" r="2.5" fill="#4d7358"/><text x="${sx(q.x)}" y="${sy(q.y)+(row.positiveDown?18:-9)}" text-anchor="middle">${fmt(q.y*row.factor)}</text>`).join('')}<text x="${right+23}" y="${zero+5}">x, мм</text><text x="350" y="${top+188}" text-anchor="middle">Рисунок ${row.number} — ${row.title}</text></g>`;
 }).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" class="scheme shaft-diagram-group" viewBox="0 0 700 1045" role="img" aria-label="Схема вала та епюри зі спільною віссю x" font-family="Arial" fill="#17231b"><g data-beam-panel="loads" data-x-start="120" data-x-end="580">${beam}<text x="350" y="417" text-anchor="middle" font-size="14">Рисунок 6.1 — Розрахункова схема тихохідного вала.</text></g>${panels}</svg>`;
}
