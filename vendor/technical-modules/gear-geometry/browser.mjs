// Lightweight SI adaptation of the pinned BSD-2-Clause BOSL2 gears.scad
// tooth, bevel-cone, rack/worm and throated-wheel constructions. See
// vendor/BOSL2/LICENSE and BROWSER.md for attribution and tessellation limits.
// No DOM, WebGL, WASM, filesystem, server or CAD application is required.
import {validateGearRequest,evaluatePlanetary} from './index.mjs';
import {extrudeRegion} from './extrude-region.mjs';
import earcut from './vendor/Earcut/src/earcut.js';
const pi=Math.PI,tau=2*pi,rad=pi/180,polar=(r,a)=>[r*Math.cos(a),r*Math.sin(a)],rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a),...(p.length>2?[p[2]]:[])],norm=p=>Math.hypot(...p),sub=(a,b)=>a.map((v,i)=>v-b[i]),plus=(a,b)=>a.map((v,i)=>v+b[i]),times=(p,n)=>p.map(v=>v*n),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),clamp=v=>Math.max(-1,Math.min(1,v));
const dedup=ps=>ps.filter((p,i)=>!i||norm(sub(p,ps[i-1]))>1e-11);
const lookup=(x,table)=>{if(x<=table[0][0])return table[0][1];for(let i=1;i<table.length;i++)if(x<=table[i][0]){const [a,b]=table[i-1],[c,d]=table[i];return b+(d-b)*(x-a)/(c-a);}return table.at(-1)[1];};
function intersection([a,b],[c,d]){const u=sub(b,a),v=sub(d,c),den=u[0]*v[1]-u[1]*v[0];if(Math.abs(den)<1e-14)return b;const t=((c[0]-a[0])*v[1]-(c[1]-a[1])*v[0])/den;return plus(a,times(u,t));}
function cornerArc([A,B,C],radius,n=8){
 const a=times(sub(A,B),1/norm(sub(A,B))),c=times(sub(C,B),1/norm(sub(C,B))),angle=Math.acos(clamp(dot(a,c))),distance=radius/Math.tan(angle/2),start=plus(B,times(a,distance)),end=plus(B,times(c,distance)),bis=plus(a,c),center=plus(B,times(bis,radius/(Math.sin(angle/2)*norm(bis)))),s=Math.atan2(start[1]-center[1],start[0]-center[0]);let delta=Math.atan2(end[1]-center[1],end[0]-center[0])-s;while(delta>pi)delta-=tau;while(delta< -pi)delta+=tau;
 return Array.from({length:n},(_,i)=>plus(center,polar(radius,s+delta*i/(n-1))));
}
// BOSL2 normal system, x=0. Its 5-degree involute lookup and rounded
// clearance valley are retained; the browser keeps extra flank vertices.
function tooth({m,z,alpha,beta=0,backlash=0,internal=false,center=false}){
 const cp=pi*m,clear=m/4,pr=m*z/(2*Math.cos(beta)),ar=pr+m*(internal?1.25:1),rr=pr-m*(internal?1:1.25),br=pr*Math.cos(Math.atan(Math.tan(alpha)/Math.cos(beta))),tang=(cp/2/Math.cos(beta)+(internal?backlash:-backlash))/(2*pr),lup=[];
 for(let a=0;a<=ar/pi/br*360*rad;a+=5*rad){const xy=[br*(Math.cos(a)+a*Math.sin(a)),br*(Math.sin(a)-a*Math.cos(a))],r=norm(xy);if(r<=ar*1.1)lup.push([r,pi/2-Math.atan2(xy[1],xy[0])]);}
 const reverse=lup.map(([x,y])=>[y,x]).sort((a,b)=>a[0]-b[0]),soff=tang+lookup(br,lup)-lookup(pr,lup),ma=Math.min(ar,lookup(pi/2-soff+.05*tau/z/2,reverse)),maAngle=lookup(ma,lup),capSteps=Math.max(1,Math.ceil((maAngle+soff-pi/2)/(5*rad))),ax=cp/4-m*Math.tan(alpha),undercut=[];
 for(let a=Math.atan2(ax,rr);a>=-pi/2;a-=rad){const x=-a*pr+ax,y=pr-m,r=Math.hypot(x,y);if(r<ar*1.05)undercut.push([r,Math.atan2(y,x)-a+pi/z]);}
 const min=undercut.reduce((best,p,i)=>p[0]<undercut[best][0]?i:best,0),uc=undercut.slice(min),raw=[];
 for(let i=0;i<=32;i++){const r=rr+(ma-rr)*i/32,a1=lookup(r,lup)+soff,a2=lookup(r,uc),a=internal||r<uc[0][0]?a1:Math.min(a1,a2);if((internal||r>rr+clear)&&(!internal||r<ma-clear)&&a<pi/2+pi/z)raw.push(polar(r,a));}
 if(!internal)for(let i=0;i<capSteps;i++)raw.push(polar(ma,maAngle+soff-i*((maAngle+soff-pi/2)/capSteps-rad)));
 const line1=internal?raw.slice(-2):raw.slice(0,2),line2=internal?[[0,ma],[-1,ma]]:[[0,rr],[1,rr]].map(p=>rotate(p,pi/z)),meet=intersection(line1,line2),corner=internal?[line1.at(-1),meet,line2[0]]:[line2[0],meet,line1[0]],u=sub(corner[0],corner[1]),v=sub(corner[2],corner[1]),maxR=norm(u)*Math.tan(Math.acos(clamp(dot(u,v)/(norm(u)*norm(v))))/2),radius=Math.min(maxR,clear,tau*(internal?ma:rr)*(pi/z-tang)/tau),arc=radius>1e-12?cornerArc(corner,radius):[meet];
 let half=dedup(internal?[...raw,...arc]:[...arc,...raw]);
 // Trim clearance points crossing the neighbouring tooth's bisector.
 const bad=half.map((p,i)=>Math.atan2(p[1],p[0])>pi/2+pi/z?i:-1).filter(i=>i>=0);if(bad.length){const i=bad.at(-1);if(i<half.length-1)half=[intersection([[0,0],polar(1,pi/2+pi/z)],[half[i],half[i+1]]),...half.slice(i+1)];}
 const sampled=sampleCorners(half,16),full=[...sampled,...sampled.toReversed().map(([x,y])=>[-x,y])];return center?full.map(([x,y])=>[x,y-pr]):full;
}
function profile(spec){const t=tooth(spec),points=[];for(let i=0;i<spec.z;i++)points.push(...t.map(p=>rotate(p,-i*tau/spec.z-pi/2)));return dedup(points);}
function orient(mesh,repair=false){
 if(repair){const map=new Map(),ids=mesh.verticesM.map(p=>{const key=p.map(v=>Math.round(v*1e10)).join(',');if(!map.has(key))map.set(key,map.size);return map.get(key);}),edges=new Map(),links=mesh.triangles.map(()=>[]);
  mesh.triangles.forEach((t,i)=>{const w=t.map(v=>ids[v]);if(new Set(w).size<3)return;for(let j=0;j<3;j++){const a=w[j],b=w[(j+1)%3],key=Math.min(a,b)+','+Math.max(a,b),dir=a<b?1:-1;if(edges.has(key)){const [k,d]=edges.get(key);links[i].push([k,-dir*d]);links[k].push([i,-dir*d]);}else edges.set(key,[i,dir]);}});
  const signs=[];for(let i=0;i<signs.length||i<links.length;i++){if(signs[i])continue;signs[i]=1;const stack=[i];while(stack.length){const k=stack.pop();for(const [j,s] of links[k])if(!signs[j]){signs[j]=signs[k]*s;stack.push(j);}}}mesh.triangles=mesh.triangles.map((t,i)=>signs[i]<0?t.toReversed():t);
 }
 let volume=0;for(const [a,b,c] of mesh.triangles){const x=mesh.verticesM[a],y=mesh.verticesM[b],z=mesh.verticesM[c];volume+=x[0]*(y[1]*z[2]-y[2]*z[1])+x[1]*(y[2]*z[0]-y[0]*z[2])+x[2]*(y[0]*z[1]-y[1]*z[0]);}if(volume<0)mesh.triangles=mesh.triangles.map(([a,b,c])=>[a,c,b]);return mesh;
}
function loft(rows){
 if(rows[0].reduce((s,p,i)=>s+p[0]*rows[0][(i+1)%rows[0].length][1]-p[1]*rows[0][(i+1)%rows[0].length][0],0)<0)rows=rows.map(r=>r.toReversed());
 const n=rows[0].length,verticesM=rows.flat(),triangles=[];for(let j=1;j<rows.length;j++)for(let i=0;i<n;i++){const a=(j-1)*n+i,b=(j-1)*n+(i+1)%n,c=j*n+(i+1)%n,d=j*n+i;triangles.push([a,b,c],[a,c,d]);}
 for(const [j,reverse] of [[0,true],[rows.length-1,false]]){const cap=earcut(rows[j].flatMap(p=>p.slice(0,2)),null,2);for(let i=0;i<cap.length;i+=3){const t=cap.slice(i,i+3).map(v=>v+j*n);triangles.push(reverse?t.toReversed():t);}}
 return orient({verticesM,triangles});
}
function cylindrical(p,z,bore=0,beta=0,internal=false){const outer=profile({m:p.gearModuleM,z,alpha:p.gearPressureAngleRad,beta,backlash:p.gearBacklashM,internal}),regions=[outer];if(bore)regions.push(Array.from({length:32},(_,i)=>polar(bore/2,-tau*i/32)));const mesh=extrudeRegion(regions,p.gearFaceWidthM),pr=p.gearModuleM*z/(2*Math.cos(beta)),n=mesh.verticesM.length/2,slices=beta?Math.max(2,Math.min(8,Math.floor(90000/n)-1)):1;
 if(!beta)return mesh;
 // A straight, single-helix normal-system tooth. Bore remains cylindrical.
 const flat=mesh.verticesM.slice(0,n).map(v=>v.slice(0,2)),rows=Array.from({length:slices+1},(_,i)=>flat.map((v,k)=>{const z=p.gearFaceWidthM*(i/slices-.5),angle=z*Math.tan(beta)/pr,xy=k<outer.length?rotate(v,angle):v;return [...xy,z];})),result={verticesM:rows.flat(),triangles:[]};
 // Retriangulate each twisted end around the stationary bore. Reusing the
 // untwisted bridges can invert cap triangles and leave radial seams.
 for(const j of [0,slices]){const cap=earcut(rows[j].flatMap(v=>v.slice(0,2)),bore?[outer.length]:[],2);for(let i=0;i<cap.length;i+=3){const t=cap.slice(i,i+3).map(v=>v+j*n);result.triangles.push(j?t:t.toReversed());}}
 let offset=0;for(const region of regions){for(let j=0;j<slices;j++)for(let i=0;i<region.length;i++){const a=j*n+offset+i,b=j*n+offset+(i+1)%region.length,c=b+n,d=a+n;result.triangles.push([a,b,c],[a,c,d]);}offset+=region.length;}return orient(result);
}
function bevel(p,z,mate){
 const delta=Math.atan2(Math.sin(p.gearShaftAngleRad),mate/z+Math.cos(p.gearShaftAngleRad)),pr=p.gearModuleM*z/2,R=pr/Math.sin(delta),face=p.gearFaceWidthM,cp=(R+(R-face))/2,cutter=face*100,radcp=[-cutter,cp],d=norm(radcp),arg=r=>Math.acos(clamp((cutter*cutter+d*d-r*r)/(2*cutter*d))),theta=Math.atan2(radcp[1],radcp[0]),t=tooth({m:p.gearModuleM,z,alpha:p.gearPressureAngleRad,backlash:p.gearBacklashM,center:true}).toReversed(),pitchoff=1.25*p.gearModuleM*Math.sin(delta);
 const rows=[R,R-face].map(radius=>{const pt=plus(radcp,polar(cutter,theta-(pi-arg(radius)))),angle=(Math.atan2(pt[1],pt[0])-pi/2)/Math.sin(delta),u=norm(pt)/R;return Array.from({length:z},(_,i)=>t.map(([x,y])=>{const v=rotate([u*x,u*(y*Math.cos(delta)+pr)],i*tau/z+angle);return [...v,u*y*Math.sin(delta)+(1-u)*pr/Math.tan(delta)+pitchoff];})).flat().toReversed();});
 const bot=rows[0],top=rows[1],n=bot.length,k=t.length,botz=bot.at(-1)[2],topz=top.at(-1)[2],ctr=topz-botz,backing=ctr>face/2?0:-ctr+face/2,anchor=botz+R*Math.cos(delta)+pitchoff,verticesM=[...top,...bot],triangles=[];
 // Non-planar tooth faces and flat root disk, as in BOSL2 bevel_gear().
 const cap=(base,center,reverse)=>{for(let i=0;i<z;i++){for(let j=0;j<k/2-1;j++){const a=base+i*k+j,b=base+(i+1)*k-j-1,c=b-1,d=a+1;for(const f of [[a,b,c],[a,c,d]])triangles.push(reverse?f.toReversed():f);}for(const f of [[center,base+(i+1)*k-1,base+i*k],[center,base+((i+1)%z)*k,base+(i+1)*k-1]])triangles.push(reverse?f.toReversed():f);}};
 verticesM.push([0,0,top[0][2]]);cap(0,2*n,false);
 if(backing===0){verticesM.push([0,0,bot[0][2]]);cap(n,2*n+1,true);}
 else{
  const base=verticesM.length,factor=-backing/Math.tan(delta);for(let i=0;i<z;i++)for(const q of [bot[i*k],bot[(i+1)*k-1]]){const r=Math.hypot(q[0],q[1]);verticesM.push([q[0]*(1+factor/r),q[1]*(1+factor/r),q[2]-backing]);}
  const center=verticesM.length;verticesM.push([0,0,bot[0][2]-backing]);for(let i=0;i<2*z;i++)triangles.push([center,base+i,base+(i+1)%(2*z)]);
  for(let i=0;i<z;i++){const a=base+2*i,b=a+1,c=base+2*((i+1)%z),v=n+i*k,w=n+(i+1)*k-1,next=n+((i+1)%z)*k;triangles.push([a,w,v],[a,b,w],[b,next,w],[b,c,next]);}
  // Tooth area still closes against the shoulder/root face of the backing.
  for(let i=0;i<z;i++)for(let j=0;j<k/2-1;j++){const a=n+i*k+j,b=n+(i+1)*k-j-1,c=b-1,d=a+1;triangles.push([a,c,b],[a,d,c]);}
 }
 for(let i=0;i<n;i++){const a=i,b=(i+1)%n;triangles.push([a,b,b+n],[a,b+n,a+n]);}
 return orient({verticesM:verticesM.map(([x,y,z])=>[x,y,z-anchor]),triangles},true);
}
function rack(m,alpha,beta,backlash){const pitch=pi*m/Math.cos(beta),pa=Math.atan(Math.tan(alpha)/Math.cos(beta)),half=(pitch/2-backlash)/2,add=m,ded=1.25*m,ax=m*Math.tan(pa),dx=ded*Math.tan(pa),points=[[-pitch/2,-ded]];
 const corners=[[[-pitch/2,-ded],[-half-dx,-ded],[-half+ax,add]], [[-half-dx,-ded],[-half+ax,add],[half-ax,add]],[[-half+ax,add],[half-ax,add],[half+dx,-ded]],[[half-ax,add],[half+dx,-ded],[pitch/2,-ded]]];corners.forEach((c,i)=>points.push(...cornerArc(c,i===0||i===3?m/4:pitch/16,4)));points.push([pitch/2,-ded]);return {pitch,points:dedup(points)};}
function worm(p){const beta=Math.asin(p.gearWormStarts*p.gearModuleM/p.gearWormDiameterM),r=rack(p.gearModuleM,p.gearPressureAngleRad,beta,p.gearBacklashM),steps=48,zsteps=Math.min(768,Math.max(16,Math.ceil(p.gearWormLengthM/(r.pitch*p.gearWormStarts)*steps))),rows=[];
 for(let j=0;j<=zsteps;j++){const z=p.gearWormLengthM*(j/zsteps-.5);rows.push(Array.from({length:steps},(_,i)=>{const u=i/steps-.5,x=z+r.pitch*p.gearWormStarts*u,local=((x+r.pitch/2)%r.pitch+r.pitch)%r.pitch-r.pitch/2,h=lookup(local,r.points);return [...polar(p.gearWormDiameterM/2+h,tau*(1-u)+pi/2),z];}));}return loft(rows);}
function resample(points,n){const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+norm(sub(points[i],points[i-1])));return Array.from({length:n},(_,i)=>{const d=lengths.at(-1)*i/(n-1);let j=1;while(j<lengths.length-1&&lengths[j]<d)j++;const f=(d-lengths[j-1])/(lengths[j]-lengths[j-1]||1);return plus(points[j-1],times(sub(points[j],points[j-1]),f));});}
function sampleCorners(points,n){
 const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+norm(sub(points[i],points[i-1])));const kept=new Set([0,points.length-1]);
 for(let i=1;i<points.length-1;i++){const u=sub(points[i],points[i-1]),v=sub(points[i+1],points[i]);if(Math.acos(clamp(dot(u,v)/(norm(u)*norm(v))))>30*rad)kept.add(i);}
 for(const axis of [0,1])for(const sign of [-1,1])kept.add(points.reduce((a,p,i)=>p[axis]*sign>points[a][axis]*sign?i:a,0));
 const stations=[...new Set([...Array.from({length:n},(_,i)=>lengths.at(-1)*i/(n-1)),...[...kept].map(i=>lengths[i])])].sort((a,b)=>a-b);
 return stations.map(d=>{let j=1;while(j<lengths.length-1&&lengths[j]<d)j++;return plus(points[j-1],times(sub(points[j],points[j-1]),(d-lengths[j-1])/(lengths[j]-lengths[j-1]||1)));});
}
function wormWheel(p){
 const beta=Math.asin(p.gearWormStarts*p.gearModuleM/p.gearWormDiameterM),pr=p.gearModuleM*p.gearWheelTeeth/(2*Math.cos(beta)),R=p.gearWormDiameterM/2,crown=.0001,profile=tooth({m:p.gearModuleM,z:p.gearWheelTeeth,alpha:p.gearPressureAngleRad,beta,backlash:p.gearBacklashM,center:true}).map(q=>rotate(q,pi/2)).toReversed(),bottom=Math.max(...profile.map(q=>q[0]));
 const build=arc=>{const half=Math.sin(arc/2)*(R+bottom),actual=2*Math.asin(half/(R+crown+bottom)),rows=profile.map(pt=>Array.from({length:49},(_,i)=>{const angle=actual*(i/48-.5),x=(pt[0]+R+crown)*Math.cos(angle)-crown,z=-(pt[0]+R+crown)*Math.sin(angle),L=R*angle*Math.tan(beta);return [x,pt[1]+L,z];})),mid=Math.floor(rows.length/2),good=rows[0].map((_,i)=>i).filter(i=>rows[mid-1][i][1]>rows[mid][i][1]);if(!good.length)throw Error('Worm wheel face width has no valid tooth surface.');const kept=rows.map(row=>good.map(i=>row[i])),zs=kept.flat().map(q=>q[2]),max=Math.max(...zs),min=Math.min(...zs),zmax=Math.max(Math.abs(min),Math.abs(max))+.00005;return {kept,min,max,zmax};};
 let lo=rad,hi=pi/2;for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(build(mid).zmax*2<p.gearFaceWidthM)lo=mid;else hi=mid;}const data=build((lo+hi)/2);if(Math.abs(2*data.zmax-p.gearFaceWidthM)>1e-6)throw Error('Worm wheel width outside supported 1…90° contact arc.');
 const first=data.kept[0],angle=q=>Math.atan2(q[1],q[0]),twist=(angle(first[0])-angle(first.at(-1)))/(data.max-data.min),samples=Math.max(3,Math.min(13,Math.floor(90000/(profile.length*p.gearWheelTeeth))-2)),toothRows=data.kept.map(row=>{const sampled=resample(row,samples),a=sampled[0],b=sampled.at(-1);return [[...rotate(a,twist*(data.zmax-a[2])).slice(0,2),data.zmax],...sampled,[...rotate(b,twist*(-data.zmax-b[2])).slice(0,2),-data.zmax]];}),gearRows=[];
 for(let i=0;i<p.gearWheelTeeth;i++)for(const row of toothRows)gearRows.push(row.map(([x,y,z])=>[...rotate([y,pr-(x-R)],i*tau/p.gearWheelTeeth),z]));
 return loft(toothRows[0].map((_,i)=>gearRows.map(row=>row[i])));
}
export function generateBrowserGearGeometry(request){
 const p=validateGearRequest(request),parts=[],profiles={};let center=0;
 const add=(id,mesh)=>parts.push({id,...mesh});
 if(p.family==='spur'||p.family==='helical'){const beta=p.family==='helical'?p.gearHelixAngleRad:0;for(const [id,z,bore,helix] of [['pinion',p.gearPinionTeeth,p.gearShaftBoreM,beta],['wheel',p.gearWheelTeeth,p.gearMateShaftBoreM,-beta]]){add(id,cylindrical(p,z,bore,helix));profiles[id]=[profile({m:p.gearModuleM,z,alpha:p.gearPressureAngleRad,beta:helix,backlash:p.gearBacklashM}).map(([x,y])=>({x,y}))];}center=p.gearModuleM*(p.gearPinionTeeth+p.gearWheelTeeth)/(2*Math.cos(beta));}
 else if(p.family==='bevel'){add('pinion',bevel(p,p.gearPinionTeeth,p.gearWheelTeeth));add('wheel',bevel(p,p.gearWheelTeeth,p.gearPinionTeeth));}
 else if(p.family==='worm'){add('worm',worm(p));add('wheel',wormWheel(p));const beta=Math.asin(p.gearWormStarts*p.gearModuleM/p.gearWormDiameterM);center=(p.gearWormDiameterM+p.gearModuleM*p.gearWheelTeeth/Math.cos(beta))/2;}
 else{for(const [id,z] of [['sun',p.gearSunTeeth],['planet',p.gearPlanetTeeth]])add(id,cylindrical(p,z));const cavity=profile({m:p.gearModuleM,z:p.gearRingTeeth,alpha:p.gearPressureAngleRad,backlash:p.gearBacklashM,internal:true}),radius=Math.max(...cavity.map(norm))+p.gearRingRimThicknessM,outer=Array.from({length:128},(_,i)=>polar(radius/Math.cos(pi/128),tau*i/128));add('ring',extrudeRegion([outer,cavity],p.gearFaceWidthM));center=p.gearModuleM*(p.gearSunTeeth+p.gearPlanetTeeth)/2;}
 for(const part of parts)if(part.verticesM.length>250000||!part.verticesM.every(v=>v.length===3&&v.every(Number.isFinite)))throw Error('Browser mesh exceeds finite geometry limits.');
 return {status:'ok',moduleId:'module.mechanics.gear-geometry',moduleVersion:'0.2.0',modelId:'browser-bosl2-derived-'+p.family+'/1',params:p,outputs:{parts,profiles,gearCenterDistanceM:center,...(p.family==='planetary'?{kinematics:evaluatePlanetary(p).outputs}:{})},diagnostics:[],provenance:{BOSL2:'6cacf1b7d69a8a4bd383b5637586fec1c179c86f',engine:'browser-parametric',units:'m and radians',basis:'Nominal tessellated geometry; root/surface sampling differs from OpenSCAD. Not a cutter toolpath or manufacturing certification.'}};
}
