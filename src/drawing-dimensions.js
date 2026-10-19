import {escapeDrawing as esc,drawingText as text} from './drawing-frame.js';

// Paper-space millimetres: geometry anchors and displayed values are separate.
// ISO-oriented presentation, following the documented TechDraw conventions.
export const dimensionStyle=Object.freeze({textHeight:3.5,toleranceHeight:2.5,arrowLength:2.5,arrowHalfWidth:.7,extensionGap:.6,extensionOverrun:2,lineWidth:.25});
export function dimensionText(x,y,label,{rotate=0,anchor='middle',background=false}={}){
 const fit=/^(⌀.+? (?:H7|h6|k6)) \(([^/]+)\/([^/]+)\)$/.exec(label),h=dimensionStyle.textHeight,t=dimensionStyle.toleranceHeight;
 const width=fit?fit[1].length*h*.53+Math.max(fit[2].length,fit[3].length)*t*.53+1:label.length*h*.53,left=anchor==='start'?0:anchor==='end'?-width:-width/2;
 const value=fit?text(left,0,fit[1],`font-size="${h}"`)+text(left+fit[1].length*h*.53+1,-1.7,fit[2],`font-size="${t}"`)+text(left+fit[1].length*h*.53+1,1.5,fit[3],`font-size="${t}"`):text(left,0,label,`font-size="${h}"`);
 return {width,svg:`<g data-dimension-text="${esc(label)}" transform="translate(${x} ${y}) rotate(${rotate})">${background?`<rect x="${left-.6}" y="${-h-1}" width="${width+1.2}" height="${h+3.4}" fill="white"/>`:''}${value}</g>`};
}
export function linearDimension({p1,p2,at,label,id,vertical=false,labelAt=null,textBackground=false}){
 const s=dimensionStyle,a=vertical?p1[1]:p1[0],b=vertical?p2[1]:p2[0],lo=Math.min(a,b),hi=Math.max(a,b),span=hi-lo,measured=dimensionText(0,0,label),outside=span<measured.width+s.arrowLength*2+2;
 const xy=(v,c=at)=>vertical?[c,v]:[v,c],line=(a,b,attrs='')=>`<path d="M${a.join(' ')}L${b.join(' ')}" fill="none" stroke="black" stroke-width="${s.lineWidth}" ${attrs}/>`;
 let svg='';
 for(const p of [p1,p2]){const target=xy(vertical?p[1]:p[0]),d=Math.sign((vertical?target[0]-p[0]:target[1]-p[1]))||1,start=vertical?[p[0]+d*s.extensionGap,p[1]]:[p[0],p[1]+d*s.extensionGap],end=vertical?[target[0]+d*s.extensionOverrun,target[1]]:[target[0],target[1]+d*s.extensionOverrun];if(Math.hypot(target[0]-p[0],target[1]-p[1])>.01)svg+=line(start,end,`data-extension-from="${p.join(',')}"`);}
 const labelPosition=labelAt??(outside?(vertical?lo-5-measured.width/2:hi+5+measured.width/2):(lo+hi)/2),lineStart=outside?Math.min(lo-5,labelPosition-measured.width/2):lo,lineEnd=outside?Math.max(hi+5,labelPosition+measured.width/2):hi;
 svg+=line(xy(lineStart),xy(lineEnd));
 for(const [v,sign] of [[lo,outside?-1:1],[hi,outside?1:-1]]){const tip=xy(v),base=xy(v+sign*s.arrowLength),corners=vertical?[[base[0]-s.arrowHalfWidth,base[1]],[base[0]+s.arrowHalfWidth,base[1]]]:[[base[0],base[1]-s.arrowHalfWidth],[base[0],base[1]+s.arrowHalfWidth]];svg+=`<path data-dimension-arrow="${outside?'outside':'inside'}" d="M${tip.join(' ')}L${corners.map(p=>p.join(' ')).join('L')}Z"/>`;}
 svg+=dimensionText(...xy(labelPosition,at-2),label,{rotate:vertical?-90:0,background:textBackground}).svg;
 return `<g data-dimension="${esc(id)}" data-measurement-points="${p1.join(',')};${p2.join(',')}">${svg}</g>`;
}
