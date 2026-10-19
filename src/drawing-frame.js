// Physical millimetres. Form-1 layout: 65 mm signature/revision area,
// 70 mm name/material area and 50 mm classification/scale area.
export const escapeDrawing=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const drawingText=(x,y,value,attrs='')=>`<text x="${x}" y="${y}" ${attrs}>${escapeDrawing(value)}</text>`;
const line=(x1,y1,x2,y2)=>`<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="black" stroke-width=".25"/>`;
function cell(x,y,w,h,value,{font=3.5,align='middle',name=''}={}){
 const words=String(value).split(/\s+/),max=Math.max(5,Math.floor((w-3)/(font*.51))),rows=[''];
 for(const word of words){const i=rows.length-1;if(rows[i]&&(rows[i]+' '+word).length>max)rows.push(word);else rows[i]+=(rows[i]?' ':'')+word;}
 const count=Math.max(1,Math.floor((h-1)/(font*1.35))),shown=rows.slice(0,count);if(rows.length>count)shown[count-1]=shown[count-1].slice(0,-1)+'…';
 return `<g data-title-field="${name}" data-cell="${[x,y,w,h].join(',')}"${['student','designation'].includes(name)?' translate="no"':''}>${shown.map((s,i)=>drawingText(align==='middle'?x+w/2:x+1.5,y+h/2+(i-(shown.length-1)/2)*font*1.35+font*.35,s,`font-size="${font}" text-anchor="${align==='middle'?'middle':'start'}"${s.length>max?` textLength="${w-3}" lengthAdjust="spacingAndGlyphs"`:''}`)).join('')}</g>`;
}
export function drawingTitleBlock({x,y,title,designation,material='—',student='',group='',scale='1:1',mass='—',sheet='',sheets=1}){
 let svg=`<g data-title-block="185x55" data-form="1"><rect x="${x}" y="${y}" width="185" height="55" fill="white" stroke="black" stroke-width=".7"/>`;
 const L=(a,b,c,d)=>svg+=line(x+a,y+b,x+c,y+d),C=(a,b,w,h,v,opts)=>svg+=cell(x+a,y+b,w,h,v,opts);
 L(65,0,65,55);L(65,15,185,15);L(65,40,185,40);L(135,15,135,55);L(135,20,185,20);L(135,35,185,35);
 for(const v of [150,167])L(v,15,v,35);for(const v of [140,145])L(v,20,v,35);L(157,35,157,40);
 for(let row=1;row<11;row++)L(0,row*5,65,row*5);
 for(const v of [7,17,40,55])L(v,0,v,25);for(const v of [17,40,55])L(v,25,v,55);
 [['Зм.',0,7],['Арк.',7,10],['№ докум.',17,23],['Підпис',40,15],['Дата',55,10]].forEach(([s,a,w])=>C(a,20,w,5,s,{font:2.5,name:'revision-'+a}));
 ['Розробив','Перевірив','Т. контр.','','Н. контр.','Затвердив'].forEach((s,i)=>C(0,25+i*5,17,5,s,{font:2.5,align:'start',name:'sign-role-'+i}));
 C(17,25,23,5,student,{font:2.5,name:'student'});C(65,0,120,15,designation,{font:5,name:'designation'});
 C(65,15,70,25,title,{font:4,name:'name'});C(65,40,70,15,material,{font:3,name:'material'});
 C(135,15,15,5,'Літера',{font:2.5,name:'letter-label'});C(150,15,17,5,'Маса',{font:2.5,name:'mass-label'});C(167,15,18,5,'Масштаб',{font:2.5,name:'scale-label'});
 C(135,20,5,15,'Н',{font:3.5,name:'letter'});C(150,20,17,15,mass,{font:3.5,name:'mass'});C(167,20,18,15,scale,{font:3.5,name:'scale'});
 C(135,35,22,5,'Аркуш '+sheet,{font:2.5,name:'sheet'});C(157,35,28,5,'Аркушів '+sheets,{font:2.5,name:'sheets'});
 C(135,40,50,15,'Житомирський агротехнічний фаховий коледж'+(group?' · '+group:''),{font:2.5,name:'organisation'});
 return svg+'</g>';
}
export function datumMark(x,y,label,dx=0,dy=10){
 const cx=x+dx,cy=y+dy+3,length=Math.hypot(dx,dy+3),ux=dx/length,uy=(dy+3)/length,bx=x+ux*3,by=y+uy*3,end=Math.abs(dx)>Math.abs(dy+3)?[cx-Math.sign(dx)*3,cy]:[cx,cy-Math.sign(dy+3)*3];
 return `<g data-datum="${label}"><path d="M${x} ${y}L${bx-uy*1.6} ${by+ux*1.6}L${bx+uy*1.6} ${by-ux*1.6}Z"/><path d="M${bx} ${by}L${end.join(' ')}" fill="none" stroke="black" stroke-width=".3"/><rect x="${cx-3}" y="${cy-3}" width="6" height="6" fill="white" stroke="black" stroke-width=".35"/>${drawingText(cx,cy+1.3,label,'text-anchor="middle" font-size="3.5"')}</g>`;
}
export function surfaceLeader(start,to,{normal,via=[],reach=5,kind,feature}){
 const magnitude=Math.hypot(...normal),n=normal.map(v=>v/magnitude),approach=to.map((v,i)=>v+n[i]*reach),points=[start,...via,approach,to].filter((p,i,a)=>i===0||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>1e-8),arrow=Math.min(2,reach);
 return `<path data-${kind}-leader="${feature}" data-feature-point="${to.join(',')}" data-surface-normal="${n.join(',')}" data-leader-route="${points.map(p=>p.join(',')).join(';')}" d="M${points.map(p=>p.join(' ')).join('L')}" fill="none" stroke="black" stroke-width=".25"/><path data-surface-arrow="${feature}" d="M${to.join(' ')}L${to[0]+n[0]*arrow-n[1]*arrow*.3} ${to[1]+n[1]*arrow+n[0]*arrow*.3}L${to[0]+n[0]*arrow+n[1]*arrow*.3} ${to[1]+n[1]*arrow-n[0]*arrow*.3}Z"/>`;
}
export function toleranceFrame(x,y,symbol,value,datum,{to=null,port='top',normal,via=[],reach=5}={}){
 const widths=[7,15,datum.length>1?14:7],total=widths.reduce((a,b)=>a+b,0);
 let svg=`<g data-geometric-tolerance="${symbol}" data-reference-datum="${datum}"><rect x="${x}" y="${y}" width="${total}" height="7" fill="white" stroke="black" stroke-width=".35"/>`;
 svg+=line(x+7,y,x+7,y+7)+line(x+22,y,x+22,y+7);
 svg+=symbol==='runout'?`<path d="M${x+2} ${y+5}l3 -3m-2 0h2v2" fill="none" stroke="black" stroke-width=".4"/>`:drawingText(x+3.5,y+5,'⊥','text-anchor="middle" font-size="4.5"');
 svg+=drawingText(x+14.5,y+4.8,value,'text-anchor="middle" font-size="3.5"')+drawingText(x+22+widths[2]/2,y+4.8,datum,'text-anchor="middle" font-size="3.5"');
 if(to){const start=port==='left'?[x,y+3.5]:port==='right'?[x+total,y+3.5]:[x+total/2,y+(port==='bottom'?7:0)];svg+=surfaceLeader(start,to,{normal,via,reach,kind:'tolerance',feature:symbol});}
 return svg+'</g>';
}
export function roughnessMark(x,y,ra,{surface='general',to=null,normal,via=[],reach=5}={}){
 // Paper-space vector rendering, following CAD's drawingManufacturingSvg
 // approach. ISO 21920-1, Fig. 4/5: 60° legs, removal bar and a separate
 // distinguishing bar ABOVE the short leg. Ra/limit go BELOW the shelf.
 const short=5/Math.sqrt(3),long=10.5/Math.sqrt(3),label='Ra '+String(ra).replace('.',',');
 const leader=to?surfaceLeader([x,y],to,{normal,via,reach,kind:'roughness',feature:surface}):'';
 return `<g data-roughness="${surface}" data-ra-um="${ra}" data-process="removal" data-standard="ISO 21920-1" data-symbol-tip="${x},${y}" data-attachment="${to?'leader':'direct'}"><path data-roughness-symbol="" d="M${x-short} ${y-5}L${x} ${y}L${x+long} ${y-10.5}H${x+24}M${x-short} ${y-5}H${x+short}M${x-1.8} ${y-7.5}h4.5" fill="none" stroke="black" stroke-width=".35"/>${drawingText(x+long+1,y-2,label,'font-size="3.5"')}${leader}</g>`;
}
export function generalRoughness({x=0,y=0,width=420,height=297,ra}){
 // A reserved note area immediately left of each part's own inscription.
 // ISO 21920 collective requirements belong near the title block (9.1.2).
 const tx=x+width-190,ty=y+height-60;
 return `<g data-general-roughness="" data-position="beside-title-block">${drawingText(tx-67,ty+5,'Неуказані поверхні','font-size="3.5"')}${drawingText(tx-67,ty+11,'ISO 21920-1','font-size="3"')}${roughnessMark(tx-50,ty+29,ra)}</g>`;
}
