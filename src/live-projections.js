import * as THREE from '../vendor/three/build/three.module.js';

// Reuse the website's existing WebGL runtime for live depth testing. Printable
// projections still use the independent vector hidden-line query.
export function liveProjections(host,{scene,records,views,scale,center,update,geometries,meshes}){
 let renderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}catch{return null;}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xffffff,0);renderer.autoClear=false;
 const ns='http://www.w3.org/2000/svg',foreign=document.createElementNS(ns,'foreignObject');foreign.setAttribute('x','0');foreign.setAttribute('y','0');foreign.setAttribute('width','1000');foreign.setAttribute('height','390');foreign.dataset.liveProjection='webgl';renderer.domElement.style.cssText='width:100%;height:100%;display:block';foreign.append(renderer.domElement);host.prepend(foreign);
 const lineGeometries=[],lineMaterials=[],staticLines=[[],[]],staticSolids=[];
 for(const record of records){
  if(record.reference){
   // A face ribbon stays visible on small pinions where WebGL's fixed
   // one-pixel lines disappear among the outlines.
   const positions=[],box=record.mesh.geometry.boundingBox,halfWidth=Math.max(box.max.x*.025,1.1/scale);
   for(const edge of record.edges){const a=record.vertices[edge.u],b=record.vertices[edge.v],length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=-(b[1]-a[1])/length*halfWidth,dy=(b[0]-a[0])/length*halfWidth,corners=[[a[0]+dx,a[1]+dy,a[2]],[a[0]-dx,a[1]-dy,a[2]],[b[0]+dx,b[1]+dy,b[2]],[b[0]-dx,b[1]-dy,b[2]]];for(const i of [0,1,2,2,1,3])positions.push(...corners[i]);}
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));lineGeometries.push(geometry);const material=new THREE.MeshBasicMaterial({color:record.colour,side:THREE.DoubleSide,depthWrite:false});lineMaterials.push(material);const mark=new THREE.Mesh(geometry,material);mark.renderOrder=1;record.mesh.add(mark);continue;
  }
  const {mesh,vertices,edges}=record,positions=[],a=[],b=[],creases=[],distances=[];let distance=0;
  for(const edge of edges){const n=edge.normals[0]||[0,0,1],m=edge.normals[1]||n,dot=n.reduce((s,v,i)=>s+v*m[i],0),crease=edge.normals.length===1||dot<.87;if(!record.reference&&edge.normals.length>1&&dot>1-1e-8)continue;for(const index of [edge.u,edge.v]){positions.push(...vertices[index]);a.push(...n);b.push(...m);creases.push(crease?1:0);}distances.push(distance);distance+=Math.hypot(...vertices[edge.u].map((v,i)=>v-vertices[edge.v][i]));distances.push(distance);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('faceA',new THREE.Float32BufferAttribute(a,3));geometry.setAttribute('faceB',new THREE.Float32BufferAttribute(b,3));geometry.setAttribute('crease',new THREE.Float32BufferAttribute(creases,1));geometry.setAttribute('lineDistance',new THREE.Float32BufferAttribute(distances,1));lineGeometries.push(geometry);
  const material=new THREE.ShaderMaterial({uniforms:{colour:{value:new THREE.Color(record.colour||(record.context?'#849087':'#26392d'))},reference:{value:0},dash:{value:record.context?3/scale:0}},vertexShader:`attribute vec3 faceA;attribute vec3 faceB;attribute float crease;attribute float lineDistance;uniform float reference;varying float showEdge;varying float distanceAlong;void main(){float a=(normalMatrix*faceA).z;float b=(normalMatrix*faceB).z;showEdge=reference>0.5||(max(a,b)>0.00000001&&(crease>0.5||min(a,b)<=0.00000001))?1.0:0.0;distanceAlong=lineDistance;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`uniform vec3 colour;uniform float dash;varying float showEdge;varying float distanceAlong;void main(){if(showEdge<0.5)discard;if(dash>0.0&&mod(distanceAlong,dash*1.65)>dash)discard;gl_FragColor=vec4(colour,1.0);
   #include <colorspace_fragment>
  }`,depthTest:!record.context,depthWrite:false});lineMaterials.push(material);
  const lines=new THREE.LineSegments(geometry,material);lines.renderOrder=record.context?2:1;
  if(!(mesh.userData.drawingItem||'').startsWith('gear-')){staticLines[record.context?1:0].push({geometry,material,matrix:mesh.matrixWorld.clone()});if(!record.context)staticSolids.push(mesh);mesh.visible=false;}else mesh.add(lines);
  if(!record.reference){mesh.material.visible=!record.context;mesh.material.color.set(0xffffff);mesh.material.polygonOffset=true;mesh.material.polygonOffsetFactor=1;mesh.material.polygonOffsetUnits=1;}
 }
 // Hardware and shafts are stationary in this illustration. Batch them once
 // instead of issuing hundreds of separate draw calls for every camera.
 for(const entries of staticLines){if(!entries.length)continue;const arrays={position:[],faceA:[],faceB:[],crease:[],lineDistance:[]},v=new THREE.Vector3();let distance=0;
  for(const entry of entries){const normal=new THREE.Matrix3().getNormalMatrix(entry.matrix);for(const name of Object.keys(arrays)){const attribute=entry.geometry.getAttribute(name);for(let i=0;i<attribute.count;i++){if(name==='position'||name==='faceA'||name==='faceB'){v.fromBufferAttribute(attribute,i);if(name==='position')v.applyMatrix4(entry.matrix);else v.applyMatrix3(normal).normalize();arrays[name].push(v.x,v.y,v.z);}else arrays[name].push(attribute.getX(i)+(name==='lineDistance'?distance:0));}}distance=arrays.lineDistance.at(-1);}
  const geometry=new THREE.BufferGeometry();for(const [name,values] of Object.entries(arrays))geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,['crease','lineDistance'].includes(name)?1:3));lineGeometries.push(geometry);const lines=new THREE.LineSegments(geometry,entries[0].material);lines.renderOrder=entries[0].material.depthTest?1:2;scene.add(lines);
 }
 if(staticSolids.length){const positions=[],indices=[],v=new THREE.Vector3();for(const mesh of staticSolids){const attribute=mesh.geometry.getAttribute('position'),offset=positions.length/3;for(let i=0;i<attribute.count;i++){v.fromBufferAttribute(attribute,i).applyMatrix4(mesh.matrixWorld);positions.push(v.x,v.y,v.z);}for(const index of mesh.geometry.index.array)indices.push(index+offset);}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometries.push(geometry);scene.add(new THREE.Mesh(geometry,staticSolids[0].material));}
 const cameras=views.map(view=>{const c=new THREE.OrthographicCamera(-142/scale,142/scale,142/scale,-142/scale,.00001,100);c.position.copy(center).addScaledVector(view.normal,10);c.up.set(0,view.normal.y?0:1,view.normal.y?1:0);c.lookAt(center);return c;});
 let width=0,disposed=false,playing=false,visible=true,frame=0,last=0,time=0,frames=0;
 const draw=()=>{if(disposed)return;const started=performance.now();update(time);scene.updateMatrixWorld(true);renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);const factor=width/1000;views.forEach((view,i)=>{renderer.setViewport((view.x-142)*factor,51*factor,284*factor,284*factor);renderer.setScissor((view.x-142)*factor,51*factor,284*factor,284*factor);renderer.render(scene,cameras[i]);});host.dataset.viewTime=String(time);host.dataset.projectionFrames=String(++frames);host.dataset.frameCpuMs=String(performance.now()-started);};
 const resize=()=>{const next=Math.max(1,Math.round(host.getBoundingClientRect().width));if(next!==width){width=next;renderer.setSize(width,width*390/1000,false);draw();}};
 const tick=now=>{frame=0;if(disposed||!playing||!visible||document.hidden)return;if(!last||now-last>=1000/30){time+=last?(now-last)/1000:0;last=now;draw();}resume();};
 const resume=()=>{if(playing&&visible&&!document.hidden&&!frame&&!disposed)frame=requestAnimationFrame(tick);};
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible){cancelAnimationFrame(frame);frame=0;last=0;}else resume();});observer.observe(host);
 const visibility=()=>{last=0;if(document.hidden){cancelAnimationFrame(frame);frame=0;}else resume();};document.addEventListener('visibilitychange',visibility);const sizing=new ResizeObserver(resize);sizing.observe(host);resize();
 host.dataset.projectionCompute='webgl-depth';host.dataset.viewTime='0';
 return {play(value){playing=value;last=0;cancelAnimationFrame(frame);frame=0;resume();},dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();sizing.disconnect();document.removeEventListener('visibilitychange',visibility);lineGeometries.forEach(g=>g.dispose());lineMaterials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());meshes.forEach(m=>m.material.dispose());renderer.dispose();renderer.forceContextLoss();}};
}
