import * as THREE from '../vendor/three/build/three.module.js';

// Split render normals at sharp edges. Averaging a broad cap triangle with
// tiny tooth-side triangles produces radial lighting streaks on a flat face.
// The authoritative SI vertices and triangles remain unchanged.
export function gearRenderGeometry(data,crease=Math.PI/6){
 const adjacent=new Map(),keys=data.verticesM.map(p=>p.map(n=>Math.round(n*1e10)).join(',')),faceNormals=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 for(const triangle of data.triangles){
  a.fromArray(data.verticesM[triangle[0]]);b.fromArray(data.verticesM[triangle[1]]);c.fromArray(data.verticesM[triangle[2]]);
  const normal=b.sub(a).cross(c.sub(a)).normalize().clone();faceNormals.push(normal);
  for(const id of triangle){const key=keys[id];if(!adjacent.has(key))adjacent.set(key,[]);adjacent.get(key).push(normal);}
 }
 const positions=new Float32Array(data.triangles.length*9),normals=new Float32Array(positions.length),cutoff=Math.cos(crease),sum=new THREE.Vector3();let offset=0;
 data.triangles.forEach((triangle,i)=>{for(const id of triangle){positions.set(data.verticesM[id],offset);sum.set(0,0,0);for(const normal of adjacent.get(keys[id]))if(faceNormals[i].dot(normal)>=cutoff)sum.add(normal);sum.normalize().toArray(normals,offset);offset+=3;}});
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));return geometry;
}

// Fit every box corner in camera space, accounting for viewport aspect and
// depth. A fixed multiple of world-axis span clips narrow views and wastes
// most of a wide view. This changes only the view camera.
export function fitGearCamera(camera,bounds,aspect,direction=new THREE.Vector3(1,-1.2,1),points=null){
 const target=bounds.getCenter(new THREE.Vector3()),radius=bounds.getSize(new THREE.Vector3()).length()/2;
 camera.aspect=aspect;camera.position.copy(target).add(direction.clone().normalize());camera.lookAt(target);
 const inverse=camera.quaternion.clone().invert(),tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/1.15;let distance=0;
 const corners=points||[bounds.min.x,bounds.max.x].flatMap(x=>[bounds.min.y,bounds.max.y].flatMap(y=>[bounds.min.z,bounds.max.z].map(z=>new THREE.Vector3(x,y,z))));
 for(const corner of corners){
  const point=corner.clone().sub(target).applyQuaternion(inverse);distance=Math.max(distance,point.z+Math.abs(point.x)/(tan*aspect),point.z+Math.abs(point.y)/tan);
 }
 camera.position.copy(target).addScaledVector(direction.clone().normalize(),distance);camera.near=Math.max(radius/10000,1e-5);camera.far=Math.max(20,distance+20*radius);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 return {target,radius,distance};
}
