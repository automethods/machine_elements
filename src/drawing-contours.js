// Drafting contour only; physical section dimensions come from the construction model.
export function shaftOutline(points,fillet,chamfer){
 const clean=points.filter((p,i)=>i===0||Math.hypot(...p.map((v,j)=>v-points[i-1][j]))>1e-8),corners=clean.map((p,i)=>{
  const a=clean[(i+clean.length-1)%clean.length],b=clean[(i+1)%clean.length],incoming=p.map((v,j)=>v-a[j]),outgoing=b.map((v,j)=>v-p[j]),la=Math.hypot(...incoming),lb=Math.hypot(...outgoing),u=incoming.map(v=>v/la),v=outgoing.map(v=>v/lb),cross=u[0]*v[1]-u[1]*v[0],end=i===0||i===clean.length-1||p[0]===Math.max(...clean.map(q=>q[0])),r=Math.min(end?chamfer:fillet,la/2,lb/2);
  if(Math.abs(cross)<1e-8)return {before:p,after:p,curve:''};
  const before=p.map((n,j)=>n-u[j]*r),after=p.map((n,j)=>n+v[j]*r);return {before,after,curve:end?'L'+after.join(' '):`A${r} ${r} 0 0 ${cross>0?1:0} ${after.join(' ')}`};
 });return 'M'+corners[0].before.join(' ')+corners.map((c,i)=>(i?'L'+c.before.join(' '):'')+(c.curve||'')).join('')+'Z';
}
