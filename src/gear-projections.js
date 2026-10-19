import * as THREE from '../vendor/three/build/three.module.js';
import {assembleGearScene} from './gear-assembly-scene.js';
import {gearAssembly} from './gear-geometry.js';
import {loadGearGeometry,pairRequest} from './cad-geometry.js';
import {hiddenLinePaths} from './hidden-lines.js';
import {formatNumber} from './precision.js';
import {liveProjections} from './live-projections.js';

// Orthographic projections of the same immutable parts and assembly transforms
// used by the WebGL view. Time and drawing state never become model inputs.
const NS='http://www.w3.org/2000/svg';
const element=(name,attrs={})=>{const e=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
const shaftColours=['#b45309','#2563eb','#9333ea'];
function rotationReferences(records){
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),ray=new THREE.Raycaster(),references=[];
 for(const {mesh} of records){
  const id=mesh.userData.drawingItem,match=/^gear-(\d+)-(pinion|wheel|sun)$/.exec(id||'');if(!match||mesh.userData.constructedHub)continue;
  const shaft=Number(match[1])-(match[2]==='wheel'?0:1),geometry=mesh.geometry;geometry.computeBoundingBox();const box=geometry.boundingBox,radius=Math.max(Math.abs(box.min.x),Math.abs(box.max.x)),probe=new THREE.Mesh(geometry,material),vertices=[],edges=[];
  // Sample the real faces once. The marks follow the mesh transform and
  // pass through the same occlusion test as the outlines in every view.
  for(const sign of [-1,1])for(const angle of [.6,.6+Math.PI]){let previous=null;for(let i=0;i<=10;i++){
   const r=radius*(.55+.4*i/10),x=r*Math.cos(angle),y=r*Math.sin(angle);ray.set(new THREE.Vector3(x,y,sign>0?box.max.z+.001:box.min.z-.001),new THREE.Vector3(0,0,-sign));const hit=ray.intersectObject(probe,false)[0];
   if(!hit){previous=null;continue;}const index=vertices.length;vertices.push([x,y,hit.point.z+sign*.000001]);if(previous!==null)edges.push({u:previous,v:index,normals:[]});previous=index;
  }}
  if(edges.length)references.push({mesh,vertices,edges,triangles:[],reference:true,colour:shaftColours[shaft],shaft});
 }
 material.dispose();return references;
}
const indexed=(symbol,index)=>symbol+'<tspan baseline-shift="sub" font-size="9">'+index+'</tspan>';
function referenceLegend(model){return Array.from({length:model.inputs.stages+1},(_,i)=>{
 const final=i===model.inputs.stages,name=i===0?'Вхідний':final?'Вихідний':'Проміжний',n=indexed('n',i+1),n0=indexed('n',1),ratio=model.result.numbers.n_0/model.result.numbers[final?'n_out':'n_'+i],reduction=final&&i===2?'('+indexed('u',1)+'·'+indexed('u',2)+')':indexed('u',1);
 return {x:model.inputs.stages===1?330+i*340:210+i*290,colour:shaftColours[i],label:name+' · '+(i===0?n0:n+'/'+n0+' = 1/'+reduction+' = 1/'+formatNumber(ratio))};
});}
function topology(geometry){
 const positions=geometry.attributes.position.array,indices=geometry.index.array,vertices=[],map=new Map(),remap=[];
 for(let i=0;i<positions.length;i+=3){const p=[positions[i],positions[i+1],positions[i+2]],key=p.map(n=>Math.round(n*1e8)).join(',');if(!map.has(key)){map.set(key,vertices.length);vertices.push(p);}remap.push(map.get(key));}
 const edges=new Map(),triangles=[];
 for(let i=0;i<indices.length;i+=3){const ids=[remap[indices[i]],remap[indices[i+1]],remap[indices[i+2]]],a=vertices[ids[0]],b=vertices[ids[1]],c=vertices[ids[2]],ab=b.map((n,j)=>n-a[j]),ac=c.map((n,j)=>n-a[j]),normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],length=Math.hypot(...normal);if(length<1e-18)continue;normal.forEach((n,j)=>normal[j]=n/length);
  triangles.push(ids);for(let j=0;j<3;j++){const u=ids[j],v=ids[(j+1)%3],key=u<v?u+','+v:v+','+u;if(!edges.has(key))edges.set(key,{u,v,normals:[]});edges.get(key).normals.push(normal);}
 }
 return {vertices,triangles,edges:[...edges.values()]};
}
function projectionScene(model,packets,{includeEdges=true}={}){
 const pairs=gearAssembly(model),requests=pairs.map((p,i)=>pairRequest(p,model,i));
 const scene=new THREE.Scene(),geometries=[],meshes=[];
 const add=geometry=>{geometries.push(geometry);const mesh=new THREE.Mesh(geometry);scene.add(mesh);meshes.push(mesh);return mesh;};
 const part=(packet,id)=>{const p=packet.outputs.parts.find(p=>p.id===id),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.verticesM.flat(),3));g.setIndex(p.triangles.flat());return add(g);};
 const update=assembleGearScene({scene,add,part},model,pairs,packets,requests);update(0);scene.updateMatrixWorld(true);
 if(!includeEdges)return {geometries,meshes};
 const records=meshes.map(mesh=>({mesh,context:/^(?:input|intermediate|output)-shaft-/.test(mesh.userData.drawingItem||''),...topology(mesh.geometry)})),box=new THREE.Box3().setFromObject(scene),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),span=Math.max(size.x,size.y,size.z),scale=Math.min(260/span,260/Math.max(size.x,size.y));
 const views=[{x:165,title:'Зі сторони входу',normal:new THREE.Vector3(0,0,1),project:p=>[p.x-center.x,-(p.y-center.y)]},{x:500,title:'План збірки',normal:new THREE.Vector3(0,-1,0),project:p=>[p.x-center.x,-(p.z-center.z)]},{x:835,title:'Зі сторони виходу',normal:new THREE.Vector3(0,0,-1),project:p=>[-(p.x-center.x),-(p.y-center.y)]}];
 return {scene,records,views,scale,center,update,geometries,meshes};
}
function projectedPath(record,view,scale){
 const normalMatrix=new THREE.Matrix3().setFromMatrix4(record.mesh.matrixWorld).transpose(),local=view.normal.clone().applyMatrix3(normalMatrix).normalize(),vertex=new THREE.Vector3(),{mesh,vertices,edges}=record,dots=n=>n[0]*local.x+n[1]*local.y+n[2]*local.z,projected=vertices.map(p=>{vertex.fromArray(p).applyMatrix4(mesh.matrixWorld);return view.project(vertex).map(n=>(n*scale).toFixed(2)).join(' ');});let d='';
 for(const e of edges){const front=e.normals.map(dots),silhouette=front.some(n=>n>1e-8)&&front.some(n=>n<=1e-8),crease=e.normals.length===1||e.normals.length>1&&e.normals[0].reduce((s,n,i)=>s+n*e.normals[1][i],0)<.87;if(silhouette||(crease&&front.some(n=>n>1e-8)))d+='M'+projected[e.u]+'L'+projected[e.v];}return d;
}
function projectedParts(records,view,scale){
 const vertex=new THREE.Vector3();
 return records.map(record=>{
  const local=view.normal.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(record.mesh.matrixWorld).transpose()).normalize(),dot=n=>n[0]*local.x+n[1]*local.y+n[2]*local.z;
  return {points:record.vertices.map(p=>{vertex.fromArray(p).applyMatrix4(record.mesh.matrixWorld);return [...view.project(vertex).map(n=>n*scale),vertex.dot(view.normal)*scale];}),triangles:record.context?[]:record.triangles,context:record.context,edges:record.edges.filter(e=>{if(record.reference)return true;const front=e.normals.map(dot),silhouette=front.some(n=>n>1e-8)&&front.some(n=>n<=1e-8),crease=e.normals.length===1||e.normals.length>1&&e.normals[0].reduce((s,n,i)=>s+n*e.normals[1][i],0)<.87;return silhouette||(crease&&front.some(n=>n>1e-8));}).map(e=>[e.u,e.v])};
 });
}
const visiblePaths=(records,view,scale)=>hiddenLinePaths(projectedParts(records,view,scale));
export function snapshotProjections(model,packets){
 const {records,views,scale,geometries,meshes}=projectionScene(model,packets);
 records.push(...rotationReferences(records));
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 390" data-projection-source="assembled-bosl2" data-hidden-lines="removed" data-bearing-covers="dashed-transparent" data-metres-to-svg="${scale}" color="black">${views.map((v,i)=>`<text x="${v.x}" y="28" text-anchor="middle" font-size="17">${v.title}</text><g data-projection="${['left','top','right'][i]}" transform="translate(${v.x} 197)">${visiblePaths(records,v,scale).map((d,j)=>`<path d="${d}" fill="none" stroke="${records[j].colour||(records[j].context?'#849087':'currentColor')}" stroke-width="${records[j].reference?1.5:.85}"${records[j].context?' stroke-dasharray="3 2"':''}/>`).join('')}</g>`).join('')}${referenceLegend(model).map(l=>`<text x="${l.x}" y="351" text-anchor="middle" fill="${l.colour}" font-size="12">${l.label}</text>`).join('')}</svg>`;geometries.forEach(g=>g.dispose());meshes.forEach(m=>m.material.dispose());return svg;
}
export function prepareConstruction(model,packets){
 const {geometries,meshes}=projectionScene(model,packets,{includeEdges:false});geometries.forEach(g=>g.dispose());meshes.forEach(m=>m.material.dispose());
}
// Drawing dimensions are construction queries over the accepted assembly.
// They never change a native input, the mesh packets or animation state.
export function assemblyDrawingData(model,packets){
 const {records,views,geometries,meshes}=projectionScene(model,packets),p=model.inputs,gearBox=new THREE.Box3();
 for(const record of records.filter(r=>r.mesh.userData.gearPart))gearBox.union(new THREE.Box3().setFromObject(record.mesh));
 const inner=gearBox.clone().expandByScalar(p.housingClearance),outer=inner.clone().expandByScalar(p.housingWall);outer.min.y-=p.housingBase;
 const casingEnvelope=outer.clone();for(const record of records.filter(r=>/-bearing-[AB]$/.test(r.mesh.userData.drawingItem)))casingEnvelope.union(new THREE.Box3().setFromObject(record.mesh).expandByScalar(p.housingWall));
 const corners=box=>[0,1].flatMap(x=>[0,1].flatMap(y=>[0,1].map(z=>new THREE.Vector3(x?box.max.x:box.min.x,y?box.max.y:box.min.y,z?box.max.z:box.min.z))));
 const extent=points=>({min:[Math.min(...points.map(q=>q[0])),Math.min(...points.map(q=>q[1]))],max:[Math.max(...points.map(q=>q[0])),Math.max(...points.map(q=>q[1]))]});
 const oilY=inner.min.y+p.oilLevelHeight;
 if(oilY>=inner.max.y)throw Error('Рівень оливи перевищує висоту порожнини корпусу. Зменште висоту оливи.');
 const projected=views.map((view,i)=>{
  const project=point=>view.project(point).map(v=>v*1000),parts=records.map(record=>{
   const vertex=new THREE.Vector3(),points=record.vertices.map(v=>project(vertex.fromArray(v).applyMatrix4(record.mesh.matrixWorld))),bounds=extent(points);
   const left=points.reduce((a,b)=>b[0]<a[0]?b:a),right=points.reduce((a,b)=>b[0]>a[0]?b:a);
   return {key:record.mesh.userData.drawingItem,path:projectedPath(record,view,1000),bounds,left,right};
  }),housing={inner:extent(corners(inner).map(project)),outer:extent(corners(outer).map(project))},bounds=extent([...parts.flatMap(part=>[part.bounds.min,part.bounds.max]),...corners(casingEnvelope).map(project)]);
  return {id:['left','top','right'][i],title:view.title,parts,housing,bounds,oilY:i===1?null:project(new THREE.Vector3(inner.min.x,oilY,inner.min.z))[1]};
 });
 geometries.forEach(g=>g.dispose());meshes.forEach(m=>m.material.dispose());
 return {views:projected,dimensionsM:casingEnvelope.getSize(new THREE.Vector3()).toArray(),oilLevelHeightM:p.oilLevelHeight,oilImmersionM:oilY-gearBox.min.y};
}
export async function createGearProjections(host,model){
 const pairs=gearAssembly(model),packets=await Promise.all(pairs.map((p,i)=>loadGearGeometry(pairRequest(p,model,i))));if(!host.isConnected)return null;
 const prepared=projectionScene(model,packets),{scene,records,views,scale,update,geometries,meshes}=prepared; host.replaceChildren();host.setAttribute('viewBox','0 0 1000 390');host.dataset.projectionSource='assembled-bosl2';host.dataset.surfaceSource=packets.some(p=>p.provenance.engine==='browser-parametric')?'browser-parametric':'BOSL2';host.dataset.ready='true';host.dataset.bearingCovers='dashed-transparent';
 records.push(...rotationReferences(records));
 const drawing=[];host.dataset.hiddenLines='removed';
 views.forEach((view,i)=>{const title=element('text',{x:view.x,y:28,'text-anchor':'middle','font-size':17});title.textContent=view.title;host.append(title);const group=element('g',{'data-projection':i===0?'left':i===1?'top':'right','data-layout':'assembled',transform:`translate(${view.x} 197)`});host.append(group);group.append(element('path',{d:'M-142 0H142','stroke-dasharray':'8 3 1 3',stroke:'#809087','stroke-width':.6,fill:'none'}));for(const record of records){const path=element('path',{fill:'none',stroke:record.colour||(record.context?'#849087':'#26392d'),'stroke-width':record.reference?1.5:.85,'stroke-linejoin':'round',...(record.context?{'data-bearing-context':record.mesh.userData.drawingItem,'stroke-dasharray':'3 2'}:{}),...(record.reference?{'data-rotation-reference':record.mesh.userData.drawingItem,'data-shaft':record.shaft}:{})});group.append(path);drawing.push({view,record,path});}});
 for(const l of referenceLegend(model)){const text=element('text',{x:l.x,y:351,'text-anchor':'middle',fill:l.colour,'font-size':12,'data-rotation-legend':''});text.innerHTML=l.label;host.append(text);}
 const note=element('text',{x:500,y:372,'text-anchor':'middle','font-size':13});note.textContent='Спільний масштаб · опори й кріплення — прозорим штриховим контуром';host.append(note);
 const live=liveProjections(host,prepared);if(live)return {geometry:packets,...live};
 const worker=new Worker(new URL('./projection-worker.js',import.meta.url),{type:'module'});host.dataset.projectionCompute='worker';let pending;
 worker.onmessage=({data})=>{if(data.error)pending?.reject(Error(data.error));else pending?.resolve(data.paths);pending=null;};
 worker.onerror=event=>{event.preventDefault();pending?.reject(Error(event.message||'Не вдалося обчислити проєкції.'));pending=null;};
 let disposed=false,playing=false,visible=true,frame=0,last=0,time=0,busy=false,motionRevision=0;
 async function draw(time){
  const revision=motionRevision;busy=true;update(time);scene.updateMatrixWorld(true);
  try{const paths=await new Promise((resolve,reject)=>{pending={resolve,reject};worker.postMessage(views.map(view=>projectedParts(records,view,scale)));});if(disposed||!host.isConnected||revision!==motionRevision)return;host.dataset.viewTime=String(time);views.forEach((view,j)=>drawing.filter(d=>d.view===view).forEach((d,i)=>d.path.setAttribute('d',paths[j][i])));}
  finally{busy=false;}
 }
 try{await draw(0);}catch(error){worker.terminate();geometries.forEach(g=>g.dispose());meshes.forEach(m=>m.material.dispose());throw error;}
 const tick=async now=>{frame=0;if(disposed||busy||!playing||!visible||document.hidden)return;try{if(!last||now-last>=125){if(last)time+=Math.min((now-last)/1000,.25);last=now;await draw(time);}resume();}catch(error){playing=false;host.dataset.projectionError=error.message;}};
 const resume=()=>{if(playing&&visible&&!document.hidden&&!frame&&!busy&&!disposed)frame=requestAnimationFrame(tick);};
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible){cancelAnimationFrame(frame);frame=0;}else resume();});observer.observe(host);
 const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else resume();};document.addEventListener('visibilitychange',visibility);
 return {geometry:packets,play(value){motionRevision++;playing=value;last=0;cancelAnimationFrame(frame);frame=0;resume();},dispose(){disposed=true;worker.terminate();pending?.resolve([]);pending=null;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);geometries.forEach(g=>g.dispose());meshes.forEach(m=>m.material.dispose());}};
}
