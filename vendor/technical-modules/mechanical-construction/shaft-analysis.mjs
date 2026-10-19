// Static Euler–Bernoulli beam, SI. Exact integration on each constant-EI
// interval; forces and torques are signed external point loads.
const finite=(v,name)=>{if(!Number.isFinite(v))throw Error('Invalid '+name);return v;};
export function analyseShaft({sections,supports,loads,elasticModulusPa,shearModulusPa,allowablePa,concentration=1,keyways=[]}){
 if(!sections?.length||supports?.length!==2)throw Error('A shaft needs sections and two supports.');
 for(const v of [elasticModulusPa,shearModulusPa,allowablePa,concentration])if(!(v>0&&Number.isFinite(v)))throw Error('Positive material and concentration values required.');
 const profile=sections.toSorted((a,b)=>a.startM-b.startM),lo=profile[0].startM,hi=profile.at(-1).endM,[A,B]=supports;
 if(!(lo<=A&&A<B&&B<=hi))throw Error('Supports outside shaft.');
 profile.forEach((s,i)=>{if(!(s.endM>s.startM&&s.diameterM>0)||(s.boreM||0)>=s.diameterM||(i&&Math.abs(profile[i-1].endM-s.startM)>1e-9))throw Error('Invalid or discontinuous shaft profile.');});
 loads.forEach(l=>{finite(l.xM,'load station');if(l.xM<lo||l.xM>hi)throw Error('Load outside shaft.');for(const k of ['fyN','fzN','axialN','torqueNm','myNm','mzNm'])finite(l[k]??0,k);});
 const reactions={};
 for(const [k,m] of [['fyN','mzNm'],['fzN','myNm']]){const rb=-loads.reduce((s,l)=>s+(l[k]||0)*(l.xM-A)+(l[m]||0),0)/(B-A);reactions[k]=[-loads.reduce((s,l)=>s+(l[k]||0),0)-rb,rb];}
 const points=[...loads,{xM:A,fyN:reactions.fyN[0],fzN:reactions.fzN[0]},{xM:B,fyN:reactions.fyN[1],fzN:reactions.fzN[1]}];
 const knots=[...new Set([lo,hi,A,B,...profile.flatMap(s=>[s.startM,s.endM]),...loads.map(l=>l.xM),...keyways.flatMap(k=>[k.startM,k.endM]).filter(x=>x>lo&&x<hi)])].sort((a,b)=>a-b);
 const properties=x=>{const s=profile.find(s=>x>=s.startM-1e-12&&x<=s.endM+1e-12),key=keyways.filter(k=>x>k.startM&&x<k.endM).sort((a,b)=>b.depthM-a.depthM)[0],d=s.diameterM,root=d-2*(key?.depthM||0),bore=s.boreM||0;
  // Inscribed root circle is a conservative static bound, not a Saint-Venant
  // solution for a slotted section. The same lower-bound I is used for EI.
  if(!(root>bore))throw Error('Keyway removes the section.');
  return {id:s.id,diameterM:d,rootDiameterM:root,areaM2:Math.PI*(root**2-bore**2)/4,inertiaM4:Math.PI*(root**4-bore**4)/64,polarM4:Math.PI*(root**4-bore**4)/32,keyway:Boolean(key)};
 };
 const resultants=(x,side=1)=>{const active=points.filter(l=>l.xM<x-1e-11||(side>0&&l.xM<=x+1e-11)),sum=k=>active.reduce((s,l)=>s+(l[k]||0),0),moment=(k,m)=>active.reduce((s,l)=>s+(l[k]||0)*(x-l.xM)-(l[m]||0),0);return {qyN:sum('fyN'),qzN:sum('fzN'),myNm:moment('fzN','myNm'),mzNm:moment('fyN','mzNm'),axialN:-sum('axialN'),torqueNm:-sum('torqueNm')};};
 const rows=[];let thetaY=0,thetaZ=0,y=0,z=0,twist=0;
 for(let i=0;i<knots.length-1;i++){const a=knots[i],b=knots[i+1],h=b-a,pr=properties((a+b)/2),r=resultants(a),EI=elasticModulusPa*pr.inertiaM4,ky=r.mzNm/EI,kz=r.myNm/EI,dy=r.qyN/EI,dz=r.qzN/EI;
  rows.push({a,b,pr,r,y,z,thetaY,thetaZ,ky,kz,dy,dz,twist});
  y+=thetaY*h+ky*h*h/2+dy*h**3/6;z+=thetaZ*h+kz*h*h/2+dz*h**3/6;thetaY+=ky*h+dy*h*h/2;thetaZ+=kz*h+dz*h*h/2;twist+=r.torqueNm*h/(shearModulusPa*pr.polarM4);
 }
 const raw=x=>{const t=rows.find(t=>x>=t.a-1e-12&&x<=t.b+1e-12),h=x-t.a;return {y:t.y+t.thetaY*h+t.ky*h*h/2+t.dy*h**3/6,z:t.z+t.thetaZ*h+t.kz*h*h/2+t.dz*h**3/6,twist:t.twist+t.r.torqueNm*h/(shearModulusPa*t.pr.polarM4)};};
 const atA=raw(A),atB=raw(B),sample=x=>{const q=raw(x),f=(x-A)/(B-A);return {xM:x,yM:q.y-atA.y-f*(atB.y-atA.y),zM:q.z-atA.z-f*(atB.z-atA.z),twistRad:q.twist-raw(A).twist};};
 const critical=[];
 for(const t of rows)for(const x of [t.a,t.b]){const r=resultants(x,x===t.a?1:-1),p=t.pr,M=Math.hypot(r.myNm,r.mzNm),sigma=concentration*(Math.abs(r.axialN)/p.areaM2+M*p.rootDiameterM/(2*p.inertiaM4)),tau=concentration*Math.abs(r.torqueNm)*p.rootDiameterM/(2*p.polarM4),vm=Math.hypot(sigma,Math.sqrt(3)*tau);critical.push({xM:x,side:x===t.a?'right':'left',...p,...r,bendingNm:M,normalPa:sigma,shearPa:tau,vonMisesPa:vm,utilization:vm/allowablePa,ok:vm<=allowablePa});}
 const samples=[...new Set([...knots,...Array.from({length:81},(_,i)=>lo+(hi-lo)*i/80)])].sort((a,b)=>a-b).map(sample),worst=critical.reduce((a,b)=>a.utilization>b.utilization?a:b);
 return {reactions,critical,samples,worst,maxDeflectionM:Math.max(...samples.map(q=>Math.hypot(q.yM,q.zM))),maxTwistRad:Math.max(...samples.map(q=>Math.abs(q.twistRad))),equilibrium:{fyN:points.reduce((s,l)=>s+(l.fyN||0),0),fzN:points.reduce((s,l)=>s+(l.fzN||0),0),axialN:loads.reduce((s,l)=>s+(l.axialN||0),0),torqueNm:loads.reduce((s,l)=>s+(l.torqueNm||0),0)},method:'Static net-root-circle von Mises; piecewise EI; prescribed concentration; no fatigue rating.'};
}
