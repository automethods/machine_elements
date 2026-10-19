import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {validateGearRequest,evaluatePlanetary,MODULE_ID,MODULE_VERSION} from './index.mjs';
import {extrudeRegion} from './extrude-region.mjs';
const execute=promisify(execFile),base=path.dirname(fileURLToPath(import.meta.url));
const source=JSON.parse(await readFile(path.join(base,'vendor-sources.json'),'utf8'));
export function gearRequestKey(p){return createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(validateGearRequest(p)).sort(([a],[b])=>a.localeCompare(b))))).digest('hex');}
export function buildGearSCAD(request){
 const p=validateGearRequest(request),mm=x=>x*1000,deg=x=>x*180/Math.PI;
 const library=path.join(base,'vendor/BOSL2').replaceAll('\\','/');
 const lines=[`include <${library}/std.scad>`,`include <${library}/gears.scad>`,'$fn=32;'];
 const common=`mod=${mm(p.gearModuleM)},pressure_angle=${deg(p.gearPressureAngleRad)},backlash=${mm(p.gearBacklashM)}`;
 const part=(id,call)=>lines.push(`echo(["vmm-part","${id}",vnf_triangulate(${call})]);`);
 const meta=expression=>lines.push(`echo(["vmm-meta",${expression}]);`);
 if(['spur','helical'].includes(p.family)){
  const helix=p.family==='helical'?deg(p.gearHelixAngleRad):0;
  for(const [id,z,bore,beta] of [['pinion',p.gearPinionTeeth,p.gearShaftBoreM,helix],['wheel',p.gearWheelTeeth,p.gearMateShaftBoreM,-helix]]){
   part(id,`spur_gear(${common},teeth=${z},thickness=${mm(p.gearFaceWidthM)},shaft_diam=${mm(bore)},profile_shift=0,helical=${beta},gear_spin=-90,slices=${p.family==='spur'?1:8})`);
   lines.push(`echo(["vmm-profile","${id}",spur_gear2d(${common},teeth=${z},profile_shift=0,helical=${beta},gear_spin=-90)]);`);
  }
  meta(`gear_dist(${common},teeth1=${p.gearPinionTeeth},teeth2=${p.gearWheelTeeth},helical=${helix},profile_shift1=0,profile_shift2=0)`);
 }else if(p.family==='bevel'){
  for(const [id,z,mate] of [['pinion',p.gearPinionTeeth,p.gearWheelTeeth],['wheel',p.gearWheelTeeth,p.gearPinionTeeth]])part(id,`bevel_gear(${common},teeth=${z},mate_teeth=${mate},face_width=${mm(p.gearFaceWidthM)},shaft_angle=${deg(p.gearShaftAngleRad)},spiral=0,cutter_radius=0,anchor="apex",slices=8)`);
  meta('0');
 }else if(p.family==='worm'){
  part('worm',`worm(${common},d=${mm(p.gearWormDiameterM)},l=${mm(p.gearWormLengthM)},starts=${p.gearWormStarts})`);
  const wormArgs=`${common},teeth=${p.gearWheelTeeth},worm_diam=${mm(p.gearWormDiameterM)},worm_starts=${p.gearWormStarts},profile_shift=0`;
  lines.push(`worm_arc=root_find(function(a) worm_gear(${wormArgs},get_thickness=true,worm_arc=a)-${mm(p.gearFaceWidthM)},1,90);`);
  part('wheel',`worm_gear(${wormArgs},worm_arc=worm_arc,slices=12)`);
  meta(`worm_dist(${common},teeth=${p.gearWheelTeeth},d=${mm(p.gearWormDiameterM)},starts=${p.gearWormStarts},profile_shift=0)`);
 }else{
  for(const [id,z] of [['sun',p.gearSunTeeth],['planet',p.gearPlanetTeeth]])part(id,`spur_gear(${common},teeth=${z},thickness=${mm(p.gearFaceWidthM)},profile_shift=0,gear_spin=-90,slices=1)`);
  lines.push(`ring_cavity=spur_gear2d(${common},teeth=${p.gearRingTeeth},profile_shift=0,internal=true,gear_spin=-90);`);
  lines.push(`echo(["vmm-region","ring",[circle(r=(max([for(pt=ring_cavity[0]) norm(pt)])+${mm(p.gearRingRimThicknessM)})/cos(180/128),$fn=128),reverse(ring_cavity[0])]]);`);
  meta(`gear_dist(${common},teeth1=${p.gearSunTeeth},teeth2=${p.gearPlanetTeeth},profile_shift1=0,profile_shift2=0)`);
 }
 return {params:p,source:lines.join('\n')+'\n'};
}
export async function generateGearGeometry(request,{openscadPath=process.env.vmm_openscad||path.resolve(base,'../../tools/openscad-2021.01/squashfs-root/AppRun')}={}){
 const {params,source:scad}=buildGearSCAD(request),dir=await mkdtemp(path.join(tmpdir(),'vmm-gears-'));
 try{
  const input=path.join(dir,'geometry.scad'),output=path.join(dir,'geometry.echo');await writeFile(input,scad);
  const execution=await execute(openscadPath,['--hardwarnings','-o',output,input],{timeout:90000,maxBuffer:24*1024*1024});
  const text=await readFile(output,'utf8');
  if(/(?:ERROR|WARNING):/.test(text+'\n'+execution.stderr))throw Error('OpenSCAD rejected geometry: '+(text+'\n'+execution.stderr).slice(-1600));
  const parts=[],profiles={};let centerDistanceM;
  for(const line of text.split('\n')){
   if(!line.startsWith('ECHO: ["vmm-'))continue;
   const [tag,id,value]=JSON.parse(line.slice(6));
   if(tag==='vmm-meta'){centerDistanceM=id/1000;continue;}
   if(tag==='vmm-profile'){profiles[id]=value.map(region=>region.map(point=>({x:point[0]/1000,y:point[1]/1000})));continue;}
   if(tag==='vmm-region'){parts.push({id,...extrudeRegion(value.map(r=>r.map(p=>p.map(x=>x/1000))),params.gearFaceWidthM)});continue;}
   const [vertices,triangles]=value;
   if(!vertices.length||vertices.length>250000||!vertices.every(v=>v.length===3&&v.every(Number.isFinite))||!triangles.length||!triangles.every(t=>t.length===3&&t.every(i=>Number.isInteger(i)&&i>=0&&i<vertices.length)))throw Error('Invalid BOSL2 triangle mesh.');
   // BOSL2/OpenSCAD faces are clockwise; browser meshes use outward CCW faces.
   parts.push({id,verticesM:vertices.map(v=>v.map(x=>x/1000)),triangles:triangles.map(([a,b,c])=>[a,c,b])});
  }
  if(parts.length!==(params.family==='planetary'?3:2)||!Number.isFinite(centerDistanceM))throw Error('Incomplete BOSL2 geometry output.');
  return {status:'ok',moduleId:MODULE_ID,moduleVersion:MODULE_VERSION,modelId:'bosl2-'+params.family+'/1',params,outputs:{parts,profiles,gearCenterDistanceM:centerDistanceM,...(params.family==='planetary'?{kinematics:evaluatePlanetary(params).outputs}:{})},diagnostics:[],provenance:{BOSL2:source.sources.find(s=>s.name==='BOSL2').commit,PlanetaryGears:source.sources.find(s=>s.name==='PlanetaryGears').commit,units:'BOSL2 mm/degrees → m/radians at this boundary; OpenSCAD echo has six significant digits',triangleWinding:'CCW viewed from outside; converted from clockwise BOSL2 VNF',basis:'Nominal reference geometry, not a load-capacity calculation or manufacturing certification'}};
 }finally{await rm(dir,{recursive:true,force:true});}
}
