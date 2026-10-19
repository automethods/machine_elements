import * as THREE from '../vendor/three/build/three.module.js';
import {evaluatePlanetary} from '../vendor/technical-modules/gear-geometry/index.mjs';
import {buildConstruction} from './construction.js';
import {bearings} from './catalogues.js';
import {partManufacturing} from './manufacturing.js';

export function assembleGearScene({scene,add,part},model,pairs,packets,requests,host={dataset:{}}){
  const updates=[],frames=[],spacing=Math.max(...pairs.map(p=>p.widthM))+.03,axis=new THREE.Vector3(0,0,1);
  let origin=new THREE.Vector3(),orientation=new THREE.Quaternion(),speed=1;
  const shaft=(center,q,length,radius,itemKey)=>{const mesh=add(new THREE.CylinderGeometry(radius,radius,length,24),'steel');mesh.userData.drawingItem=itemKey;mesh.position.copy(center);mesh.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2));return mesh;};
  const extent=(box,d)=>{const values=[0,1].flatMap(x=>[0,1].flatMap(y=>[0,1].map(z=>new THREE.Vector3(x?box.max.x:box.min.x,y?box.max.y:box.min.y,z?box.max.z:box.min.z).dot(d))));return [Math.min(...values),Math.max(...values)];};
  const seatZ=(pair,packet,id)=>{if(pair.type!==1)return 0;const z=packet.outputs.parts.find(p=>p.id===id).verticesM.map(v=>v[2]);return (Math.min(...z)+Math.max(...z))/2;};
  pairs.forEach((pair,index)=>{
   const packet=packets[index],request=requests[index],group=new THREE.Group();scene.add(group);group.position.copy(origin);group.quaternion.copy(orientation);
   const mesh=(id,color)=>{const m=part(packet,id,color);m.userData.drawingItem=`gear-${pair.stage}-${id}`;m.userData.gearPart=true;group.add(m);
    const data=packet.outputs.parts.find(p=>p.id===id),spec=partManufacturing(model,{pair,part:data});
    if(spec.hubDiameterM){const inner=spec.boreM/2,outer=spec.hubDiameterM/2,half=spec.hubExtensionM/2,profile=[new THREE.Vector2(inner,-half),new THREE.Vector2(outer,-half),new THREE.Vector2(outer,half),new THREE.Vector2(inner,half),new THREE.Vector2(inner,-half)],hub=add(new THREE.LatheGeometry(profile,48),color);hub.userData.drawingItem=m.userData.drawingItem;hub.userData.gearPart=true;hub.userData.constructedHub=true;hub.rotation.x=Math.PI/2;hub.position.z=spec.hubCenterZM;m.add(hub);}
    return m;};
   const spin=(m,base,rate,phase=0)=>{const update=t=>m.quaternion.copy(base).multiply(new THREE.Quaternion().setFromAxisAngle(axis,phase+t*Math.PI/4*rate));update(0);updates.push(update);};
   let outputOffset=new THREE.Vector3(),outputRotation=new THREE.Quaternion(),outputSpeed=-speed/pair.ratio;
   if(pair.type===3){
    const sun=mesh('sun','green'),ring=mesh('ring','steel'),planets=Array.from({length:pair.planetCount},()=>mesh('planet','pale'));
    const arms=planets.map(()=>{const a=add(new THREE.BoxGeometry(pair.centerDistanceM,request.gearModuleM*2,request.gearModuleM),'steel');a.userData.drawingItem=`gear-${pair.stage}-carrier`;group.add(a);return a;});
    const inputSpeed=speed;host.dataset.motionSource='McCracken';
    updates.push(t=>{const motion=evaluatePlanetary({...request,gearSunAngularSpeedRadPerS:Math.PI/4*inputSpeed,gearViewTimeS:t}).outputs;sun.rotation.z=motion.sunAngleRad;ring.rotation.z=0;motion.planets.forEach((p,i)=>{planets[i].position.set(pair.centerDistanceM*Math.cos(p.orbitAngleRad),pair.centerDistanceM*Math.sin(p.orbitAngleRad),0);planets[i].rotation.z=p.angleRad;arms[i].position.set(pair.centerDistanceM/2*Math.cos(p.orbitAngleRad),pair.centerDistanceM/2*Math.sin(p.orbitAngleRad),-pair.widthM/2-request.gearModuleM);arms[i].rotation.z=p.orbitAngleRad;});host.dataset.carrierAngle=String(motion.carrierAngleRad);});
    outputSpeed=speed/pair.ratio;outputOffset.z=pair.widthM;
   }else if(pair.type===2){
    const worm=mesh('worm','green'),wheel=mesh('wheel','pale');outputOffset.x=-pair.centerDistanceM;outputRotation.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);wheel.position.copy(outputOffset);spin(worm,new THREE.Quaternion(),speed);spin(wheel,outputRotation,outputSpeed);
   }else{
    const pinion=mesh('pinion','green'),wheel=mesh('wheel','pale');
    if(pair.type===1)outputRotation.setFromAxisAngle(new THREE.Vector3(1,0,0),pair.shaftAngleRad);else outputOffset.x=pair.centerDistanceM;
    wheel.position.copy(outputOffset);spin(pinion,new THREE.Quaternion(),speed);spin(wheel,outputRotation,outputSpeed,pair.type===1?Math.PI/pair.wheel.teeth:Math.PI-Math.PI/pair.wheel.teeth);
   }
   // Separate the complete stage envelopes, including bevel cones and hubs.
   // A face-width-only offset can put the next cone through the preceding gear.
   updates.forEach(update=>update(0));scene.updateMatrixWorld(true);
   if(index){const previous=frames.at(-1),d=previous.direction,previousMax=extent(new THREE.Box3().setFromObject(previous.group),d)[1]-previous.outOrigin.dot(d),nextMin=extent(new THREE.Box3().setFromObject(group),d)[0]-origin.dot(d),distance=Math.max(spacing,previousMax-nextMin+.03);origin.addScaledVector(d,distance);group.position.copy(origin);}
   const outOrigin=outputOffset.clone().applyQuaternion(orientation).add(origin),outOrientation=orientation.clone().multiply(outputRotation),direction=axis.clone().applyQuaternion(outOrientation);
   const inputSeat=origin.clone().addScaledVector(axis.clone().applyQuaternion(orientation),seatZ(pair,packet,'pinion')),outputSeat=outOrigin.clone().addScaledVector(direction,seatZ(pair,packet,'wheel'));
   group.userData.stage=pair.stage;frames.push({group,origin:origin.clone(),orientation:orientation.clone(),orientationDirection:axis.clone().applyQuaternion(orientation),outOrigin,outOrientation,direction,inputSeat,outputSeat});
   origin=outOrigin.clone();orientation=outOrientation;speed=outputSpeed;
  });
  const construction=buildConstruction(model,pairs,packets,frames);
  for(const spec of construction.shafts){
   const origin=new THREE.Vector3().fromArray(spec.originM),q=new THREE.Quaternion().fromArray(spec.orientation),d=new THREE.Vector3().fromArray(spec.direction),point=x=>origin.clone().addScaledVector(d,x-spec.referenceStationM);
   for(const section of spec.sections)shaft(point((section.startM+section.endM)/2),q,section.endM-section.startM,section.diameterM/2,spec.id);
   const ring=(start,end,inner,outer,key,color='steel')=>{const half=(end-start)/2,profile=[new THREE.Vector2(inner/2,-half),new THREE.Vector2(outer/2,-half),new THREE.Vector2(outer/2,half),new THREE.Vector2(inner/2,half),new THREE.Vector2(inner/2,-half)],mesh=add(new THREE.LatheGeometry(profile,24),color);mesh.userData.drawingItem=key;mesh.position.copy(point((start+end)/2));mesh.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2));return mesh;};
   
   for(const h of spec.hardware){
    if(h.kind==='key'){const mesh=add(new THREE.BoxGeometry(h.widthM,h.heightM,h.endM-h.startM),'steel');mesh.userData.drawingItem=h.id;mesh.position.copy(point((h.startM+h.endM)/2)).add(new THREE.Vector3(0,h.innerDiameterM/2,0).applyQuaternion(q));mesh.quaternion.copy(q);continue;}
    if(h.kind==='cover-bolt'){for(let i=0;i<4;i++){const mesh=shaft(point((h.startM+h.endM)/2).add(new THREE.Vector3(Math.cos(i*Math.PI/2),Math.sin(i*Math.PI/2),0).multiplyScalar((spec.bearing.outerDiameterM+.012)/2).applyQuaternion(q)),q,h.endM-h.startM,.003,h.id);mesh.userData.fixed=true;}continue;}
    if(h.bores?.length)for(const b of h.bores)ring(b.startM,b.endM,b.diameterM,h.outerDiameterM,h.id);else ring(h.startM,h.endM,h.innerDiameterM,h.outerDiameterM,h.id,h.kind==='seal'?'green':'steel');
   }
  }
  return t=>updates.forEach(update=>update(t));

}

