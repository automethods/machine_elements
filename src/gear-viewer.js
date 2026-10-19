import * as THREE from '../vendor/three/build/three.module.js';
import {OrbitControls} from '../vendor/three/examples/jsm/controls/OrbitControls.js';
import {gearAssembly} from './gear-geometry.js';
import {loadGearGeometry,pairRequest} from './cad-geometry.js';
import {exampleGearRequest,evaluatePlanetary} from '../vendor/technical-modules/gear-geometry/index.mjs';
import {assembleGearScene} from './gear-assembly-scene.js';
import {gearRenderGeometry,fitGearCamera} from './gear-view-geometry.js';

// Camera and elapsed time belong to this view. Frames never change calculation
// inputs, native values, project history or the shared geometry packets.
function createScene(host,assemble){
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xf5f8f3);host.replaceChildren(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.001,20),controls=new OrbitControls(camera,renderer.domElement),geometries=[],materials=[];
 const material=color=>{const m=new THREE.MeshStandardMaterial({color,metalness:.25,roughness:.6});materials.push(m);return m;};
 const colors={green:material(0x54775b),pale:material(0xb5c9ac),steel:material(0x89938e)};
 const add=(geometry,color='green')=>{geometries.push(geometry);const mesh=new THREE.Mesh(geometry,colors[color]);scene.add(mesh);return mesh;};
 const part=(packet,id,color)=>{const data=packet.outputs.parts.find(p=>p.id===id);if(!data)throw Error('Відсутня деталь '+id);return add(gearRenderGeometry(data),color);};
 const update=assemble({scene,add,part});update(0);
 const bounds=new THREE.Box3().setFromObject(scene),target=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),span=Math.max(size.x,size.y,size.z);
 const fitPoints=[];scene.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])fitPoints.push(new THREE.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld));});
 const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(target.x-span,target.y-span,target.z+span);scene.add(light,new THREE.HemisphereLight(0xffffff,0x425a45,2));
 controls.target.copy(target);controls.enableDamping=false;
 let frame=0,last=0,timeS=0,playing=false,disposed=false,visible=true;
 const render=()=>{if(!disposed&&visible)renderer.render(scene,camera);};
 const fit=()=>{const result=fitGearCamera(camera,bounds,camera.aspect,undefined,fitPoints);controls.target.copy(result.target);controls.minDistance=result.radius*.2;controls.maxDistance=result.distance*8;controls.update();render();};
 const resize=()=>{if(disposed)return;const width=host.clientWidth,height=Math.max(260,Math.min(480,width*.6));renderer.setSize(width,height,false);camera.aspect=width/height;fit();};
 const tick=time=>{frame=0;if(disposed||!playing||!visible||document.hidden)return;timeS+=last?Math.min((time-last)/1000,.05):0;last=time;update(timeS);host.dataset.viewTime=String(timeS);render();frame=requestAnimationFrame(tick);};
 const resume=()=>{last=0;if(playing&&visible&&!document.hidden&&!frame)frame=requestAnimationFrame(tick);};
 const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else resume();};
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible){cancelAnimationFrame(frame);frame=0;}else {render();resume();}});observer.observe(host);
 controls.addEventListener('change',render);document.addEventListener('visibilitychange',visibility);const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();
 host.dataset.ready='true';host.dataset.geometrySource||='BOSL2';host.dataset.viewTime='0';
 return {fit,play(value){playing=value;cancelAnimationFrame(frame);frame=0;resume();},dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();resizeObserver.disconnect();document.removeEventListener('visibilitychange',visibility);controls.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();}};
}

export async function createGearViewer(host,model){
 const pairs=gearAssembly(model);host.textContent='Готуємо геометрію зубців BOSL2…';
 const requests=pairs.map((p,i)=>pairRequest(p,model,i)),packets=await Promise.all(requests.map(loadGearGeometry));
 if(!host.isConnected)return null;
 packets.forEach((packet,i)=>{if(Math.abs(packet.outputs.gearCenterDistanceM-pairs[i].centerDistanceM)>Math.max(1e-7,pairs[i].centerDistanceM*2e-5))throw Error('Геометрія BOSL2 не збігається з міжосьовою відстанню розрахунку.');});
 host.dataset.family='current';host.dataset.gearboxType=String(model.inputs.gearboxType);host.dataset.geometrySource=packets.some(p=>p.provenance.engine==='browser-parametric')?'browser-parametric':'BOSL2';
 return createScene(host,context=>assembleGearScene(context,model,pairs,packets,requests,host));
}

export async function createExampleGearViewer(host,family){
 const request=exampleGearRequest(family);host.textContent='Готуємо геометричний приклад BOSL2…';
 const packet=await loadGearGeometry(request);if(!host.isConnected)return null;host.dataset.family=family;host.dataset.geometrySource=packet.provenance.engine||'BOSL2';
 return createScene(host,({add,part})=>{
  const distance=packet.outputs.gearCenterDistanceM,omega=Math.PI/4;
  if(family==='planetary'){
   const sun=part(packet,'sun','green'),ring=part(packet,'ring','steel'),planets=Array.from({length:request.gearPlanetCount},()=>part(packet,'planet','pale'));
   const arms=planets.map(()=>add(new THREE.BoxGeometry(distance,request.gearModuleM*2,request.gearModuleM),'steel'));
   host.dataset.motionSource='McCracken';
   return timeS=>{const motion=evaluatePlanetary({...request,gearViewTimeS:timeS}).outputs;sun.rotation.z=motion.sunAngleRad;ring.rotation.z=motion.ringAngleRad;motion.planets.forEach((p,i)=>{planets[i].position.set(distance*Math.cos(p.orbitAngleRad),distance*Math.sin(p.orbitAngleRad),0);planets[i].rotation.z=p.angleRad;arms[i].position.set(distance/2*Math.cos(p.orbitAngleRad),distance/2*Math.sin(p.orbitAngleRad),-request.gearFaceWidthM/2-request.gearModuleM);arms[i].rotation.z=p.orbitAngleRad;});host.dataset.carrierAngle=String(motion.carrierAngleRad);};
  }
  if(family==='worm'){
   const worm=part(packet,'worm','green'),wheel=part(packet,'wheel','pale');worm.rotation.x=-Math.PI/2;worm.rotation.order='XYZ';wheel.position.x=-distance;
   // Same orientations and rotation signs as BOSL2's meshing-worm example.
   return timeS=>{worm.rotation.z=timeS*omega;wheel.rotation.z=-timeS*omega*request.gearWormStarts/request.gearWheelTeeth;};
  }
  const pinion=part(packet,'pinion','green'),wheel=part(packet,'wheel','pale'),ratio=request.gearPinionTeeth/request.gearWheelTeeth;
  if(family==='bevel'){wheel.rotation.x=request.gearShaftAngleRad;wheel.rotation.order='XYZ';}
  else wheel.position.x=distance;
  const phase=family==='bevel'?Math.PI/request.gearWheelTeeth:Math.PI-Math.PI/request.gearWheelTeeth;
  return timeS=>{pinion.rotation.z=timeS*omega;wheel.rotation.z=phase-timeS*omega*ratio;};
 });
}
