/** Graph Studio technical formatting. MIT. Plotly remains the renderer. */
import {AdapterError, canonical, sha256, safeJSON} from './core.js';
export const TECHNICAL_VERSION = '0.4.1';
export const CSS_PX_PER_MM = 96 / 25.4;
export const SVG_UNITS_PER_MM = 10;
export const LINE_ROLES = ['primary','secondary','reference','limit','construction','centerline','uncertainty','axis','grid_major','grid_minor'];
export const DASH_PATTERNS = {solid:[],dashed:[4,2],dotted:[0.4,1.4],'dash-dot':[6,1.5,0.4,1.5],centerline:[10,2,0.4,2]};
export const MARKERS = ['native','none','circle','circle-open','square','square-open','triangle-up','triangle-down','diamond','cross','x'];
// Maximum un-stroked outline dimension / Plotly marker.size; verified by SVG fixtures.
export const MARKER_FACTORS = {circle:1,'circle-open':1,square:1,'square-open':1,'triangle-up':1.15,'triangle-down':1.15,diamond:1.3,cross:1.2,x:1.1313708498984762};
export const cloneTechnical = v => { if(ArrayBuffer.isView(v)) return new v.constructor(v); if(Array.isArray(v))return v.map(cloneTechnical); if(v&&typeof v==='object'){const o={};for(const[k,x]of Object.entries(v)){if(['__proto__','prototype','constructor'].includes(k))throw new AdapterError('UNSAFE_KEY',k);o[k]=cloneTechnical(x);}return o;}return v; };
const frozen = v => {if(v&&typeof v==='object'&&!ArrayBuffer.isView(v)){Object.values(v).forEach(frozen);Object.freeze(v);}return v;};
const techError = (code,message) => {throw new AdapterError(code,message);};
const near = (a,b,t=1e-9) => Math.abs(a-b)<=t;
const cleanNumber = x => Number(x.toFixed(8));
const escText = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function parseDashMM(s){if(Array.isArray(s)){if(s.length>16||s.length%2||s.some(x=>typeof x!=='number'||!Number.isFinite(x)||x<=0||x>100))techError('DASH_GEOMETRY','Use up to eight positive dash/gap pairs in mm.');return [...s];}if(typeof s!=='string')techError('DASH_GEOMETRY','Dash pattern must be a numeric array or comma-separated lengths.');if(!s.trim())return[];return parseDashMM(s.split(/[\s,;]+/).filter(Boolean).map(Number));}
const roleToken = (width,color,dash=[],marker='native') => ({width_mm:width,color,dash_mm:dash,dash_offset_mm:0,cap:'butt',join:'round',marker,marker_mm:1.8,marker_edge_mm:0.2,max_markers:16});
function baseTechnicalProfile(){return {
 schema:'graph-technical-profile/0.4',name:'UA / DSTU-oriented report',mode:'technical_format',
 page:{width_mm:160,height_mm:110,left_mm:19,right_mm:10,top_mm:12,bottom_mm:15,caption_mm:18,dpi:600},
 typography:{family:'Arial',size_mm:3.4,cap_height_mm:null,text_policy:'external_font_required'},
 background:'#ffffff',foreground:'#111111',
 grid:{major:true,minor:true},
 axes:{ticks:'outside',tick_length_mm:1.5,minor_tick_length_mm:0.8,ends:'arrows',arrow_mm:2,label_position:'arrowhead',notation:'comma',labels:false,steps:{x:{major:null,minor:null},y:{major:null,minor:null},z:{major:null,minor:null}}},
 legend:'top',
 roles:{primary:roleToken(.6,'#111111',[],'circle-open'),secondary:roleToken(.45,'#333333',[4,2]),reference:roleToken(.3,'#555555',[6,1.5,.4,1.5]),limit:roleToken(.5,'#111111',[2,1]),construction:roleToken(.2,'#666666',[.4,1.4]),centerline:roleToken(.25,'#444444',[10,2,.4,2]),uncertainty:roleToken(.25,'#666666',[2,1]),axis:roleToken(.25,'#111111'),grid_major:roleToken(.18,'#a8adb3'),grid_minor:roleToken(.09,'#d9dce0')},
 caption:{enabled:true,number:'1.1',title:'',source:'',notes:'',prefix:'Рисунок'},
 metadata:{x:{quantity:'',symbol:'',unit:''},y:{quantity:'',symbol:'',unit:''},z:{quantity:'',symbol:'',unit:''}},
 provenance:'Project drawing choices + DSTU 3008:2015 figure-caption convention; not a standards certificate.'
};}
const ua=baseTechnicalProfile();const color=cloneTechnical(ua);color.name='Technical colour';color.roles.primary.color='#086b7c';color.roles.secondary.color='#9b542b';color.roles.limit.color='#a13c3c';
const mono=cloneTechnical(ua);mono.name='Publication monochrome';Object.entries(mono.roles).forEach(([k,v])=>{if(!k.startsWith('grid'))v.color='#111111';});
export const technicalProfiles=frozen({ua,colour:color,monochrome:mono});
function exactKeys(obj,allowed,label){if(!obj||typeof obj!=='object'||Array.isArray(obj))techError('INVALID_PROFILE',`${label} must be an object.`);for(const k of Object.keys(obj))if(!allowed.includes(k))techError('INVALID_PROFILE',`Unknown ${label}.${k}`);for(const k of allowed)if(!Object.hasOwn(obj,k))techError('INVALID_PROFILE',`Missing ${label}.${k}`);}
function num(v,min,max,key){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)techError('INVALID_PROFILE',`${key} must be ${min}–${max}.`);}
function str(v,max,key){if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))techError('INVALID_PROFILE',`Invalid ${key}.`);}
function one(v,values,key){if(!values.includes(v))techError('INVALID_PROFILE',`Invalid ${key}: ${v}`);}
function hex(v,key){if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))techError('INVALID_PROFILE',`${key} must be #RRGGBB.`);}
export function validateTechnicalProfile(input){
 const p=cloneTechnical(input);const base=baseTechnicalProfile();exactKeys(p,Object.keys(base),'profile');
 for(const k of Object.keys(base))if(!(k in p))techError('INVALID_PROFILE',`Missing ${k}.`);
 one(p.schema,['graph-technical-profile/0.4'],'schema');one(p.mode,['technical_format','native_style'],'mode');str(p.name,100,'name');str(p.provenance,1000,'provenance');
 exactKeys(p.page,Object.keys(base.page),'page');for(const[k,v]of Object.entries(p.page))num(v,k==='dpi'?96:k==='width_mm'?60:k==='height_mm'?60:0,k==='dpi'?600:500,`page.${k}`);
 if(p.page.width_mm>400||p.page.height_mm>400)techError('RESOURCE_LIMIT','Maximum page side is 400 mm.');
 one(p.page.dpi,[96,150,300,600],'dpi');
 const cap=p.caption?.enabled?p.page.caption_mm:0;
 if(p.page.width_mm-p.page.left_mm-p.page.right_mm<30||p.page.height_mm-cap-p.page.top_mm-p.page.bottom_mm<25)techError('LAYOUT_OVERFLOW','Margins and caption must leave at least a 30 × 25 mm plot.');
 if(p.caption?.enabled&&cap<8)techError('LAYOUT_OVERFLOW','Reserve at least 8 mm for a caption.');
 if(Math.round(p.page.width_mm*p.page.dpi/25.4)*Math.round(p.page.height_mm*p.page.dpi/25.4)>40000000)techError('RESOURCE_LIMIT','PNG output exceeds 40 megapixels. Reduce size or DPI.');
 exactKeys(p.typography,Object.keys(base.typography),'typography');one(p.typography.family,['Arial','Times New Roman','Georgia','Verdana','Courier New'],'font family');num(p.typography.size_mm,2,8,'font em size');if(p.typography.cap_height_mm!==null)num(p.typography.cap_height_mm,1.5,6,'cap height');one(p.typography.text_policy,['external_font_required'],'text policy');
 hex(p.background,'background');hex(p.foreground,'foreground');exactKeys(p.grid,['major','minor'],'grid');for(const v of Object.values(p.grid))one(v,[true,false],'grid visibility');
 exactKeys(p.axes,Object.keys(base.axes),'axes');one(p.axes.ticks,['outside','inside',''],'ticks');one(p.axes.ends,['plain','arrows'],'axis ends');one(p.axes.label_position,['center','end','arrowhead'],'label position');one(p.axes.notation,['comma','slash','brackets','quantity'],'notation');one(p.axes.labels,[true,false],'label override');num(p.axes.tick_length_mm,0,6,'tick length');num(p.axes.minor_tick_length_mm,0,4,'minor tick length');num(p.axes.arrow_mm,1,5,'arrow length');
 exactKeys(p.axes.steps,['x','y','z'],'steps');for(const a of ['x','y','z']){exactKeys(p.axes.steps[a],['major','minor'],`steps.${a}`);for(const[k,v]of Object.entries(p.axes.steps[a]))if(v!==null)num(v,1e-12,1e12,`${a} ${k} interval`);const s=p.axes.steps[a];if(s.major&&s.minor&&s.minor>=s.major)techError('TICK_INTERVAL','Minor interval must be smaller than major interval.');}
 one(p.legend,['native','top','bottom','right','hidden'],'legend');exactKeys(p.roles,LINE_ROLES,'roles');for(const r of LINE_ROLES){const t=p.roles[r];exactKeys(t,Object.keys(roleToken(1,'#000000')),`role.${r}`);num(t.width_mm,.05,2,`${r} width`);hex(t.color,r);t.dash_mm=parseDashMM(t.dash_mm);num(t.dash_offset_mm,-100,100,'dash offset');one(t.cap,['butt','round','square'],'cap');one(t.join,['round','miter','bevel'],'join');one(t.marker,MARKERS,'marker');num(t.marker_mm,.5,8,'marker size');num(t.marker_edge_mm,.05,1,'marker edge');num(t.max_markers,0,1000,'maximum markers');if(!Number.isInteger(t.max_markers))techError('INVALID_PROFILE','Maximum markers must be an integer.');}
 exactKeys(p.caption,Object.keys(base.caption),'caption');one(p.caption.enabled,[true,false],'caption enabled');for(const k of ['number','title','source','notes','prefix'])str(p.caption[k],k==='number'?30:k==='prefix'?30:600,`caption ${k}`);
 exactKeys(p.metadata,['x','y','z'],'metadata');for(const a of ['x','y','z']){exactKeys(p.metadata[a],['quantity','symbol','unit'],a);for(const[k,v]of Object.entries(p.metadata[a]))str(v,100,`${a} ${k}`);}
 return frozen(p);
}
export function technicalDimensions(profile){const p=profile.page,c=profile.caption.enabled?p.caption_mm:0;return{width_mm:p.width_mm,height_mm:p.height_mm,chart_height_mm:p.height_mm-c,caption_mm:c,plot:{x_mm:p.left_mm,y_mm:p.top_mm,width_mm:p.width_mm-p.left_mm-p.right_mm,height_mm:p.height_mm-c-p.top_mm-p.bottom_mm},raster:{width:Math.round(p.width_mm*p.dpi/25.4),height:Math.round(p.height_mm*p.dpi/25.4),dpi:p.dpi}};}
export function quantityLabel(m,notation='comma'){const q=m.quantity||'',s=m.symbol||q,u=m.unit||'';if(notation==='quantity')return q+(m.symbol?', '+m.symbol:'')+(u?' ['+u+']':'');return s+(u?(notation==='comma'?', ':notation==='slash'?' / ':' [')+u+(notation==='brackets'?']':''):'');}
export function profileWarnings(p,is3d=false){const w=[];const ratio=p.roles.primary.width_mm/p.roles.axis.width_mm;if(ratio<2||ratio>3)w.push(`Curve / axis width ratio is ${ratio.toFixed(2)}. Project target 2–3; not attributed as a universal DSTU rule.`);if(p.roles.grid_minor.width_mm>=p.roles.grid_major.width_mm)w.push('Minor grid is not thinner than major grid.');if(p.roles.grid_major.width_mm>=p.roles.axis.width_mm)w.push('Major grid is not thinner than axes.');if(is3d)w.push('3D: physical dashes, SVG caps/joins, minor grids, 2D arrowheads and endpoint labels are not supported; camera and scalar colours remain protected.');w.push('Fonts are external requirements, not bundled or certified drafting fonts.');return w;}
function getT(obj,path){const parts=path.split('.');let cur=obj;for(const k of parts.slice(0,-1)){if(!cur||!Object.hasOwn(cur,k))return{present:false};cur=cur[k];}const k=parts.at(-1);return cur&&Object.hasOwn(cur,k)?{present:true,value:cloneTechnical(cur[k])}:{present:false};}
function delT(obj,path){const parts=path.split('.');let cur=obj;for(const k of parts.slice(0,-1)){if(!cur||!Object.hasOwn(cur,k))return;cur=cur[k];}if(cur)delete cur[parts.at(-1)];}
function pruneT(v){if(Array.isArray(v))return v.map(pruneT);if(v&&typeof v==='object'&&!ArrayBuffer.isView(v)){const o={};for(const[k,x]of Object.entries(v)){const q=pruneT(x);if(q&&typeof q==='object'&&!Array.isArray(q)&&Object.keys(q).length===0)continue;o[k]=q;}return o;}return v;}
export function applyTechnicalOperationsToCopy(state,ops){const s=cloneTechnical(state);for(const op of ops){const target=op.target==='layout'?s.layout:s.data[op.index];const parts=op.path.split('.');let o=target;for(const k of parts.slice(0,-1))o=o[k]??=( {} );if(op.remove)delete o[parts.at(-1)];else o[parts.at(-1)]=cloneTechnical(op.next);}return s;}
function technicalProtected(state,ops){const s=cloneTechnical(state);for(const op of ops)delT(op.target==='layout'?s.layout:s.data[op.index],op.path);return {data:canonical(pruneT(s.data)),layout:canonical(pruneT(s.layout)),host:canonical(s.host)};}
function technicalView(state){if(!state?.layout)return 'missing-native-layout';const v={};for(const[k,a]of Object.entries(state.layout)){if(/^[xy]axis\d*$/.test(k)){v[k]={};for(const n of ['range','autorange','type','scaleanchor','scaleratio','domain'])if(n in a)v[k][n]=a[n];}if(/^scene\d*$/.test(k)){v[k]={};for(const n of ['camera','aspectmode','aspectratio','domain'])if(n in a)v[k][n]=a[n];}}return canonical(v);}
function bindTechnical(state,bindings){const used=new Set();for(const b of bindings){if(!Number.isInteger(b.index)||!state.data[b.index]||used.has(b.index)||!LINE_ROLES.includes(b.role))techError('INVALID_BINDING','Each binding needs a unique existing trace index and a known semantic role.');used.add(b.index);for(const[k,v]of Object.entries(b.channels??{}))if(!['color','width','dash','marker'].includes(k)||!['decorative','quantitative','categorical','unknown'].includes(v))techError('INVALID_BINDING','Invalid channel classification.');}return bindings;}
export function planTechnicalStyle(state,input,bindings=[],context={}){
 const p=validateTechnicalProfile(input),k=context.pxPerMm??CSS_PX_PER_MM;num(k,.1,40,'px per mm');bindTechnical(state,bindings);const ops=[],notices=[];
 const add=(target,index,path,next,token)=>{if(next===undefined)return;const prior=getT(target==='layout'?state.layout:state.data[index],path);if(prior.present&&canonical(prior.value)===canonical(next))return;ops.push({target,...(target==='trace'?{index}:{}),path,previous:prior,next:cloneTechnical(next),token});};
 const la=(path,v,token=path)=>add('layout',null,path,v,token),tr=(i,path,v,token=path)=>add('trace',i,path,v,token);
 const axes=new Set(Object.keys(state.layout).filter(x=>/^[xy]axis\d*$/.test(x))),scenes=new Set(Object.keys(state.layout).filter(x=>/^scene\d*$/.test(x)));
 for(const t of state.data){if(['surface','mesh3d','scatter3d'].includes(t.type))scenes.add(t.scene??'scene');else if(!t.type||['scatter','scattergl'].includes(t.type)){axes.add((t.xaxis??'x').replace('x','xaxis'));axes.add((t.yaxis??'y').replace('y','yaxis'));}else techError('UNSUPPORTED_TRACE','Technical release supports scatter, scattergl, scatter3d, surface and mesh3d.');}
 const tech=p.mode==='technical_format',dims=technicalDimensions(p);if(tech&&(axes.size>2||scenes.size>1||(axes.size&&scenes.size)))techError('UNSUPPORTED_LAYOUT','Fixed technical layout supports a single XY plot or a single 3D scene. Native-style mode can style additional axes.');
 if(tech)for(const a of axes){const q=state.layout[a]??{};if(q.scaleanchor||q.matches||q.overlaying||q.anchor==='free'||(q.domain&&canonical(q.domain)!==canonical([0,1])))techError('CONSTRAINED_LAYOUT','Fixed paper layout must not change constrained/overlaid axis geometry. Use native-style mode.');}
 const fontPx=context.fontSizePx??resolveTechnicalFontPx(p,k);
 const font=prefix=>{la(prefix+'.family',p.typography.family,'font');la(prefix+'.size',fontPx,'font');la(prefix+'.color',p.foreground,'font');};
 font('font');font('legend.font');if(state.layout.title?.text)font('title.font');
 la('paper_bgcolor',p.background);la('plot_bgcolor',p.background);
 const axisStyle=(path,is3d=false)=>{
   font(path+'.tickfont');font(path+'.title.font');const a=p.roles.axis,g=p.roles.grid_major,m=p.roles.grid_minor;
   la(path+'.showgrid',p.grid.major,'grid.major');la(path+'.gridcolor',g.color,'grid_major');la(path+'.gridwidth',g.width_mm*k,'grid_major');la(path+'.linecolor',a.color,'axis');la(path+'.linewidth',a.width_mm*k,'axis');la(path+'.tickcolor',a.color,'axis');
   if(tech){la(path+'.showline',true,'axis');la(path+'.ticks',p.axes.ticks);la(path+'.ticklen',p.axes.tick_length_mm*k);la(path+'.tickwidth',a.width_mm*k);}
   if(!is3d){la(path+'.griddash',g.dash_mm.length?g.dash_mm.map(v=>cleanNumber(v*k)+'px').join(','):'solid','grid_major');la(path+'.minor.showgrid',p.grid.minor,'grid.minor');la(path+'.minor.gridcolor',m.color,'grid_minor');la(path+'.minor.gridwidth',m.width_mm*k,'grid_minor');la(path+'.minor.griddash',m.dash_mm.length?m.dash_mm.map(v=>cleanNumber(v*k)+'px').join(','):'solid','grid_minor');if(tech){la(path+'.minor.ticks',p.grid.minor?p.axes.ticks:'');la(path+'.minor.ticklen',p.axes.minor_tick_length_mm*k);la(path+'.minor.tickwidth',a.width_mm*k*.65);la(path+'.automargin',false);la(path+'.title.standoff',2*k);la(path+'.ticklabelposition','outside');}}
   if(tech){const letter=path.split('.').at(-1)[0],q=state.layout[path]??getT(state.layout,path).value??{},s=p.axes.steps[letter];for(const[j,step]of Object.entries(s)){if(step===null)continue;if(j==='minor'&&is3d){notices.push('3D minor intervals are unsupported.');continue;}if(q.type&&q.type!=='linear')techError('TICK_SCALE','Explicit numeric intervals in this panel require a linear axis. Native logarithmic ticks are preserved when interval inputs are blank.');const range=q.range;if(range&&Math.abs(range[1]-range[0])/step>300)techError('GRID_DENSITY','More than 300 grid divisions. Increase the interval.');const sub=j==='minor'?'.minor':'';la(path+sub+'.tickmode','linear');la(path+sub+'.tick0',0);la(path+sub+'.dtick',step);}
    if(p.axes.labels){const text=quantityLabel(p.metadata[letter],p.axes.notation);if(!text)techError('MISSING_QUANTITY',`Provide metadata for ${letter} or disable label override.`);la(path+'.title.text',p.axes.label_position!=='center'&&!is3d?'':escText(text),'quantity label');}}
 };
 axes.forEach(a=>axisStyle(a));scenes.forEach(s=>{['xaxis','yaxis','zaxis'].forEach(a=>axisStyle(s+'.'+a,true));la(s+'.bgcolor',p.background);});
 if(tech){la('width',dims.width_mm*k,'page');la('height',dims.chart_height_mm*k,'page');la('autosize',false,'page');for(const[a,field]of Object.entries({l:'left_mm',r:'right_mm',t:'top_mm',b:'bottom_mm'}))la('margin.'+a,p.page[field]*k,'page');la('margin.pad',0,'page');la('margin.autoexpand',false,'page');
   if(p.legend==='hidden')la('showlegend',false);else if(p.legend!=='native'){la('showlegend',true);la('legend.orientation',p.legend==='right'?'v':'h');la('legend.x',p.legend==='right'?1.02:p.axes.labels&&p.axes.label_position!=='center'?.34:0);la('legend.xanchor','left');la('legend.y',p.legend==='bottom'?-0.18:1+2/dims.plot.height_mm);la('legend.yanchor',p.legend==='bottom'?'top':'bottom');}
   // Only adapter-owned shapes/labels are regenerated. Other native annotations are retained.
   const anns=cloneTechnical(state.layout.annotations??[]).filter(a=>!String(a.name??'').startsWith('graph-style:'));
   const shapes=cloneTechnical(state.layout.shapes??[]).filter(a=>!String(a.name??'').startsWith('graph-style:'));
   if(axes.size){if(p.axes.labels&&p.axes.label_position!=='center'){
     const atArrow=p.axes.label_position==='arrowhead'&&p.axes.ends==='arrows';
     if(p.axes.label_position==='arrowhead'&&!atArrow)notices.push('Arrowheads are off: arrowhead title placement uses the plain axis-end layout.');
     for(const a of ['x','y']){
       const text=quantityLabel(p.metadata[a],p.axes.notation);
       let placement={x:a==='x'?1:0,y:a==='x'?0:1,xanchor:a==='x'?'right':'left',yanchor:a==='x'?'top':'bottom',yshift:(a==='x'?-6:2)*k};
       if(atArrow){
         // Distances are publication lengths, scaled at the same boundary as the
         // arrowheads. Keep native annotations so HTML, PNG and SVG agree.
         const gap=1.5*k;
         if(a==='x'){
           let textWidth=text.length*fontPx*.65;
           if(typeof document!=='undefined'){
             const ctx=document.createElement('canvas').getContext('2d');
             if(ctx){ctx.font=`${fontPx}px "${p.typography.family}"`;textWidth=ctx.measureText(text).width;}
           }
           // A short label sits immediately beyond the tip. A long name uses
           // the space above the shaft, rather than clipping in the right margin.
           const fitsRight=textWidth+gap+0.5*k<=p.page.right_mm*k;
           placement=fitsRight
             ?{x:1,y:0,xanchor:'left',yanchor:'middle',xshift:gap,yshift:0}
             :{x:1,y:0,xanchor:'right',yanchor:'bottom',xshift:0,yshift:gap+p.axes.arrow_mm*.35*k};
         }else placement={x:0,y:1,xanchor:'left',yanchor:'bottom',xshift:gap,yshift:gap};
       }
       anns.push({name:'graph-style:label-'+a,xref:'paper',yref:'paper',...placement,showarrow:false,text:escText(text),font:{family:p.typography.family,size:fontPx,color:p.foreground},...(atArrow?{borderpad:0,borderwidth:0,textangle:0}: {})});
     }
   }
    if(p.axes.ends==='arrows'){const w=dims.plot.width_mm,h=dims.plot.height_mm,L=p.axes.arrow_mm;shapes.push({name:'graph-style:arrow-x',type:'path',xref:'paper',yref:'paper',path:`M 1,0 L ${1-L/w},${L*.35/h} L ${1-L/w},${-L*.35/h} Z`,fillcolor:p.roles.axis.color,line:{width:0},layer:'above'});shapes.push({name:'graph-style:arrow-y',type:'path',xref:'paper',yref:'paper',path:`M 0,1 L ${-L*.35/w},${1-L/h} L ${L*.35/w},${1-L/h} Z`,fillcolor:p.roles.axis.color,line:{width:0},layer:'above'});}}
   if(anns.length||state.layout.annotations)la('annotations',anns,'owned labels');if(shapes.length||state.layout.shapes)la('shapes',shapes,'owned arrowheads');
 }
 for(const b of bindings){const t=state.data[b.index],r=p.roles[b.role],ch=b.channels??{};
  if(['scatter','scattergl','scatter3d'].includes(t.type??'scatter')){
   if(ch.width==='decorative'){if(Array.isArray(t.line?.width)||ArrayBuffer.isView(t.line?.width))techError('ENCODING_PROTECTED','Array-valued widths cannot be replaced.');tr(b.index,'line.width',r.width_mm*k,b.role);}
   if(ch.color==='decorative'){if(Array.isArray(t.line?.color)||ArrayBuffer.isView(t.line?.color))techError('ENCODING_PROTECTED','Array-valued colours cannot be replaced.');tr(b.index,'line.color',r.color,b.role);}
   if(ch.dash==='decorative'){if((t.type??'scatter')==='scatter')tr(b.index,'line.dash',r.dash_mm.length?r.dash_mm.map(v=>cleanNumber(v*k)+'px').join(','):'solid',b.role);else if(r.dash_mm.length)notices.push(`Trace ${b.index}: physical dashes unavailable in this WebGL route.`);}
   if(ch.marker==='decorative'&&r.marker!=='native'){
    if((t.type??'scatter')!=='scatter'){notices.push(`Trace ${b.index}: calibrated markers are qualified for 2D SVG scatter only.`);continue;}
    const m=t.marker??{};for(const v of [m.size,m.color,m.symbol,m.opacity,m.line?.color,m.line?.width])if(Array.isArray(v)||ArrayBuffer.isView(v))techError('ENCODING_PROTECTED','Array-valued markers are protected.');
    const oldMode=t.mode??'lines';if(oldMode==='none')techError('ENCODING_PROTECTED','An invisible native trace cannot be made visible by a marker style.');
    if(r.marker==='none'){const parts=oldMode.split('+').filter(s=>s!=='markers');if(!parts.length)techError('ENCODING_PROTECTED','Removing the only marker representation would hide a data series.');tr(b.index,'mode',parts.join('+'),'marker visibility');}
    else{tr(b.index,'mode',[...new Set([...oldMode.split('+'),'markers'])].join('+'),'marker appearance');tr(b.index,'marker.symbol',r.marker,'marker');tr(b.index,'marker.size',r.marker_mm*k/(MARKER_FACTORS[r.marker]??1),'marker');tr(b.index,'marker.sizemode','diameter','marker');tr(b.index,'marker.sizeref',1,'marker');tr(b.index,'marker.line.width',r.marker_edge_mm*k,'marker');tr(b.index,'marker.line.color',r.color,'marker');tr(b.index,'marker.color',r.color,'marker');tr(b.index,'marker.maxdisplayed',r.max_markers,'marker');}
   }
  }
 }
 // Colourbar typography is presentation only. Scalar arrays, ranges and palettes never change.
 state.data.forEach((t,i)=>{const cb=t.colorbar??t.marker?.colorbar??t.line?.colorbar;const prefix=t.colorbar?'colorbar':t.marker?.colorbar?'marker.colorbar':t.line?.colorbar?'line.colorbar':null;if(prefix){for(const sub of ['tickfont','title.font']){tr(i,prefix+'.'+sub+'.family',p.typography.family,'font');tr(i,prefix+'.'+sub+'.size',fontPx,'font');tr(i,prefix+'.'+sub+'.color',p.foreground,'font');}}});
 // Plotly clears authored autosize when only width/height are relaid out. Keep
 // this existing policy explicitly in the same native update (not an unreported mutation).
 if(tech && ops.some(op=>op.target==='layout'&&['width','height'].includes(op.path)) && !ops.some(op=>op.target==='layout'&&op.path==='autosize'))ops.push({target:'layout',path:'autosize',previous:getT(state.layout,'autosize'),next:false,token:'page:retain-sizing-policy'});
 return frozen({schema:'graph-technical-plan/0.4',version:TECHNICAL_VERSION,profile:p,pxPerMm:k,operations:ops,notices:[...notices,...profileWarnings(p,!!scenes.size)],dimensions:dims});
}
export function createTechnicalAdapter(Plotly,graph,options={}){
 if(!Plotly?.restyle||!Plotly?.relayout||!graph?.data)techError('INVALID_TARGET','Attach to a rendered native Plotly chart.');if(Plotly.version!=='3.3.1'&&!options.allowUntestedVersion)techError('UNTESTED_ENGINE','Qualified engine: Plotly.js 3.3.1.');if(typeof options.withExclusive!=='function')techError('OWNERSHIP_REQUIRED','Supply withExclusive shared with host chart updates.');
 const bindings=cloneTechnical(options.bindings??[]),identities=bindings.map(b=>({b,uid:graph.data[b.index]?.uid,ref:graph.data[b.index]})),plans=new WeakMap(),history=[];let disposed=false,lastProfile=null;
 const alive=()=>{if(disposed)techError('DISPOSED','Adapter disposed.');};
 const capture=async()=>{alive();if(options.awaitSettled)await options.awaitSettled();return{data:cloneTechnical(graph.data),layout:cloneTechnical(graph.layout),host:options.readProtectedState?cloneTechnical(await options.readProtectedState()):null,revision:options.readRevision?String(await options.readRevision()):null};};
 const fresh=()=>{for(const{b,uid,ref}of identities)if(!graph.data[b.index]||(uid?graph.data[b.index].uid!==uid:graph.data[b.index]!==ref))techError('STALE_BINDING','Trace was replaced or reordered. Reattach the adapter.');};
 async function prepare(p){alive();fresh();const before=await capture(),plan=planTechnicalStyle(before,p,bindings,options);const publicPlan=frozen({...plan,baseDigest:await sha256(canonical(before))});plans.set(publicPlan,{before,oldProfile:lastProfile});return publicPlan;}
 async function write(ops,reverse=false){const layout={},trace=new Map();for(const op of ops){const value=reverse?(op.previous.present?cloneTechnical(op.previous.value):null):(op.remove?null:cloneTechnical(op.next));if(op.target==='layout')layout[op.path]=value;else{if(!trace.has(op.index))trace.set(op.index,{});trace.get(op.index)[op.path]=Array.isArray(value)?[cloneTechnical(value)]:value;}}
  if(Object.keys(layout).length)await Plotly.relayout(graph,layout);for(const[i,patch]of trace)await Plotly.restyle(graph,patch,[i]);if(options.awaitSettled)await options.awaitSettled();}
 async function apply(plan,isUndo=false){alive();fresh();const saved=plans.get(plan);if(!saved)techError('INVALID_PLAN','Only an unconsumed plan from this adapter can be applied.');if(canonical(await capture())!==canonical(saved.before))techError('STALE_PLAN','Native chart changed since planning. Replan.');plans.delete(plan);let after,err;
  try{await write(plan.operations);after=await capture();}catch(e){err=e;after=await capture();}
  const A=technicalProtected(saved.before,plan.operations),B=technicalProtected(after,plan.operations);const checks=Object.keys(A).map(id=>({property:id,status:id==='host'&&!options.readProtectedState?'nominal':A[id]===B[id]?'verified':'failed',method:'native before/after protected-field comparison'}));checks.push({property:'view',status:technicalView(saved.before)===technicalView(after)?'verified':'failed',method:'camera/scale/range/aspect comparison'});
  const applied=plan.operations.every(op=>{const q=getT(op.target==='layout'?after.layout:after.data[op.index],op.path);return op.remove?!q.present:q.present&&canonical(q.value)===canonical(op.next);});checks.push({property:'requested_style',status:applied&&!err?'verified':'failed',method:'native leaf-field readback'});
  const accepted=!err&&!checks.some(c=>c.status==='failed');let recovery='not_needed';if(!accepted){if(options.readRevision&&after.revision!==saved.before.revision)recovery='conflict';else try{await write(plan.operations,true);recovery=canonical(pruneT(await capture()))===canonical(pruneT(saved.before))?'restored':'recovery_required';}catch{recovery='recovery_required';}}
  const report={schema:'graph-technical-report/0.4',version:TECHNICAL_VERSION,engine:Plotly.version,outcome:accepted?'accepted':'failed',operationCount:plan.operations.length,checks,recovery,notices:plan.notices,beforeDigest:plan.baseDigest,afterDigest:await sha256(canonical(after)),profile:plan.profile,styleMismatches:plan.operations.filter(op=>{const q=getT(op.target==='layout'?after.layout:after.data[op.index],op.path);return op.remove?q.present:!q.present||canonical(q.value)!==canonical(op.next);}).map(op=>({path:op.path,expected:op.next,actual:getT(op.target==='layout'?after.layout:after.data[op.index],op.path)}))};
  if(!accepted)throw new AdapterError('PRESERVATION_FAILED',err?.message??'Protected values or requested style did not pass readback.',report);
  if(!isUndo)history.push({operations:plan.operations,profile:saved.oldProfile});lastProfile=plan.profile;finishTechnicalSVG(graph,graph.data,lastProfile,bindings,options.pxPerMm??CSS_PX_PER_MM);return {plan,report};
 }
 const finish=()=>{if(lastProfile&&!disposed)finishTechnicalSVG(graph,graph.data,lastProfile,bindings,options.pxPerMm??CSS_PX_PER_MM);};graph.on?.('plotly_afterplot',finish);
 return {plan:p=>options.withExclusive(()=>prepare(p)),apply:plan=>options.withExclusive(()=>apply(plan)),applyProfile:p=>options.withExclusive(async()=>apply(await prepare(p))),capture:()=>options.withExclusive(capture),get canUndo(){return !!history.length;},get profile(){return lastProfile;},undo:()=>options.withExclusive(async()=>{if(!history.length)techError('NO_UNDO','No style to undo.');const h=history.at(-1),before=await capture();for(const op of h.operations){const cur=getT(op.target==='layout'?before.layout:before.data[op.index],op.path);if(!cur.present||canonical(cur.value)!==canonical(op.next))techError('UNDO_CONFLICT','A styled field changed since applying. Undo will not overwrite it.');}const ops=h.operations.map(op=>({...op,previous:getT(op.target==='layout'?before.layout:before.data[op.index],op.path),next:op.previous.present?op.previous.value:null,remove:!op.previous.present}));const plan=frozen({profile:h.profile??lastProfile,operations:ops,notices:[],baseDigest:await sha256(canonical(before))});plans.set(plan,{before});const result=await apply(plan,true);history.pop();lastProfile=h.profile;if(lastProfile)finish();return result;}),dispose(){disposed=true;graph.removeListener?.('plotly_afterplot',finish);history.length=0;}};
}
/** Qualified presentation finishing step on native SVG, reapplied after native redraws. */
export function finishTechnicalSVG(root,data,p,bindings,k){
 if(!root?.querySelectorAll)return;
 const active=data.map((t,i)=>({t,i})).filter(({t})=>(t.type??'scatter')==='scatter'&&t.visible!==false&&t.visible!=='legendonly');
 const groups=[...root.querySelectorAll('.scatterlayer > .trace.scatter')];
 active.forEach(({t,i},j)=>{const g=groups[j],b=bindings.find(b=>b.index===i);if(!g)return;g.setAttribute('data-graph-index',String(i));if(!b)return;const r=p.roles[b.role];g.setAttribute('data-graph-role',b.role);for(const path of g.querySelectorAll('.js-line')){if(b.channels?.dash==='decorative'){path.style.strokeDashoffset=String(r.dash_offset_mm*k)+'px';path.style.strokeLinecap=r.cap;path.style.strokeLinejoin=r.join;}}
 });
 const styles=[['.xlines-above,.ylines-above','axis'],['.gridlayer .xgrid,.gridlayer .ygrid','grid_major'],['.minor-gridlayer .xgrid,.minor-gridlayer .ygrid','grid_minor']];for(const[selector,role]of styles)root.querySelectorAll(selector).forEach(el=>{el.setAttribute('data-graph-role',role);if(role==='axis')el.style.strokeDasharray=p.roles[role].dash_mm.length?p.roles[role].dash_mm.map(v=>v*k).join(','):'none';el.style.strokeLinecap=p.roles[role].cap;el.style.strokeLinejoin=p.roles[role].join;el.style.strokeDashoffset=(p.roles[role].dash_offset_mm*k)+'px';});
}

export function resolveTechnicalFontPx(p,k=CSS_PX_PER_MM){
 if(p.typography.cap_height_mm===null)return p.typography.size_mm*k;
 if(typeof document==='undefined')techError('FONT_CALIBRATION_UNAVAILABLE','Cap-height calibration requires a browser.');
 const c=document.createElement('canvas').getContext('2d');c.font=`100px "${p.typography.family}"`;
 const ascent=c.measureText('H').actualBoundingBoxAscent;if(!(ascent>0))techError('FONT_CALIBRATION_UNAVAILABLE','Browser cannot measure reference H.');
 return p.typography.cap_height_mm*k*100/ascent;
}
